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

/**
 * W3C Relative Luminance & WCAG 2.1 AA Contrast Compliance Helpers
 */
export function getRelativeLuminance(hex) {
  if (!hex || typeof hex !== 'string') return 0;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return 0;

  const r8 = (num >> 16) & 255;
  const g8 = (num >> 8) & 255;
  const b8 = num & 255;

  const normalize = (c8) => {
    const s = c8 / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const r = normalize(r8);
  const g = normalize(g8);
  const b = normalize(b8);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calculateContrastRatio(hex1, hex2) {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function ensureContrastCompliance(textHex, bgHex, minRatio = 4.5) {
  const ratio = calculateContrastRatio(textHex, bgHex);
  if (ratio >= minRatio) {
    return textHex;
  }
  const bgLuminance = getRelativeLuminance(bgHex);
  const adjustedText = bgLuminance > 0.5 ? "#0F172A" : "#FFFFFF";
  console.log(`[WCAG Contrast Compliance]: Adjusted ${textHex} against background ${bgHex} (ratio ${ratio.toFixed(2)}:1) -> ${adjustedText} (${calculateContrastRatio(adjustedText, bgHex).toFixed(2)}:1)`);
  return adjustedText;
}

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
    this.applyTheme(activeTheme, true);

    // Initialize High-Contrast Mode from local storage
    const highContrast = localStorage.getItem('foundation_high_contrast') === 'true';
    this.setHighContrastMode(highContrast);
  }

  /**
   * Toggles or sets High-Contrast mode explicitly
   * @param {boolean} enabled
   */
  setHighContrastMode(enabled) {
    const value = !!enabled;
    document.documentElement.setAttribute('data-high-contrast', value ? 'true' : 'false');
    localStorage.setItem('foundation_high_contrast', String(value));

    // Sync to store state if exists
    try {
      store.dispatch('SET_HIGH_CONTRAST', value);
    } catch (e) {}

    console.log(`[ThemeEngine]: High-Contrast mode ${value ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Translates a Brand Guide JSON object into standard CSS custom properties on :root
   */
  applyTheme(themeConfig, isInitial = false) {
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

    // Detect if the theme config has explicitly changed from what is currently saved
    const savedThemeStr = localStorage.getItem('foundation_theme_config');
    let hasChanged = true;
    if (savedThemeStr) {
      try {
        const savedTheme = JSON.parse(savedThemeStr);
        hasChanged = JSON.stringify(savedTheme) !== JSON.stringify(themeConfig);
      } catch (e) {
        hasChanged = true;
      }
    } else {
      // If there was no saved theme in localStorage, we are using defaults.
      // This is not an explicit user change, so we don't treat it as "explicitly changed" to avoid boot-time writes.
      hasChanged = false;
    }

    // Update Store & LocalStorage under foundation_theme_config
    localStorage.setItem('foundation_theme_config', JSON.stringify(themeConfig));
    store.dispatch('APPLY_THEME_JSON', themeConfig);
    console.log(`[ThemeEngine]: Applied design system -> "${themeConfig.name || 'Custom Theme'}"`);

    // Synchronize to Firestore under /settings/config only if not initial boot or if the config has explicitly changed
    if (!isInitial || hasChanged) {
      this.syncThemeToFirestore(themeConfig);
    }
  }

  /**
   * Dynamic Theme Engine Injection
   * Injects CSS Custom Properties and loads Google Fonts for synthesized Brand Guide
   */
  applyCustomDesignSystem(payload) {
    if (!payload || typeof payload !== 'object') return;
    const root = document.documentElement;

    let brandGuide = payload;
    let cssVarsMap = {};

    if (payload.colors || payload.typography) {
      const colors = payload.colors || {};
      const typography = payload.typography || {};

      const surface = colors.surface || "#ffffff";
      let textPrimary = colors.textPrimary || "#1a202c";
      textPrimary = ensureContrastCompliance(textPrimary, surface, 4.5);

      cssVarsMap = {
        '--theme-color-primary': colors.primary || '#2b6cb0',
        '--theme-color-primary-hover': colors.primaryHover || '#2c5282',
        '--theme-color-accent': colors.accent || '#38a169',
        '--theme-color-surface': surface,
        '--theme-color-surface-alt': colors.surfaceAlt || '#f8fafc',
        '--theme-color-text-primary': textPrimary,
        '--theme-color-text-secondary': colors.textSecondary || '#4a5568',
        '--theme-font-family-heading': typography.headingFont || typography.primaryFont || 'system-ui',
        '--theme-font-family-body': typography.bodyFont || typography.primaryFont || 'system-ui',
        '--theme-font-primary': typography.headingFont || typography.primaryFont || 'system-ui',
        '--theme-font-body': typography.bodyFont || 'system-ui'
      };

      this.loadGoogleFontIfNeeded(typography.headingFont);
      this.loadGoogleFontIfNeeded(typography.bodyFont);
    } else {
      cssVarsMap = payload;
      Object.entries(payload).forEach(([key, val]) => {
        if (typeof val === 'string' && (key.includes('font') || key.includes('Family'))) {
          this.loadGoogleFontIfNeeded(val);
        }
      });
    }

    Object.entries(cssVarsMap).forEach(([prop, val]) => {
      if (val) root.style.setProperty(prop, val);
    });

    try {
      localStorage.setItem('foundation_theme_custom', JSON.stringify(brandGuide));
    } catch (e) {}

    try {
      store.dispatch('APPLY_THEME_JSON', brandGuide);
    } catch (e) {}

    this.syncThemeToFirestore(brandGuide);
    console.log('[ThemeEngine]: Custom design system injected dynamically.');
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
