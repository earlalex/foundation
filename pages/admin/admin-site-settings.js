// pages/admin/admin-site-settings.js - Site & Brand configuration
import { store } from '../../core/store.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { themeEngine, defaultBrandTheme } from '../../core/theme.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { FormValidator, adminFormRules } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';

import { darkModernTheme, ascensionBrandTheme } from '../../core/theme.js';

const THEME_PRESETS = {
  default: defaultBrandTheme,
  darkModern: darkModernTheme,
  ascension: ascensionBrandTheme,
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
  
  // Check and render Factory Reset trigger strictly for admins
  const currentUser = store.state.user;
  const simulatedUserTier = store.state.simulatedUserTier;
  const currentRole = simulatedUserTier || currentUser?.role || 'prospect';
  // Allow if explicitly Dev Mode / Emergency Bypass or role is admin
  const isDevConsoleBypass = window.__FOUNDATION_DEV_BYPASS__ === true || store.state.devMode === true;
  const isAdmin = currentUser?.isAdmin === true || currentRole === 'admin' || isDevConsoleBypass;
  const resetSectionId = 'factory-reset-section-wrapper';
  let resetSection = document.getElementById(resetSectionId);

  if (isAdmin || isDevConsoleBypass) {
    if (!resetSection) {
      resetSection = document.createElement('div');
      resetSection.id = resetSectionId;
      resetSection.style.marginTop = '2rem';
      resetSection.innerHTML = `
        <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-danger, #ef4444); padding: 1.5rem; border-radius: var(--theme-layout-border-radius, 8px);">
          <h2 style="margin-top: 0; font-size: 1.25rem; color: var(--theme-color-danger, #ef4444);">Emergency Operations</h2>
          <p style="margin: 0 0 1rem 0; color: var(--theme-color-text-secondary, #718096); font-size: 0.875rem;">
            Wipe configurations and reset the platform back to pristine state.
          </p>
          <button type="button" id="btn-factory-reset-trigger" style="padding: 10px 20px; background: var(--theme-color-danger, #ef4444); color: white; border: none; border-radius: var(--theme-layout-border-radius, 8px); font-weight: bold; cursor: pointer; transition: opacity 0.2s;">
            Factory Reset Platform
          </button>
        </div>
      `;
      // Append to the parent container of the forms or inside tab-site
      const tabSite = document.getElementById('tab-site');
      if (tabSite) {
        tabSite.appendChild(resetSection);
      } else {
        document.body.appendChild(resetSection);
      }
    }

    // Bind event trigger
    const btnTrigger = document.getElementById('btn-factory-reset-trigger');
    if (btnTrigger) {
      // Clear previous triggers if re-initialized to prevent multiple bindings
      const newBtn = btnTrigger.cloneNode(true);
      btnTrigger.parentNode.replaceChild(newBtn, btnTrigger);
      newBtn.addEventListener('click', () => {
        launchFactoryResetModal();
      });
    }
  } else {
    if (resetSection) {
      resetSection.remove();
    }
  }

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
  initIconSetManager();
  initNavigationEditor();
  initFooterLayoutEditor();
}

function initNavigationEditor() {
  const container = document.getElementById('nav-links-list-container');
  const addBtn = document.getElementById('btn-add-nav-link');
  const form = document.getElementById('nav-links-form');
  if (!container || !form) return;

  const currentCfg = configManager.current.navigation || [];

  function renderLinks(links) {
    container.innerHTML = links.map((link, idx) => `
      <div class="nav-link-row" style="display: grid; grid-template-columns: 2fr 2fr 1fr 1.5fr auto; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <input type="text" placeholder="Label" class="nav-label-input" value="${link.label || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
        <input type="text" placeholder="URL" class="nav-url-input" value="${link.url || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
        <select class="nav-target-select" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
          <option value="_self" ${link.target === '_self' ? 'selected' : ''}>_self</option>
          <option value="_blank" ${link.target === '_blank' ? 'selected' : ''}>_blank</option>
        </select>
        <select class="nav-role-select" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
          <option value="public" ${link.requiredRole === 'public' ? 'selected' : ''}>Public (Everyone)</option>
          <option value="subscriber" ${link.requiredRole === 'subscriber' ? 'selected' : ''}>Subscriber (Logged In)</option>
          <option value="member" ${link.requiredRole === 'member' ? 'selected' : ''}>Member (Paid)</option>
          <option value="admin" ${link.requiredRole === 'admin' ? 'selected' : ''}>Admin (Admin only)</option>
        </select>
        <button type="button" class="btn-remove-nav-row" style="background: transparent; border: none; color: var(--theme-color-danger, #e53e3e); font-size: 1.25rem; font-weight: bold; cursor: pointer;">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-remove-nav-row').forEach((btn, idx) => {
      btn.onclick = () => {
        const rows = Array.from(container.querySelectorAll('.nav-link-row'));
        rows[idx].remove();
      };
    });
  }

  renderLinks(currentCfg);

  if (addBtn) {
    addBtn.onclick = () => {
      const div = document.createElement('div');
      div.className = 'nav-link-row';
      div.style.cssText = 'display: grid; grid-template-columns: 2fr 2fr 1fr 1.5fr auto; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;';
      div.innerHTML = `
        <input type="text" placeholder="Label" class="nav-label-input" value="" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
        <input type="text" placeholder="URL" class="nav-url-input" value="" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
        <select class="nav-target-select" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
          <option value="_self">_self</option>
          <option value="_blank">_blank</option>
        </select>
        <select class="nav-role-select" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
          <option value="public">Public (Everyone)</option>
          <option value="subscriber">Subscriber (Logged In)</option>
          <option value="member">Member (Paid)</option>
          <option value="admin">Admin (Admin only)</option>
        </select>
        <button type="button" class="btn-remove-nav-row" style="background: transparent; border: none; color: var(--theme-color-danger, #e53e3e); font-size: 1.25rem; font-weight: bold; cursor: pointer;">&times;</button>
      `;
      div.querySelector('.btn-remove-nav-row').onclick = () => div.remove();
      container.appendChild(div);
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const rows = container.querySelectorAll('.nav-link-row');
    const updatedNavigation = [];
    rows.forEach(row => {
      updatedNavigation.push({
        label: row.querySelector('.nav-label-input').value.trim(),
        url: row.querySelector('.nav-url-input').value.trim(),
        target: row.querySelector('.nav-target-select').value,
        requiredRole: row.querySelector('.nav-role-select').value
      });
    });

    try {
      const updatedConfig = {
        ...configManager.current,
        navigation: updatedNavigation
      };
      const success = await configManager.saveToFirebase(updatedConfig);
      if (success) {
        toast.success("Header Top Navigation structure updated successfully!");
        const { initNavbar } = await import('../../core/navbar.js');
        initNavbar();
      } else {
        toast.error("Failed to save Top Navigation structure.");
      }
    } catch (err) {
      toast.error(`Error saving Top Navigation structure: ${err.message}`);
    }
  };
}

function initFooterLayoutEditor() {
  const form = document.getElementById('footer-layout-form');
  if (!form) return;

  const footerCfg = configManager.current.footer || {
    brand: { show: true, title: "Foundation", tagline: "A custom zero-build web framework for modern serverless architectures." },
    legal: { show: true, heading: "Legal & Policies", links: [{ label: "Terms of Use", url: "/terms" }, { label: "Privacy Policy", url: "/privacy" }, { label: "Cookie Settings", url: "/cookies" }] },
    newsletter: { show: true, heading: "Newsletter", text: "Subscribe to our newsletter for exclusive updates.", consentCopy: "I agree to receive email communications and accept the privacy policy." },
    social: { show: true, heading: "Follow Us", links: [{ name: "twitter", url: "https://x.com" }, { name: "linkedin", url: "https://linkedin.com" }, { name: "youtube", url: "https://youtube.com" }, { name: "github", url: "https://github.com" }, { name: "facebook", url: "https://facebook.com" }, { name: "instagram", url: "https://instagram.com" }] }
  };

  document.getElementById('footer-brand-show').checked = !!footerCfg.brand?.show;
  document.getElementById('footer-brand-title').value = footerCfg.brand?.title || '';
  document.getElementById('footer-brand-tagline').value = footerCfg.brand?.tagline || '';

  document.getElementById('footer-legal-show').checked = !!footerCfg.legal?.show;
  document.getElementById('footer-legal-heading').value = footerCfg.legal?.heading || '';

  document.getElementById('footer-newsletter-show').checked = !!footerCfg.newsletter?.show;
  document.getElementById('footer-newsletter-heading').value = footerCfg.newsletter?.heading || '';
  document.getElementById('footer-newsletter-text').value = footerCfg.newsletter?.text || '';
  document.getElementById('footer-newsletter-consent').value = footerCfg.newsletter?.consentCopy || '';

  document.getElementById('footer-social-show').checked = !!footerCfg.social?.show;
  document.getElementById('footer-social-heading').value = footerCfg.social?.heading || '';

  const legalList = document.getElementById('footer-legal-links-list');
  const addLegalBtn = document.getElementById('btn-add-footer-legal');

  function renderLegalLinks(links) {
    legalList.innerHTML = links.map(link => `
      <div class="footer-legal-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <input type="text" placeholder="Label" class="legal-label-input" value="${link.label || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; flex: 1; box-sizing: border-box;" />
        <input type="text" placeholder="URL" class="legal-url-input" value="${link.url || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; flex: 2; box-sizing: border-box;" />
        <button type="button" class="btn-remove-legal-row" style="background: transparent; border: none; color: var(--theme-color-danger, #e53e3e); font-size: 1.25rem; font-weight: bold; cursor: pointer;">&times;</button>
      </div>
    `).join('');

    legalList.querySelectorAll('.btn-remove-legal-row').forEach((btn, idx) => {
      btn.onclick = () => {
        const rows = Array.from(legalList.querySelectorAll('.footer-legal-row'));
        rows[idx].remove();
      };
    });
  }

  renderLegalLinks(footerCfg.legal?.links || []);

  if (addLegalBtn) {
    addLegalBtn.onclick = () => {
      const div = document.createElement('div');
      div.className = 'footer-legal-row';
      div.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;';
      div.innerHTML = `
        <input type="text" placeholder="Label" class="legal-label-input" value="" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; flex: 1; box-sizing: border-box;" />
        <input type="text" placeholder="URL" class="legal-url-input" value="" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; flex: 2; box-sizing: border-box;" />
        <button type="button" class="btn-remove-legal-row" style="background: transparent; border: none; color: var(--theme-color-danger, #e53e3e); font-size: 1.25rem; font-weight: bold; cursor: pointer;">&times;</button>
      `;
      div.querySelector('.btn-remove-legal-row').onclick = () => div.remove();
      legalList.appendChild(div);
    };
  }

  const socialList = document.getElementById('footer-social-links-list');
  const socialIcons = footerCfg.social?.links || [
    { name: "twitter", url: "https://x.com" },
    { name: "linkedin", url: "https://linkedin.com" },
    { name: "youtube", url: "https://youtube.com" },
    { name: "github", url: "https://github.com" },
    { name: "facebook", url: "https://facebook.com" },
    { name: "instagram", url: "https://instagram.com" }
  ];

  socialList.innerHTML = socialIcons.map(link => `
    <div class="footer-social-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
      <span style="font-weight: bold; font-size: 0.85rem; text-transform: capitalize; width: 80px;">${link.name}:</span>
      <input type="url" class="social-url-input" data-name="${link.name}" value="${link.url || ''}" style="flex: 1; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
    </div>
  `).join('');

  form.onsubmit = async (e) => {
    e.preventDefault();

    const legalRows = legalList.querySelectorAll('.footer-legal-row');
    const legalLinks = [];
    legalRows.forEach(row => {
      legalLinks.push({
        label: row.querySelector('.legal-label-input').value.trim(),
        url: row.querySelector('.legal-url-input').value.trim()
      });
    });

    const socialRows = socialList.querySelectorAll('.footer-social-row');
    const socialLinks = [];
    socialRows.forEach(row => {
      socialLinks.push({
        name: row.querySelector('.social-url-input').getAttribute('data-name'),
        url: row.querySelector('.social-url-input').value.trim()
      });
    });

    const updatedFooter = {
      brand: {
        show: document.getElementById('footer-brand-show').checked,
        title: document.getElementById('footer-brand-title').value.trim(),
        tagline: document.getElementById('footer-brand-tagline').value.trim()
      },
      legal: {
        show: document.getElementById('footer-legal-show').checked,
        heading: document.getElementById('footer-legal-heading').value.trim(),
        links: legalLinks
      },
      newsletter: {
        show: document.getElementById('footer-newsletter-show').checked,
        heading: document.getElementById('footer-newsletter-heading').value.trim(),
        text: document.getElementById('footer-newsletter-text').value.trim(),
        consentCopy: document.getElementById('footer-newsletter-consent').value.trim()
      },
      social: {
        show: document.getElementById('footer-social-show').checked,
        heading: document.getElementById('footer-social-heading').value.trim(),
        links: socialLinks
      }
    };

    try {
      const updatedConfig = {
        ...configManager.current,
        footer: updatedFooter
      };
      const success = await configManager.saveToFirebase(updatedConfig);
      if (success) {
        toast.success("Global Footer layout settings applied successfully!");
        const { initGlobalFooter } = await import('../../index.js');
        initGlobalFooter();
      } else {
        toast.error("Failed to save Global Footer layout settings.");
      }
    } catch (err) {
      toast.error(`Error saving Global Footer: ${err.message}`);
    }
  };
}

function initIconSetManager() {
  const iconSetSelect = document.getElementById('icon-set-select');
  const iconPackFile = document.getElementById('icon-pack-file');
  const iconSetForm = document.getElementById('icon-set-form');

  const currentCfg = configManager.current || {};
  if (iconSetSelect) {
    iconSetSelect.value = currentCfg.iconSet || 'default';
  }

  iconSetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedSet = iconSetSelect.value;
    const file = iconPackFile?.files?.[0];

    let customIconData = currentCfg.customIconData || null;

    if (selectedSet === 'custom' && file) {
      try {
        const reader = new FileReader();
        const fileContent = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

        if (file.name.endsWith('.json')) {
          customIconData = JSON.parse(fileContent);
        } else if (file.name.endsWith('.svg')) {
          customIconData = { sprite: fileContent };
        }
      } catch (err) {
        toast.error('Failed to parse uploaded icon pack. Please ensure it is valid JSON or SVG.');
        return;
      }
    }

    try {
      const updatedConfig = {
        ...configManager.current,
        iconSet: selectedSet,
        customIconData
      };
      const success = await configManager.saveToFirebase(updatedConfig);
      if (success) {
        toast.success('Icon set configuration saved successfully!');
      } else {
        toast.error('Failed to save icon set configuration.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin Icon Set Setup');
      toast.error(`Error saving icon set configuration: ${err.message}`);
    }
  });
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

function launchFactoryResetModal() {
  const modal = document.createElement('div');
  modal.id = 'factory-reset-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    z-index: 100002;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, sans-serif;
  `;

  let currentStep = 1;
  const confirmationPhrase = 'RESET-FOUNDATION';

  const renderModalContent = () => {
    if (currentStep === 1) {
      modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 90%; max-width: 500px; padding: 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); position: relative; color: #1a202c; text-align: left;">
          <h3 style="margin-top: 0; font-size: 1.4rem; font-weight: 800; color: #e53e3e; border-bottom: 2px solid #edf2f7; padding-bottom: 0.75rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>⚠️</span> Safety Verification: Step 1 of 2
          </h3>
          <p style="color: #2d3748; font-size: 0.95rem; line-height: 1.6; font-weight: bold; margin-bottom: 1.5rem; background: #fff5f5; border: 1px solid #fed7d7; padding: 12px; border-radius: 6px;">
            "WARNING: This action will permanently wipe all local cached settings, disconnect Firestore configurations, clear session storage, log you out, and return the application to its fresh out-of-the-box installation state."
          </p>
          <div style="display: flex; justify-content: flex-end; gap: 1rem; border-top: 1px solid #edf2f7; padding-top: 1.25rem;">
            <button id="btn-reset-cancel" style="background: transparent; border: 1px solid #cbd5e0; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer; color: #4a5568;">
              Cancel
            </button>
            <button id="btn-reset-next" style="background: #e53e3e; color: white; border: none; border-radius: 6px; padding: 8px 20px; font-weight: bold; cursor: pointer;">
              Understand & Continue
            </button>
          </div>
        </div>
      `;

      modal.querySelector('#btn-reset-cancel').addEventListener('click', () => {
        modal.remove();
      });

      modal.querySelector('#btn-reset-next').addEventListener('click', () => {
        currentStep = 2;
        renderModalContent();
      });
    } else if (currentStep === 2) {
      modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 90%; max-width: 500px; padding: 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); position: relative; color: #1a202c; text-align: left;">
          <h3 style="margin-top: 0; font-size: 1.4rem; font-weight: 800; color: #e53e3e; border-bottom: 2px solid #edf2f7; padding-bottom: 0.75rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>⚠️</span> Safety Verification: Step 2 of 2
          </h3>
          <p style="color: #4a5568; font-size: 0.9rem; margin-bottom: 1rem; line-height: 1.5;">
            To confirm this highly destructive action, please type the confirmation phrase exactly as shown below:
          </p>
          <div style="background: #f7fafc; padding: 10px; border-radius: 6px; text-align: center; font-weight: bold; font-family: monospace; font-size: 1.1rem; letter-spacing: 2px; border: 1px dashed #cbd5e0; margin-bottom: 1rem;">
            ${confirmationPhrase}
          </div>
          <input type="text" id="input-confirm-phrase" placeholder="Type phrase here..." style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 1rem; box-sizing: border-box; text-align: center; font-family: monospace; font-weight: bold; margin-bottom: 1.5rem;" />
          <div style="display: flex; justify-content: flex-end; gap: 1rem; border-top: 1px solid #edf2f7; padding-top: 1.25rem;">
            <button id="btn-reset-back" style="background: #edf2f7; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer; color: #4a5568;">
              Back
            </button>
            <button id="btn-reset-confirm" disabled style="background: #e53e3e; color: white; border: none; border-radius: 6px; padding: 8px 20px; font-weight: bold; cursor: not-allowed; opacity: 0.5; transition: opacity 0.2s;">
              Confirm & Wipe Everything
            </button>
          </div>
        </div>
      `;

      const input = modal.querySelector('#input-confirm-phrase');
      const confirmBtn = modal.querySelector('#btn-reset-confirm');

      input.focus();

      input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val === confirmationPhrase) {
          confirmBtn.disabled = false;
          confirmBtn.style.cursor = 'pointer';
          confirmBtn.style.opacity = '1';
        } else {
          confirmBtn.disabled = true;
          confirmBtn.style.cursor = 'not-allowed';
          confirmBtn.style.opacity = '0.5';
        }
      });

      modal.querySelector('#btn-reset-back').addEventListener('click', () => {
        currentStep = 1;
        renderModalContent();
      });

      confirmBtn.addEventListener('click', async () => {
        if (input.value.trim() === confirmationPhrase) {
          modal.innerHTML = `
            <div style="background: white; border-radius: 12px; width: 100%; max-width: 400px; padding: 2.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
              <div style="font-size: 3rem; margin-bottom: 1rem;">🧹</div>
              <h3 style="margin-top: 0; margin-bottom: 0.5rem; font-weight: 800;">Purging State...</h3>
              <p style="color: #718096; font-size: 0.9rem; margin-bottom: 0;">Executing factory reset pipeline...</p>
            </div>
          `;
          try {
            await configManager.resetPlatform();
            toast.success("Platform has been factory reset successfully.");
            modal.remove();
            setTimeout(() => {
              window.location.href = window.location.origin + '/admin';
            }, 1000);
          } catch (err) {
            console.error('Factory reset failed:', err);
            toast.error('Factory reset failed: ' + err.message);
            modal.remove();
          }
        }
      });
    }
  };

  document.body.appendChild(modal);
  renderModalContent();
}
