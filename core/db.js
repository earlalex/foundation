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
import { auth } from './auth.js';
import { schemaRegistry } from '../schemas/registry.js';
import { errorHandler } from './error-handler.js';
import { configManager } from './config.js';

const db = getFirestore();
const CONTENT_COLLECTION = 'content';
const USERS_COLLECTION = 'users';

function isFirebaseConfigured() {
  const cfg = configManager.current?.firebase;
  return cfg && cfg.projectId && cfg.projectId !== 'YOUR_PROJECT_ID' && cfg.apiKey !== 'YOUR_API_KEY';
}

export class ContentDB {
  async saveContent(contentData) {
    if (!isFirebaseConfigured()) {
      console.warn('[DB]: Firebase is not configured with real API credentials. Action simulated.');
      return true;
    }
    try {
      schemaRegistry.validate(contentData);
      const docRef = doc(db, CONTENT_COLLECTION, contentData.id);
      await setDoc(docRef, {
        ...contentData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`[DB]: Successfully saved content ${contentData.id}`);
      return true;
    } catch (err) {
      errorHandler.handleError(err);
      return false;
    }
  }

  async getContentById(id) {
    if (!isFirebaseConfigured()) return null;
    try {
      const docRef = doc(db, CONTENT_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        schemaRegistry.validate(data);
        return data;
      }
      return null;
    } catch (err) {
      errorHandler.handleError(err);
      return null;
    }
  }

  async getContentByType(type, maxItems = 12) {
    if (!isFirebaseConfigured()) {
      console.log('[DB]: Firebase unconfigured/demo environment. Returning baseline content feed.');
      return [];
    }
    try {
      const q = query(
        collection(db, CONTENT_COLLECTION), 
        where('type', '==', type),
        limit(maxItems)
      );
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        schemaRegistry.validate(data);
        results.push(data);
      });
      return results;
    } catch (err) {
      console.warn('[DB]: Cloud Firestore query bypassed or unreachable.', err.message);
      return [];
    }
  }

  async getAllUsers() {
    if (!isFirebaseConfigured()) return [];
    try {
      const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
      const users = [];
      querySnapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      return users;
    } catch (err) {
      console.warn('[DB]: Could not fetch users collection from Firestore.', err.message);
      return [];
    }
  }

  async saveUser(userData) {
    if (!isFirebaseConfigured()) return userData;
    try {
      const userId = userData.id || userData.email.replace(/[@.]/g, '_');
      const docRef = doc(db, USERS_COLLECTION, userId);
      const payload = {
        ...userData,
        id: userId,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload, { merge: true });
      console.log(`[DB]: Successfully saved user ${userId}`);
      return payload;
    } catch (err) {
      errorHandler.handleError(err);
      return null;
    }
  }

  async deleteUser(userId) {
    if (!isFirebaseConfigured()) return true;
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      await deleteDoc(docRef);
      console.log(`[DB]: Deleted user ${userId}`);
      return true;
    } catch (err) {
      errorHandler.handleError(err);
      return false;
    }
  }
}

export const contentDB = new ContentDB();