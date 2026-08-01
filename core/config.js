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
  sectionWizards: {
    section1: false,
    section2: false,
    section3: false,
    section4: false
  },
  site: {
    isConfigured: false,
    companyName: "",
    siteName: ""
  },
  api: {
    isConfigured: false
  },
  firebase: {
    apiKey: "",
    projectId: "",
    authDomain: ""
  },
  thirdParty: {
    lookerStudioEmbedUrl: "",
    ga4PropertyId: ""
  },
  analytics: {
    googleAnalyticsId: ""
  },
  cloudflare: {
    zoneId: "",
    pagesUrl: "",
    workerApiKey: "",
    workflowUrl: "/api/workflow-trigger",
    vtUrl: "/api/virustotal-scan"
  },
  security: {
    monthlyScanEnabled: false,
    isConfigured: false,
    zapApiUrl: "https://wwtesw.zaproxy.org/",
    zapApiKey: ""
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
    apiEndpoint: "https://lastpass.com/enterprise/api.php",
    isConfigured: false
  },
  vault: {},
  // Newly added structured configs for section setup wizards
  businessProfile: {
    legalName: "",
    dba: "",
    ein: "",
    entityType: "llc",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    email: "",
    supportEmail: "",
    phone: "",
    privacyUrl: "/privacy",
    termsUrl: "/terms",
    refundUrl: "/refunds",
    duns: "",
    bankName: "",
    bankRouting: "",
    bankAccount: "",
    naicsCode: "",
    naicsDefinition: "",
    isConfigured: false
  },
  stripe: {
    publishableKey: "",
    secretKey: "",
    priceId: "",
    webhookSecret: "",
    achFee: 500, // flat $5.00 fee in cents
    enableAch: false,
    isConfigured: false
  },
  google: {
    clientId: "",
    clientSecret: "",
    ownerEmail: ""
  },
  aiConfig: {
    geminiApiKey: "",
    openaiApiKey: "",
    preferredProvider: "gemini"
  },
  virustotal: {
    apiKey: ""
  },
  wise: {
    apiKey: "",
    profileId: "",
    sandbox: true
  },
  marketing: {
    gmailSender: "",
    defaultSenderAlias: "Notification System",
    defaultDelay: 24,
    defaultTrigger: "user_signup",
    isConfigured: false
  },
  vaHub: {
    apiKey: "",
    pipelineId: "",
    onboardingTemplate: "Welcome to our team! Please complete your onboarding...",
    welcomeEmailSubject: "Welcome to the Team!",
    isConfigured: false
  },
  iconSet: "default",
  customIconData: null,
  appointments: {
    operatingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    operatingHours: { start: "09:00", end: "17:00" },
    duration: 30,
    buffer: 15,
    notifications: {
      adminEmail: true,
      appointeeEmail: true,
      adminAlert: true
    },
    consultationFee: 150,
    depositRule: "percentage",
    depositAmount: 50,
    depositPercentage: 20
  },
  navigation: [
    { label: "Home", url: "/home", target: "_self", requiredRole: "public" },
    { label: "About", url: "/about", target: "_self", requiredRole: "public" },
    { label: "Events", url: "/events", target: "_self", requiredRole: "public" },
    { label: "Contact", url: "/contact", target: "_self", requiredRole: "public" }
  ],
  footer: {
    brand: {
      show: true,
      title: "Foundation",
      tagline: "A custom zero-build web framework for modern serverless architectures."
    },
    legal: {
      show: true,
      heading: "Legal & Policies",
      links: [
        { label: "Terms of Use", url: "/terms" },
        { label: "Privacy Policy", url: "/privacy" },
        { label: "Cookie Settings", url: "/cookies" }
      ]
    },
    newsletter: {
      show: true,
      heading: "Newsletter",
      text: "Subscribe to our newsletter for exclusive updates.",
      consentCopy: "I agree to receive email communications and accept the privacy policy."
    },
    social: {
      show: true,
      heading: "Follow Us",
      links: [
        { name: "twitter", url: "https://x.com" },
        { name: "linkedin", url: "https://linkedin.com" },
        { name: "youtube", url: "https://youtube.com" },
        { name: "github", url: "https://github.com" },
        { name: "facebook", url: "https://facebook.com" },
        { name: "instagram", url: "https://instagram.com" }
      ]
    }
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
   * Get cached config from LocalStorage securely
   * @private
   */
  #getLocalStorageConfig() {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('foundation_config');
    if (saved) {
      try {
        return { ...defaultConfig, ...JSON.parse(saved) };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Load configuration from localStorage
   * @private
   */
  #loadFromLocalStorage() {
    const saved = this.#getLocalStorageConfig();
    if (saved) {
      this.#activeConfig = saved;
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
        localStorage.setItem('foundation_config', JSON.stringify(this.#activeConfig));
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
   * Set current configuration object (mainly for testing)
   */
  set current(val) {
    this.#activeConfig = val;
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
      localStorage.setItem('foundation_config', JSON.stringify(this.#activeConfig));
      return true;
    } catch (err) {
      console.warn('[ConfigEngine]: Persisted locally. Firestore sync pending auth/rules.');
      return true;
    }
  }

  /**
   * Section-wide Wizards configurations
   */
  isSection1Configured() {
    const local = this.current;
    return local.sectionWizards?.section1 === true;
  }

  isSection2Configured() {
    const local = this.current;
    return local.sectionWizards?.section2 === true;
  }

  isSection3Configured() {
    const local = this.current;
    return local.sectionWizards?.section3 === true;
  }

  isSection4Configured() {
    const local = this.current;
    return local.sectionWizards?.section4 === true;
  }

  /**
   * Sequential Wizard readiness getters
   */
  isGoogleWorkspaceConfigured() {
    const local = this.current;
    const g = local.google || {};
    return !!(g.clientId && g.clientSecret && g.ownerEmail && g.clientId !== '' && g.clientSecret !== '');
  }

  isFirebaseConfigured() {
    const local = this.current;
    const fb = local.firebase || {};
    return !!(fb.apiKey && fb.projectId && fb.authDomain && fb.apiKey !== '' && fb.projectId !== '');
  }

  isCloudflareConfigured() {
    const local = this.current;
    const cf = local.cloudflare || {};
    return !!(cf.zoneId && cf.pagesUrl && cf.workerApiKey && cf.zoneId !== '');
  }

  isLastpassConfigured() {
    const local = this.current;
    const lp = local.lastpass || {};
    return !!(lp.provisioningHash && lp.companyId && lp.provisioningHash !== '');
  }

  /**
   * Explicit readiness guards for every admin section
   */
  isConfigured() {
    return !!(this.current?.isInstalled && this.current?.adminEmails?.length > 0);
  }

  async resetPlatform() {
    // Clear all localStorage keys
    localStorage.removeItem('foundation_config');
    localStorage.removeItem('foundation_theme');
    localStorage.removeItem('foundation_ref_id');
    localStorage.removeItem('foundation_local_chat_logs');
    localStorage.removeItem('foundation_local_content');
    localStorage.removeItem('foundation_local_users');
    localStorage.removeItem('foundation_local_invoices');
    localStorage.removeItem('foundation_local_expenses');
    localStorage.removeItem('foundation_local_payroll');
    localStorage.removeItem('foundation_local_budgets');
    localStorage.removeItem('foundation_local_employees');
    localStorage.removeItem('foundation_local_kanban_tasks');
    localStorage.removeItem('foundation_local_vault_credentials');
    localStorage.removeItem('foundation_local_pages');
    localStorage.removeItem('foundation_local_marketing_segments');
    localStorage.removeItem('foundation_local_email_templates');
    localStorage.removeItem('foundation_local_course_progress');
    localStorage.removeItem('foundation_dev_mode');

    // Clear all sessionStorage keys
    sessionStorage.clear();

    // Wipe local IndexedDB tables
    try {
      if (typeof indexedDB !== 'undefined') {
        await new Promise((resolve, reject) => {
          const req = indexedDB.deleteDatabase('FoundationFinancesDB');
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => {
            console.warn('IndexedDB delete blocked');
            resolve();
          };
        });
      }
    } catch (e) {
      console.warn('IndexedDB reset warning:', e);
    }

    // Set config values back to defaults and not installed
    this.#activeConfig = { ...defaultConfig, isInstalled: false };

    // Dispatch LOGOUT to store and log out
    const { authManager } = await import('./auth.js');
    await authManager.logout();
    store.dispatch('LOGOUT');
  }

  isBrandConfigured() {
    const local = this.current;
    if (local.sectionWizards?.section1 === true) return true;
    const isFlagged = local.site?.isConfigured === true;
    const hasParams = !!(local.siteTitle && local.siteDomain && local.siteTitle !== 'Foundation Framework' && local.siteTitle !== '');
    return isFlagged || hasParams;
  }

  isApiKeysConfigured() {
    const local = this.current;
    if (local.sectionWizards?.section1 === true) return true;
    const fb = local.firebase || {};
    const google = local.google || {};
    return !!(fb.apiKey && fb.projectId && google.clientId && google.clientSecret && fb.apiKey !== '' && google.clientId !== '');
  }

  isBusinessConfigured() {
    const local = this.current;
    if (local.sectionWizards?.section2 === true) return true;
    const isFlagged = local.businessProfile?.isConfigured === true;
    const biz = local.businessProfile || {};
    return isFlagged || !!(biz.legalName && biz.address && biz.ein && biz.naicsCode && biz.legalName !== '');
  }

  isFinancesConfigured() {
    const local = this.current;
    if (local.sectionWizards?.section2 === true) return true;
    const isFlagged = local.stripe?.isConfigured === true;
    const stripe = local.stripe || {};
    return isFlagged || !!(stripe.secretKey && stripe.publishableKey && stripe.priceId && stripe.achFee !== undefined && stripe.secretKey !== '');
  }

  isMarketingConfigured() {
    const local = this.current;
    if (local.sectionWizards?.section3 === true) return true;
    const isFlagged = local.marketing?.isConfigured === true;
    const mkt = local.marketing || {};
    return isFlagged || !!(mkt.gmailSender && mkt.defaultTrigger && mkt.gmailSender !== '');
  }

  isSecurityConfigured() {
    const local = this.current;
    if (local.sectionWizards?.section4 === true) return true;
    const isFlagged = local.security?.isConfigured === true;
    const vt = local.virustotal || {};
    const sec = local.security || {};
    return isFlagged || !!(vt.apiKey && sec.monthlyScanEnabled !== undefined && vt.apiKey !== '');
  }

  isVaHubConfigured() {
    const local = this.current;
    if (local.sectionWizards?.section4 === true) return true;
    const isFlagged = local.vaHub?.isConfigured === true;
    const va = local.vaHub || {};
    return isFlagged || !!(va.apiKey && va.onboardingTemplate && va.apiKey !== '');
  }

  /**
   * Check if a specific module is properly configured
   * @param {string} moduleName - Name of the module to check
   * @returns {boolean} True if module is configured, false otherwise
   */
  isModuleConfigured(moduleName) {
    const config = this.current;
    
    const moduleConfigs = {
      'site-brand': () => {
        return this.isBrandConfigured();
      },
      'api-keys': () => {
        return this.isApiKeysConfigured();
      },
      'business-legal': () => {
        return this.isBusinessConfigured();
      },
      'finances-ach': () => {
        return this.isFinancesConfigured();
      },
      'chatbot-voice': () => {
        const chat = config.chatbot || {};
        const hasTelnyx = !!(chat.telnyxApiKey && chat.telnyxPhoneNumber);
        const hasTwilio = !!(chat.twilioAccountSid && chat.twilioAuthToken && chat.twilioPhoneNumber);
        return !!(chat.enabled && (hasTelnyx || hasTwilio));
      },
      'security-ops': () => {
        return this.isSecurityConfigured();
      },
      'seo-analytics': () => {
        const third = config.thirdParty || {};
        return !!(third.ga4PropertyId || third.lookerStudioEmbedUrl);
      }
    };

    const checker = moduleConfigs[moduleName];
    if (!checker) {
      console.warn(`[ConfigEngine]: Unknown module "${moduleName}" in configuration check`);
      return false;
    }

    try {
      return checker();
    } catch (err) {
      console.error(`[ConfigEngine]: Error checking module "${moduleName}":`, err);
      return false;
    }
  }

  /**
   * Get missing configuration keys for a module
   * @param {string} moduleName - Name of the module to check
   * @returns {Array<string>} Array of missing configuration keys
   */
  getMissingConfigKeys(moduleName) {
    const config = this.current;
    const missing = [];

    const moduleRequirements = {
      'site-brand': [
        { key: 'siteTitle', path: 'siteTitle', label: 'Site Title' },
        { key: 'siteDomain', path: 'siteDomain', label: 'Site Domain' }
      ],
      'api-keys': [
        { key: 'google.clientId', path: 'google.clientId', label: 'Google Client ID' },
        { key: 'google.clientSecret', path: 'google.clientSecret', label: 'Google Client Secret' },
        { key: 'firebase.apiKey', path: 'firebase.apiKey', label: 'Firebase API Key' },
        { key: 'firebase.projectId', path: 'firebase.projectId', label: 'Firebase Project ID' },
        { key: 'cloudflare.zoneId', path: 'cloudflare.zoneId', label: 'Cloudflare Zone ID' },
        { key: 'cloudflare.workerApiKey', path: 'cloudflare.workerApiKey', label: 'Cloudflare Worker API Key' }
      ],
      'business-legal': [
        { key: 'businessProfile.legalName', path: 'businessProfile.legalName', label: 'Business Name' },
        { key: 'businessProfile.address', path: 'businessProfile.address', label: 'Business Address' },
        { key: 'businessProfile.ein', path: 'businessProfile.ein', label: 'EIN / Tax ID' },
        { key: 'businessProfile.naicsCode', path: 'businessProfile.naicsCode', label: 'NAICS Industry Code' }
      ],
      'finances-ach': [
        { key: 'stripe.secretKey', path: 'stripe.secretKey', label: 'Stripe Secret Key' },
        { key: 'stripe.publishableKey', path: 'stripe.publishableKey', label: 'Stripe Publishable Key' },
        { key: 'stripe.priceId', path: 'stripe.priceId', label: 'Stripe Price ID' }
      ],
      'chatbot-voice': [
        { key: 'chatbot.enabled', path: 'chatbot.enabled', label: 'Chatbot Enabled' },
        { key: 'chatbot.telnyxApiKey', path: 'chatbot.telnyxApiKey', label: 'Telnyx API Key (or Twilio)' }
      ],
      'security-ops': [
        { key: 'virustotal.apiKey', path: 'virustotal.apiKey', label: 'VirusTotal API Key' }
      ],
      'seo-analytics': [
        { key: 'thirdParty.ga4PropertyId', path: 'thirdParty.ga4PropertyId', label: 'GA4 Property ID' },
        { key: 'thirdParty.lookerStudioEmbedUrl', path: 'thirdParty.lookerStudioEmbedUrl', label: 'Looker Studio URL' }
      ]
    };

    const requirements = moduleRequirements[moduleName];
    if (!requirements) return missing;

    for (const req of requirements) {
      const keys = req.path.split('.');
      let value = config;
      for (const key of keys) {
        value = value?.[key];
      }
      if (!value || value === '' || value === 'YOUR_API_KEY' || value === 'YOUR_PROJECT_ID') {
        missing.push(req.label);
      }
    }

    return missing;
  }
}

export const configManager = new ConfigEngine();
