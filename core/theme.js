// core/theme.js
import { store } from '/core/store.js';

// Default Foundation Theme Schema
export const defaultBrandTheme = {
  name: "Foundation Default",
  colors: {
    primary: "#2b6cb0",
    primaryHover: "#2c5282",
    surface: "#ffffff",
    background: "#f7fafc",
    textPrimary: "#1a202c",
    textSecondary: "#4a5568",
    border: "#e2e8f0",
    accent: "#38a169",
    danger: "#e53e3e"
  },
  typography: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSizeBase: "16px",
    headingWeight: "700"
  },
  layout: {
    borderRadius: "8px",
    containerMaxWidth: "1000px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
  }
};

export class ThemeEngine {
  constructor() {
    this.init();
  }

  init() {
    // 1. Try restoring theme from localStorage or fallback to default
    const savedTheme = localStorage.getItem('foundation_active_theme');
    let activeTheme = defaultBrandTheme;

    if (savedTheme) {
      try {
        activeTheme = JSON.parse(savedTheme);
      } catch (e) {
        console.warn('[ThemeEngine]: Failed to parse stored theme JSON. Resetting to default.');
      }
    }

    this.applyTheme(activeTheme);
  }

  /**
   * Translates a Brand Guide JSON object into standard CSS custom properties on :root
   */
  applyTheme(themeConfig) {
    if (!themeConfig || typeof themeConfig !== 'object') return;

    const root = document.documentElement;

    // Map Colors
    if (themeConfig.colors) {
      Object.entries(themeConfig.colors).forEach(([key, val]) => {
        root.style.setProperty(`--theme-color-${this.#toKebabCase(key)}`, val);
      });
    }

    // Map Typography
    if (themeConfig.typography) {
      Object.entries(themeConfig.typography).forEach(([key, val]) => {
        root.style.setProperty(`--theme-font-${this.#toKebabCase(key)}`, val);
      });
    }

    // Map Layout & Spacing
    if (themeConfig.layout) {
      Object.entries(themeConfig.layout).forEach(([key, val]) => {
        root.style.setProperty(`--theme-layout-${this.#toKebabCase(key)}`, val);
      });
    }

    // Update Store & LocalStorage
    localStorage.setItem('foundation_active_theme', JSON.stringify(themeConfig));
    store.dispatch('APPLY_THEME_JSON', themeConfig);
    console.log(`[ThemeEngine]: Applied design system -> "${themeConfig.name || 'Custom Theme'}"`);
  }

  #toKebabCase(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }
}

export const themeEngine = new ThemeEngine();