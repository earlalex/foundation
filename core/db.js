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

function getFirestoreDB() {
  try {
    return getFirestore();
  } catch (e) {
    console.warn('[DB]: Firestore instance uninitialized.', e);
    return null;
  }
}

export class ContentDB {
  // LocalStorage fallback engines
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

  // LocalStorage fallback engines
  #getLocalContent() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_content') || '{}');
    } catch (e) {
      return {};
    }
  }

  #saveLocalContent(data) {
    localStorage.setItem('foundation_local_content', JSON.stringify(data));
  }

  #getLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem('foundation_local_users') || '{}');
    } catch (e) {
      return {};
    }
  }

  #saveLocalUsers(data) {
    localStorage.setItem('foundation_local_users', JSON.stringify(data));
  }

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
}

export const contentDB = new ContentDB();