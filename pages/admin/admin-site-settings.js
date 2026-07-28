// pages/admin/admin-site-settings.js - Site & Brand configuration
import { store } from '../../core/store.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { themeEngine, defaultBrandTheme } from '../../core/theme.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { FormValidator, adminFormRules } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';

const THEME_PRESETS = {
  default: defaultBrandTheme,
  emerald: {
    name: "Emerald Modern",
    colors: {
      primary: "#059669",
      primaryHover: "#047857",
      surface: "#ffffff",
      background: "#f0fdf4",
      textPrimary: "#064e3b",
      textSecondary: "#047857",
      border: "#a7f3d0",
      accent: "#10b981",
      danger: "#ef4444"
    },
    typography: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSizeBase: "16px",
      headingWeight: "800"
    },
    layout: {
      borderRadius: "12px",
      containerMaxWidth: "1000px",
      boxShadow: "0 4px 6px 1px rgba(0, 0, 0, 0.05)"
    }
  },
  midnight: {
    name: "Midnight Dark",
    colors: {
      primary: "#3b82f6",
      primaryHover: "#2563eb",
      surface: "#1f2937",
      background: "#111827",
      textPrimary: "#f9fafb",
      textSecondary: "#9ca3af",
      border: "#374151",
      accent: "#60a5fa",
      danger: "#f87171"
    },
    typography: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSizeBase: "16px",
      headingWeight: "700"
    },
    layout: {
      borderRadius: "8px",
      containerMaxWidth: "1000px",
      boxShadow: "0 10px 15px 3px rgba(0, 0, 0, 0.3)"
    }
  },
  cyberpunk: {
    name: "Cyberpunk Neon",
    colors: {
      primary: "#d946ef",
      primaryHover: "#c026d3",
      surface: "#18181b",
      background: "#09090b",
      textPrimary: "#f4f4f5",
      textSecondary: "#a1a1aa",
      border: "#27272a",
      accent: "#06b6d4",
      danger: "#f43f5e"
    },
    typography: {
      fontFamily: "Consolas, Monaco, monospace",
      fontSizeBase: "15px",
      headingWeight: "900"
    },
    layout: {
      borderRadius: "2px",
      containerMaxWidth: "1000px",
      boxShadow: "0 0 10px rgba(217, 70, 239, 0.2)"
    }
  }
};

export function initSiteSettingsTab() {
  const currentCfg = configManager.current || {};
  
  // Site identity form
  const siteTitleInput = document.getElementById('site-title');
  const siteTaglineInput = document.getElementById('site-tagline');
  const siteDomainInput = document.getElementById('site-domain');
  const siteDescriptionInput = document.getElementById('site-description');
  const lookerUrlInput = document.getElementById('looker-studio-url');
  const headerScriptsInput = document.getElementById('header-scripts');

  if (siteTitleInput) siteTitleInput.value = currentCfg.siteTitle || '';
  if (siteTaglineInput) siteTaglineInput.value = currentCfg.siteTagline || '';
  if (siteDomainInput) siteDomainInput.value = currentCfg.siteDomain || '';
  if (siteDescriptionInput) siteDescriptionInput.value = currentCfg.siteDescription || '';
  if (lookerUrlInput) lookerUrlInput.value = currentCfg.thirdParty?.lookerStudioEmbedUrl || '';
  if (headerScriptsInput) headerScriptsInput.value = currentCfg.headerScripts || '';

  // Initialize form validator
  const siteSettingsForm = document.getElementById('site-settings-form');
  let siteSettingsValidator = null;
  if (siteSettingsForm) {
    siteSettingsValidator = new FormValidator(siteSettingsForm, adminFormRules.siteSettings);
  }

  document.getElementById('site-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (siteSettingsValidator && !siteSettingsValidator.validateAll()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const siteLogoInput = document.getElementById('site-logo');
      const siteFaviconInput = document.getElementById('site-favicon');
      let logoAsset = currentCfg.siteLogo || null;
      let faviconAsset = currentCfg.siteFavicon || null;

      if (siteLogoInput && siteLogoInput.files.length > 0) {
        logoAsset = await uploadFileToDrive(siteLogoInput.files[0]);
      }
      if (siteFaviconInput && siteFaviconInput.files.length > 0) {
        faviconAsset = await uploadFileToDrive(siteFaviconInput.files[0]);
      }

      const updatedSiteConfig = {
        ...currentCfg,
        siteTitle: siteTitleInput.value,
        siteTagline: siteTaglineInput.value,
        siteDomain: siteDomainInput.value,
        siteDescription: siteDescriptionInput.value,
        siteLogo: logoAsset,
        siteFavicon: faviconAsset
      };

      const success = await configManager.saveToFirebase(updatedSiteConfig);
      if (success) {
        toast.success(`Site Identity settings saved for "${siteTitleInput.value}"!`);
      } else {
        toast.error('Failed to save site settings. Please try again.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin Site Settings - Site Identity Form');
      toast.error(`Error saving site settings: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  document.getElementById('site-embeds-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const updatedEmbedsConfig = {
        ...configManager.current,
        thirdParty: {
          ...(configManager.current.thirdParty || {}),
          lookerStudioEmbedUrl: lookerUrlInput.value
        },
        headerScripts: headerScriptsInput.value
      };
      const success = await configManager.saveToFirebase(updatedEmbedsConfig);
      if (success) {
        toast.success('Integration embeds and custom header scripts saved!');
      } else {
        toast.error('Failed to save embed settings. Please try again.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin Site Settings - Embeds Form');
      toast.error(`Error saving embed settings: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  initThemeEngine();
}

function initThemeEngine() {
  const themeJsonInput = document.getElementById('theme-json-input');
  const themeForm = document.getElementById('theme-json-form');
  const presetSelect = document.getElementById('theme-preset-select');
  const resetBtn = document.getElementById('btn-reset-theme');

  // Individual theme controls elements
  const ctrlPrimary = document.getElementById('theme-ctrl-primary');
  const ctrlPrimaryHover = document.getElementById('theme-ctrl-primary-hover');
  const ctrlSurface = document.getElementById('theme-ctrl-surface');
  const ctrlBackground = document.getElementById('theme-ctrl-background');
  const ctrlTextPrimary = document.getElementById('theme-ctrl-text-primary');
  const ctrlTextSecondary = document.getElementById('theme-ctrl-text-secondary');
  const ctrlBorder = document.getElementById('theme-ctrl-border');
  const ctrlAccent = document.getElementById('theme-ctrl-accent');
  const ctrlFont = document.getElementById('theme-ctrl-font');
  const ctrlFontSize = document.getElementById('theme-ctrl-font-size');
  const ctrlRadius = document.getElementById('theme-ctrl-radius');

  function updateInputControlsFromTheme(theme) {
    if (!theme) return;
    if (ctrlPrimary && theme.colors?.primary) ctrlPrimary.value = theme.colors.primary;
    if (ctrlPrimaryHover && theme.colors?.primaryHover) ctrlPrimaryHover.value = theme.colors.primaryHover;
    if (ctrlSurface && theme.colors?.surface) ctrlSurface.value = theme.colors.surface;
    if (ctrlBackground && theme.colors?.background) ctrlBackground.value = theme.colors.background;
    if (ctrlTextPrimary && theme.colors?.textPrimary) ctrlTextPrimary.value = theme.colors.textPrimary;
    if (ctrlTextSecondary && theme.colors?.textSecondary) ctrlTextSecondary.value = theme.colors.textSecondary;
    if (ctrlBorder && theme.colors?.border) ctrlBorder.value = theme.colors.border;
    if (ctrlAccent && theme.colors?.accent) ctrlAccent.value = theme.colors.accent;
    if (ctrlFont && theme.typography?.fontFamily) ctrlFont.value = theme.typography.fontFamily;
    if (ctrlFontSize && theme.typography?.fontSizeBase) ctrlFontSize.value = theme.typography.fontSizeBase;
    if (ctrlRadius && theme.layout?.borderRadius) ctrlRadius.value = theme.layout.borderRadius;
  }

  function getThemeObjectFromInputs() {
    const currentTheme = store.state.activeBrandGuide || defaultBrandTheme;
    return {
      name: currentTheme.name || "Custom Theme",
      colors: {
        primary: ctrlPrimary?.value || "#2b6cb0",
        primaryHover: ctrlPrimaryHover?.value || "#2c5282",
        surface: ctrlSurface?.value || "#ffffff",
        background: ctrlBackground?.value || "#f7fafc",
        textPrimary: ctrlTextPrimary?.value || "#1a202c",
        textSecondary: ctrlTextSecondary?.value || "#4a5568",
        border: ctrlBorder?.value || "#e2e8f0",
        accent: ctrlAccent?.value || "#38a169",
        danger: currentTheme.colors?.danger || "#e53e3e"
      },
      typography: {
        fontFamily: ctrlFont?.value || "system-ui, -apple-system, sans-serif",
        fontSizeBase: ctrlFontSize?.value || "16px",
        headingWeight: currentTheme.typography?.headingWeight || "700"
      },
      layout: {
        borderRadius: ctrlRadius?.value || "8px",
        containerMaxWidth: currentTheme.layout?.containerMaxWidth || "1000px",
        boxShadow: currentTheme.layout?.boxShadow || "0 1px 3px rgba(0,0,0,0.08)"
      }
    };
  }

  function updateJSONTextarea() {
    const customTheme = getThemeObjectFromInputs();
    if (themeJsonInput) {
      themeJsonInput.value = JSON.stringify(customTheme, null, 2);
    }
    themeEngine.applyTheme(customTheme);
  }

  // Bind events to the interactive inputs to update the theme instantly (live preview)
  const inputsToBind = [
    ctrlPrimary, ctrlPrimaryHover, ctrlSurface, ctrlBackground,
    ctrlTextPrimary, ctrlTextSecondary, ctrlBorder, ctrlAccent,
    ctrlFont, ctrlFontSize, ctrlRadius
  ];
  inputsToBind.forEach(input => {
    if (input) {
      input.addEventListener('input', updateJSONTextarea);
      input.addEventListener('change', updateJSONTextarea);
    }
  });

  function loadActiveThemeIntoTextarea() {
    if (!themeJsonInput) return;
    const currentTheme = store.state.activeBrandGuide || defaultBrandTheme;
    themeJsonInput.value = JSON.stringify(currentTheme, null, 2);
    updateInputControlsFromTheme(currentTheme);
  }

  loadActiveThemeIntoTextarea();

  themeForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const parsedTheme = JSON.parse(themeJsonInput.value);
      themeEngine.applyTheme(parsedTheme);
      updateInputControlsFromTheme(parsedTheme);
      toast.success(`Successfully applied "${parsedTheme.name || 'Custom Theme'}" design system!`);
    } catch (err) {
      errorHandler.handleError(err, 'Admin Site Settings - Theme JSON');
      toast.error(`Invalid Theme JSON: ${err.message}`);
    }
  });

  presetSelect?.addEventListener('change', (e) => {
    const selectedKey = e.target.value;
    const presetTheme = THEME_PRESETS[selectedKey] || defaultBrandTheme;
    themeEngine.applyTheme(presetTheme);
    themeJsonInput.value = JSON.stringify(presetTheme, null, 2);
    updateInputControlsFromTheme(presetTheme);
  });

  resetBtn?.addEventListener('click', () => {
    if (confirm('Reset theme back to Foundation Default?')) {
      themeEngine.applyTheme(defaultBrandTheme);
      themeJsonInput.value = JSON.stringify(defaultBrandTheme, null, 2);
      updateInputControlsFromTheme(defaultBrandTheme);
      if (presetSelect) presetSelect.value = 'default';
      toast.success('Theme reset to default.');
    }
  });
}
