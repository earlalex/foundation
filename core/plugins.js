// core/plugins.js
import { hookSystem } from './hooks.js';

export const DefaultPluginsList = [
  {
    id: 'custom-analytics',
    name: 'Custom Analytics Plugin',
    version: '1.0.0',
    description: 'Tracks page route transitions and fires analytic events seamlessly.',
    enabled: true,
    init(hs) {
      hs.addAction('router_after_route', (route) => {
        console.log(`[Plugin - Analytics]: Route transition recorded -> ${route}`);
      });
    }
  },
  {
    id: 'console-logger',
    name: 'Console Logger Hook',
    version: '1.0.1',
    description: 'Intercepts system events and outputs debugging metrics to developer console.',
    enabled: true,
    init(hs) {
      hs.addAction('foundation_init', () => {
        console.log('[Plugin - Logger]: Foundation initial boot intercepted.');
      });
      hs.addAction('user_login', (user) => {
        console.log(`[Plugin - Logger]: Logged in user: ${user?.email}`);
      });
    }
  }
];

class PluginManager {
  constructor() {
    this.plugins = [];
    this.loadState();
  }

  loadState() {
    try {
      const stored = localStorage.getItem('foundation_active_plugins');
      if (stored) {
        const statuses = JSON.parse(stored); // { id: boolean }
        this.plugins = DefaultPluginsList.map(p => ({
          ...p,
          enabled: statuses[p.id] !== undefined ? statuses[p.id] : p.enabled
        }));
      } else {
        this.plugins = [...DefaultPluginsList];
        this.saveState();
      }
    } catch (e) {
      this.plugins = [...DefaultPluginsList];
    }
  }

  saveState() {
    try {
      const statuses = {};
      this.plugins.forEach(p => {
        statuses[p.id] = p.enabled;
      });
      localStorage.setItem('foundation_active_plugins', JSON.stringify(statuses));
    } catch (e) {
      console.error('[PluginManager]: Failed to write plugin statuses to localStorage.', e);
    }
  }

  getPlugins() {
    return this.plugins;
  }

  togglePlugin(pluginId, isEnabled) {
    const plugin = this.plugins.find(p => p.id === pluginId);
    if (plugin) {
      plugin.enabled = isEnabled;
      this.saveState();
      console.log(`[PluginManager]: Plugin "${plugin.name}" set to ${isEnabled ? 'ENABLED' : 'PAUSED'}. Reload required to reinitialize pipeline.`);
      return true;
    }
    return false;
  }

  initializeActivePlugins() {
    this.plugins.forEach(p => {
      if (p.enabled) {
        try {
          if (typeof p.init === 'function') {
            p.init(hookSystem);
            console.log(`[PluginManager]: Initialized plugin "${p.name}" successfully.`);
          }
        } catch (err) {
          console.error(`[PluginManager Error]: Failed to initialize plugin "${p.name}":`, err);
        }
      }
    });
  }
}

export const pluginManager = new PluginManager();
