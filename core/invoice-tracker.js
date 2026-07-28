// core/invoice-tracker.js - Invoice tracking system linked to Google Contacts
import { contentDB } from './db.js';

/**
 * Invoice Tracker for managing invoices linked to Google Contacts
 * Tracks invoice status, due dates, and payment history
 */
export class InvoiceTracker {
  constructor() {
    this.invoices = [];
  }

  /**
   * Create a new invoice
   * @param {Object} invoiceData - Invoice details
   * @returns {Promise<Object>} Created invoice
   */
  async createInvoice(invoiceData) {
    const invoice = {
      id: 'inv_' + Date.now(),
      invoiceNumber: this.generateInvoiceNumber(),
      productId: invoiceData.productId,
      productName: invoiceData.productName,
      customerId: invoiceData.customerId,
      customerEmail: invoiceData.customerEmail,
      customerName: invoiceData.customerName,
      googleContactId: invoiceData.googleContactId,
      
      // Pricing
      amount: invoiceData.amount,
      currency: invoiceData.currency || 'USD',
      retainerAmount: invoiceData.retainerAmount || 0,
      balanceDue: invoiceData.balanceDue || invoiceData.amount,
      
      // Payment type
      paymentType: invoiceData.paymentType, // 'full_upfront', 'retainer_invoice', 'invoice_only'
      
      // Dates
      createdAt: new Date().toISOString(),
      dueDate: invoiceData.dueDate || this.calculateDueDate(30),
      paidAt: null,
      
      // Status
      status: 'pending', // 'pending', 'partial', 'paid', 'overdue', 'cancelled'
      
      // Invoice settings
      paymentTerms: invoiceData.paymentTerms || 'Net 30 days',
      stripeInvoiceId: invoiceData.stripeInvoiceId || null,
      
      // Metadata
      metadata: invoiceData.metadata || {}
    };

    try {
      // Save to Firestore via contentDB
      await contentDB.saveInvoice(invoice);
      this.invoices.push(invoice);
      return invoice;
    } catch (err) {
      console.error('[InvoiceTracker] Error creating invoice:', err);
      throw err;
    }
  }

  /**
   * Get invoice by ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object|null>} Invoice object
   */
  async getInvoice(invoiceId) {
    try {
      return await contentDB.getInvoice(invoiceId);
    } catch (err) {
      console.error('[InvoiceTracker] Error getting invoice:', err);
      return null;
    }
  }

  /**
   * Get all invoices for a customer
   * @param {string} customerEmail - Customer email
   * @returns {Promise<Array>} Array of invoices
   */
  async getInvoicesByCustomer(customerEmail) {
    try {
      return await contentDB.getInvoicesByCustomer(customerEmail);
    } catch (err) {
      console.error('[InvoiceTracker] Error getting customer invoices:', err);
      return [];
    }
  }

  /**
   * Get all invoices for a Google Contact
   * @param {string} googleContactId - Google Contact ID
   * @returns {Promise<Array>} Array of invoices
   */
  async getInvoicesByGoogleContact(googleContactId) {
    try {
      return await contentDB.getInvoicesByGoogleContact(googleContactId);
    } catch (err) {
      console.error('[InvoiceTracker] Error getting Google Contact invoices:', err);
      return [];
    }
  }

  /**
   * Get all invoices
   * @returns {Promise<Array>} Array of all invoices
   */
  async getAllInvoices() {
    try {
      return await contentDB.getAllInvoices();
    } catch (err) {
      console.error('[InvoiceTracker] Error getting all invoices:', err);
      return [];
    }
  }

  /**
   * Update invoice status
   * @param {string} invoiceId - Invoice ID
   * @param {string} status - New status
   * @param {Object} updateData - Additional update data
   * @returns {Promise<Object>} Updated invoice
   */
  async updateInvoiceStatus(invoiceId, status, updateData = {}) {
    try {
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updatedInvoice = {
        ...invoice,
        status,
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      if (status === 'paid' || status === 'partial') {
        updatedInvoice.paidAt = new Date().toISOString();
      }

      await contentDB.saveInvoice(updatedInvoice);
      return updatedInvoice;
    } catch (err) {
      console.error('[InvoiceTracker] Error updating invoice status:', err);
      throw err;
    }
  }

  /**
   * Mark invoice as paid
   * @param {string} invoiceId - Invoice ID
   * @param {number} amountPaid - Amount paid
   * @returns {Promise<Object>} Updated invoice
   */
  async markAsPaid(invoiceId, amountPaid = null) {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const paidAmount = amountPaid || invoice.balanceDue;
    const remainingBalance = invoice.balanceDue - paidAmount;

    let status = 'paid';
    if (remainingBalance > 0) {
      status = 'partial';
    }

    return await this.updateInvoiceStatus(invoiceId, status, {
      balanceDue: remainingBalance,
      amountPaid: paidAmount
    });
  }

  /**
   * Get overdue invoices
   * @returns {Promise<Array>} Array of overdue invoices
   */
  async getOverdueInvoices() {
    const allInvoices = await this.getAllInvoices();
    const now = new Date();
    
    return allInvoices.filter(invoice => {
      if (invoice.status === 'paid' || invoice.status === 'cancelled') {
        return false;
      }
      const dueDate = new Date(invoice.dueDate);
      return dueDate < now;
    });
  }

  /**
   * Generate invoice number
   * @returns {string} Invoice number
   */
  generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  }

  /**
   * Calculate due date
   * @param {number} days - Number of days from now
   * @returns {string} ISO date string
   */
  calculateDueDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  /**
   * Get invoice summary for a customer
   * @param {string} customerEmail - Customer email
   * @returns {Promise<Object>} Invoice summary
   */
  async getCustomerInvoiceSummary(customerEmail) {
    const invoices = await this.getInvoicesByCustomer(customerEmail);
    
    const summary = {
      totalInvoices: invoices.length,
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      overdueCount: 0,
      pendingCount: 0
    };

    const now = new Date();

    invoices.forEach(invoice => {
      summary.totalAmount += invoice.amount;
      
      if (invoice.status === 'paid') {
        summary.totalPaid += invoice.amount;
      } else {
        summary.totalOutstanding += invoice.balanceDue;
        
        if (invoice.status === 'pending') {
          summary.pendingCount++;
          
          const dueDate = new Date(invoice.dueDate);
          if (dueDate < now) {
            summary.overdueCount++;
          }
        }
      }
    });

    return summary;
  }
}

export const invoiceTracker = new InvoiceTracker();
