// core/logger.js
import { store } from './store.js';

class DevLogger {
  #isDevMode() {
    return store?.state?.devMode || localStorage.getItem('foundation_dev_mode') === 'true';
  }

  log(message, ...args) {
    if (this.#isDevMode()) {
      console.log(`%c[Foundation Log]: ${message}`, 'color: #3182ce; font-weight: bold;', ...args);
    }
  }

  info(message, ...args) {
    if (this.#isDevMode()) {
      console.info(`%c[Foundation Info]: ${message}`, 'color: #38a169; font-weight: bold;', ...args);
    }
  }

  warn(message, ...args) {
    if (this.#isDevMode()) {
      console.warn(`%c[Foundation Advisory]: ${message}`, 'color: #dd6b20; font-weight: bold;', ...args);
    }
  }

  error(message, ...args) {
    if (this.#isDevMode()) {
      console.error(`%c[Foundation Error]: ${message}`, 'color: #e53e3e; font-weight: bold;', ...args);
    }
  }

  group(label) {
    if (this.#isDevMode()) {
      console.group(`%c[Dev Mode]: ${label}`, 'color: #805ad5; font-weight: bold;');
    }
  }

  groupEnd() {
    if (this.#isDevMode()) {
      console.groupEnd();
    }
  }
}

export const logger = new DevLogger();