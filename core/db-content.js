// core/db-content.js - Content & Custom Pages Repository
import {
  getFirestoreDB, doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, limit,
  queryWith3SecTimeout, originalGetDocs, CONTENT_COLLECTION, PAGES_COLLECTION,
  VAULT_CREDENTIALS_COLLECTION, schemaRegistry, store,
  getLocalContent, saveLocalContent, getLocalPages, saveLocalPages
} from './db-shared.js';
import { configManager } from './config.js';

const ZAP_SCANS_COLLECTION = 'security_scans';
const MARKETING_SEGMENTS_COLLECTION = 'marketing_segments';
const MARKETING_WORKFLOWS_COLLECTION = 'marketing_workflows';
const EMAIL_TEMPLATES_COLLECTION = 'email_templates';
const KANBAN_TASKS_COLLECTION = 'kanban_tasks';

const getHipaaModule = async () => {
  return await import('../utils/hipaa-audit.js');
};

async function decryptSensitiveFields(item) {
  if (!item) return item;
  const hasEncrypted = item.encryptedDescription || item.encryptedLongFormText || item.encryptedPersonalDetails;
  if (hasEncrypted) {
    try {
      const hipaa = await getHipaaModule();
      if (item.encryptedDescription) {
        const dec = await hipaa.decryptPHIRecord(
          item.encryptedDescription.cipherText,
          item.encryptedDescription.iv,
          item.encryptedDescription.salt
        );
        item.description = dec;
      }
      if (item.encryptedLongFormText) {
        const dec = await hipaa.decryptPHIRecord(
          item.encryptedLongFormText.cipherText,
          item.encryptedLongFormText.iv,
          item.encryptedLongFormText.salt
        );
        item.longFormText = JSON.parse(dec);
      }
      if (item.encryptedPersonalDetails) {
        const dec = await hipaa.decryptPHIRecord(
          item.encryptedPersonalDetails.cipherText,
          item.encryptedPersonalDetails.iv,
          item.encryptedPersonalDetails.salt
        );
        item.personalDetails = JSON.parse(dec);
      }

      // Log HIPAA Read access
      await hipaa.logHipaaAccess('READ', item.id, 'SUCCESS', { notes: `Sensitive record decrypted/accessed: ${item.title || item.id}` });
    } catch (err) {
      console.warn('[HIPAA Secure Read]: Decryption or logging failed.', err);
    }
  }
  return item;
}

/**
 * Save content to Firestore or localStorage fallback
 * @param {Object} contentData - Content data to save
 * @returns {Promise<boolean>} True if save was successful
 */
export async function saveContent(contentData) {
  const dataWithDefaults = {
    description: 'Default Description',
    longFormText: [],
    author: 'Default Author',
    date: new Date().toISOString(),
    access: { visibility: 'public' },
    ...contentData
  };

  schemaRegistry.validate(dataWithDefaults);

  const isSensitive = dataWithDefaults.isPHIRecord || dataWithDefaults.type === 'va_candidate' || dataWithDefaults.type === 'va_hired';
  let processedData = { ...dataWithDefaults };

  if (isSensitive) {
    try {
      const hipaa = await getHipaaModule();
      // Encrypt description and longFormText if they exist and are not already encrypted
      if (processedData.description && !processedData.encryptedDescription && processedData.description !== '[ENCRYPTED ePHI]') {
        const encDesc = await hipaa.encryptPHIRecord(processedData.description);
        processedData.encryptedDescription = encDesc;
        processedData.description = '[ENCRYPTED ePHI]';
      }
      if (processedData.longFormText && Array.isArray(processedData.longFormText) && processedData.longFormText.length > 0 && !processedData.encryptedLongFormText) {
        const textStr = JSON.stringify(processedData.longFormText);
        const encText = await hipaa.encryptPHIRecord(textStr);
        processedData.encryptedLongFormText = encText;
        processedData.longFormText = ['[ENCRYPTED ePHI]'];
      }
      if (processedData.personalDetails && !processedData.encryptedPersonalDetails) {
        const detailsStr = JSON.stringify(processedData.personalDetails);
        const encDetails = await hipaa.encryptPHIRecord(detailsStr);
        processedData.encryptedPersonalDetails = encDetails;
        delete processedData.personalDetails;
      }

      // Log HIPAA Write access
      await hipaa.logHipaaAccess('WRITE', processedData.id, 'SUCCESS', { notes: `Sensitive record saved: ${processedData.title || processedData.id}` });
    } catch (err) {
      console.warn('[HIPAA Secure Write]: Encryption or logging failed.', err);
    }
  }

  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalContent();
    local[processedData.id] = { ...processedData, updatedAt: new Date().toISOString() };
    saveLocalContent(local);
    return true;
  }

  try {
    const docRef = doc(db, CONTENT_COLLECTION, processedData.id);
    await setDoc(docRef, { ...processedData, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore permission or write error. Falling back to LocalStorage.', err.message);
    const local = getLocalContent();
    local[processedData.id] = { ...processedData, updatedAt: new Date().toISOString() };
    saveLocalContent(local);
    return true;
  }
}

/**
 * Get content by ID from Firestore or localStorage fallback
 * @param {string} id - Content ID
 * @returns {Promise<Object|null>} Content object or null if not found
 */
export async function getContentById(id) {
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalContent();
    if (local[id]) {
      schemaRegistry.validate(local[id]);
      return await decryptSensitiveFields(local[id]);
    }
    return null;
  }

  try {
    const docRef = doc(db, CONTENT_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      schemaRegistry.validate(data);
      return await decryptSensitiveFields(data);
    }
  } catch (err) {
    console.warn('[DB]: Firestore read error. Falling back to LocalStorage.', err.message);
  }

  const local = getLocalContent();
  if (local[id]) {
    try {
      schemaRegistry.validate(local[id]);
      return await decryptSensitiveFields(local[id]);
    } catch (e) {}
  }
  return null;
}

/**
 * Get all content from Firestore or localStorage fallback
 * @returns {Promise<Array>} Array of content objects
 */
export async function getAllContent() {
  const results = [];
  const db = getFirestoreDB();

  if (db) {
    try {
      const user = store.state.user;
      const isAdmin = user?.isAdmin;
      let q;
      const contentRef = collection(db, CONTENT_COLLECTION);
      if (isAdmin) {
        q = contentRef;
      } else {
        q = query(contentRef, where('access.visibility', '==', 'public'));
      }
      const querySnapshot = await queryWith3SecTimeout(originalGetDocs(q));
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        try {
          schemaRegistry.validate(data);
          const decrypted = await decryptSensitiveFields(data);
          results.push(decrypted);
        } catch (e) {}
      }
      if (results.length > 0) return results;
    } catch (err) {
      console.warn('[DB]: Cloud Firestore query bypassed or unreachable.', err.message);
    }
  }

  // fallback to local
  const local = getLocalContent();
  for (const item of Object.values(local)) {
    try {
      schemaRegistry.validate(item);
      const decrypted = await decryptSensitiveFields(item);
      results.push(decrypted);
    } catch (e) {}
  }
  return results;
}

/**
 * Get content by type from Firestore or LocalStorage fallback
 */
export async function getContentByType(type, maxItems = 12) {
  if (type === 'all') {
    const all = await getAllContent();
    return all.slice(0, maxItems);
  }

  const results = [];
  const db = getFirestoreDB();

  if (db) {
    try {
      const user = store.state.user;
      const isAdmin = user?.isAdmin;
      let q;
      const contentRef = collection(db, CONTENT_COLLECTION);
      if (isAdmin) {
        q = query(
          contentRef,
          where('type', '==', type),
          limit(maxItems)
        );
      } else {
        q = query(
          contentRef,
          where('type', '==', type),
          where('access.visibility', '==', 'public'),
          limit(maxItems)
        );
      }
      const querySnapshot = await queryWith3SecTimeout(originalGetDocs(q));
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        try {
          schemaRegistry.validate(data);
          const decrypted = await decryptSensitiveFields(data);
          results.push(decrypted);
        } catch (e) {}
      }
      if (results.length > 0) return results;
    } catch (err) {
      console.warn('[DB]: Cloud Firestore query bypassed or unreachable.', err.message);
    }
  }

  // fallback to local
  const local = getLocalContent();
  for (const item of Object.values(local)) {
    if (item.type === type && results.length < maxItems) {
      try {
        schemaRegistry.validate(item);
        const decrypted = await decryptSensitiveFields(item);
        results.push(decrypted);
      } catch (e) {}
    }
  }
  return results;
}

/**
 * Delete content from Firestore or localStorage fallback
 * @param {string} id - Content ID to delete
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteContent(id) {
  const db = getFirestoreDB();
  const localPages = getLocalPages();

  if (localPages[id]) {
    delete localPages[id];
    saveLocalPages(localPages);
  }

  if (!db) {
    const local = getLocalContent();
    delete local[id];
    saveLocalContent(local);
    return true;
  }

  try {
    const docRef = doc(db, CONTENT_COLLECTION, id);
    await deleteDoc(docRef);
    try {
      const pageDocRef = doc(db, PAGES_COLLECTION, id);
      await deleteDoc(pageDocRef);
    } catch (e) {}
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore content delete error. Falling back to LocalStorage.', err.message);
    const local = getLocalContent();
    delete local[id];
    saveLocalContent(local);
    return true;
  }
}

export async function saveCustomPage(pageData) {
  const payload = { ...pageData, type: 'page', updatedAt: new Date().toISOString() };
  schemaRegistry.validate(payload);
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalPages();
    local[payload.id] = payload;
    saveLocalPages(local);
    return true;
  }

  try {
    const docRef = doc(db, PAGES_COLLECTION, payload.id);
    await setDoc(docRef, payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore pages write error. Falling back to LocalStorage.', err.message);
    const local = getLocalPages();
    local[payload.id] = payload;
    saveLocalPages(local);
    return true;
  }
}

export async function getCustomPageBySlug(slug) {
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalPages();
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

  const local = getLocalPages();
  const page = local[slug] || null;
  if (page) {
    try {
      schemaRegistry.validate(page);
    } catch (e) {}
  }
  return page;
}

export async function getAllCustomPages() {
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

  const local = getLocalPages();
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

// OWASP ZAP Scans Persistence
export async function saveZapScanResult(data) {
  const payload = { ...data, type: 'zap_scans', id: data.id || `zap_${Date.now()}` };
  schemaRegistry.validate(payload);
  const db = getFirestoreDB();

  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
    local[payload.id] = payload;
    localStorage.setItem('foundation_local_security_scans', JSON.stringify(local));
    return payload;
  }

  try {
    const docRef = doc(db, ZAP_SCANS_COLLECTION, payload.id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
    local[payload.id] = payload;
    localStorage.setItem('foundation_local_security_scans', JSON.stringify(local));
    return payload;
  }
}

export async function getZapScanHistory() {
  const db = getFirestoreDB();

  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
    return Object.values(local).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  try {
    const querySnapshot = await getDocs(collection(db, ZAP_SCANS_COLLECTION));
    return querySnapshot.docs.map(docSnap => docSnap.data()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '{}');
    return Object.values(local).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
}

// Marketing Segments Persistence
export async function saveMarketingSegment(segmentData) {
  const payload = { ...segmentData, type: 'marketing_segments', id: segmentData.id || `seg_${Date.now()}` };
  schemaRegistry.validate(payload);
  const db = getFirestoreDB();

  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
    local[payload.id] = payload;
    localStorage.setItem('foundation_local_marketing_segments', JSON.stringify(local));
    return payload;
  }

  try {
    const docRef = doc(db, MARKETING_SEGMENTS_COLLECTION, payload.id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
    local[payload.id] = payload;
    localStorage.setItem('foundation_local_marketing_segments', JSON.stringify(local));
    return payload;
  }
}

export async function getMarketingSegments() {
  const db = getFirestoreDB();

  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
    return Object.values(local);
  }

  try {
    const querySnapshot = await getDocs(collection(db, MARKETING_SEGMENTS_COLLECTION));
    return querySnapshot.docs.map(docSnap => docSnap.data());
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
    return Object.values(local);
  }
}

export async function getMarketingSegmentById(id) {
  const segments = await getMarketingSegments();
  return segments.find(s => s.id === id) || null;
}

export async function evaluateSegmentUsers(segmentId) {
  const segment = await getMarketingSegmentById(segmentId);
  if (!segment) return [];
  const { getAllUsers } = await import('./db-users.js');
  const users = await getAllUsers();
  const { marketingEngine } = await import('./marketingEngine.js');
  return users.filter(user => marketingEngine.evaluateSegment(user, segment));
}

// Marketing Journeys (mapped to marketing_workflows)
export async function saveMarketingJourney(journeyData) {
  const payload = { ...journeyData, type: 'marketing_journeys', id: journeyData.id || `journey_${Date.now()}` };
  schemaRegistry.validate(payload);
  return saveMarketingWorkflow(payload);
}

// Email Templates Persistence
export async function saveEmailTemplate(templateRecord) {
  const payload = { ...templateRecord, type: 'email_templates', id: templateRecord.id || `tpl_${Date.now()}` };
  schemaRegistry.validate(payload);
  const db = getFirestoreDB();

  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
    local[payload.id] = payload;
    localStorage.setItem('foundation_local_email_templates', JSON.stringify(local));
    return payload;
  }

  try {
    const docRef = doc(db, EMAIL_TEMPLATES_COLLECTION, payload.id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
    local[payload.id] = payload;
    localStorage.setItem('foundation_local_email_templates', JSON.stringify(local));
    return payload;
  }
}

export async function getEmailTemplates() {
  const db = getFirestoreDB();

  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
    return Object.values(local);
  }

  try {
    const querySnapshot = await getDocs(collection(db, EMAIL_TEMPLATES_COLLECTION));
    return querySnapshot.docs.map(docSnap => docSnap.data());
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_email_templates') || '{}');
    return Object.values(local);
  }
}

export async function getEmailTemplateById(id) {
  const templates = await getEmailTemplates();
  return templates.find(t => t.id === id) || null;
}

function getLocalMarketingWorkflows() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalMarketingWorkflows(workflows) {
  try {
    localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(workflows));
  } catch (e) {
    console.error('[DB]: Failed to save marketing workflows to localStorage', e);
  }
}

export async function saveMarketingWorkflow(workflow) {
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalMarketingWorkflows();
    local[workflow.id] = { ...workflow, updatedAt: new Date().toISOString() };
    saveLocalMarketingWorkflows(local);
    return workflow;
  }

  try {
    const docRef = doc(db, MARKETING_WORKFLOWS_COLLECTION, workflow.id);
    await setDoc(docRef, { ...workflow, updatedAt: new Date().toISOString() }, { merge: true });
    return workflow;
  } catch (err) {
    console.warn('[DB]: Firestore marketing workflow save error. Falling back to LocalStorage.', err.message);
    const local = getLocalMarketingWorkflows();
    local[workflow.id] = { ...workflow, updatedAt: new Date().toISOString() };
    saveLocalMarketingWorkflows(local);
    return workflow;
  }
}

export async function getMarketingWorkflows() {
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalMarketingWorkflows();
    return Object.values(local);
  }

  try {
    const querySnapshot = await getDocs(collection(db, MARKETING_WORKFLOWS_COLLECTION));
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn('[DB]: Firestore marketing workflows get error. Falling back to LocalStorage.', err.message);
    const local = getLocalMarketingWorkflows();
    return Object.values(local);
  }
}

export async function deleteMarketingWorkflow(workflowId) {
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalMarketingWorkflows();
    delete local[workflowId];
    saveLocalMarketingWorkflows(local);
    return true;
  }

  try {
    const docRef = doc(db, MARKETING_WORKFLOWS_COLLECTION, workflowId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore marketing workflow delete error. Falling back to LocalStorage.', err.message);
    const local = getLocalMarketingWorkflows();
    delete local[workflowId];
    saveLocalMarketingWorkflows(local);
    return true;
  }
}

function getLocalVaultCredentials() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalVaultCredentials(credentials) {
  try {
    localStorage.setItem('foundation_local_vault_credentials', JSON.stringify(credentials));
  } catch (e) {
    console.error('[DB]: Failed to save vault credentials to localStorage', e);
  }
}

export async function saveVaultCredential(record) {
  const credential = record;

  try {
    const { getGoogleAccessToken } = await import('./google-services.js');
    const token = await getGoogleAccessToken(false);
    if (token) {
      const { syncCredentialToGoogleVault } = await import('../utils/backend-google.js');
      const syncRes = await syncCredentialToGoogleVault(token, credential);
      if (syncRes && syncRes.success) {
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
    const local = getLocalVaultCredentials();
    local[credential.id] = { ...credential, updatedAt: new Date().toISOString() };
    saveLocalVaultCredentials(local);
    return credential;
  }

  try {
    const docRef = doc(db, VAULT_CREDENTIALS_COLLECTION, credential.id);
    await setDoc(docRef, { ...credential, updatedAt: new Date().toISOString() }, { merge: true });
    return credential;
  } catch (err) {
    console.warn('[DB]: Firestore vault credential save error. Falling back to LocalStorage.', err.message);
    const local = getLocalVaultCredentials();
    local[credential.id] = { ...credential, updatedAt: new Date().toISOString() };
    saveLocalVaultCredentials(local);
    return credential;
  }
}

export async function getVaultCredentials() {
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalVaultCredentials();
    return Object.values(local);
  }

  try {
    const querySnapshot = await getDocs(collection(db, VAULT_CREDENTIALS_COLLECTION));
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn('[DB]: Firestore vault credentials get error. Falling back to LocalStorage.', err.message);
    const local = getLocalVaultCredentials();
    return Object.values(local);
  }
}

export async function deleteVaultCredential(credentialId) {
  const db = getFirestoreDB();

  if (!db) {
    const local = getLocalVaultCredentials();
    delete local[credentialId];
    saveLocalVaultCredentials(local);
    return true;
  }

  try {
    const docRef = doc(db, VAULT_CREDENTIALS_COLLECTION, credentialId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore vault credential delete error. Falling back to LocalStorage.', err.message);
    const local = getLocalVaultCredentials();
    delete local[credentialId];
    saveLocalVaultCredentials(local);
    return true;
  }
}

export async function saveVaCandidate(data) {
  return saveContent(data);
}

export async function getVaCandidates(statusFilter = 'all') {
  const all = await getAllContent();
  let vas = all.filter(item => item.type === 'va_candidate' || item.type === 'va_hired');
  if (statusFilter && statusFilter !== 'all') {
    vas = vas.filter(item => item.status === statusFilter);
  }
  return vas;
}

export async function getVaActivityLogs(editorId) {
  const logs = [];
  const { getUser } = await import('./db-users.js');
  const user = await getUser(editorId);
  const editorEmail = user?.email || editorId;
  const editorName = user?.name || '';

  try {
    const { getKanbanTasks } = await import('../pages/admin/modules/admin-growth.js').catch(() => ({ getKanbanTasks: async () => [] }));
    const tasks = await getKanbanTasks();
    const assignedTasks = tasks.filter(t => t.assigneeId === editorId || t.assigneeId === editorEmail);
    assignedTasks.forEach(task => {
      logs.push({
        id: `log_task_${task.id}`,
        timestamp: task.updatedAt || task.createdAt || new Date().toISOString(),
        type: 'task',
        description: `Assigned Kanban Task: "${task.title}"`,
        details: task.description || ''
      });
    });
  } catch (e) {
    console.warn('Error fetching tasks for activity logs', e);
  }

  try {
    const contentItems = await getAllContent();
    const editorContent = contentItems.filter(item => item.author === editorEmail || item.author === editorName || (item.author && item.author.toLowerCase() === editorName.toLowerCase()));
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

  try {
    const workflows = await getMarketingWorkflows();
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

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return logs;
}

export async function assignLastpassVaultAccess(vaultId, editorId) {
  const creds = await getVaultCredentials();
  const cred = creds.find(c => c.id === vaultId);
  if (!cred) {
    throw new Error(`Vault credential with ID ${vaultId} not found`);
  }
  cred.assignedEditorId = editorId || null;
  cred.updatedAt = new Date().toISOString();
  return saveVaultCredential(cred);
}