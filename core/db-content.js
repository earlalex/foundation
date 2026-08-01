// core/db-content.js
import {
  getFirestoreDB, doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, limit,
  originalGetDocs, queryWith3SecTimeout, CONTENT_COLLECTION, PAGES_COLLECTION,
  VAULT_CREDENTIALS_COLLECTION, schemaRegistry, store,
  getLocalContent, saveLocalContent, getLocalPages, saveLocalPages
} from './db-shared.js';

export async function saveContent(contentData) {
  const dataWithDefaults = {
    description: 'Default Description',
    longFormText: [],
    author: 'Default Author',
    date: new Date().toISOString(),
    ...contentData
  };
  schemaRegistry.validate(dataWithDefaults);
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalContent();
    local[dataWithDefaults.id] = { ...dataWithDefaults, updatedAt: new Date().toISOString() };
    saveLocalContent(local);
    return true;
  }

  try {
    const docRef = doc(db, CONTENT_COLLECTION, dataWithDefaults.id);
    await setDoc(docRef, {
      ...dataWithDefaults,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore permission or write error. Falling back to LocalStorage.', err.message);
    const local = getLocalContent();
    local[dataWithDefaults.id] = { ...dataWithDefaults, updatedAt: new Date().toISOString() };
    saveLocalContent(local);
    return true;
  }
}

export async function getContentById(id) {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalContent();
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

  const local = getLocalContent();
  if (local[id]) {
    try {
      schemaRegistry.validate(local[id]);
      return local[id];
    } catch (e) {}
  }
  return null;
}

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
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        try {
          schemaRegistry.validate(data);
        } catch (e) {}
        results.push(data);
      });
      if (results.length > 0) return results;
    } catch (err) {
      console.warn('[DB]: Cloud Firestore query bypassed or unreachable.', err.message);
    }
  }

  const local = getLocalContent();
  Object.values(local).forEach(item => {
    try {
      schemaRegistry.validate(item);
    } catch (e) {}
    results.push(item);
  });
  return results;
}

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

  const local = getLocalContent();
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
  const payload = {
    ...pageData,
    type: 'page',
    updatedAt: new Date().toISOString()
  };
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

export async function saveZapScanResult(data) {
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

export async function getZapScanHistory() {
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

export async function saveMarketingSegment(segmentData) {
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

export async function getMarketingSegments() {
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

export async function getMarketingSegmentById(id) {
  const segments = await getMarketingSegments();
  return segments.find(s => s.id === id) || null;
}

export async function evaluateSegmentUsers(segmentId) {
  const segment = await getMarketingSegmentById(segmentId);
  if (!segment) return [];
  const users = await store.state.user_directory || []; // custom logic or query users
  return users; // fallback evaluate
}

export async function saveMarketingWorkflow(workflow) {
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    local[workflow.id] = { ...workflow, updatedAt: new Date().toISOString() };
    localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(local));
    return workflow;
  }

  try {
    const docRef = doc(db, 'marketing_workflows', workflow.id);
    await setDoc(docRef, { ...workflow, updatedAt: new Date().toISOString() }, { merge: true });
    return workflow;
  } catch (err) {
    console.warn('[DB]: Firestore marketing workflow save error. Falling back to LocalStorage.', err.message);
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    local[workflow.id] = { ...workflow, updatedAt: new Date().toISOString() };
    localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(local));
    return workflow;
  }
}

export async function getMarketingWorkflows() {
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    return Object.values(local);
  }

  try {
    const querySnapshot = await getDocs(collection(db, 'marketing_workflows'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[DB]: Firestore marketing workflows get error. Falling back to LocalStorage.', err.message);
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    return Object.values(local);
  }
}

export async function deleteMarketingWorkflow(workflowId) {
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    delete local[workflowId];
    localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(local));
    return true;
  }

  try {
    const docRef = doc(db, 'marketing_workflows', workflowId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore marketing workflow delete error. Falling back to LocalStorage.', err.message);
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    delete local[workflowId];
    localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(local));
    return true;
  }
}

export async function saveMarketingJourney(journeyData) {
  const payload = {
    ...journeyData,
    type: 'marketing_journeys',
    id: journeyData.id || `journey_${Date.now()}`
  };
  schemaRegistry.validate(payload);
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    local[payload.id] = { ...payload, updatedAt: new Date().toISOString() };
    localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(local));
    return payload;
  }
  try {
    const docRef = doc(db, 'marketing_workflows', payload.id);
    await setDoc(docRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
    return payload;
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_workflows') || '{}');
    local[payload.id] = { ...payload, updatedAt: new Date().toISOString() };
    localStorage.setItem('foundation_local_marketing_workflows', JSON.stringify(local));
    return payload;
  }
}

export async function saveEmailTemplate(templateRecord) {
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

export async function getEmailTemplates() {
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

export async function getEmailTemplateById(id) {
  const templates = await getEmailTemplates();
  return templates.find(t => t.id === id) || null;
}

export async function saveVaultCredential(record) {
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
    local[record.id] = { ...record, updatedAt: new Date().toISOString() };
    localStorage.setItem('foundation_local_vault_credentials', JSON.stringify(local));
    return record;
  }
  try {
    const docRef = doc(db, VAULT_CREDENTIALS_COLLECTION, record.id);
    await setDoc(docRef, { ...record, updatedAt: new Date().toISOString() }, { merge: true });
    return record;
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
    local[record.id] = { ...record, updatedAt: new Date().toISOString() };
    localStorage.setItem('foundation_local_vault_credentials', JSON.stringify(local));
    return record;
  }
}

export async function getVaultCredentials() {
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
    return Object.values(local);
  }
  try {
    const querySnapshot = await getDocs(collection(db, VAULT_CREDENTIALS_COLLECTION));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
    return Object.values(local);
  }
}

export async function deleteVaultCredential(credentialId) {
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
    delete local[credentialId];
    localStorage.setItem('foundation_local_vault_credentials', JSON.stringify(local));
    return true;
  }
  try {
    const docRef = doc(db, VAULT_CREDENTIALS_COLLECTION, credentialId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    const local = JSON.parse(localStorage.getItem('foundation_local_vault_credentials') || '{}');
    delete local[credentialId];
    localStorage.setItem('foundation_local_vault_credentials', JSON.stringify(local));
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
  const localUsers = JSON.parse(localStorage.getItem('foundation_local_users') || '{}');
  const user = localUsers[editorId] || null;
  const editorEmail = user?.email || editorId;
  const editorName = user?.name || '';

  try {
    const tasks = Object.values(JSON.parse(localStorage.getItem('foundation_local_kanban_tasks') || '{}'));
    const assignedTasks = tasks.filter(t =>
      t.assigneeId === editorId ||
      t.assigneeId === editorEmail ||
      (t.assignee && (t.assignee.email === editorEmail || t.assignee.email === editorId))
    );
    assignedTasks.forEach(task => {
      logs.push({
        id: `log_task_${task.id}`,
        timestamp: task.updatedAt || task.createdAt || new Date().toISOString(),
        type: 'task',
        description: `Assigned Kanban Task: "${task.title}" (Status: ${task.status})`,
        details: task.description || ''
      });
    });
  } catch (e) {}

  try {
    const contentItems = await getAllContent();
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
  } catch (e) {}

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

export async function saveHeroConfig(pageId, heroData) {
  let page = await getCustomPageBySlug(pageId);
  if (!page) {
    page = await getContentById(pageId);
  }

  const pagePayload = {
    type: 'page',
    id: pageId,
    slug: pageId,
    title: page?.title || (pageId.charAt(0).toUpperCase() + pageId.slice(1)),
    access: { visibility: 'public' },
    ...page,
    hero: heroData,
    updatedAt: new Date().toISOString()
  };

  await saveCustomPage(pagePayload);
  await saveContent(pagePayload);
  return true;
}

export async function getHeroConfig(pageId) {
  let page = await getCustomPageBySlug(pageId);
  if (!page) {
    page = await getContentById(pageId);
  }
  return page?.hero || null;
}
