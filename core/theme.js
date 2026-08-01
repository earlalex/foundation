// core/theme.js
import { store } from './store.js';

// Default "Foundation Blue" Theme Preset
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
    headingWeight: "800",
    primaryFont: "system-ui, -apple-system, sans-serif",
    bodyFont: "system-ui, -apple-system, sans-serif",
    accentFont: "monospace"
  },
  layout: {
    borderRadius: "8px",
    containerMaxWidth: "1000px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
  }
};

export const darkModernTheme = {
  name: "Dark Modern",
  colors: {
    primary: "#3182ce",
    primaryHover: "#2b6cb0",
    surface: "#1a202c",
    background: "#111422",
    textPrimary: "#f7fafc",
    textSecondary: "#a0aec0",
    border: "#2d3748",
    accent: "#48bb78",
    danger: "#f56565"
  },
  typography: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSizeBase: "16px",
    headingWeight: "700",
    primaryFont: "system-ui, -apple-system, sans-serif",
    bodyFont: "system-ui, -apple-system, sans-serif",
    accentFont: "monospace"
  },
  layout: {
    borderRadius: "8px",
    containerMaxWidth: "1000px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)"
  }
};

export const ascensionBrandTheme = {
  name: "Ascension Brand",
  colors: {
    primary: "#805ad5",
    primaryHover: "#6b46c1",
    surface: "#ffffff",
    background: "#f9f5ff",
    textPrimary: "#2d3748",
    textSecondary: "#718096",
    border: "#e9d8fd",
    accent: "#b7791f",
    danger: "#e53e3e"
  },
  typography: {
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSizeBase: "16px",
    headingWeight: "800",
    primaryFont: "system-ui, -apple-system, sans-serif",
    bodyFont: "system-ui, -apple-system, sans-serif",
    accentFont: "monospace"
  },
  layout: {
    borderRadius: "12px",
    containerMaxWidth: "1000px",
    boxShadow: "0 4px 6px rgba(128, 90, 213, 0.15)"
  }
};

// Preset Definitions
export const themePresets = {
  "Foundation Default": defaultBrandTheme,
  "Emerald Modern": {
    name: "Emerald Modern",
    colors: {
      primary: "#059669",
      primaryHover: "#047857",
      surface: "#ffffff",
      background: "#f0fdf4",
      textPrimary: "#064e3b",
      textSecondary: "#047857",
      border: "#d1fae5",
      accent: "#34d399",
      danger: "#ef4444"
    },
    typography: {
      fontFamily: "'Inter', sans-serif",
      fontSizeBase: "16px",
      headingWeight: "700",
      primaryFont: "Inter",
      bodyFont: "Inter",
      accentFont: "monospace"
    },
    layout: {
      borderRadius: "8px",
      containerMaxWidth: "1000px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
    }
  },
  "Midnight Dark": darkModernTheme,
  "Cyberpunk Neon": {
    name: "Cyberpunk Neon",
    colors: {
      primary: "#ff007f",
      primaryHover: "#e0006c",
      surface: "#120024",
      background: "#02000a",
      textPrimary: "#39ff14",
      textSecondary: "#00ffff",
      border: "#ff007f",
      accent: "#00ffff",
      danger: "#ff0033"
    },
    typography: {
      fontFamily: "'Orbitron', sans-serif",
      fontSizeBase: "16px",
      headingWeight: "800",
      primaryFont: "Orbitron",
      bodyFont: "Inter",
      accentFont: "monospace"
    },
    layout: {
      borderRadius: "0px",
      containerMaxWidth: "1000px",
      boxShadow: "0 0 10px #ff007f"
    }
  }
};

export class ThemeEngine {
  constructor() {
    this.init();
  }

  init() {
    // 1. Try restoring theme from localStorage (foundation_theme_config) or fallback to default Foundation Blue
    const savedTheme = localStorage.getItem('foundation_theme_config');
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

    // Map Typography and load Google Fonts
    if (themeConfig.typography) {
      Object.entries(themeConfig.typography).forEach(([key, val]) => {
        root.style.setProperty(`--theme-font-${this.#toKebabCase(key)}`, val);
      });

      // Handle individual customizable font slots
      const primFont = themeConfig.typography.primaryFont || themeConfig.typography.fontFamily;
      const bodyFont = themeConfig.typography.bodyFont || themeConfig.typography.fontFamily;
      const accentFont = themeConfig.typography.accentFont || "monospace";

      root.style.setProperty(`--theme-font-primary`, primFont);
      root.style.setProperty(`--theme-font-body`, bodyFont);
      root.style.setProperty(`--theme-font-accent`, accentFont);

      // Load fonts dynamically from Google Fonts if needed
      this.loadGoogleFontIfNeeded(primFont);
      this.loadGoogleFontIfNeeded(bodyFont);
      this.loadGoogleFontIfNeeded(accentFont);
    }

    // Map Layout & Spacing
    if (themeConfig.layout) {
      Object.entries(themeConfig.layout).forEach(([key, val]) => {
        root.style.setProperty(`--theme-layout-${this.#toKebabCase(key)}`, val);
      });
    }

    // Update Store & LocalStorage under foundation_theme_config
    localStorage.setItem('foundation_theme_config', JSON.stringify(themeConfig));
    store.dispatch('APPLY_THEME_JSON', themeConfig);
    console.log(`[ThemeEngine]: Applied design system -> "${themeConfig.name || 'Custom Theme'}"`);

    // Synchronize to Firestore under /settings/config
    this.syncThemeToFirestore(themeConfig);
  }

  loadGoogleFontIfNeeded(fontName) {
    if (!fontName) return;
    const cleanFont = fontName.split(',')[0].replace(/['"]/g, '').trim();

    // Check if it's standard web safe
    const webSafe = ['system-ui', '-apple-system', 'sans-serif', 'serif', 'monospace', 'arial', 'helvetica', 'georgia', 'courier', 'verdana', 'tahoma', 'trebuchet'];
    const isWebSafe = webSafe.some(ws => cleanFont.toLowerCase().includes(ws));
    if (isWebSafe) return;

    const fontId = `google-font-${cleanFont.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(fontId)) return;

    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${cleanFont.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800&display=swap`;
    document.head.appendChild(link);
  }

  async syncThemeToFirestore(themeConfig) {
    try {
      const { configManager } = await import('./config.js');
      // Merge with current config and save
      const current = configManager.current || {};
      const updatedConfig = {
        ...current,
        activeThemeConfig: themeConfig
      };
      await configManager.saveSetupCredentials(updatedConfig);
    } catch (e) {
      console.warn('[ThemeEngine]: Postponed Firestore theme sync: configManager unavailable or offline.');
    }
  }

  #toKebabCase(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }
}

export const themeEngine = new ThemeEngine();
