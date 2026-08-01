// core/db-shared.js
import {
  getFirestore,
  collection,
  doc,
  getDoc as originalGetDoc,
  getDocs as originalGetDocs,
  setDoc as originalSetDoc,
  deleteDoc as originalDeleteDoc,
  query,
  where,
  limit
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { schemaRegistry } from '../schemas/registry.js';
import { configManager } from './config.js';
import { store } from './store.js';

export const CONTENT_COLLECTION = 'content';
export const PAGES_COLLECTION = 'pages';
export const USERS_COLLECTION = 'users';
export const CHAT_LOGS_COLLECTION = 'chat_logs';
export const INVOICES_COLLECTION = 'invoices';
export const MARKETING_WORKFLOWS_COLLECTION = 'marketing_workflows';
export const KANBAN_TASKS_COLLECTION = 'kanban_tasks';
export const VAULT_CREDENTIALS_COLLECTION = 'vault_credentials';

export function withTimeout(promise, ms = 2000) {
  promise.catch((err) => {
    console.warn('[DB Timeout Wrapper]: original promise rejected post-timeout/settlement:', err.message || err);
  });
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore operation timeout')), ms))
  ]);
}

export const getDoc = (docRef) => withTimeout(originalGetDoc(docRef));
export const getDocs = (queryRef) => withTimeout(originalGetDocs(queryRef));
export const setDoc = (docRef, data, options) => withTimeout(originalSetDoc(docRef, data, options));
export const deleteDoc = (docRef) => withTimeout(originalDeleteDoc(docRef));

export function queryWith3SecTimeout(promise) {
  promise.catch((err) => {
    console.warn('[DB 3s Query Wrapper]: original query rejected post-timeout/settlement:', err.message || err);
  });
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore operation timeout')), 3000))
  ]);
}

export function getFirestoreDB() {
  const currentFbConfig = configManager.current.firebase;
  const isConfigured = currentFbConfig &&
                        currentFbConfig.projectId &&
                        currentFbConfig.projectId !== "YOUR_PROJECT_ID" &&
                        currentFbConfig.projectId !== "demo-foundation-app" &&
                        currentFbConfig.apiKey !== "" &&
                        currentFbConfig.apiKey !== "YOUR_API_KEY";

  if (!isConfigured) {
    return null;
  }

  try {
    return getFirestore();
  } catch (e) {
    console.warn('[DB]: Firestore instance uninitialized.', e);
    return null;
  }
}

export {
  collection,
  doc,
  query,
  where,
  limit,
  originalGetDocs,
  schemaRegistry,
  configManager,
  store
};
