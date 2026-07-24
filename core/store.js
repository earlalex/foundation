// core/store.js

import { Type, validateSchema } from '/core/validator.js';
import { errorHandler } from '/core/error-handler.js';

class Store {
  #state;
  #actions = new Map();
  #listeners = new Set();
  #schemas = {};

  constructor(initialState = {}, schemas = {}) {
    this.#schemas = schemas;

    // Validate initial state against schemas if provided
    if (Object.keys(schemas).length > 0) {
      validateSchema(schemas, initialState, 'store.initialState');
    }

    this.#state = DeepFreeze(initialState);
  }

  /**
   * Returns a frozen copy of state to guarantee immutability
   */
  get state() {
    return this.#state;
  }

  /**
   * Registers a named state action/mutation
   * @param {string} actionName 
   * @param {Function} actionFn - (currentState, payload) => newState
   */
  registerAction(actionName, actionFn) {
    if (this.#actions.has(actionName)) {
      console.warn(`[Store]: Overwriting action "${actionName}"`);
    }
    this.#actions.set(actionName, actionFn);
  }

  /**
   * Dispatches an action to safely update state
   * @param {string} actionName 
   * @param {Object} payload 
   */
  dispatch(actionName, payload) {
    const action = this.#actions.get(actionName);
    if (!action) {
      errorHandler.handleError(new Error(`[Store]: Unknown action "${actionName}"`));
      return;
    }

    try {
      // 1. Calculate proposed next state
      const proposedState = action(this.#state, payload);

      // 2. Validate proposed state BEFORE committing
      if (Object.keys(this.#schemas).length > 0) {
        validateSchema(this.#schemas, proposedState, 'store.state');
      }

      // 3. ONLY commit and freeze if validation succeeds
      this.#state = DeepFreeze(proposedState);

      // 4. Notify subscribers
      this.#notify();
    } catch (err) {
      // Validation failed: notify error handler, leave this.#state UNTOUCHED!
      errorHandler.handleError(err);
    }
  }

  /**
   * Subscribes a listener callback to state updates
   * @param {Function} listener 
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

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
 * Deep freezes an object to enforce strict immutability
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

// --- STATE SCHEMAS & SINGLETON INITIALIZATION ---

// User Profile Schema for authenticated session tracking
const UserSchema = {
  uid: Type.string,
  email: Type.string,
  displayName: Type.optional(Type.string),
  photoURL: Type.optional(Type.string),
  isAdmin: Type.boolean
};

const stateSchemas = {
  // Allow null/undefined OR validate against UserSchema
  user: Type.optional((val) => {
    if (val === null || val === undefined) return true;
    validateSchema(UserSchema, val, 'store.state.user');
    return true;
  }),
  theme: Type.string,
  devMode: Type.boolean,
  contentFeed: Type.optional(Type.array()),
  history: Type.optional(Type.array())
};

// Check localStorage for saved preference, defaulting to false
const initialDevMode = localStorage.getItem('foundation_dev_mode') === 'true';

export const store = new Store({
  user: null,
  theme: 'dark',
  devMode: initialDevMode,
  contentFeed: [],
  history: []
}, stateSchemas);

// --- REGISTER STORE ACTIONS ---

store.registerAction('SET_USER', (state, userPayload) => {
  return { ...state, user: userPayload };
});

store.registerAction('LOGOUT', (state) => {
  return { ...state, user: null };
});

store.registerAction('TOGGLE_THEME', (state) => {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  return { ...state, theme: nextTheme };
});

store.registerAction('SET_DEV_MODE', (state, enabled) => {
  const isEnabled = Boolean(enabled);
  localStorage.setItem('foundation_dev_mode', isEnabled ? 'true' : 'false');
  return { ...state, devMode: isEnabled };
});

store.registerAction('SET_CONTENT_FEED', (state, items) => {
  return { ...state, contentFeed: Array.isArray(items) ? items : [] };
});

store.registerAction('PUSH_HISTORY', (state, path) => {
  if (!path) return state;
  const updatedHistory = [...(state.history || []), path].slice(-20);
  return { ...state, history: updatedHistory };
});