// core/db.js
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where,
  limit 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { auth } from './auth.js';
import { schemaRegistry } from '../schemas/registry.js';
import { errorHandler } from './error-handler.js';

const db = getFirestore();
const CONTENT_COLLECTION = 'content';

export class ContentDB {
  /**
   * Save or update a master content JSON document in Firestore
   */
  async saveContent(contentData) {
    try {
      // 1. Strict runtime schema validation before hitting DB
      schemaRegistry.validate(contentData);

      // 2. Save document using its 'id' field as key
      const docRef = doc(db, CONTENT_COLLECTION, contentData.id);
      await setDoc(docRef, {
        ...contentData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log(`[DB]: Successfully saved ${contentData.id}`);
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
        schemaRegistry.validate(data); // Validate on read
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
   * Fetch all content items by type (e.g., 'blog', 'podcast')
   */
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
}

export const contentDB = new ContentDB();