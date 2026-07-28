// core/stripe.js - Stripe payment integration
import { configManager } from './config.js';
import { errorHandler } from './error-handler.js';

/**
 * Stripe Service for payment processing
 * Handles product creation, payment intents, and invoice generation
 */
export class StripeService {
  constructor() {
    this.apiKey = configManager.current.stripe?.secretKey || null;
    this.publishableKey = configManager.current.stripe?.publishableKey || null;
  }

  /**
   * Create a Stripe product
   * @param {Object} productData - Product details
   * @returns {Promise<Object>} Stripe product object
   */
  async createProduct(productData) {
    if (!this.apiKey) {
      const error = new Error('Stripe API key not configured');
      errorHandler.handleError(error, 'Stripe Configuration');
      throw error;
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          name: productData.title,
          description: productData.description || '',
          metadata: {
            category: productData.category,
            foundation_product_id: productData.id
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error?.message || 'Failed to create Stripe product');
        errorHandler.handleError(error, 'Stripe Product Creation');
        throw error;
      }

      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Product Creation');
      throw err;
    }
  }

  /**
   * Create a Stripe price for a product
   * @param {string} productId - Stripe product ID
   * @param {number} amount - Price in cents
   * @param {string} currency - Currency code (e.g., 'usd')
   * @returns {Promise<Object>} Stripe price object
   */
  async createPrice(productId, amount, currency = 'usd') {
    if (!this.apiKey) {
      const error = new Error('Stripe API key not configured');
      errorHandler.handleError(error, 'Stripe Configuration');
      throw error;
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          product: productId,
          unit_amount: amount,
          currency: currency.toLowerCase(),
          recurring: JSON.stringify({
            interval: 'month'
          })
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error?.message || 'Failed to create Stripe price');
        errorHandler.handleError(error, 'Stripe Price Creation');
        throw error;
      }

      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Price Creation');
      throw err;
    }
  }

  /**
   * Create a payment intent for one-time payment
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Payment intent object
   */
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    if (!this.apiKey) {
      const error = new Error('Stripe API key not configured');
      errorHandler.handleError(error, 'Stripe Configuration');
      throw error;
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          amount: amount,
          currency: currency.toLowerCase(),
          metadata: JSON.stringify(metadata)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error?.message || 'Failed to create payment intent');
        errorHandler.handleError(error, 'Stripe Payment Intent');
        throw error;
      }

      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Payment Intent');
      throw err;
    }
  }

  /**
   * Create an invoice for a customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} invoiceData - Invoice details
   * @returns {Promise<Object>} Invoice object
   */
  async createInvoice(customerId, invoiceData) {
    if (!this.apiKey) {
      const error = new Error('Stripe API key not configured');
      errorHandler.handleError(error, 'Stripe Configuration');
      throw error;
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/invoices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          customer: customerId,
          description: invoiceData.description || '',
          metadata: JSON.stringify(invoiceData.metadata || {}),
          due_date: Math.floor(new Date(invoiceData.dueDate).getTime() / 1000)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error?.message || 'Failed to create invoice');
        errorHandler.handleError(error, 'Stripe Invoice Creation');
        throw error;
      }

      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Invoice Creation');
      throw err;
    }
  }

  /**
   * Create a customer in Stripe
   * @param {Object} customerData - Customer details
   * @returns {Promise<Object>} Customer object
   */
  async createCustomer(customerData) {
    if (!this.apiKey) {
      const error = new Error('Stripe API key not configured');
      errorHandler.handleError(error, 'Stripe Configuration');
      throw error;
    }

    try {
      const response = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          email: customerData.email,
          name: customerData.name,
          metadata: JSON.stringify(customerData.metadata || {})
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error?.message || 'Failed to create customer');
        errorHandler.handleError(error, 'Stripe Customer Creation');
        throw error;
      }

      return await response.json();
    } catch (err) {
      errorHandler.handleError(err, 'Stripe Customer Creation');
      throw err;
    }
  }

  /**
   * Get the publishable key for frontend use
   * @returns {string} Stripe publishable key
   */
  getPublishableKey() {
    return this.publishableKey;
  }
}

export const stripeService = new StripeService();
