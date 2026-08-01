// core/db.js - Re-export and Delegation Hub
import { getFirestoreDB } from './db-shared.js';

import {
  saveContent, getContentById, getAllContent, getContentByType, deleteContent,
  saveCustomPage, getCustomPageBySlug, getAllCustomPages,
  saveZapScanResult, getZapScanHistory, saveMarketingSegment, getMarketingSegments,
  getMarketingSegmentById, evaluateSegmentUsers, saveMarketingJourney,
  saveEmailTemplate, getEmailTemplates, getEmailTemplateById,
  saveVaultCredential, getVaultCredentials, deleteVaultCredential,
  saveVaCandidate, getVaCandidates, getVaActivityLogs, assignLastpassVaultAccess,
  saveMarketingWorkflow, getMarketingWorkflows, deleteMarketingWorkflow
} from './db-content.js';

import {
  getAllUsers, saveUser, getUser, deleteUser,
  saveUserCourseProgress, getUserCourseProgress, getUserAllProgress
} from './db-users.js';

import {
  saveInvoice, getInvoice, getAllInvoices, getInvoicesByCustomer, getInvoicesByGoogleContact, deleteInvoice,
  saveExpense, getExpenses, savePayrollRecord, getPayrollRecords,
  saveBudgetTargets, getBudgets, saveEmployee, getEmployees, deleteEmployee
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
}

export const contentDB = new ContentDB();

export const db = {
  get state() {
    return {};
  },
  async set(id, data) {
    return saveContent({ ...data, id });
  },
  async get(id) {
    return getContentById(id);
  },
  async delete(id) {
    return deleteContent(id);
  },
  async query(filterFn) {
    const all = await getAllContent();
    return all.filter(filterFn);
  }
};

export { getFirestoreDB };
