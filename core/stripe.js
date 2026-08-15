// core/stripe.js - Stripe payment integration
import { configManager } from './config.js';
import { errorHandler } from './error-handler.js';

/**
 * Stripe Service for payment processing
 * Handles product creation, payment intents, and invoice generation
 * Securely communicates with `/api/stripe-proxy` to avoid secret key exposure in client-side code.
 */
export class StripeService {
  constructor() {
    this.publishableKey = configManager.current.stripe?.publishableKey || null;
  }

  /**
   * Helper to retrieve authenticated headers with Firebase IdToken or simulated fallback
   */
  async getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      const { auth } = await import('./auth.js');
      if (auth?.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      } else {
        const { store } = await import('./store.js');
        const user = store.state.user;
        const currentRole = store.state.simulatedUserTier || user?.role || 'admin';
        const email = user?.email || 'admin@example.com';
        headers['Authorization'] = `Bearer mock_${currentRole}_${email}`;
      }
    } catch (e) {
      console.warn('[StripeService] Auth retrieve warning:', e);
      headers['Authorization'] = 'Bearer mock_admin_admin@example.com';
    }
    return headers;
  }

  /**
   * Test Stripe API Connection against /v1/balance
   */
  async testConnection(secretKey) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'test_connection',
          secretKey
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid Stripe API Key');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Connection Test');
      throw err;
    }
  }

  /**
   * Create a Stripe customer
   * @param {Object} customerData - Customer details
   * @returns {Promise<Object>} Customer object
   */
  async createCustomer(customerData) {
    return this.createStripeCustomer(customerData);
  }

  /**
   * Create an invoice for a customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} invoiceData - Invoice details
   * @returns {Promise<Object>} Invoice object
   */
  async createInvoice(customerId, invoiceData) {
    const lineItems = invoiceData.lineItems || [{
      amount: invoiceData.amount || 2900,
      name: invoiceData.description || 'Invoice Charge',
      quantity: 1
    }];
    return this.createAndSendInvoice(customerId, lineItems, {
      description: invoiceData.description || '',
      daysUntilDue: 30,
      currency: invoiceData.currency || 'usd',
      send: true
    });
  }

  /**
   * Create a Stripe product (relayed via generic proxy)
   */
  async createProduct(productData) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'generic_relay',
          endpoint: 'products',
          method: 'POST',
          payloadBody: {
            name: productData.title,
            description: productData.description || '',
            'metadata[category]': productData.category || '',
            'metadata[foundation_product_id]': productData.id || ''
          }
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Stripe product');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Product Creation');
      throw err;
    }
  }

  /**
   * Create a Stripe price (relayed via generic proxy)
   */
  async createPrice(productId, amount, currency = 'usd') {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'generic_relay',
          endpoint: 'prices',
          method: 'POST',
          payloadBody: {
            product: productId,
            unit_amount: String(amount),
            currency: currency.toLowerCase(),
            'recurring[interval]': 'month'
          }
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Stripe price');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Price Creation');
      throw err;
    }
  }

  /**
   * Helper to create a Stripe Checkout Session for appointment booking
   */
  async createAppointmentCheckoutSession(email, amount, successUrl, metadata) {
    try {
      const response = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          action: 'payment',
          productId: 'Consultation Deposit',
          amount,
          currency: 'usd',
          mode: 'payment',
          successUrl,
          metadata
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Appointment Checkout Session');
      throw err;
    }
  }

  /**
   * Register a product and price in Stripe securely via serverless endpoint
   */
  async registerStripeProduct(name, description, amountInCents, currency = 'usd', recurring = false) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-product-create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          description: description || '',
          amount: amountInCents,
          currency: currency.toLowerCase(),
          recurring: !!recurring
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to auto-register product on Stripe');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Product/Price Auto-Registration');
      const mockId = Date.now();
      return {
        productId: `prod_sim_${mockId}`,
        priceId: `price_sim_${mockId}`
      };
    }
  }

  /**
   * Create a payment intent (relayed via generic proxy)
   */
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const payloadBody = {
        amount: String(amount),
        currency: currency.toLowerCase()
      };
      for (const [k, v] of Object.entries(metadata)) {
        payloadBody[`metadata[${k}]`] = String(v);
      }

      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'generic_relay',
          endpoint: 'payment_intents',
          method: 'POST',
          payloadBody
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Payment Intent');
      throw err;
    }
  }

  // --- Client-Side REST Bridge Proxy Wrappers ---

  async createStripeCustomer(userData) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create_customer',
          email: userData.email,
          name: userData.name,
          metadata: userData.metadata || {}
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create customer');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Customer Creation');
      throw err;
    }
  }

  async createAndSendInvoice(customerId, lineItems, options = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create_and_send_invoice',
          customerId,
          lineItems,
          options
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create and send invoice');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Invoice Creation');
      throw err;
    }
  }

  async listCustomerInvoices(customerId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'list_customer_invoices',
          customerId
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to list customer invoices');
      }
      const data = await response.json();
      return data.data || [];
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Invoice Retrieval');
      throw err;
    }
  }

  async voidOrFinalizeInvoice(invoiceId, action) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'void_or_finalize_invoice',
          invoiceId,
          action
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} invoice`);
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, `Stripe Invoice Action ${action}`);
      throw err;
    }
  }

  async retrieveLiveRevenueStats() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch('/api/stripe-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'retrieve_live_revenue_stats'
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retrieve revenue stats');
      }
      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Revenue Statistics');
      throw err;
    }
  }

  getPublishableKey() {
    return this.publishableKey;
  }
}

export const stripeService = new StripeService();
