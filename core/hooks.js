/**
 * core/hooks.js - System-Wide Event, Hook & Queue Execution Pipeline
 * Standardized action and filter queue system inspired by WordPress operating in zero-build ES Modules.
 */

class HookSystem {
  constructor() {
    this.actions = new Map();
    this.filters = new Map();
  }

  /**
   * Action Queue: Allows core modules and plugins to register callbacks triggered at specific lifecycle phases.
   * @param {string} hookName
   * @param {Function} callback
   * @param {number} priority
   */
  addAction(hookName, callback, priority = 10) {
    if (typeof callback !== 'function') {
      console.warn(`[HookSystem]: Action callback for "${hookName}" must be a function.`);
      return;
    }
    if (!this.actions.has(hookName)) {
      this.actions.set(hookName, []);
    }
    this.actions.get(hookName).push({ callback, priority });
    this.actions.get(hookName).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execution Dispatcher: Synchronously or asynchronously executes registered callbacks sorted by priority.
   * @param {string} hookName
   * @param  {...any} args
   * @returns {Promise<void>}
   */
  async doAction(hookName, ...args) {
    const callbacks = this.actions.get(hookName) || [];
    for (const item of callbacks) {
      try {
        const result = item.callback(...args);
        if (result instanceof Promise) {
          await result;
        }
      } catch (err) {
        console.error(`[HookSystem Error]: Action callback failed on hook "${hookName}".`, err);
        // Error boundary: do not crash the core application
      }
    }
  }

  /**
   * Filter Pipeline: Allows core modules and plugins to register filter callbacks.
   * @param {string} hookName
   * @param {Function} callback
   * @param {number} priority
   */
  addFilter(hookName, callback, priority = 10) {
    if (typeof callback !== 'function') {
      console.warn(`[HookSystem]: Filter callback for "${hookName}" must be a function.`);
      return;
    }
    if (!this.filters.has(hookName)) {
      this.filters.set(hookName, []);
    }
    this.filters.get(hookName).push({ callback, priority });
    this.filters.get(hookName).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Apply Filters: Passes data through a sequence of functions to allow plugins to modify system payloads before rendering or saving.
   * @param {string} hookName
   * @param {any} value
   * @param  {...any} args
   * @returns {any} Filtered value
   */
  applyFilters(hookName, value, ...args) {
    const callbacks = this.filters.get(hookName) || [];
    let currentValue = value;
    for (const item of callbacks) {
      try {
        currentValue = item.callback(currentValue, ...args);
      } catch (err) {
        console.error(`[HookSystem Error]: Filter callback failed on hook "${hookName}".`, err);
        // Error boundary: return current value as-is and continue
      }
    }
    return currentValue;
  }
}

export const hookSystem = new HookSystem();
export const addAction = hookSystem.addAction.bind(hookSystem);
export const doAction = hookSystem.doAction.bind(hookSystem);
export const addFilter = hookSystem.addFilter.bind(hookSystem);
export const applyFilters = hookSystem.applyFilters.bind(hookSystem);
