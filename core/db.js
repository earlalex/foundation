// core/db.js - Re-export and Delegation Hub
import { getFirestoreDB, schemaRegistry, store, configManager } from './db-shared.js';
import { FRAMEWORK_AFFILIATES } from './affiliates.js';

import {
  saveContent, getContentById, getAllContent, getContentByType, deleteContent,
  saveCustomPage, getCustomPageBySlug, getAllCustomPages,
  saveZapScanResult, getZapScanHistory, saveMarketingSegment, getMarketingSegments,
  getMarketingSegmentById, evaluateSegmentUsers, saveMarketingJourney,
  saveEmailTemplate, getEmailTemplates, getEmailTemplateById,
  saveVaultCredential, getVaultCredentials, deleteVaultCredential,
  saveVaCandidate, getVaCandidates, getVaActivityLogs, assignLastpassVaultAccess,
  saveMarketingWorkflow, getMarketingWorkflows, deleteMarketingWorkflow,
  saveHeroConfig, getHeroConfig
} from './db-content.js';

import {
  getAllUsers, saveUser, getUser, deleteUser,
  saveUserCourseProgress, getUserCourseProgress, getUserAllProgress
} from './db-users.js';

import {
  saveInvoice, getInvoice, getAllInvoices, getInvoicesByCustomer, getInvoicesByGoogleContact, deleteInvoice,
  saveExpense, getExpenses, savePayrollRecord, getPayrollRecords,
  saveBudgetTargets, getBudgets, saveEmployee, getEmployees, deleteEmployee,
  updateBudgetTargetsOnPayout
} from './db-finances.js';

import {
  saveEvent, getEventBySlug, getAllEvents, updateTicketAvailability,
  saveRegistration, getRegistrationsByUser, getAllRegistrations,
  saveAppointment, getAppointments
} from './db-events.js';

export class ContentDB {
  get state() {
    return {};
  }

  // Alias helper
  async getContent(id) {
    return this.getContentById(id);
  }

  // Chat logs fallback
  #getLocalChatLogs() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_chat_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  #saveLocalChatLogs(data) {
    localStorage.setItem('foundation_local_chat_logs', JSON.stringify(data));
  }

  async saveChatLog(logData) {
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
      this.#saveLocalChatLogs(local.slice(-100));
      return true;
    }

    try {
      const { doc, setDoc } = await import('./db-shared.js');
      const docRef = doc(db, 'chat_logs', payload.id);
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

  async getChatLogs(limitCount = 50) {
    const db = getFirestoreDB();
    if (db) {
      try {
        const { collection, getDocs } = await import('./db-shared.js');
        const querySnapshot = await getDocs(collection(db, 'chat_logs'));
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

    const local = this.#getLocalChatLogs();
    return [...local].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limitCount);
  }

  // Delegated content methods
  async saveContent(data) { return saveContent(data); }
  async getContentById(id) { return getContentById(id); }
  async getAllContent() { return getAllContent(); }
  async getContentByType(type, max) { return getContentByType(type, max); }
  async deleteContent(id) { return deleteContent(id); }

  // Delegated page methods
  async saveCustomPage(data) { return saveCustomPage(data); }
  async getCustomPageBySlug(slug) { return getCustomPageBySlug(slug); }
  async getAllCustomPages() { return getAllCustomPages(); }
  async getCustomPages() { return getAllCustomPages(); }
  async saveHeroConfig(pageId, heroData) { return saveHeroConfig(pageId, heroData); }
  async getHeroConfig(pageId) { return getHeroConfig(pageId); }

  // Delegated user methods
  async getAllUsers() { return getAllUsers(); }
  async saveUser(data) { return saveUser(data); }
  async getUser(id) { return getUser(id); }
  async deleteUser(id) { return deleteUser(id); }
  async getUserPurchases(userId) {
    const allInvoices = await this.getAllInvoices();
    return allInvoices.filter(inv => inv.userId === userId || inv.customerEmail === userId);
  }
  async getUserNotifications(userId) {
    try {
      const announcements = await this.getContentByType('announcement');
      return announcements.map(ann => ({
        id: ann.id,
        title: ann.title,
        message: ann.description,
        date: ann.date,
        type: 'broadcast'
      }));
    } catch (e) {
      return [];
    }
  }

  // Delegated progress methods
  async saveUserCourseProgress(u, c, p) { return saveUserCourseProgress(u, c, p); }
  async getUserCourseProgress(u, c) { return getUserCourseProgress(u, c); }
  async getUserAllProgress(u) { return getUserAllProgress(u); }

  // Delegated finance methods
  async saveInvoice(inv) { return saveInvoice(inv); }
  async getInvoice(id) { return getInvoice(id); }
  async getAllInvoices() { return getAllInvoices(); }
  async getInvoicesByCustomer(email) { return getInvoicesByCustomer(email); }
  async getInvoicesByGoogleContact(id) { return getInvoicesByGoogleContact(id); }
  async deleteInvoice(id) { return deleteInvoice(id); }
  async saveExpense(data) { return saveExpense(data); }
  async getExpenses(filter) { return getExpenses(filter); }
  async savePayrollRecord(data) { return savePayrollRecord(data); }
  async getPayrollRecords() { return getPayrollRecords(); }
  async updateBudgetTargetsOnPayout(amountUSD, feeUSD) { return updateBudgetTargetsOnPayout(amountUSD, feeUSD); }
  async saveBudgetTargets(data) { return saveBudgetTargets(data); }
  async getBudgets() { return getBudgets(); }
  async saveEmployee(data) { return saveEmployee(data); }
  async getEmployees() { return getEmployees(); }
  async deleteEmployee(id) { return deleteEmployee(id); }

  // Delegated VA methods
  async saveVaCandidate(data) { return saveVaCandidate(data); }
  async getVaCandidates(f) { return getVaCandidates(f); }
  async getVaActivityLogs(id) { return getVaActivityLogs(id); }
  async assignLastpassVaultAccess(v, e) { return assignLastpassVaultAccess(v, e); }

  // Delegated scan & marketing methods
  async saveZapScanResult(data) { return saveZapScanResult(data); }
  async getZapScanHistory() { return getZapScanHistory(); }
  async saveMarketingSegment(data) { return saveMarketingSegment(data); }
  async getMarketingSegments() { return getMarketingSegments(); }
  async getMarketingSegmentById(id) { return getMarketingSegmentById(id); }
  async evaluateSegmentUsers(id) { return evaluateSegmentUsers(id); }
  async saveMarketingJourney(data) { return saveMarketingJourney(data); }
  async saveEmailTemplate(data) { return saveEmailTemplate(data); }
  async getEmailTemplates() { return getEmailTemplates(); }
  async getEmailTemplateById(id) { return getEmailTemplateById(id); }
  async saveMarketingWorkflow(data) { return saveMarketingWorkflow(data); }
  async getMarketingWorkflows() { return getMarketingWorkflows(); }
  async deleteMarketingWorkflow(id) { return deleteMarketingWorkflow(id); }
  async saveVaultCredential(record) { return saveVaultCredential(record); }
  async getVaultCredentials() { return getVaultCredentials(); }
  async deleteVaultCredential(id) { return deleteVaultCredential(id); }

  // Delegated event methods
  async saveEvent(data) { return saveEvent(data); }
  async getEventBySlug(slug) { return getEventBySlug(slug); }
  async getAllEvents() { return getAllEvents(); }
  async updateTicketAvailability(evId, tId, qty) { return updateTicketAvailability(evId, tId, qty); }
  async saveRegistration(data) { return saveRegistration(data); }
  async getRegistrationsByUser(email) { return getRegistrationsByUser(email); }
  async getAllRegistrations() { return getAllRegistrations(); }
  async saveAppointment(data) { return saveAppointment(data); }
  async getAppointments() { return getAppointments(); }

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

  #saveLocalExpenses(expenses) {
    try {
      localStorage.setItem('foundation_local_expenses', JSON.stringify(expenses));
    } catch (e) {
      console.error('[DB]: Failed to save expenses to localStorage', e);
    }
  }

  #saveLocalPayroll(payroll) {
    try {
      localStorage.setItem('foundation_local_payroll', JSON.stringify(payroll));
    } catch (e) {
      console.error('[DB]: Failed to save payroll to localStorage', e);
    }
  }

  #saveLocalEmployees(employees) {
    try {
      localStorage.setItem('foundation_local_employees', JSON.stringify(employees));
    } catch (e) {
      console.error('[DB]: Failed to save employees to localStorage', e);
    }
  }

  #getLocalMarketingWorkflows() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    } catch (e) {
      return {};
    }
  }

  #getLocalBudgets() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_budgets') || '{}');
    } catch (e) {
      return {};
    }
  }

  #getLocalExpenses() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_expenses') || '{}');
    } catch (e) {
      return {};
    }
  }

  #getLocalPayroll() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_payroll') || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * Save marketing workflows to localStorage fallback
   * @private
   * @param {Object} workflows - Object of workflow objects keyed by ID
   */
  #saveLocalMarketingWorkflows(workflows) {
    try {
      localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(workflows));
    } catch (e) {
      console.error('[DB]: Failed to save marketing workflows to localStorage', e);
    }
  }

  /**
   * Save marketing workflow to Firestore or localStorage fallback
   * @param {Object} workflow - Workflow object to save
   * @returns {Promise<Object>} Saved workflow
   */
  async saveMarketingWorkflow(workflow) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalMarketingWorkflows();
      local[workflow.id] = { ...workflow, updatedAt: new Date().toISOString() };
      this.#saveLocalMarketingWorkflows(local);
      return workflow;
    }

    try {
      const docRef = doc(db, MARKETING_WORKFLOWS_COLLECTION, workflow.id);
      await setDoc(docRef, { ...workflow, updatedAt: new Date().toISOString() }, { merge: true });
      return workflow;
    } catch (err) {
      console.warn('[DB]: Firestore marketing workflow save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalMarketingWorkflows();
      local[workflow.id] = { ...workflow, updatedAt: new Date().toISOString() };
      this.#saveLocalMarketingWorkflows(local);
      return workflow;
    }
  }

  /**
   * Get all marketing workflows from Firestore or localStorage fallback
   * @returns {Promise<Array>} Array of workflow objects
   */
  async getMarketingWorkflows() {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalMarketingWorkflows();
      return Object.values(local);
    }

    try {
      const querySnapshot = await getDocs(collection(db, MARKETING_WORKFLOWS_COLLECTION));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[DB]: Firestore marketing workflows get error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalMarketingWorkflows();
      return Object.values(local);
    }
  }

  /**
   * Delete marketing workflow from Firestore or localStorage fallback
   * @param {string} workflowId - Workflow ID to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteMarketingWorkflow(workflowId) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalMarketingWorkflows();
      delete local[workflowId];
      this.#saveLocalMarketingWorkflows(local);
      return true;
    }

    try {
      const docRef = doc(db, MARKETING_WORKFLOWS_COLLECTION, workflowId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore marketing workflow delete error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalMarketingWorkflows();
      delete local[workflowId];
      this.#saveLocalMarketingWorkflows(local);
      return true;
    }
  }

  /**
   * Get kanban tasks from localStorage fallback
   * @private
   * @returns {Object} Object of task objects keyed by ID
   */
  #getLocalKanbanTasks() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_kanban_tasks') || '{}');
    } catch (e) {
      return {};
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
        const querySnapshot = await queryWith3SecTimeout(originalGetDocs(collection(db, 'finances_payroll')));
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
        const docSnap = await queryWith3SecTimeout(originalGetDoc(docRef));
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

  /**
   * Save kanban tasks to localStorage fallback
   * @private
   * @param {Object} tasks - Object of task objects keyed by ID
   */
  #saveLocalKanbanTasks(tasks) {
    try {
      localStorage.setItem('foundation_local_kanban_tasks', JSON.stringify(tasks));
    } catch (e) {
      console.error('[DB]: Failed to save kanban tasks to localStorage', e);
    }
  }

  /**
   * Save kanban task to Firestore or localStorage fallback
   * @param {Object} task - Task object to save
   * @returns {Promise<Object>} Saved task
   */
  async saveKanbanTask(task) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalKanbanTasks();
      local[task.id] = { ...task, updatedAt: new Date().toISOString() };
      this.#saveLocalKanbanTasks(local);
      return task;
    }

    try {
      const docRef = doc(db, KANBAN_TASKS_COLLECTION, task.id);
      await setDoc(docRef, { ...task, updatedAt: new Date().toISOString() }, { merge: true });
      return task;
    } catch (err) {
      console.warn('[DB]: Firestore kanban task save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalKanbanTasks();
      local[task.id] = { ...task, updatedAt: new Date().toISOString() };
      this.#saveLocalKanbanTasks(local);
      return task;
    }
  }

  /**
   * Get all kanban tasks from Firestore or localStorage fallback
   * @returns {Promise<Array>} Array of task objects
   */
  async getKanbanTasks() {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalKanbanTasks();
      return Object.values(local);
    }

    try {
      const querySnapshot = await getDocs(collection(db, KANBAN_TASKS_COLLECTION));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[DB]: Firestore kanban tasks get error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalKanbanTasks();
      return Object.values(local);
    }
  }

  /**
   * Delete kanban task from Firestore or localStorage fallback
   * @param {string} taskId - Task ID to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteKanbanTask(taskId) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalKanbanTasks();
      delete local[taskId];
      this.#saveLocalKanbanTasks(local);
      return true;
    }

    try {
      const docRef = doc(db, KANBAN_TASKS_COLLECTION, taskId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore kanban task delete error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalKanbanTasks();
      delete local[taskId];
      this.#saveLocalKanbanTasks(local);
      return true;
    }
  }

  /**
   * Get vault credentials from localStorage fallback
   * @private
   * @returns {Object} Object of credential objects keyed by ID
   */
  #getLocalVaultCredentials() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * Save vault credentials to localStorage fallback
   * @private
   * @param {Object} credentials - Object of credential objects keyed by ID
   */
  #saveLocalVaultCredentials(credentials) {
    try {
      localStorage.setItem('foundation_local_vault_credentials', JSON.stringify(credentials));
    } catch (e) {
      console.error('[DB]: Failed to save vault credentials to localStorage', e);
    }
  }

  /**
   * Save vault credential to Firestore or localStorage fallback
   * @param {Object} record - Credential record to save
   * @returns {Promise<Object>} Saved credential record
   */
  async saveVaultCredential(record) {
    const credential = record;

    // Trigger Google Workspace Password Vault Integration & Secret Sync if OAuth is active
    try {
      const { getGoogleAccessToken } = await import('./google-services.js');
      const token = await getGoogleAccessToken(false);
      if (token) {
        const { syncCredentialToGoogleVault } = await import('../utils/backend-google.js');
        const syncRes = await syncCredentialToGoogleVault(token, credential);
        if (syncRes && syncRes.success) {
          // Securely map LastPass and Google Workspace Vault hashes under configManager.current.vault
          const currentVaultConfig = configManager.current.vault || {};
          currentVaultConfig[credential.id] = {
            googleVaultHash: syncRes.googleVaultHash,
            lastpassHash: syncRes.lastpassHash,
            syncedAt: new Date().toISOString()
          };
          await configManager.saveToFirebase({
            ...configManager.current,
            vault: currentVaultConfig
          });
        }
      }
    } catch (syncErr) {
      console.warn('[DB]: Google Password Vault sync deferred or offline.', syncErr.message);
    }

    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalVaultCredentials();
      local[credential.id] = { ...credential, updatedAt: new Date().toISOString() };
      this.#saveLocalVaultCredentials(local);
      return credential;
    }

    try {
      const docRef = doc(db, VAULT_CREDENTIALS_COLLECTION, credential.id);
      await setDoc(docRef, { ...credential, updatedAt: new Date().toISOString() }, { merge: true });
      return credential;
    } catch (err) {
      console.warn('[DB]: Firestore vault credential save error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalVaultCredentials();
      local[credential.id] = { ...credential, updatedAt: new Date().toISOString() };
      this.#saveLocalVaultCredentials(local);
      return credential;
    }
  }

  /**
   * Get all vault credentials from Firestore or localStorage fallback
   * @returns {Promise<Array>} Array of credential objects
   */
  async getVaultCredentials() {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalVaultCredentials();
      return Object.values(local);
    }

    try {
      const querySnapshot = await getDocs(collection(db, VAULT_CREDENTIALS_COLLECTION));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('[DB]: Firestore vault credentials get error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalVaultCredentials();
      return Object.values(local);
    }
  }

  /**
   * Delete vault credential from Firestore or localStorage fallback
   * @param {string} credentialId - Credential ID to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteVaultCredential(credentialId) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalVaultCredentials();
      delete local[credentialId];
      this.#saveLocalVaultCredentials(local);
      return true;
    }

    try {
      const docRef = doc(db, VAULT_CREDENTIALS_COLLECTION, credentialId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore vault credential delete error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalVaultCredentials();
      delete local[credentialId];
      this.#saveLocalVaultCredentials(local);
      return true;
    }
  }

  // --- Dynamic Custom Pages & User Interaction Helpers ---

  #getLocalPages() {
    try {
      const stored = localStorage.getItem('foundation_local_pages');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}

    const seeded = {
      "our-story": {
        type: "page",
        id: "our-story",
        slug: "our-story",
        title: "Our Story",
        editorType: "grapesjs",
        compiledHtml: `
          <section style="padding: 40px 0; font-family: system-ui, sans-serif;">
            <h1 style="color: #2b6cb0; font-weight: 800; font-size: 2rem; margin-bottom: 16px;">Our Story</h1>
            <p style="color: #4a5568; line-height: 1.6; font-size: 1.05rem;">We started Foundation with a simple mission: to build fast, beautiful, and maintainable web platforms without the bloat of modern bundling tooling.</p>
          </section>
        `,
        compiledCss: "",
        access: { visibility: "public" },
        updatedAt: new Date().toISOString()
      }
    };
    this.#saveLocalPages(seeded);
    return seeded;
  }

  #saveLocalPages(data) {
    localStorage.setItem('foundation_local_pages', JSON.stringify(data));
  }

  async saveCustomPage(pageData) {
    const payload = {
      ...pageData,
      type: 'page',
      updatedAt: new Date().toISOString()
    };
    schemaRegistry.validate(payload);

    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalPages();
      local[payload.id] = payload;
      this.#saveLocalPages(local);
      return true;
    }

    try {
      const docRef = doc(db, PAGES_COLLECTION, payload.id);
      await setDoc(docRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('[DB]: Firestore pages write error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalPages();
      local[payload.id] = payload;
      this.#saveLocalPages(local);
      return true;
    }
  }

  async getCustomPageBySlug(slug) {
    const db = getFirestoreDB();
    if (!db) {
      const local = this.#getLocalPages();
      const page = local[slug] || null;
      if (page) schemaRegistry.validate(page);
      return page;
    }

    try {
      const docRef = doc(db, PAGES_COLLECTION, slug);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        schemaRegistry.validate(data);
        return data;
      }
    } catch (err) {
      console.warn('[DB]: Firestore pages read error. Falling back to LocalStorage.', err.message);
    }

    const local = this.#getLocalPages();
    const page = local[slug] || null;
    if (page) {
      try {
        schemaRegistry.validate(page);
      } catch (e) {}
    }
    return page;
  }

  async getAllCustomPages() {
    const results = [];
    const db = getFirestoreDB();
    if (db) {
      try {
        const user = store.state.user;
        const isAdmin = user?.isAdmin;
        const isEditor = user?.role === 'editor';
        let q;
        const colRef = collection(db, PAGES_COLLECTION);
        if (isAdmin || isEditor) {
          q = colRef;
        } else {
          q = query(colRef, where('access.visibility', '==', 'public'));
        }
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          try {
            schemaRegistry.validate(data);
          } catch (e) {}
          results.push(data);
        });
        if (results.length > 0) return results;
      } catch (err) {
        console.warn('[DB]: Cloud Firestore pages query bypassed or unreachable.', err.message);
      }
    }

    // fallback to local
    const local = this.#getLocalPages();
    const user = store.state.user;
    const isAdmin = user?.isAdmin;
    const isEditor = user?.role === 'editor';
    Object.values(local).forEach(item => {
      if (isAdmin || isEditor || item.access?.visibility === 'public') {
        try {
          schemaRegistry.validate(item);
        } catch (e) {}
        results.push(item);
      }
    });
    return results;
  }

  async getCustomPages() {
    return this.getAllCustomPages();
  }

  async getUser(userId) {
    const users = await this.getAllUsers();
    return users.find(u => u.id === userId || u.email === userId) || null;
  }

  async getUserPurchases(userId) {
    const allInvoices = await this.getAllInvoices();
    return allInvoices.filter(inv => inv.userId === userId || inv.customerEmail === userId);
  }

  async getUserNotifications(userId) {
    try {
      const announcements = await this.getContentByType('announcement');
      return announcements.map(ann => ({
        id: ann.id,
        title: ann.title,
        message: ann.description,
        date: ann.date,
        type: 'broadcast'
      }));
    } catch (e) {
      return [];
    }
  }

  // --- User Progress Persistence Helpers ---

  #getLocalCourseProgress() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_course_progress') || '{}');
    } catch (e) {
      return {};
    }
  }

  #saveLocalCourseProgress(data) {
    try {
      localStorage.setItem('foundation_local_course_progress', JSON.stringify(data));
    } catch (e) {
      console.error('[DB]: Failed to save course progress to localStorage', e);
    }
  }

  /**
   * Saves course progress for a user.
   */
  async saveUserCourseProgress(userId, courseId, progressData) {
    const dbInstance = getFirestoreDB();
    const payload = {
      ...progressData,
      userId,
      courseId,
      updatedAt: new Date().toISOString()
    };

    if (!dbInstance) {
      const local = this.#getLocalCourseProgress();
      const key = `${userId}_${courseId}`;
      local[key] = payload;
      this.#saveLocalCourseProgress(local);
      return payload;
    }

    try {
      const docRef = doc(dbInstance, USERS_COLLECTION, userId, 'course_progress', courseId);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore course progress write error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalCourseProgress();
      const key = `${userId}_${courseId}`;
      local[key] = payload;
      this.#saveLocalCourseProgress(local);
      return payload;
    }
  }

  /**
   * Retrieves course progress for a user and course.
   */
  async getUserCourseProgress(userId, courseId) {
    const dbInstance = getFirestoreDB();
    if (!dbInstance) {
      const local = this.#getLocalCourseProgress();
      const key = `${userId}_${courseId}`;
      return local[key] || null;
    }

    try {
      const docRef = doc(dbInstance, USERS_COLLECTION, userId, 'course_progress', courseId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (err) {
      console.warn('[DB]: Firestore course progress read error. Falling back to LocalStorage.', err.message);
      const local = this.#getLocalCourseProgress();
      const key = `${userId}_${courseId}`;
      return local[key] || null;
    }
  }

  /**
   * Retrieves all course progress records for a user.
   */
  async getUserAllProgress(userId) {
    const dbInstance = getFirestoreDB();
    if (!dbInstance) {
      const local = this.#getLocalCourseProgress();
      return Object.values(local).filter(item => item.userId === userId);
    }

    try {
      const colRef = collection(dbInstance, USERS_COLLECTION, userId, 'course_progress');
      const querySnapshot = await getDocs(colRef);
      const results = [];
      querySnapshot.forEach(docSnap => {
        results.push(docSnap.data());
      });
      if (results.length > 0) return results;
    } catch (err) {
      console.warn('[DB]: Firestore course progress query error. Falling back to LocalStorage.', err.message);
    }

    const local = this.#getLocalCourseProgress();
    return Object.values(local).filter(item => item.userId === userId);
  }

  // --- VA Management & Evaluation Helpers ---

  async saveVaCandidate(data) {
    return this.saveContent(data);
  }

  async getVaCandidates(statusFilter = 'all') {
    const all = await this.getAllContent();
    let vas = all.filter(item => item.type === 'va_candidate' || item.type === 'va_hired');
    if (statusFilter && statusFilter !== 'all') {
      vas = vas.filter(item => item.status === statusFilter);
    }
    return vas;
  }

  async getVaActivityLogs(editorId) {
    const logs = [];
    const user = await this.getUser(editorId);
    const editorEmail = user?.email || editorId;
    const editorName = user?.name || '';

    // 1. Get Kanban Tasks
    try {
      const tasks = await this.getKanbanTasks();
      const assignedTasks = tasks.filter(t => t.assigneeId === editorId || t.assigneeId === editorEmail);
      assignedTasks.forEach(task => {
        logs.push({
          id: `log_task_${task.id}`,
          timestamp: task.updatedAt || task.createdAt || new Date().toISOString(),
          type: 'task',
          description: `Assigned Kanban Task: "${task.title}" (Status: ${task.status})`,
          details: task.description || ''
        });
      });
    } catch (e) {
      console.warn('Error fetching tasks for activity logs', e);
    }

    // 2. Get Content Submissions
    try {
      const contentItems = await this.getAllContent();
      const editorContent = contentItems.filter(item =>
        item.author === editorEmail ||
        item.author === editorName ||
        (item.author && item.author.toLowerCase() === editorName.toLowerCase())
      );
      editorContent.forEach(item => {
        logs.push({
          id: `log_content_${item.id}`,
          timestamp: item.updatedAt || item.date || new Date().toISOString(),
          type: 'content',
          description: `CMS Content Published: "${item.title}" (Type: ${item.type})`,
          details: item.description || ''
        });
      });
    } catch (e) {
      console.warn('Error fetching content for activity logs', e);
    }

    // 3. Get Marketing Workflows
    try {
      const workflows = await this.getMarketingWorkflows();
      const editorWorkflows = workflows.filter(w => w.createdBy === editorId || w.createdBy === editorEmail);
      editorWorkflows.forEach(w => {
        logs.push({
          id: `log_wf_${w.id}`,
          timestamp: w.updatedAt || new Date().toISOString(),
          type: 'marketing',
          description: `Marketing Workflow Drafted: "${w.name}"`,
          details: w.description || ''
        });
      });
    } catch (e) {
      console.warn('Error fetching workflows for activity logs', e);
    }

    // Sort logs newest first
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return logs;
  }

  async assignLastpassVaultAccess(vaultId, editorId) {
    const creds = await this.getVaultCredentials();
    const cred = creds.find(c => c.id === vaultId);
    if (!cred) {
      throw new Error(`Vault credential with ID ${vaultId} not found`);
    }
    cred.assignedEditorId = editorId || null;
    cred.updatedAt = new Date().toISOString();
    return this.saveVaultCredential(cred);
  }

  async updateKanbanTaskStatus(taskId, columnId, editorId) {
    const tasks = await this.getKanbanTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Kanban task with ID ${taskId} not found`);
    }
    task.status = columnId;
    if (editorId) {
      task.updatedBy = editorId;
    }
    task.updatedAt = new Date().toISOString();
    return this.saveKanbanTask(task);
  }

  // --- OWASP ZAP Scans Persistence ---
  async saveZapScanResult(data) {
    const payload = {
      ...data,
      type: 'zap_scans',
      id: data.id || `zap_${Date.now()}`
    };
    schemaRegistry.validate(payload);
    const db = getFirestoreDB();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
      local[payload.id] = payload;
      localStorage.setItem('foundation_local_security_scans', JSON.stringify(local));
      return payload;
    }
    try {
      const docRef = doc(db, 'security_scans', payload.id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
      local[payload.id] = payload;
      localStorage.setItem('foundation_local_security_scans', JSON.stringify(local));
      return payload;
    }
  }

  async getZapScanHistory() {
    const db = getFirestoreDB();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
      return Object.values(local).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'security_scans'));
      return querySnapshot.docs.map(doc => doc.data()).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
      return Object.values(local).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    }
  }

  // --- Marketing Segments Persistence ---
  async saveMarketingSegment(segmentData) {
    const payload = {
      ...segmentData,
      type: 'marketing_segments',
      id: segmentData.id || `seg_${Date.now()}`
    };
    schemaRegistry.validate(payload);
    const db = getFirestoreDB();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
      local[payload.id] = payload;
      localStorage.setItem('foundation_local_marketing_segments', JSON.stringify(local));
      return payload;
    }
    try {
      const docRef = doc(db, 'marketing_segments', payload.id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
      local[payload.id] = payload;
      localStorage.setItem('foundation_local_marketing_segments', JSON.stringify(local));
      return payload;
    }
  }

  async getMarketingSegments() {
    const db = getFirestoreDB();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
      return Object.values(local);
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'marketing_segments'));
      return querySnapshot.docs.map(doc => doc.data());
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
      return Object.values(local);
    }
  }

  async getMarketingSegmentById(id) {
    const segments = await this.getMarketingSegments();
    return segments.find(s => s.id === id) || null;
  }

  async evaluateSegmentUsers(segmentId) {
    const segment = await this.getMarketingSegmentById(segmentId);
    if (!segment) return [];
    const users = await this.getAllUsers();
    const { marketingEngine } = await import('./marketingEngine.js');
    return users.filter(user => marketingEngine.evaluateSegment(user, segment));
  }

  // --- Marketing Journeys (mapped to marketing_workflows) ---
  async saveMarketingJourney(journeyData) {
    const payload = {
      ...journeyData,
      type: 'marketing_journeys',
      id: journeyData.id || `journey_${Date.now()}`
    };
    schemaRegistry.validate(payload);
    return this.saveMarketingWorkflow(payload);
  }

  // --- Email Templates Persistence ---
  async saveEmailTemplate(templateRecord) {
    const payload = {
      ...templateRecord,
      type: 'email_templates',
      id: templateRecord.id || `tpl_${Date.now()}`
    };
    schemaRegistry.validate(payload);
    const db = getFirestoreDB();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
      local[payload.id] = payload;
      localStorage.setItem('foundation_local_email_templates', JSON.stringify(local));
      return payload;
    }
    try {
      const docRef = doc(db, 'email_templates', payload.id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
      local[payload.id] = payload;
      localStorage.setItem('foundation_local_email_templates', JSON.stringify(local));
      return payload;
    }
  }

  async getEmailTemplates() {
    const db = getFirestoreDB();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
      return Object.values(local);
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'email_templates'));
      return querySnapshot.docs.map(doc => doc.data());
    } catch (err) {
      const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
      return Object.values(local);
    }
  }

  async getEmailTemplateById(id) {
    const templates = await this.getEmailTemplates();
    return templates.find(t => t.id === id) || null;
  }

  // --- Event Management Helpers ---
  async saveEvent(eventData) {
    const payload = {
      ...eventData,
      type: 'event'
    };
    return this.saveContent(payload);
  }

  async getEventBySlug(slug) {
    const all = await this.getAllEvents();
    return all.find(e => e.slug === slug || e.id === slug) || null;
  }

  async getAllEvents() {
    const all = await this.getAllContent();
    return all.filter(e => e.type === 'event');
  }

  async updateTicketAvailability(eventId, ticketTypeId, quantity) {
    const event = await this.getContentById(eventId);
    if (!event) return false;

    let updated = false;

    if (event.ticketTypes) {
      const tType = event.ticketTypes.find(t => t.id === ticketTypeId);
      if (tType) {
        tType.sold = (tType.sold || 0) + quantity;
        updated = true;
      }
    }

    if (event.vendorPackages) {
      const vPkg = event.vendorPackages.find(v => v.id === ticketTypeId);
      if (vPkg) {
        vPkg.capacity = Math.max(0, (vPkg.capacity || 0) - quantity);
        vPkg.sold = (vPkg.sold || 0) + quantity;
        updated = true;
      }
    }

    if (event.sponsorshipPackages) {
      const sPkg = event.sponsorshipPackages.find(s => s.id === ticketTypeId);
      if (sPkg) {
        sPkg.capacity = Math.max(0, (sPkg.capacity || 0) - quantity);
        sPkg.sold = (sPkg.sold || 0) + quantity;
        updated = true;
      }
    }

    if (updated) {
      return this.saveEvent(event);
    }
    return false;
  }

  async saveRegistration(regData) {
    const db = getFirestoreDB();
    const id = regData.id || `reg_${Date.now()}`;
    const payload = { ...regData, id, updatedAt: new Date().toISOString() };

    // Save to local storage fallback
    try {
      const local = JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
      const index = local.findIndex(r => r.id === id);
      if (index !== -1) {
        local[index] = payload;
      } else {
        local.push(payload);
      }
      localStorage.setItem('foundation_local_registrations', JSON.stringify(local));
    } catch (e) {
      console.warn('Failed to save registration locally', e);
    }

    if (!db) return payload;

    try {
      const docRef = doc(db, 'registrations', id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore registration save error.', err.message);
      return payload;
    }
  }

  async getRegistrationsByUser(email) {
    const db = getFirestoreDB();
    if (!db) {
      const local = JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
      return local.filter(r => r.email === email);
    }
    try {
      const q = query(collection(db, 'registrations'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach(docSnap => {
        results.push(docSnap.data());
      });
      if (results.length > 0) return results;
    } catch (e) {
      console.warn('[DB]: Failed to query registrations from firestore, falling back', e);
    }
    const local = JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
    return local.filter(r => r.email === email);
  }

  async getAllRegistrations() {
    const db = getFirestoreDB();
    if (!db) {
      return JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'registrations'));
      const results = [];
      querySnapshot.forEach(docSnap => {
        results.push(docSnap.data());
      });
      if (results.length > 0) return results;
    } catch (err) {
      console.warn('[DB]: Failed to fetch registrations, falling back', err);
    }
    return JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
  }

  // --- Appointments Helpers ---
  async saveAppointment(apptData) {
    const db = getFirestoreDB();
    const id = apptData.id || `appt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = { ...apptData, id, updatedAt: new Date().toISOString() };

    // LocalStorage sync/fallback
    try {
      const local = JSON.parse(localStorage.getItem('foundation_local_appointments') || '[]');
      const idx = local.findIndex(a => a.id === id);
      if (idx !== -1) {
        local[idx] = payload;
      } else {
        local.push(payload);
      }
      localStorage.setItem('foundation_local_appointments', JSON.stringify(local));
    } catch (e) {
      console.warn('Failed to save appointment locally', e);
    }

    if (!db) return payload;

    try {
      const docRef = doc(db, 'appointments', id);
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      console.warn('[DB]: Firestore appointment save error.', err.message);
      return payload;
    }
  }

  async getAppointments() {
    const db = getFirestoreDB();
    if (!db) {
      return JSON.parse(localStorage.getItem('foundation_local_appointments') || '[]');
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'appointments'));
      const results = [];
      querySnapshot.forEach(docSnap => {
        results.push(docSnap.data());
      });
      if (results.length > 0) return results;
    } catch (err) {
      console.warn('[DB]: Failed to fetch appointments from Firestore, falling back', err);
    }
    return JSON.parse(localStorage.getItem('foundation_local_appointments') || '[]');
  }
}

/**
 * Singleton instance of ContentDB
 * @type {ContentDB}
 */
export const contentDB = new ContentDB();

/**
 * Generic db wrapper with Redux-like state getter and basic CRUD + query support
 * to satisfy standard db test requirements.
 */
export const db = {
  get state() {
    return {};
  },
  async set(id, data) {
    const firestoreDb = getFirestoreDB();
    if (!firestoreDb) {
      const local = this._getLocal();
      local[id] = { ...data, id, updatedAt: new Date().toISOString() };
      this._saveLocal(local);
      return true;
    }
    try {
      const docRef = doc(firestoreDb, CONTENT_COLLECTION, id);
      await setDoc(docRef, {
        ...data,
        id,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (err) {
      const local = this._getLocal();
      local[id] = { ...data, id, updatedAt: new Date().toISOString() };
      this._saveLocal(local);
      return true;
    }
  },
  async get(id) {
    const firestoreDb = getFirestoreDB();
    if (!firestoreDb) {
      const local = this._getLocal();
      return local[id] || null;
    }
    try {
      const docRef = doc(firestoreDb, CONTENT_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (err) {
      console.warn('[DB]: Firestore read error.', err.message);
    }
    const local = this._getLocal();
    return local[id] || null;
  },
  async delete(id) {
    const firestoreDb = getFirestoreDB();
    if (!firestoreDb) {
      const local = this._getLocal();
      delete local[id];
      this._saveLocal(local);
      return true;
    }
    try {
      const docRef = doc(firestoreDb, CONTENT_COLLECTION, id);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      const local = this._getLocal();
      delete local[id];
      this._saveLocal(local);
      return true;
    }
  },
  async query(filterFn) {
    const results = [];
    const firestoreDb = getFirestoreDB();
    if (firestoreDb) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, CONTENT_COLLECTION));
        querySnapshot.forEach((docSnap) => {
          results.push(docSnap.data());
        });
      } catch (err) {
        console.warn('[DB]: Query failed, falling back to local', err.message);
      }
    }
    const local = this._getLocal();
    const localVals = Object.values(local);
    const seen = new Set();
    const merged = [];
    results.forEach(r => {
      if (r.id) {
        seen.add(r.id);
        merged.push(r);
      }
    });
    localVals.forEach(r => {
      if (r.id && !seen.has(r.id)) {
        merged.push(r);
      }
    });
    return merged.filter(filterFn);
  },
  _getLocal() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_content') || '{}');
    } catch (e) {
      return {};
    }
  },
  _saveLocal(data) {
    localStorage.setItem('foundation_local_content', JSON.stringify(data));
  }
};
