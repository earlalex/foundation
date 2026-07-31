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

  // ==========================================
  // Operational Expense Engine Methods (IndexedDB + LocalStorage Falls + Dual Sync)
  // ==========================================

  /**
   * Save an expense locally (IndexedDB & LocalStorage) and sync to Firestore
   * @param {Object} expenseData
   */
  async saveExpense(expenseData) {
    const expense = {
      id: expenseData.id || 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      category: expenseData.category || 'Software',
      vendor: expenseData.vendor || expenseData.title || 'Unknown',
      amount: Number(expenseData.amount || 0),
      date: expenseData.date || new Date().toISOString().split('T')[0],
      isRecurring: !!expenseData.isRecurring,
      notes: expenseData.notes || '',
      title: expenseData.title || expenseData.vendor || 'Unknown',
      receipt: expenseData.receipt || null,
      updatedAt: new Date().toISOString()
    };

    // 1. Persist to IndexedDB
    try {
      await this.#saveToIndexedDB(expense);
    } catch (e) {
      console.warn('[InvoiceTracker] IndexedDB save failed, using localStorage fallback', e);
    }

    // 2. Persist to localStorage
    try {
      const local = this.#getLocalExpenses();
      local[expense.id] = expense;
      this.#saveLocalExpenses(local);
    } catch (e) {
      console.error('[InvoiceTracker] LocalStorage save failed', e);
    }

    // 3. Dual Sync: Backup to Firestore
    try {
      await contentDB.saveExpense(expense);
      // Also try syncing to /finances/expenses nested path collection for absolute compatibility
      try {
        const dbInstance = contentDB.getFirestoreDB?.();
        if (dbInstance) {
          const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
          const docRef = doc(dbInstance, 'finances', 'expenses', 'entries', expense.id);
          await setDoc(docRef, expense, { merge: true });
        }
      } catch (innerErr) {
        console.warn('[InvoiceTracker] Direct nested path sync warning:', innerErr.message);
      }
    } catch (err) {
      console.warn('[InvoiceTracker] Firestore sync deferred (offline or permission lock):', err.message);
    }

    return expense;
  }

  /**
   * Get all expenses (Unified query: tries IndexedDB first, then localStorage fallback, then synced Firestore backup)
   */
  async getExpenses(filter = {}) {
    let list = [];

    // Try IndexedDB
    try {
      list = await this.#getAllFromIndexedDB();
    } catch (e) {
      console.warn('[InvoiceTracker] IndexedDB get failed, trying localStorage fallback', e);
    }

    // Try localStorage fallback if IDB empty
    if (!list || list.length === 0) {
      list = Object.values(this.#getLocalExpenses());
    }

    // Try Firestore contentDB if offline stores empty
    if (!list || list.length === 0) {
      try {
        list = await contentDB.getExpenses();
      } catch (err) {
        console.warn('[InvoiceTracker] Firestore fetch deferred:', err.message);
      }
    }

    // Apply client filters
    if (filter.category && filter.category !== 'all') {
      list = list.filter(item => item.category?.toLowerCase() === filter.category.toLowerCase());
    }
    if (filter.vendor) {
      list = list.filter(item => item.vendor?.toLowerCase().includes(filter.vendor.toLowerCase()));
    }

    // Sort descending by date
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    return list;
  }

  /**
   * Delete expense record
   */
  async deleteExpense(id) {
    // Delete from IndexedDB
    try {
      await this.#deleteFromIndexedDB(id);
    } catch (e) {
      console.warn('[InvoiceTracker] IndexedDB delete failed', e);
    }

    // Delete from LocalStorage
    try {
      const local = this.#getLocalExpenses();
      delete local[id];
      this.#saveLocalExpenses(local);
    } catch (e) {
      console.error('[InvoiceTracker] LocalStorage delete failed', e);
    }

    // Delete from Firestore
    try {
      const dbInstance = contentDB.getFirestoreDB?.();
      if (dbInstance) {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const docRef = doc(dbInstance, 'finances_expenses', id);
        await deleteDoc(docRef);

        const nestedRef = doc(dbInstance, 'finances', 'expenses', 'entries', id);
        await deleteDoc(nestedRef);
      }
    } catch (err) {
      console.warn('[InvoiceTracker] Firestore delete deferred:', err.message);
    }

    return true;
  }

  // --- Private IndexedDB Helpers ---

  #openIDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported'));
        return;
      }
      const request = indexedDB.open('FoundationFinancesDB', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async #saveToIndexedDB(expense) {
    const db = await this.#openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('expenses', 'readwrite');
      const store = tx.objectStore('expenses');
      const req = store.put(expense);
      req.onsuccess = () => resolve(expense);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async #getAllFromIndexedDB() {
    const db = await this.#openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('expenses', 'readonly');
      const store = tx.objectStore('expenses');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async #deleteFromIndexedDB(id) {
    const db = await this.#openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('expenses', 'readwrite');
      const store = tx.objectStore('expenses');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Private LocalStorage Fallbacks ---

  #getLocalExpenses() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_expenses') || '{}');
    } catch (e) {
      return {};
    }
  }

  #saveLocalExpenses(expenses) {
    try {
      localStorage.setItem('foundation_local_expenses', JSON.stringify(expenses));
    } catch (e) {
      console.error(e);
    }
  }
}

export const invoiceTracker = new InvoiceTracker();