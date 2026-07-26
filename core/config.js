import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { errorHandler } from './error-handler.js';

export const defaultConfig = {
  siteTitle: "Foundation Framework",
  siteTagline: "A zero-build web framework",
  siteDomain: typeof window !== 'undefined' ? window.location.origin : '',
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
  #activeConfig;

  constructor() {
    this.#loadFromLocalStorage();
  }

  #loadFromLocalStorage() {
    const saved = localStorage.getItem('foundation_config');
    if (saved) {
      try {
        this.#activeConfig = { ...defaultConfig, ...JSON.parse(saved) };
      } catch (e) {
        this.#activeConfig = { ...defaultConfig };
      }
    } else {
      this.#activeConfig = { ...defaultConfig };
    }
  }

  async init() {
    this.#loadFromLocalStorage();

    const fb = this.#activeConfig.firebase;
    const hasLocalKeys = fb && fb.projectId && fb.projectId !== "YOUR_PROJECT_ID" && fb.projectId !== "demo-foundation-app" && fb.apiKey && fb.apiKey !== "YOUR_API_KEY";

    if (!hasLocalKeys && !this.#activeConfig.isInstalled) {
      console.warn('[ConfigEngine]: Unconfigured environment. Setup Wizard required.');
      return false;
    }

    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');
      
      const docSnap = await Promise.race([
        getDoc(configRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2000))
      ]);

      if (docSnap && docSnap.exists()) {
        const firestoreData = docSnap.data();
        this.#activeConfig = { ...defaultConfig, ...firestoreData, isInstalled: true };
        localStorage.removeItem('foundation_config');
        console.log('[ConfigEngine]: Master configuration verified from Firestore.');
        return true;
      } else if (hasLocalKeys) {
        console.log('[ConfigEngine]: Local setup credentials loaded. Attempting initial sync to Firestore...');
        await this.syncToFirestore();
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.warn('[ConfigEngine]: Operating with active local setup configuration.', err.message);
      return this.#activeConfig.isInstalled && this.#activeConfig.adminEmails?.length > 0;
    }
  }

  get current() {
    return this.#activeConfig || defaultConfig;
  }

  async saveToFirebase(configPayload) {
    return await this.saveSetupCredentials(configPayload);
  }

  async saveSetupCredentials(configPayload) {
    this.#activeConfig = {
      ...this.#activeConfig,
      ...configPayload,
      isInstalled: true,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('foundation_config', JSON.stringify(this.#activeConfig));
    console.log('[ConfigEngine]: Credentials saved to LocalStorage.');

    await this.syncToFirestore();
    return true;
  }

  async syncToFirestore() {
    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');

      await Promise.race([
        setDoc(configRef, this.#activeConfig, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timeout')), 2000))
      ]);

      console.log('[ConfigEngine]: Configuration synced to Firestore successfully.');
      localStorage.removeItem('foundation_config');
      return true;
    } catch (err) {
      console.warn('[ConfigEngine]: Persisted locally. Firestore sync pending auth/rules.');
      return true;
    }
  }
}

export const configManager = new ConfigEngine();
