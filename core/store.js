// core/store.js
import { Type, validateSchema } from './validator.js';
import { errorHandler } from './error-handler.js';

/**
 * Store manages application state with schema validation, immutable state, action dispatch, and subscription support
 */
class Store {
  #state;
  #actions = new Map();
  #listeners = new Set();
  #schemas = {};

  /**
   * Initialize Store with initial state and optional schemas
   * @param {Object} initialState - Initial state object
   * @param {Object} schemas - Schema definitions for state validation
   */
  constructor(initialState = {}, schemas = {}) {
    this.#schemas = schemas;
    if (Object.keys(schemas).length > 0) {
      validateSchema(schemas, initialState, 'store.initialState');
    }
    this.#state = DeepFreeze(initialState);
  }

  /**
   * Get current immutable state
   * @returns {Object} Current state
   */
  get state() {
    return this.#state;
  }

  /**
   * Register an action handler
   * @param {string} actionName - Name of the action
   * @param {Function} actionFn - Action handler function
   */
  registerAction(actionName, actionFn) {
    if (this.#actions.has(actionName)) {
      console.warn(`[Store]: Overwriting action "${actionName}"`);
    }
    this.#actions.set(actionName, actionFn);
  }

  /**
   * Dispatch an action with payload
   * @param {string} actionName - Name of the action to dispatch
   * @param {*} payload - Payload to pass to action handler
   */
  dispatch(actionName, payload) {
    const action = this.#actions.get(actionName);
    if (!action) {
      errorHandler.handleError(new Error(`[Store]: Unknown action "${actionName}"`));
      return;
    }
    try {
      const proposedState = action(this.#state, payload);
      if (Object.keys(this.#schemas).length > 0) {
        validateSchema(this.#schemas, proposedState, 'store.state');
      }
      this.#state = DeepFreeze(proposedState);

      // Optional console log output when in dev mode
      if (this.#state.devMode) {
        console.log(`%c[Store Dispatch]: %c${actionName}`, 'color: #805ad5; font-weight: bold;', 'color: #2b6cb0; font-weight: 600;', payload !== undefined ? payload : '');
      }

      this.#notify();
    } catch (err) {
      errorHandler.handleError(err);
    }
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function to receive state updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   * @private
   */
  #notify() {
    this.#listeners.forEach((listener) => {
      try {
        listener(this.#state);
      } catch (err) {
        errorHandler.handleError(err);
      }
    });
  }
}

/**
 * Deep freeze an object to make it immutable
 * @param {*} obj - Object to freeze
 * @returns {*} Frozen object
 */
function DeepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (
      obj[prop] !== null &&
      (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
      !Object.isFrozen(obj[prop])
    ) {
      DeepFreeze(obj[prop]);
    }
  });
  return obj;
}

const UserSchema = {
  uid: Type.string,
  email: Type.string,
  displayName: Type.optional(Type.string),
  photoURL: Type.optional(Type.string),
  isAdmin: Type.boolean,
  role: Type.optional(Type.string),           // "prospect", "subscriber", "member", "affiliate", "editor", "admin"
  paymentStatus: Type.optional(Type.string),   // "Active", "Past Due", "Delinquent", "Converted", "None"
  affiliateCode: Type.optional(Type.string),
  referredBy: Type.optional(Type.string)
};

const ChatLogSchema = {
  id: Type.string,
  timestamp: Type.string,
  sender: Type.string,
  message: Type.string,
  type: Type.string // "web", "sms", "voice"
};

const stateSchemas = {
  user: Type.optional((val) => {
    if (val === null || val === undefined) return true;
    validateSchema(UserSchema, val, 'store.state.user');
    return true;
  }),
  theme: Type.string,
  activeBrandGuide: Type.optional(Type.object),
  devMode: Type.boolean,
  highContrast: Type.optional(Type.boolean),
  contentFeed: Type.optional(Type.array()),
  history: Type.optional(Type.array()),
  chatLogs: Type.optional(Type.array((val) => {
    validateSchema(ChatLogSchema, val, 'store.state.chatLogs.item');
    return true;
  })),
  simulatedUserTier: Type.optional(Type.string), // optional string simulation flag ("prospect", "subscriber", "member", "affiliate", "editor", "admin")
  cart: Type.optional(Type.object)
};

const initialDevMode = localStorage.getItem('foundation_dev_mode') === 'true';
const initialHighContrast = localStorage.getItem('foundation_high_contrast') === 'true';

export const store = new Store({
  user: null,
  theme: 'dark',
  activeBrandGuide: null,
  devMode: initialDevMode,
  highContrast: initialHighContrast,
  contentFeed: [],
  history: [],
  chatLogs: [],
  simulatedUserTier: null,
  cart: { eventId: null, items: [] }
}, stateSchemas);

// --- REGISTER STORE ACTIONS ---
store.registerAction('SET_HIGH_CONTRAST', (state, enabled) => ({ ...state, highContrast: !!enabled }));
store.registerAction('SET_USER', (state, userPayload) => ({ ...state, user: userPayload }));
store.registerAction('SET_CART', (state, cartPayload) => ({ ...state, cart: cartPayload || { eventId: null, items: [] } }));
store.registerAction('LOGOUT', (state) => ({ ...state, user: null, simulatedUserTier: null }));
store.registerAction('TOGGLE_THEME', (state) => ({
  ...state,
  theme: state.theme === 'dark' ? 'light' : 'dark'
}));
store.registerAction('APPLY_THEME_JSON', (state, brandGuide) => ({
  ...state,
  activeBrandGuide: brandGuide
}));
store.registerAction('SET_DEV_MODE', (state, enabled) => {
  const isEnabled = Boolean(enabled);
  localStorage.setItem('foundation_dev_mode', isEnabled ? 'true' : 'false');
  return { ...state, devMode: isEnabled };
});
store.registerAction('SET_CONTENT_FEED', (state, items) => ({
  ...state,
  contentFeed: Array.isArray(items) ? items : []
}));
store.registerAction('SET_CHAT_LOGS', (state, logs) => ({
  ...state,
  chatLogs: Array.isArray(logs) ? logs : []
}));
store.registerAction('PUSH_HISTORY', (state, path) => {
  if (!path) return state;
  const updatedHistory = [...(state.history || []), path].slice(-20);
  return { ...state, history: updatedHistory };
});
store.registerAction('SET_SIMULATED_USER_TIER', (state, tier) => ({
  ...state,
  simulatedUserTier: tier || null
}));
store.registerAction('FLUSH_LOCAL_SENSITIVE_DATA', (state) => {
  try {
    const keysToFlush = [
      'foundation_local_vault_credentials',
      'foundation_local_payroll',
      'foundation_local_expenses',
      'foundation_local_invoices',
      'foundation_local_budgets',
      'foundation_local_employees',
      'foundation_local_kanban_tasks',
      'foundation_local_chat_logs',
      'foundation_local_state_compliance',
      'foundation_local_security_scans',
      'foundation_local_registrations',
      'foundation_local_appointments',
      'foundation_local_marketing_workflows',
      'foundation_local_marketing_segments',
      'foundation_local_email_templates',
      'foundation_local_course_progress',
      'foundation_outbox'
    ];
    keysToFlush.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    console.log('[Store]: Local sensitive data secure flushed.');
  } catch (e) {
    console.warn('[Store Flush]: localStorage cleanup deferred.', e);
  }
  return {
    ...state,
    cart: { eventId: null, items: [] }
  };
});
