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

function getFirestoreDB() {
  try {
    return getFirestore();
  } catch (e) {
    console.warn('[DB]: Firestore instance uninitialized.', e);
    return null;
  }
}

export class ContentDB {
  async saveContent(contentData) {
    const db = getFirestoreDB();
    if (!db) return false;

    try {
      schemaRegistry.validate(contentData);
      const docRef = doc(db, CONTENT_COLLECTION, contentData.id);
      await setDoc(docRef, {
        ...contentData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (err) {
      errorHandler.handleError(err);
      return false;
    }
  }

  async getContentById(id) {
    const db = getFirestoreDB();
    if (!db) return null;

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
    const db = getFirestoreDB();
    if (!db) return [];

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
    const db = getFirestoreDB();
    if (!db) return [];

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
    const db = getFirestoreDB();
    if (!db) return userData;

    try {
      const userId = userData.id || userData.email.replace(/[@.]/g, '_');
      const docRef = doc(db, USERS_COLLECTION, userId);
      const payload = {
        ...userData,
        id: userId,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload, { merge: true });
      return payload;
    } catch (err) {
      errorHandler.handleError(err);
      return null;
    }
  }

  async deleteUser(userId) {
    const db = getFirestoreDB();
    if (!db) return true;

    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      errorHandler.handleError(err);
      return false;
    }
  }
}

export const contentDB = new ContentDB();