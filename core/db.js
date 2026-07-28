// core/db.js
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  limit 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { schemaRegistry } from '../schemas/registry.js';
import { errorHandler } from './error-handler.js';
import { configManager } from './config.js';

const CONTENT_COLLECTION = 'content';
const USERS_COLLECTION = 'users';
const CHAT_LOGS_COLLECTION = 'chat_logs';
const INVOICES_COLLECTION = 'invoices';

/**
 * Get Firestore database instance
 * @returns {Object|null} Firestore instance or null if uninitialized
 */
function getFirestoreDB() {
  try {
    return getFirestore();
  } catch (e) {
    console.warn('[DB]: Firestore instance uninitialized.', e);
    return null;
  }
}

/**
 * ContentDB class abstracts Firestore interactions for content, users, and chat logs
 * Includes localStorage fallback for chat logs when Firestore is unavailable
 */
export class ContentDB {
  /**
   * Get chat logs from localStorage fallback
   * @private
   * @returns {Array} Array of chat log objects
   */
  #getLocalChatLogs() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_chat_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Save chat logs to localStorage fallback
   * @private
   * @param {Array} data - Array of chat log objects
   */
  #saveLocalChatLogs(data) {
    localStorage.setItem('foundation_local_chat_logs', JSON.stringify(data));
  }

  /**
   * Save a chat log entry to Firestore or localStorage fallback
   * @param {Object} logData - Chat log data with timestamp, sender, message, type
   * @returns {Promise<boolean>} True if save was successful
   */
  async saveChatLog(logData) {
    // Basic validation matching schema guidelines (timestamp, sender, message, type)
    if (!logData.timestamp || !logData.sender || !logData.message) {
      throw new Error('[DB]: Missing required fields in chat log');
    }

    const payload = {
      ...logData,
      id: logData.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };

    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalChatLogs();
      local.push(payload);
      this.#saveLocalChatLogs(local.slice(-100)); // Keep last 100 logs
      return true;
    }

    try {
      const docRef = doc(db, CHAT_LOGS_COLLECTION, payload.id);
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore chat log write error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalChatLogs();
      local.push(payload);
      this.#saveLocalChatLogs(local.slice(-100));
      return true;
    }
  }

  /**
   * Get chat logs from Firestore or localStorage fallback
   * @param {number} limitCount - Maximum number of logs to return
   * @returns {Promise<Array>} Array of chat log objects sorted by date
   */
  async getChatLogs(limitCount = 50) {
    const db = getFirestoreDB();
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, CHAT_LOGS_COLLECTION));
        const results = [];
        querySnapshot.forEach((docSnap) => {
          results.push({ id: docSnap.id, ...docSnap.data() });
        });
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (results.length > 0) return results.slice(0, limitCount);
      } catch (err) {
        console.warn('[DB]: Could not fetch chat logs from Firestore.', err.message);
      }
    }

    // fallback to local
    const local = this.#getLocalChatLogs();
    return [...local].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limitCount);
  }

  /**
   * Get content from localStorage fallback
   * @private
   * @returns {Object} Content object from localStorage
   */
  #getLocalContent() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_content') || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * Save content to localStorage fallback
   * @private
   * @param {Object} data - Content object to save
   */
  #saveLocalContent(data) {
    localStorage.setItem('foundation_local_content', JSON.stringify(data));
  }

  /**
   * Get users from localStorage fallback
   * @private
   * @returns {Object} Users object from localStorage
   */
  #getLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_users') || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * Save users to localStorage fallback
   * @private
   * @param {Object} data - Users object to save
   */
  #saveLocalUsers(data) {
    localStorage.setItem('foundation_local_users', JSON.stringify(data));
  }

  /**
   * Save content to Firestore or localStorage fallback
   * @param {Object} contentData - Content data to save
   * @returns {Promise<boolean>} True if save was successful
   */
  async saveContent(contentData) {
    schemaRegistry.validate(contentData);
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalContent();
      local[contentData.id] = { ...contentData, updatedAt: new Date().toISOString() };
      this.#saveLocalContent(local);
      return true;
    }

    try {
      const docRef = doc(db, CONTENT_COLLECTION, contentData.id);
      await setDoc(docRef, {
        ...contentData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore permission or write error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalContent();
      local[contentData.id] = { ...contentData, updatedAt: new Date().toISOString() };
      this.#saveLocalContent(local);
      return true;
    }
  }

  /**
   * Get content by ID from Firestore or localStorage fallback
   * @param {string} id - Content ID
   * @returns {Promise<Object|null>} Content object or null if not found
   */
  async getContentById(id) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalContent();
      if (local[id]) {
        schemaRegistry.validate(local[id]);
        return local[id];
      }
      return null;
    }

    try {
      const docRef = doc(db, CONTENT_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        schemaRegistry.validate(data);
        return data;
      }
    } catch (err) {
      console.warn('[DB]: Firestore read error. Falling back to LocalStorage.', err.message);
    }

    const local = this.#getLocalContent();
    if (local[id]) {
      try {
        schemaRegistry.validate(local[id]);
        return local[id];
      } catch (e) {}
    }
    return null;
  }

  /**
   * Get content by type from Firestore or localStorage fallback
   * @param {string} type - Content type to filter by
   * @param {number} maxItems - Maximum number of items to return
   * @returns {Promise<Array>} Array of content objects
   */
  async getContentByType(type, maxItems = 12) {
    const results = [];
    const db = getFirestoreDB();
    if (db) {
      try {
        const q = query(
          collection(db, CONTENT_COLLECTION),
          where('type', '==', type),
          limit(maxItems)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          try {
            schemaRegistry.validate(data);
            results.push(data);
          } catch (e) {}
        });
        if (results.length > 0) return results;
      } catch (err) {
        console.warn('[DB]: Cloud Firestore query bypassed or unreachable.', err.message);
      }
    }

    // fallback to local
    const local = this.#getLocalContent();
    Object.values(local).forEach(item => {
      if (item.type === type && results.length < maxItems) {
        try {
          schemaRegistry.validate(item);
          results.push(item);
        } catch (e) {}
      }
    });
    return results;
  }

  /**
   * Get all users from Firestore or localStorage fallback
   * @returns {Promise<Array>} Array of user objects
   */
  async getAllUsers() {
    const users = [];
    const db = getFirestoreDB();
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
        querySnapshot.forEach((docSnap) => {
          users.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (users.length > 0) return users;
      } catch (err) {
        console.warn('[DB]: Could not fetch users collection from Firestore.', err.message);
      }
    }

    // fallback to local
    const local = this.#getLocalUsers();
    return Object.values(local);
  }

  /**
   * Save user data to Firestore or localStorage fallback
   * @param {Object} userData - User data to save
   * @returns {Promise<boolean>} True if save was successful
   */
  async saveUser(userData) {
    const userId = userData.id || userData.email.replace(/[@.]/g, '_');
    const payload = {
      ...userData,
      id: userId,
      updatedAt: new Date().toISOString()
    };

    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalUsers();
      local[userId] = payload;
      this.#saveLocalUsers(local);
      return payload;
    }

    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore user save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalUsers();
      local[userId] = payload;
      this.#saveLocalUsers(local);
      return payload;
    }
  }

  /**
   * Delete user from Firestore or localStorage fallback
   * @param {string} userId - User ID to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteUser(userId) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalUsers();
      delete local[userId];
      this.#saveLocalUsers(local);
      return true;
    }

    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore user delete error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalUsers();
      delete local[userId];
      this.#saveLocalUsers(local);
      return true;
    }
  }

  /**
   * Save invoice to Firestore or localStorage fallback
   * @param {Object} invoice - Invoice object to save
   * @returns {Promise<Object>} Saved invoice
   */
  async saveInvoice(invoice) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalInvoices();
      local[invoice.id] = invoice;
      this.#saveLocalInvoices(local);
      return invoice;
    }

    try {
      const docRef = doc(db, INVOICES_COLLECTION, invoice.id);
      await setDoc(docRef, invoice, { merge: true });
      return invoice;
    } catch (err) {
      console.warn('[DB]: Firestore invoice save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalInvoices();
      local[invoice.id] = invoice;
      this.#saveLocalInvoices(local);
      return invoice;
    }
  }

  /**
   * Get invoice by ID from Firestore or localStorage fallback
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object|null>} Invoice object or null
   */
  async getInvoice(invoiceId) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalInvoices();
      return local[invoiceId] || null;
    }

    try {
      const docRef = doc(db, INVOICES_COLLECTION, invoiceId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (err) {
      console.warn('[DB]: Firestore invoice get error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalInvoices();
      return local[invoiceId] || null;
    }
  }

  /**
   * Get all invoices from Firestore or localStorage fallback
   * @returns {Promise<Array>} Array of invoice objects
   */
  async getAllInvoices() {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalInvoices();
      return Object.values(local);
    }

    try {
      const collectionRef = collection(db, INVOICES_COLLECTION);
      const querySnapshot = await getDocs(collectionRef);
      return querySnapshot.docs.map(doc => doc.data());
    } catch (err) {
      console.warn('[DB]: Firestore invoices get error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalInvoices();
      return Object.values(local);
    }
  }

  /**
   * Get invoices by customer email from Firestore or localStorage fallback
   * @param {string} customerEmail - Customer email
   * @returns {Promise<Array>} Array of invoice objects
   */
  async getInvoicesByCustomer(customerEmail) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalInvoices();
      return Object.values(local).filter(inv => inv.customerEmail === customerEmail);
    }

    try {
      const collectionRef = collection(db, INVOICES_COLLECTION);
      const q = query(collectionRef, where('customerEmail', '==', customerEmail));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());
    } catch (err) {
      console.warn('[DB]: Firestore customer invoices get error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalInvoices();
      return Object.values(local).filter(inv => inv.customerEmail === customerEmail);
    }
  }

  /**
   * Get invoices by Google Contact ID from Firestore or localStorage fallback
   * @param {string} googleContactId - Google Contact ID
   * @returns {Promise<Array>} Array of invoice objects
   */
  async getInvoicesByGoogleContact(googleContactId) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalInvoices();
      return Object.values(local).filter(inv => inv.googleContactId === googleContactId);
    }

    try {
      const collectionRef = collection(db, INVOICES_COLLECTION);
      const q = query(collectionRef, where('googleContactId', '==', googleContactId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());
    } catch (err) {
      console.warn('[DB]: Firestore Google Contact invoices get error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalInvoices();
      return Object.values(local).filter(inv => inv.googleContactId === googleContactId);
    }
  }

  /**
   * Delete invoice from Firestore or localStorage fallback
   * @param {string} invoiceId - Invoice ID to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteInvoice(invoiceId) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalInvoices();
      delete local[invoiceId];
      this.#saveLocalInvoices(local);
      return true;
    }

    try {
      const docRef = doc(db, INVOICES_COLLECTION, invoiceId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore invoice delete error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalInvoices();
      delete local[invoiceId];
      this.#saveLocalInvoices(local);
      return true;
    }
  }

  /**
   * Get invoices from localStorage fallback
   * @private
   * @returns {Object} Object of invoice objects keyed by ID
   */
  #getLocalInvoices() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_invoices') || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * Save invoices to localStorage fallback
   * @private
   * @param {Object} invoices - Object of invoice objects keyed by ID
   */
  #saveLocalInvoices(invoices) {
    try {
      localStorage.setItem('foundation_local_invoices', JSON.stringify(invoices));
    } catch (e) {
      console.error('[DB]: Failed to save invoices to localStorage', e);
    }
  }

  /**
   * Delete content from Firestore or localStorage fallback
   * @param {string} id - Content ID to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteContent(id) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalContent();
      delete local[id];
      this.#saveLocalContent(local);
      return true;
    }

    try {
      const docRef = doc(db, CONTENT_COLLECTION, id);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore content delete error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalContent();
      delete local[id];
      this.#saveLocalContent(local);
      return true;
    }
  }

  // --- Financial Persistence Helpers ---

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
      console.error('[DB]: Failed to save expenses to localStorage', e);
    }
  }

  #getLocalPayroll() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_payroll') || '{}');
    } catch (e) {
      return {};
    }
  }

  #saveLocalPayroll(payroll) {
    try {
      localStorage.setItem('foundation_local_payroll', JSON.stringify(payroll));
    } catch (e) {
      console.error('[DB]: Failed to save payroll to localStorage', e);
    }
  }

  #getLocalBudgets() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_budgets') || '{}');
    } catch (e) {
      return {};
    }
  }

  #saveLocalBudgets(budgets) {
    try {
      localStorage.setItem('foundation_local_budgets', JSON.stringify(budgets));
    } catch (e) {
      console.error('[DB]: Failed to save budgets to localStorage', e);
    }
  }

  #getLocalEmployees() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_employees') || '{}');
    } catch (e) {
      return {};
    }
  }

  #saveLocalEmployees(employees) {
    try {
      localStorage.setItem('foundation_local_employees', JSON.stringify(employees));
    } catch (e) {
      console.error('[DB]: Failed to save employees to localStorage', e);
    }
  }

  async saveExpense(data) {
    const db = getFirestoreDB();
    const id = data.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = { ...data, id, updatedAt: new Date().toISOString() };

    if (!db) {
      const local = this.#getLocalExpenses();
      local[id] = payload;
      this.#saveLocalExpenses(local);
      return payload;
    }

    try {
      const docRef = doc(db, 'finances_expenses', id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore expense save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalExpenses();
      local[id] = payload;
      this.#saveLocalExpenses(local);
      return payload;
    }
  }

  async getExpenses(filter = {}) {
    let results = [];
    const db = getFirestoreDB();
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'finances_expenses'));
        querySnapshot.forEach((docSnap) => {
          results.push(docSnap.data());
        });
      } catch (err) {
        console.warn('[DB]: Could not fetch expenses from Firestore.', err.message);
      }
    }

    if (results.length === 0) {
      results = Object.values(this.#getLocalExpenses());
    }

    if (filter.category && filter.category !== 'all') {
      results = results.filter(item => item.category === filter.category);
    }
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    return results;
  }

  async savePayrollRecord(data) {
    const db = getFirestoreDB();
    const id = data.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };

    if (!db) {
      const local = this.#getLocalPayroll();
      local[id] = payload;
      this.#saveLocalPayroll(local);
      return payload;
    }

    try {
      const docRef = doc(db, 'finances_payroll', id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore payroll save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalPayroll();
      local[id] = payload;
      this.#saveLocalPayroll(local);
      return payload;
    }
  }

  async getPayrollRecords() {
    let results = [];
    const db = getFirestoreDB();
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'finances_payroll'));
        querySnapshot.forEach((docSnap) => {
          results.push(docSnap.data());
        });
      } catch (err) {
        console.warn('[DB]: Could not fetch payroll records from Firestore.', err.message);
      }
    }

    if (results.length === 0) {
      results = Object.values(this.#getLocalPayroll());
    }

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results;
  }

  async saveBudgetTargets(targets) {
    const db = getFirestoreDB();
    const id = 'monthly_budget_targets';
    const payload = { ...targets, id, updatedAt: new Date().toISOString() };

    if (!db) {
      const local = this.#getLocalBudgets();
      local[id] = payload;
      this.#saveLocalBudgets(local);
      return payload;
    }

    try {
      const docRef = doc(db, 'finances_budgets', id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore budget save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalBudgets();
      local[id] = payload;
      this.#saveLocalBudgets(local);
      return payload;
    }
  }

  async getBudgets() {
    const db = getFirestoreDB();
    const id = 'monthly_budget_targets';
    if (db) {
      try {
        const docRef = doc(db, 'finances_budgets', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data();
        }
      } catch (err) {
        console.warn('[DB]: Could not fetch budgets from Firestore.', err.message);
      }
    }

    const local = this.#getLocalBudgets();
    return local[id] || { totalExpensesBudget: 5000, payrollBudget: 10000 };
  }

  async saveEmployee(data) {
    const db = getFirestoreDB();
    const id = data.id || `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = { ...data, id, updatedAt: new Date().toISOString() };

    if (!db) {
      const local = this.#getLocalEmployees();
      local[id] = payload;
      this.#saveLocalEmployees(local);
      return payload;
    }

    try {
      const docRef = doc(db, 'finances_employees', id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore employee save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalEmployees();
      local[id] = payload;
      this.#saveLocalEmployees(local);
      return payload;
    }
  }

  async getEmployees() {
    let results = [];
    const db = getFirestoreDB();
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'finances_employees'));
        querySnapshot.forEach((docSnap) => {
          results.push(docSnap.data());
        });
      } catch (err) {
        console.warn('[DB]: Could not fetch employees from Firestore.', err.message);
      }
    }

    if (results.length === 0) {
      results = Object.values(this.#getLocalEmployees());
    }

    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }

  async deleteEmployee(id) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalEmployees();
      delete local[id];
      this.#saveLocalEmployees(local);
      return true;
    }

    try {
      const docRef = doc(db, 'finances_employees', id);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore employee delete error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalEmployees();
      delete local[id];
      this.#saveLocalEmployees(local);
      return true;
    }
  }
}

/**
 * Singleton instance of ContentDB
 * @type {ContentDB}
 */
export const contentDB = new ContentDB();