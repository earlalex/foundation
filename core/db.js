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

const db = getFirestore();
const CONTENT_COLLECTION = 'content';
const USERS_COLLECTION = 'users';

export class ContentDB {
  /**
   * Save or update a master content JSON document in Firestore
   */
  async saveContent(contentData) {
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

  /**
   * Fetch single content JSON by ID
   */
  async getContentById(id) {
    try {
      const docRef = doc(db, CONTENT_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        schemaRegistry.validate(data);
        return data;
      } else {
        throw new Error(`Content with ID "${id}" not found.`);
      }
    } catch (err) {
      errorHandler.handleError(err);
      return null;
    }
  }

  /**
   * Fetch content items by type with limit
   */
  async getContentByType(type, maxItems = 12) {
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
      errorHandler.handleError(err);
      return [];
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                       USER DIRECTORY MANAGEMENT                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Retrieve all platform users from Firestore
   */
  async getAllUsers() {
    try {
      const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
      const users = [];
      querySnapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      return users;
    } catch (err) {
      console.warn('[DB]: Could not fetch users collection from Firestore. Serving session defaults.', err);
      return [];
    }
  }

  /**
   * Save or update a user record in Firestore
   */
  async saveUser(userData) {
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

  /**
   * Delete a user record from Firestore
   */
  async deleteUser(userId) {
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