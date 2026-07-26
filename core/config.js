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

    // GUARD: If no real Firebase project ID is configured locally, skip Firestore network query
    const fb = this.#activeConfig.firebase;
    if (!fb || !fb.projectId || fb.projectId === "YOUR_PROJECT_ID" || fb.projectId === "demo-foundation-app" || !fb.apiKey) {
      console.warn('[ConfigEngine]: Unconfigured environment. Displaying Setup Wizard.');
      return false;
    }

    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        this.#activeConfig = { ...defaultConfig, ...docSnap.data() };
        localStorage.setItem('foundation_config', JSON.stringify(this.#activeConfig));
        console.log('[ConfigEngine]: Master configuration loaded from Firestore.');
        return this.#activeConfig.isInstalled && this.#activeConfig.adminEmails?.length > 0;
      } else {
        console.warn('[ConfigEngine]: No config found in Firestore. First-Run Setup Required.');
        return false;
      }
    } catch (err) {
      console.warn('[ConfigEngine]: Firestore fetch skipped or offline.', err.message);
      return false;
    }
  }

  get current() {
    return this.#activeConfig || defaultConfig;
  }

  async saveToFirebase(configPayload) {
    this.#activeConfig = {
      ...this.#activeConfig,
      ...configPayload,
      isInstalled: true,
      updatedAt: new Date().toISOString()
    };

    // Save locally first so the app can recover immediately
    localStorage.setItem('foundation_config', JSON.stringify(this.#activeConfig));

    try {
      const db = getFirestore();
      const configRef = doc(db, 'settings', 'config');
      await setDoc(configRef, this.#activeConfig, { merge: true });
      console.log('[ConfigEngine]: Configuration saved to Firestore successfully.');
      return true;
    } catch (err) {
      console.warn('[ConfigEngine]: Saved locally (Firestore sync pending database creation/auth).');
      return true;
    }
  }
}

export const configManager = new ConfigEngine();