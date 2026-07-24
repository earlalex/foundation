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
    if (Object.keys(schemas).length > 0) {
      validateSchema(schemas, initialState, 'store.initialState');
    }
    this.#state = DeepFreeze(initialState);
  }

  get state() {
    return this.#state;
  }

  registerAction(actionName, actionFn) {
    if (this.#actions.has(actionName)) {
      console.warn(`[Store]: Overwriting action "${actionName}"`);
    }
    this.#actions.set(actionName, actionFn);
  }

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
      this.#notify();
    } catch (err) {
      errorHandler.handleError(err);
    }
  }

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
  isAdmin: Type.boolean
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
  contentFeed: Type.optional(Type.array()),
  history: Type.optional(Type.array())
};

const initialDevMode = localStorage.getItem('foundation_dev_mode') === 'true';

export const store = new Store({
  user: null,
  theme: 'dark',
  activeBrandGuide: null,
  devMode: initialDevMode,
  contentFeed: [],
  history: []
}, stateSchemas);

// --- REGISTER STORE ACTIONS ---
store.registerAction('SET_USER', (state, userPayload) => ({ ...state, user: userPayload }));
store.registerAction('LOGOUT', (state) => ({ ...state, user: null }));
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
store.registerAction('PUSH_HISTORY', (state, path) => {
  if (!path) return state;
  const updatedHistory = [...(state.history || []), path].slice(-20);
  return { ...state, history: updatedHistory };
});