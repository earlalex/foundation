// core/config.js
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { errorHandler } from './error-handler.js';

export const defaultConfig = {
  siteTitle: "Foundation Framework",
  siteTagline: "A zero-build web framework",
  siteDomain: window.location.origin,
  isInstalled: false,
  adminEmails: [],
  firebase: {
    apiKey: "",
    projectId: ""
  },
  thirdParty: {
    lookerStudioEmbedUrl: "",
    ga4PropertyId: ""
  },
  cloudflare: {
    workflowUrl: "/api/workflow-trigger",
    vtUrl: "/api/virustotal-scan"
  }
};

class ConfigEngine {
  #activeConfig = { ...defaultConfig };

  async init() {
    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');
      const docSnap = await getDoc(configRef);

      if (docSnap.exists()) {
        this.#activeConfig = { ...defaultConfig, ...docSnap.data() };
        console.log('[ConfigEngine]: Master configuration loaded from Firestore.');
        return this.#activeConfig.isInstalled && this.#activeConfig.adminEmails?.length > 0;
      } else {
        console.warn('[ConfigEngine]: No config found in Firestore. First-Run Setup Required.');
        return false;
      }
    } catch (err) {
      console.warn('[ConfigEngine]: Unconfigured or offline. First-Run Setup Required.', err.message);
      return false;
    }
  }

  get current() {
    return this.#activeConfig;
  }

  async saveToFirebase(configPayload) {
    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');
      const updatedData = {
        ...this.#activeConfig,
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