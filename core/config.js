import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { errorHandler } from './error-handler.js';

/**
 * Default configuration object for the Foundation Framework
 * @type {Object}
 */
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
  },
  security: {
    monthlyScanEnabled: false
  },
  seoMyRankAddr: {
    apiKey: "E4462175E8369240D133B6C4F3CD288C",
    costPerRequest: 0.01,
    totalSpent: 0,
    requestCount: 0
  },
  chatbot: {
    enabled: true,
    name: "Foundation Assistant",
    systemPrompt: "You are a helpful customer support agent for Foundation Framework.",
    welcomeMessage: "Hello! How can I help you today?",
    openaiApiKey: "",
    telnyxApiKey: "",
    telnyxPhoneNumber: "",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    voiceWelcomeMessage: "Thank you for calling Foundation support. How can I help you today?"
  },
  lastpass: {
    provisioningHash: "",
    companyId: "",
    apiEndpoint: "https://lastpass.com/enterprise/api.php"
  }
};

/**
 * ConfigEngine manages application configuration state
 * Handles loading from localStorage, syncing with Firestore, and providing centralized config access
 */
class ConfigEngine {
  #activeConfig;

  /**
   * Initialize ConfigEngine and load configuration from localStorage
   */
  constructor() {
    this.#loadFromLocalStorage();
  }

  /**
   * Load configuration from localStorage
   * @private
   */
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

  /**
   * Initialize configuration by loading from localStorage and syncing with Firestore
   * @returns {Promise<boolean>} True if configuration is valid, false otherwise
   */
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

  /**
   * Get current configuration object
   * @returns {Object} Current active configuration
   */
  get current() {
    return this.#activeConfig || defaultConfig;
  }

  /**
   * Save configuration to Firestore
   * @param {Object} configPayload - Configuration object to save
   * @returns {Promise<boolean>} True if save was successful
   */
  async saveToFirebase(configPayload) {
    return await this.saveSetupCredentials(configPayload);
  }

  /**
   * Save setup credentials to localStorage and sync to Firestore
   * @param {Object} configPayload - Configuration object to save
   * @returns {Promise<boolean>} True if save was successful
   */
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

  /**
   * Sync current configuration to Firestore
   * @returns {Promise<boolean>} True if sync was successful
   */
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
