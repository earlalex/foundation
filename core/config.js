// core/config.js
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { store } from './store.js';
import { errorHandler } from './error-handler.js';

const CONFIG_DOC_PATH = 'settings/config';

class ConfigEngine {
  #activeConfig = null;

  async init() {
    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');
      const docSnap = await getDoc(configRef);

      if (docSnap.exists()) {
        this.#activeConfig = docSnap.data();
        console.log('[ConfigEngine]: Master configuration loaded from Firestore.');
        return true;
      } else {
        console.warn('[ConfigEngine]: No configuration found in Firestore. Triggering Setup Wizard.');
        return false; // Trigger install wizard
      }
    } catch (err) {
      console.warn('[ConfigEngine]: Could not load Firestore config. First-time setup required.');
      return false;
    }
  }

  get current() {
    return this.#activeConfig || {};
  }

  async saveToFirebase(configPayload) {
    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');
      const updatedData = {
        ...configPayload,
        isInstalled: true,
        updatedAt: new Date().toISOString()
      };

      await setDoc(configRef, updatedData, { merge: true });
      this.#activeConfig = updatedData;
      console.log('[ConfigEngine]: Configuration saved to Firestore successfully.');
      return true;
    } catch (err) {
      errorHandler.handleError(new Error(`Failed to save settings to Firestore: ${err.message}`));
      return false;
    }
  }
}

export const configManager = new ConfigEngine();