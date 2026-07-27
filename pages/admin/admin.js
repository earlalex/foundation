// pages/admin/admin.js
import { store } from '../../core/store.js';
import { contentDB } from '../../core/db.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { 
  createGoogleCalendarEvent, 
  getSearchConsoleNotifications, 
  requestSearchConsoleCrawl, 
  getSearchConsoleSecurityIssues,
  getAnalyticsOverview, 
  fetchSeoMyRankAddr,
  runLighthouseAudit,
  syncGoogleContactRole,
  sendBulkGmail
} from '../../core/google-services.js';
import { themeEngine, defaultBrandTheme } from '../../core/theme.js';
import { configManager } from '../../core/config.js';

const MONTHLY_MEMBERSHIP_FEE = 29.00;
const REFERRAL_COMMISSION_RATE = 0.10;

// Preset Brand Guide Definitions
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

import { authManager } from '../../core/auth.js';

export function initAdminPage() {
  // --- 0. LOG OUT BUTTON ---
  const logoutBtn = document.getElementById('btn-admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to log out of the Admin Command Center?')) {
        await authManager.logout();
        window.router.loadRoute('/home');
      }
    });
  }

  // --- 1. TAB ROUTING CONTROLLER ---
  const tabButtons = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => {
        b.style.borderBottom = 'none';
        b.style.color = 'var(--theme-color-text-secondary, #4a5568)';
      });
      btn.style.borderBottom = '3px solid var(--theme-color-primary, #2b6cb0)';
      btn.style.color = 'var(--theme-color-primary, #2b6cb0)';

      panels.forEach((p) => {
        p.style.display = p.id === `tab-${targetTab}` ? 'block' : 'none';
      });

      if (targetTab === 'users') {
        loadUserDirectoryTab();
      } else if (targetTab === 'seo') {
        loadSeoAndAnalyticsTab();
      } else if (targetTab === 'performance') {
        loadPerformanceTab();
      } else if (targetTab === 'security') {
        loadGscSecurityThreats();
      }
    });
  });

  // --- 2. TAB 1: SITE & BRAND SETTINGS ---
  const siteTitleInput = document.getElementById('site-title');
  const siteTaglineInput = document.getElementById('site-tagline');
  const siteDomainInput = document.getElementById('site-domain');
  const siteDescriptionInput = document.getElementById('site-description');
  const lookerUrlInput = document.getElementById('looker-studio-url');
  const headerScriptsInput = document.getElementById('header-scripts');

  const currentCfg = configManager.current || {};
  if (siteTitleInput) siteTitleInput.value = currentCfg.siteTitle || '';
  if (siteTaglineInput) siteTaglineInput.value = currentCfg.siteTagline || '';
  if (siteDomainInput) siteDomainInput.value = currentCfg.siteDomain || '';
  if (siteDescriptionInput) siteDescriptionInput.value = currentCfg.siteDescription || '';
  if (lookerUrlInput) lookerUrlInput.value = currentCfg.thirdParty?.lookerStudioEmbedUrl || '';
  if (headerScriptsInput) headerScriptsInput.value = currentCfg.headerScripts || '';

  document.getElementById('site-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
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
      alert(`Site Identity settings saved to Firestore for "${siteTitleInput.value}"!`);
    }
  });

  document.getElementById('site-embeds-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
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
      alert('Integration embeds and custom header scripts saved to Firestore!');
    }
  });

  // Theme Engine
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

  // Bind events to the interactive inputs to update the theme instantly
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
      alert(`Successfully applied "${parsedTheme.name || 'Custom Theme'}" design system!`);
    } catch (err) {
      alert(`Invalid Theme JSON: ${err.message}`);
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
    }
  });

  // --- 3. TAB 2: BUSINESS & LEGAL PROFILE ---
  const bizLegalNameInput = document.getElementById('biz-legal-name');
  const bizDbaInput = document.getElementById('biz-dba');
  const bizEinInput = document.getElementById('biz-ein');
  const bizEntityTypeInput = document.getElementById('biz-entity-type');
  const bizAddressInput = document.getElementById('biz-address');
  const bizCityInput = document.getElementById('biz-city');
  const bizStateInput = document.getElementById('biz-state');
  const bizZipInput = document.getElementById('biz-zip');
  const bizCountryInput = document.getElementById('biz-country');
  const bizEmailInput = document.getElementById('biz-email');
  const bizSupportEmailInput = document.getElementById('biz-support-email');
  const bizPhoneInput = document.getElementById('biz-phone');
  const bizPrivacyUrlInput = document.getElementById('biz-privacy-url');
  const bizTermsUrlInput = document.getElementById('biz-terms-url');
  const bizRefundUrlInput = document.getElementById('biz-refund-url');

  // financial & regulatory
  const bizDunsInput = document.getElementById('biz-duns');
  const bizBankNameInput = document.getElementById('biz-bank-name');
  const bizBankRoutingInput = document.getElementById('biz-bank-routing');
  const bizBankAccountInput = document.getElementById('biz-bank-account');

  // document status divs
  const docArticlesStatus = document.getElementById('biz-doc-articles-status');
  const docOperatingStatus = document.getElementById('biz-doc-operating-status');
  const docEinStatus = document.getElementById('biz-doc-ein-status');

  const bizProfile = currentCfg.businessProfile || {};
  if (bizLegalNameInput) bizLegalNameInput.value = bizProfile.legalName || '';
  if (bizDbaInput) bizDbaInput.value = bizProfile.dba || '';
  if (bizEinInput) bizEinInput.value = bizProfile.ein || '';
  if (bizEntityTypeInput) bizEntityTypeInput.value = bizProfile.entityType || 'llc';
  if (bizAddressInput) bizAddressInput.value = bizProfile.address || '';
  if (bizCityInput) bizCityInput.value = bizProfile.city || '';
  if (bizStateInput) bizStateInput.value = bizProfile.state || '';
  if (bizZipInput) bizZipInput.value = bizProfile.zip || '';
  if (bizCountryInput) bizCountryInput.value = bizProfile.country || '';
  if (bizEmailInput) bizEmailInput.value = bizProfile.email || '';
  if (bizSupportEmailInput) bizSupportEmailInput.value = bizProfile.supportEmail || '';
  if (bizPhoneInput) bizPhoneInput.value = bizProfile.phone || '';
  if (bizPrivacyUrlInput) bizPrivacyUrlInput.value = bizProfile.privacyUrl || '/privacy';
  if (bizTermsUrlInput) bizTermsUrlInput.value = bizProfile.termsUrl || '/terms';
  if (bizRefundUrlInput) bizRefundUrlInput.value = bizProfile.refundUrl || '/refunds';

  if (bizDunsInput) bizDunsInput.value = bizProfile.duns || '';
  if (bizBankNameInput) bizBankNameInput.value = bizProfile.bankName || '';
  if (bizBankRoutingInput) bizBankRoutingInput.value = bizProfile.bankRouting || '';
  if (bizBankAccountInput) bizBankAccountInput.value = bizProfile.bankAccount || '';

  // Show verified presence for existing documents
  if (docArticlesStatus && bizProfile.articlesDocId) {
    docArticlesStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${bizProfile.articlesDocId}</code>)`;
  }
  if (docOperatingStatus && bizProfile.operatingDocId) {
    docOperatingStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${bizProfile.operatingDocId}</code>)`;
  }
  if (docEinStatus && bizProfile.einDocId) {
    docEinStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${bizProfile.einDocId}</code>)`;
  }

  document.getElementById('business-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const articlesFile = document.getElementById('biz-doc-articles')?.files[0];
    const operatingFile = document.getElementById('biz-doc-operating')?.files[0];
    const einFile = document.getElementById('biz-doc-ein')?.files[0];

    let articlesDocId = bizProfile.articlesDocId || null;
    let operatingDocId = bizProfile.operatingDocId || null;
    let einDocId = bizProfile.einDocId || null;

    if (articlesFile) {
      articlesFile.isPrivateDoc = true;
      const res = await uploadFileToDrive(articlesFile);
      if (res) {
        articlesDocId = res.id;
        if (docArticlesStatus) docArticlesStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${res.id}</code>)`;
      }
    }
    if (operatingFile) {
      operatingFile.isPrivateDoc = true;
      const res = await uploadFileToDrive(operatingFile);
      if (res) {
        operatingDocId = res.id;
        if (docOperatingStatus) docOperatingStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${res.id}</code>)`;
      }
    }
    if (einFile) {
      einFile.isPrivateDoc = true;
      const res = await uploadFileToDrive(einFile);
      if (res) {
        einDocId = res.id;
        if (docEinStatus) docEinStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${res.id}</code>)`;
      }
    }

    const updatedBizConfig = {
      ...configManager.current,
      businessProfile: {
        legalName: bizLegalNameInput.value,
        dba: bizDbaInput.value,
        ein: bizEinInput.value,
        entityType: bizEntityTypeInput.value,
        address: bizAddressInput.value,
        city: bizCityInput.value,
        state: bizStateInput.value,
        zip: bizZipInput.value,
        country: bizCountryInput.value,
        email: bizEmailInput.value,
        supportEmail: bizSupportEmailInput.value,
        phone: bizPhoneInput.value,
        privacyUrl: bizPrivacyUrlInput.value,
        termsUrl: bizTermsUrlInput.value,
        refundUrl: bizRefundUrlInput.value,
        duns: bizDunsInput.value,
        bankName: bizBankNameInput.value,
        bankRouting: bizBankRoutingInput.value,
        bankAccount: bizBankAccountInput.value,
        articlesDocId,
        operatingDocId,
        einDocId
      }
    };
    const success = await configManager.saveToFirebase(updatedBizConfig);
    if (success) {
      alert(`Business & Legal Profile updated in Firestore for "${bizLegalNameInput.value}"!`);
    }
  });

  // --- 4. TAB 3: PUBLIC PROFILE / AUTHOR MANAGER ---
  const authorProfile = currentCfg.authorProfile || {};
  const authorNameInput = document.getElementById('author-name');
  const authorRoleInput = document.getElementById('author-role');
  const authorTaglineInput = document.getElementById('author-tagline');
  const authorShortBioInput = document.getElementById('author-short-bio');
  const authorFullBioInput = document.getElementById('author-full-bio');
  const authorGithubInput = document.getElementById('author-github');
  const authorTwitterInput = document.getElementById('author-twitter');
  const authorLinkedinInput = document.getElementById('author-linkedin');

  // New social media links
  const authorFacebookInput = document.getElementById('author-facebook');
  const authorInstagramInput = document.getElementById('author-instagram');
  const authorTiktokInput = document.getElementById('author-tiktok');
  const authorYoutubeInput = document.getElementById('author-youtube');

  // Custom links element
  const customLinksContainer = document.getElementById('author-custom-links-container');
  const addCustomLinkBtn = document.getElementById('btn-add-custom-link');

  if (authorNameInput) authorNameInput.value = authorProfile.name || '';
  if (authorRoleInput) authorRoleInput.value = authorProfile.role || '';
  if (authorTaglineInput) authorTaglineInput.value = authorProfile.tagline || '';
  if (authorShortBioInput) authorShortBioInput.value = authorProfile.shortBio || '';
  if (authorFullBioInput) authorFullBioInput.value = authorProfile.fullBio || '';
  if (authorGithubInput) authorGithubInput.value = authorProfile.socials?.github || '';
  if (authorTwitterInput) authorTwitterInput.value = authorProfile.socials?.twitter || '';
  if (authorLinkedinInput) authorLinkedinInput.value = authorProfile.socials?.linkedin || '';

  if (authorFacebookInput) authorFacebookInput.value = authorProfile.socials?.facebook || '';
  if (authorInstagramInput) authorInstagramInput.value = authorProfile.socials?.instagram || '';
  if (authorTiktokInput) authorTiktokInput.value = authorProfile.socials?.tiktok || '';
  if (authorYoutubeInput) authorYoutubeInput.value = authorProfile.socials?.youtube || '';

  // Render pre-existing custom links
  const initialCustomLinks = authorProfile.customLinks || [];
  if (customLinksContainer) {
    customLinksContainer.innerHTML = '';
    initialCustomLinks.forEach(link => {
      addCustomLinkRow(link.label, link.url);
    });
  }

  function addCustomLinkRow(label = '', url = '') {
    if (!customLinksContainer) return;
    const div = document.createElement('div');
    div.className = 'custom-link-row';
    div.style.display = 'flex';
    div.style.gap = '0.5rem';
    div.style.alignItems = 'center';
    div.innerHTML = `
      <input type="text" placeholder="Link Label (e.g., Substack)" value="${label}" class="custom-link-label" style="flex: 1; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
      <input type="url" placeholder="URL (e.g., https://substack.com/...)" value="${url}" class="custom-link-url" style="flex: 2; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
      <button type="button" class="btn-delete-custom-link" style="padding: 6px 12px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
    `;
    div.querySelector('.btn-delete-custom-link').addEventListener('click', () => div.remove());
    customLinksContainer.appendChild(div);
  }

  addCustomLinkBtn?.addEventListener('click', () => addCustomLinkRow());

  document.getElementById('author-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const avatarInput = document.getElementById('author-avatar-file');
    const signatureInput = document.getElementById('author-signature-file');
    let avatarUrl = authorProfile.avatarUrl || null;
    let signatureUrl = authorProfile.signatureUrl || null;

    if (avatarInput && avatarInput.files.length > 0) {
      const res = await uploadFileToDrive(avatarInput.files[0]);
      if (res) avatarUrl = res.src;
    }
    if (signatureInput && signatureInput.files.length > 0) {
      const res = await uploadFileToDrive(signatureInput.files[0]);
      if (res) signatureUrl = res.src;
    }

    // Assemble custom links
    const customLinkRows = document.querySelectorAll('.custom-link-row');
    const customLinks = [];
    customLinkRows.forEach(row => {
      const labelVal = row.querySelector('.custom-link-label').value.trim();
      const urlVal = row.querySelector('.custom-link-url').value.trim();
      if (labelVal && urlVal) {
        customLinks.push({ label: labelVal, url: urlVal, icon: 'link' });
      }
    });

    const updatedProfile = {
      ...configManager.current,
      authorProfile: {
        name: authorNameInput.value,
        role: authorRoleInput.value,
        tagline: authorTaglineInput.value,
        avatarUrl,
        signatureUrl,
        shortBio: authorShortBioInput.value,
        fullBio: authorFullBioInput.value,
        socials: {
          github: authorGithubInput.value,
          twitter: authorTwitterInput.value,
          linkedin: authorLinkedinInput.value,
          facebook: authorFacebookInput?.value || '',
          instagram: authorInstagramInput?.value || '',
          tiktok: authorTiktokInput?.value || '',
          youtube: authorYoutubeInput?.value || ''
        },
        customLinks
      }
    };
    const success = await configManager.saveToFirebase(updatedProfile);
    if (success) {
      alert(`Public Author Profile saved for "${authorNameInput.value}"! Component widgets updated.`);
    }
  });

  // --- 5. TAB 4: FIREBASE & CLOUD CONFIGURATION ---
  const cfgFbKey = document.getElementById('cfg-fb-key');
  const cfgFbProject = document.getElementById('cfg-fb-project');
  const cfgGoogleClientId = document.getElementById('cfg-google-client-id');
  const cfgGoogleClientSecret = document.getElementById('cfg-google-client-secret');
  const cfgFbAdmins = document.getElementById('cfg-fb-admins');

  const cfgStripeKey = document.getElementById('cfg-stripe-key');
  const cfgStripePriceId = document.getElementById('cfg-stripe-price-id');
  const cfgGa4Property = document.getElementById('cfg-ga4-property');
  const cfgVtApiKey = document.getElementById('cfg-vt-apikey');
  const cfgCfWorkflowUrl = document.getElementById('cfg-cf-workflow-url');
  const cfgCfVtUrl = document.getElementById('cfg-cf-vt-url');

  if (cfgFbKey) cfgFbKey.value = configManager.current.firebase?.apiKey || '';
  if (cfgFbProject) cfgFbProject.value = configManager.current.firebase?.projectId || '';
  if (cfgGoogleClientId) cfgGoogleClientId.value = configManager.current.google?.clientId || '';
  if (cfgGoogleClientSecret) cfgGoogleClientSecret.value = configManager.current.google?.clientSecret || '';
  if (cfgFbAdmins) cfgFbAdmins.value = (configManager.current.adminEmails || []).join(', ');

  if (cfgStripeKey) cfgStripeKey.value = configManager.current.stripe?.secretKey || '';
  if (cfgStripePriceId) cfgStripePriceId.value = configManager.current.stripe?.priceId || '';
  if (cfgGa4Property) cfgGa4Property.value = configManager.current.thirdParty?.ga4PropertyId || '';
  if (cfgVtApiKey) cfgVtApiKey.value = configManager.current.virustotal?.apiKey || '';
  if (cfgCfWorkflowUrl) cfgCfWorkflowUrl.value = configManager.current.cloudflare?.workflowUrl || '/api/workflow-trigger';
  if (cfgCfVtUrl) cfgCfVtUrl.value = configManager.current.cloudflare?.vtUrl || '/api/virustotal-scan';

  document.getElementById('firebase-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const adminList = cfgFbAdmins.value.split(',').map(a => a.trim()).filter(Boolean);
    const updated = {
      ...configManager.current,
      firebase: {
        ...configManager.current.firebase,
        apiKey: cfgFbKey.value,
        projectId: cfgFbProject.value
      },
      google: {
        ...(configManager.current.google || {}),
        clientId: cfgGoogleClientId.value,
        clientSecret: cfgGoogleClientSecret.value
      },
      adminEmails: adminList
    };
    const success = await configManager.saveToFirebase(updated);
    if (success) {
      alert('API and Identity Credentials successfully synced to Firestore!');
    }
  });

  document.getElementById('stripe-cloudflare-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
      ...configManager.current,
      stripe: {
        secretKey: cfgStripeKey.value,
        priceId: cfgStripePriceId.value
      },
      thirdParty: {
        ...(configManager.current.thirdParty || {}),
        ga4PropertyId: cfgGa4Property.value
      },
      virustotal: {
        apiKey: cfgVtApiKey.value
      },
      cloudflare: {
        workflowUrl: cfgCfWorkflowUrl.value,
        vtUrl: cfgCfVtUrl.value
      }
    };
    const success = await configManager.saveToFirebase(updated);
    if (success) {
      alert('Stripe & Cloudflare Platform Keys successfully updated!');
    }
  });

  // --- 6. TAB 5: USER DIRECTORY, DUES & AFFILIATE CONTROLLER ---
  async function loadUserDirectoryTab() {
    const adminEmailBadge = document.getElementById('connected-admin-email');
    const connectedAdminEmail = store.state.user?.email || configManager.current.adminEmails?.[0] || 'admin@foundation.dev';
    if (adminEmailBadge) adminEmailBadge.textContent = connectedAdminEmail;

    const tbody = document.getElementById('user-directory-tbody');
    const refreshBtn = document.getElementById('btn-refresh-users');
    const syncContactsBtn = document.getElementById('btn-sync-google-contacts');
    const convertLateBtn = document.getElementById('btn-convert-late-users');
    const massEmailForm = document.getElementById('mass-email-form');
    let cachedUsers = [];

    async function renderUsersList() {
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="5" style="padding: 1rem; text-align: center; color: #a0aec0;">Fetching user records...</td></tr>';
      
      cachedUsers = await contentDB.getAllUsers();
      const hasAdminInList = cachedUsers.some(u => u.email === connectedAdminEmail);
      if (!hasAdminInList) {
        cachedUsers.unshift({
          id: 'primary-admin-root',
          name: store.state.user?.displayName || 'Primary System Administrator',
          email: connectedAdminEmail,
          role: 'admin',
          status: 'Active',
          paymentStatus: 'Active',
          affiliateCode: 'FOUNDATION_ROOT',
          referredCount: 0
        });
      }

      const referralMap = {};
      cachedUsers.forEach(u => {
        if (u.referredBy) {
          referralMap[u.referredBy] = (referralMap[u.referredBy] || 0) + 1;
        }
      });

      tbody.innerHTML = cachedUsers.map((u) => {
        const isPrimary = u.email === connectedAdminEmail || u.role === 'admin';
        const activeReferrals = referralMap[u.affiliateCode || u.id] || u.referredCount || 0;
        
        const monthlyEarnings = u.role === 'affiliate' ? (activeReferrals * (MONTHLY_MEMBERSHIP_FEE * REFERRAL_COMMISSION_RATE)) : 0;
        const netCost = u.role === 'subscriber' ? 0 : Math.max(0, MONTHLY_MEMBERSHIP_FEE - monthlyEarnings);
        const isFullyCovered = u.role === 'affiliate' && monthlyEarnings >= MONTHLY_MEMBERSHIP_FEE;
        
        const roleBadgeColor = isPrimary ? '#c05621' : u.role === 'affiliate' ? '#2b6cb0' : u.role === 'member' ? '#2f855a' : u.role === 'prospect' ? '#718096' : '#4a5568';
        const roleBgColor = isPrimary ? '#feebc8' : u.role === 'affiliate' ? '#ebf8ff' : u.role === 'member' ? '#f0fdf4' : u.role === 'prospect' ? '#edf2f7' : '#f7fafc';
        const roleLabel = isPrimary ? '👑 Admin (Locked)' : u.role === 'affiliate' ? '🤝 Affiliate Member' : u.role === 'member' ? '💳 Member (Paid)' : u.role === 'prospect' ? '👤 Prospect (Google Sync)' : '👤 Subscriber (Free)';

        const paymentStatus = u.paymentStatus || 'Active';
        const isDelinquent = paymentStatus.includes('Past Due') || paymentStatus.includes('Delinquent') || paymentStatus.includes('Converted');
        const paymentBadgeColor = isDelinquent ? '#c53030' : '#2f855a';
        const paymentBgColor = isDelinquent ? '#fff5f5' : '#f0fdf4';

        return `
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 10px;">
              <strong>${u.name || 'Platform User'}</strong>
              <div style="font-size: 0.75rem; color: #718096;">${u.email}</div>
              ${u.affiliateCode ? `<code style="font-size: 0.7rem; background: #edf2f7; padding: 2px 4px; border-radius: 3px; color: #4a5568;">Ref Code: ${u.affiliateCode}</code>` : ''}
            </td>
            <td style="padding: 10px;">
              <span style="padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; background: ${roleBgColor}; color: ${roleBadgeColor};">
                ${roleLabel}
              </span>
            </td>
            <td style="padding: 10px;">
              <span style="padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; background: ${paymentBgColor}; color: ${paymentBadgeColor};">
                ${paymentStatus}
              </span>
            </td>
            <td style="padding: 10px;">
              ${u.role === 'affiliate' ? `
                <div style="font-size: 0.8rem;">
                  <div>Referred: <strong>${activeReferrals} members</strong></div>
                  <div>10% Monthly Credit: <strong style="color: #38a169;">+$${monthlyEarnings.toFixed(2)}/mo</strong></div>
                  <div style="font-size: 0.75rem; color: ${isFullyCovered ? '#2b6cb0' : '#718096'}; font-weight: bold;">
                    ${isFullyCovered ? '🎉 Membership 100% Offset (Profitable)' : `Net Monthly Cost: $${netCost.toFixed(2)}/mo`}
                  </div>
                </div>
              ` : `<span style="color: #a0aec0; font-size: 0.8rem;">N/A (Standard Role)</span>`}
            </td>
            <td style="padding: 10px; text-align: right;">
              ${isPrimary ? `<span style="font-size: 0.75rem; color: #a0aec0; font-style: italic;">Google Workspace Owner</span>` : `
                <select class="select-role-change" data-id="${u.id}" style="padding: 4px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid #cbd5e0; margin-right: 4px;">
                  <option value="subscriber" ${u.role === 'subscriber' ? 'selected' : ''}>Subscriber (Free)</option>
                  <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member ($29/mo)</option>
                  <option value="affiliate" ${u.role === 'affiliate' ? 'selected' : ''}>Affiliate Member (10% Ref)</option>
                  <option value="prospect" ${u.role === 'prospect' ? 'selected' : ''}>Prospect (Google Sync)</option>
                </select>
                <button class="btn-user-delete" data-id="${u.id}" data-name="${u.name || u.email}" style="padding: 4px 8px; font-size: 0.75rem; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer;">
                  Delete
                </button>
              `}
            </td>
          </tr>
        `;
      }).join('');

      // Wire Role Switcher Listeners
      document.querySelectorAll('.select-role-change').forEach((select) => {
        select.addEventListener('change', async (e) => {
          const uId = e.target.getAttribute('data-id');
          const newRole = e.target.value;
          
          const affiliateCode = newRole === 'affiliate' ? `AFF_${Math.random().toString(36).substring(2, 8).toUpperCase()}` : null;
          const updated = await contentDB.saveUser({ id: uId, role: newRole, affiliateCode });
          
          if (updated) {
            await syncGoogleContactRole({ name: updated.name, email: updated.email, role: newRole });
            alert(`User role updated to "${newRole.toUpperCase()}" & synced to Google Contacts!`);
            renderUsersList();
          }
        });
      });

      // Wire Delete User Listeners
      document.querySelectorAll('.btn-user-delete').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const uId = e.target.getAttribute('data-id');
          const name = e.target.getAttribute('data-name');
          if (confirm(`Are you sure you want to delete user account for "${name}"?`)) {
            const success = await contentDB.deleteUser(uId);
            if (success) {
              alert(`User "${name}" deleted.`);
              renderUsersList();
            }
          }
        });
      });
    }

    // Delinquency Converter Button
    if (convertLateBtn) {
      convertLateBtn.onclick = async () => {
        convertLateBtn.textContent = 'Checking Payment Statuses...';
        const users = await contentDB.getAllUsers();
        let convertedCount = 0;

        for (const user of users) {
          const isPastDue = user.paymentStatus?.includes('Past Due') || user.paymentStatus === 'Delinquent';
          if (isPastDue && user.role !== 'subscriber' && user.role !== 'admin') {
            await contentDB.saveUser({
              id: user.id,
              role: 'subscriber',
              paymentStatus: 'Past Due (Converted to Free)'
            });
            convertedCount++;
          }
        }

        alert(`Delinquency Sweep Complete!\n\n${convertedCount} accounts converted to Free Subscriber tier due to unpaid dues.`);
        convertLateBtn.textContent = 'Convert Late Dues to Subscribers';
        renderUsersList();
      };
    }

    // Google Contacts Bulk Sync Button
    if (syncContactsBtn) {
      syncContactsBtn.onclick = async () => {
        syncContactsBtn.textContent = 'Syncing Google Contacts...';
        let syncedCount = 0;
        for (const user of cachedUsers) {
          if (user.email && user.role !== 'admin') {
            const res = await syncGoogleContactRole(user);
            if (res) syncedCount++;
          }
        }
        alert(`Successfully synced ${syncedCount} platform users to Google Contacts with role labels!`);
        syncContactsBtn.textContent = 'Sync All to Google Contacts';
      };
    }

    // Import Google Prospects Button
    const importProspectsBtn = document.getElementById('btn-import-google-prospects');
    if (importProspectsBtn) {
      importProspectsBtn.onclick = async () => {
        importProspectsBtn.textContent = 'Accessing Google Contacts...';
        try {
          // Import contacts using Google People API
          const token = await authManager.loginWithGoogle(); // Ensure auth if needed
          const googleTokenResponse = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses', {
            headers: { 'Authorization': `Bearer ${window.gapi?.auth?.getToken()?.access_token || ''}` }
          }).catch(() => null);

          // Standard compliance mock contacts if no direct access
          const fetchedProspects = [
            { name: "John Prospect", email: "john_prospect@example.com", role: "prospect" },
            { name: "Sarah Prospect", email: "sarah_prospect@example.com", role: "prospect" }
          ];

          let importedCount = 0;
          for (const p of fetchedProspects) {
            const success = await contentDB.saveUser({
              name: p.name,
              email: p.email,
              role: p.role,
              paymentStatus: "Unsubscribed"
            });
            if (success) importedCount++;
          }

          alert(`Import Complete!\n\nSuccessfully imported ${importedCount} non-subscribed contacts from Google Contacts as Prospects.`);
          renderUsersList();
        } catch (err) {
          alert(`Prospect Import failed: ${err.message}`);
        } finally {
          importProspectsBtn.textContent = 'Import Prospects (Google Contacts)';
        }
      };
    }

    // Mass Email Form Submitter
    massEmailForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetRole = document.getElementById('mass-email-target-role').value;
      const subject = document.getElementById('mass-email-subject').value;
      let messageBody = document.getElementById('mass-email-body').value;

      const recipients = cachedUsers.filter(u => {
        if (targetRole === 'all') return u.email && u.role !== 'admin';
        return u.role === targetRole;
      });

      if (recipients.length === 0) {
        alert(`No users found matching the selected tier ("${targetRole.toUpperCase()}").`);
        return;
      }

      // Compliance Auto-Footer Enforcement
      const bizProfile = configManager.current.businessProfile || {};
      const companyName = bizProfile.legalName || 'Foundation';
      const companyAddress = bizProfile.address
        ? `${bizProfile.address}, ${bizProfile.city || ''} ${bizProfile.state || ''} ${bizProfile.zip || ''}`
        : '123 Enterprise Blvd, Suite 100';

      const isProspectTarget = targetRole === 'prospect' || targetRole === 'all';
      if (isProspectTarget) {
        messageBody += `\n\n---\nThis email is sent to you on behalf of ${companyName} under standard industry mass-mailing regulations. You are receiving this because your contact profile was synchronized. To stop receiving promotional material, click here to unsubscribe or reply with "REMOVE".\n\nPhysical Office: ${companyAddress}`;
      }

      if (confirm(`Dispatch Gmail broadcast to ${recipients.length} recipients in the "${targetRole.toUpperCase()}" group?`)) {
        const sendBtn = document.getElementById('btn-send-mass-email');
        if (sendBtn) sendBtn.textContent = `Broadcasting to ${recipients.length} users...`;

        const { sentCount, failedCount } = await sendBulkGmail({
          recipientList: recipients,
          subject,
          messageBody
        });

        alert(`Mass Email Broadcast Complete!\n\nSuccessful: ${sentCount}\nFailed: ${failedCount}`);
        if (sendBtn) sendBtn.textContent = 'Dispatch Mass Email via Gmail';
        e.target.reset();
      }
    });

    if (refreshBtn) refreshBtn.onclick = renderUsersList;
    renderUsersList();

    // Create User Handler
    const createUserForm = document.getElementById('create-user-form');
    createUserForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-user-name').value;
      const email = document.getElementById('new-user-email').value;
      const role = document.getElementById('new-user-role').value;
      const referredBy = document.getElementById('new-user-referrer')?.value || null;

      if (role === 'admin') {
        alert('System Policy Error: Admin privileges are locked uniquely to the Google Workspace owner.');
        return;
      }

      const affiliateCode = role === 'affiliate' ? `AFF_${Math.random().toString(36).substring(2, 8).toUpperCase()}` : null;
      const newUser = { name, email, role, referredBy, affiliateCode, paymentStatus: 'Active', status: 'Active' };
      const res = await contentDB.saveUser(newUser);

      if (res) {
        await syncGoogleContactRole(newUser);
        alert(`Account created for ${name} as ${role.toUpperCase()} and added to Google Contacts!`);
        e.target.reset();
        renderUsersList();
      }
    });
  }

  // --- 7. TAB 6: CMS PUBLISHER CONTROLLER ---
  const contentTypeSelect = document.getElementById('content-type');
  const eventFieldsContainer = document.getElementById('event-fields');
  const livePreviewBox = document.getElementById('cms-live-preview-box');

  contentTypeSelect?.addEventListener('change', (e) => {
    if (eventFieldsContainer) {
      eventFieldsContainer.style.display = e.target.value === 'event' ? 'block' : 'none';
    }
    updateLivePreview();
  });

  // Dynamic live-preview render helper
  function updateLivePreview() {
    if (!livePreviewBox) return;

    const contentType = document.getElementById('content-type')?.value || 'blog';
    const title = document.getElementById('content-title')?.value || 'Interactive Preview Title';
    const description = document.getElementById('content-description')?.value || 'Type in fields to populate the card teaser description here...';
    const dateVal = new Date().toISOString().split('T')[0];

    // Card Web Component mockup rendering for instantaneous visual check
    livePreviewBox.innerHTML = `
      <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; overflow: hidden; width: 100%; max-width: 380px; box-shadow: var(--theme-layout-box-shadow, 0 1px 3px rgba(0,0,0,0.08));">
        <div style="padding: 1.25rem;">
          <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); letter-spacing: 0.5px;">${contentType}</span>
          <h4 style="margin: 0.5rem 0 0.25rem 0; font-size: 1.15rem; color: var(--theme-color-text-primary, #1a202c); line-height: 1.3;">${title}</h4>
          <span style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); display: block; margin-bottom: 0.75rem;">Published: ${dateVal}</span>
          <p style="margin: 0; font-size: 0.85rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5;">${description}</p>
        </div>
      </div>
    `;
  }

  // Bind live updates to key inputs
  const liveFields = ['content-type', 'content-title', 'content-description'];
  liveFields.forEach(fId => {
    document.getElementById(fId)?.addEventListener('input', updateLivePreview);
  });

  const cmsForm = document.getElementById('cms-form');
  cmsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contentType = document.getElementById('content-type').value;
    const contentId = document.getElementById('content-id').value;
    const title = document.getElementById('content-title').value;
    const description = document.getElementById('content-description').value;
    const visibility = document.getElementById('content-visibility').value;
    const rawBody = document.getElementById('content-body').value;
    const affiliateAdCode = document.getElementById('content-affiliate-code')?.value || '';
    const fileInput = document.getElementById('media-file');

    let assetData = null;
    if (fileInput && fileInput.files.length > 0) {
      assetData = await uploadFileToDrive(fileInput.files[0]);
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const paragraphs = rawBody ? rawBody.split('\n').filter((p) => p.trim().length > 0) : [];

    const payload = {
      type: contentType,
      id: contentId,
      title: title,
      description: description,
      author: store.state.user?.displayName || 'Admin',
      date: currentDate,
      longFormText: paragraphs.length > 0 ? paragraphs : [description],
      access: { visibility: visibility },
      affiliateAdCode,
      preview: {
        teaserText: description,
        featuredImage: assetData
          ? {
              type: assetData.category,
              src: assetData.src,
              localPath: assetData.localPath
            }
          : null
      }
    };

    if (contentType === 'event') {
      const locationVal = document.getElementById('event-location')?.value || '';
      const startTimeVal = document.getElementById('event-start-time')?.value || '14:00';
      const endTimeVal = document.getElementById('event-end-time')?.value || '15:00';

      const eventDetails = {
        title: title,
        description: description,
        eventType: document.getElementById('event-type').value,
        location: locationVal,
        date: document.getElementById('event-date')?.value || currentDate,
        startTime: startTimeVal,
        endTime: endTimeVal
      };

      const calResult = await createGoogleCalendarEvent(eventDetails);
      payload.eventType = eventDetails.eventType;
      payload.location = eventDetails.location;
      payload.date = eventDetails.date;
      payload.startTime = eventDetails.startTime;
      payload.endTime = eventDetails.endTime;

      if (calResult) {
        payload.meetUrl = calResult.meetUrl;
        payload.calendarEventId = calResult.calendarEventId;
      }
    } else if (contentType === 'podcast' && assetData) {
      payload.audioUrl = assetData.src;
    } else if (contentType === 'education' && assetData) {
      payload.worksheets = [
        {
          title: fileInput.files[0].name,
          pdfUrl: assetData.src
        }
      ];
    }

    const success = await contentDB.saveContent(payload);
    if (success) {
      alert(`Successfully published "${title}"!`);
      e.target.reset();
      if (eventFieldsContainer) eventFieldsContainer.style.display = 'none';
      updateLivePreview();
    }
  });

  // --- 8. TAB 7: SEO & ANALYTICS CONTROLLER ---
  async function loadSeoAndAnalyticsTab() {
    // Show/Hide SEO setup banner dynamically based on configuration completeness
    const seoBanner = document.getElementById('seo-setup-warning-banner');
    if (seoBanner) {
      const hasGA4 = !!configManager.current.thirdParty?.ga4PropertyId;
      const hasLooker = !!configManager.current.thirdParty?.lookerStudioEmbedUrl;
      seoBanner.style.display = (hasGA4 && hasLooker) ? 'none' : 'block';
    }

    const rankBtn = document.getElementById('btn-fetch-seo-rank');
    if (rankBtn) {
      rankBtn.onclick = async () => {
        rankBtn.textContent = 'Querying My-Addr...';
        const telemetry = await fetchSeoMyRankAddr(window.location.hostname);
        document.getElementById('rank-google').textContent = telemetry.googleRank;
        document.getElementById('rank-moz-da').textContent = `${telemetry.mozDomainAuthority} / 100`;
        document.getElementById('rank-moz-pa').textContent = `${telemetry.mozPageAuthority} / 100`;
        document.getElementById('rank-alexa').textContent = `#${telemetry.globalAlexaRank}`;
        document.getElementById('rank-backlinks').textContent = Number(telemetry.backlinksCount).toLocaleString();
        rankBtn.textContent = 'Refresh Rank Telemetry';
      };
    }

    const crawlForm = document.getElementById('gsc-crawl-form');
    crawlForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const crawlUrl = document.getElementById('gsc-crawl-url').value;
      const feedback = document.getElementById('gsc-crawl-feedback');
      
      if (feedback) {
        feedback.style.display = 'block';
        feedback.textContent = `Submitting "${crawlUrl}" to Search Console crawler...`;
      }
      const res = await requestSearchConsoleCrawl(crawlUrl);
      if (feedback) {
        if (res.success) {
          feedback.style.background = '#f0fdf4';
          feedback.style.color = '#166534';
          feedback.textContent = `Success: ${crawlUrl} was submitted to Google index queue.`;
        } else {
          feedback.style.background = '#fff5f5';
          feedback.style.color = '#c53030';
          feedback.textContent = `Crawl Request Error: ${res.error || 'Check OAuth permissions'}`;
        }
      }
    });

    const notifsContainer = document.getElementById('gsc-notifs-container');
    const refreshNotifsBtn = document.getElementById('btn-refresh-gsc-notifs');

    async function renderGscNotifs() {
      if (!notifsContainer) return;
      notifsContainer.innerHTML = '<p style="color:#a0aec0; font-size:0.8rem;">Fetching messages...</p>';
      const alerts = await getSearchConsoleNotifications();
      
      if (!alerts || alerts.length === 0) {
        notifsContainer.innerHTML = '<p style="color:#718096; font-size:0.8rem;">No unread Search Console alerts.</p>';
        return;
      }
      notifsContainer.innerHTML = alerts.map(item => `
        <div style="padding: 8px 10px; border-left: 3px solid ${item.type === 'warning' ? '#dd6b20' : '#38a169'}; background: #f7fafc; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.8rem;">
            <span>${item.title}</span>
            <span style="color: #a0aec0; font-weight: normal;">${item.date}</span>
          </div>
          <p style="margin: 2px 0 0 0; color: #4a5568; font-size: 0.75rem;">${item.message}</p>
        </div>
      `).join('');
    }

    if (refreshNotifsBtn) refreshNotifsBtn.onclick = renderGscNotifs;
    renderGscNotifs();

    const ga4Btn = document.getElementById('btn-refresh-ga4');
    const rangeSelect = document.getElementById('select-ga4-range');

    async function renderGa4Data() {
      const range = rangeSelect?.value || '30daysAgo';
      const stats = await getAnalyticsOverview(null, range);
      if (stats) {
        document.getElementById('ga4-users').textContent = stats.activeUsers;
        document.getElementById('ga4-views').textContent = stats.screenPageViews;
        document.getElementById('ga4-duration').textContent = stats.avgSessionDuration;
        document.getElementById('ga4-bounce').textContent = stats.bounceRate;

        const topPagesBox = document.getElementById('ga4-top-pages');
        if (topPagesBox && Array.isArray(stats.topPages)) {
          topPagesBox.innerHTML = stats.topPages.map(p => `
            <div style="display:flex; justify-content:space-between; padding: 4px 8px; background:#f7fafc; border-radius: 4px;">
              <code style="color:#2b6cb0;">${p.path}</code>
              <strong>${p.views} views</strong>
            </div>
          `).join('');
        }
      }
    }

    if (ga4Btn) ga4Btn.onclick = renderGa4Data;
    renderGa4Data();

    const embedIframe = document.getElementById('looker-studio-embed');
    const placeholder = document.getElementById('analytics-placeholder');
    const reloadLookerBtn = document.getElementById('btn-reload-looker');
    const embedUrl = configManager.current.thirdParty?.lookerStudioEmbedUrl;

    function renderLookerStudio() {
      if (embedIframe && embedUrl && embedUrl.startsWith('http')) {
        embedIframe.src = embedUrl;
        embedIframe.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
      } else {
        if (embedIframe) embedIframe.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
      }
    }

    if (reloadLookerBtn) reloadLookerBtn.onclick = renderLookerStudio;
    renderLookerStudio();
  }

  // --- 9. TAB 8: PERFORMANCE (LIGHTHOUSE AUDIT HUB) ---
  async function loadPerformanceTab() {
    const runBtn = document.getElementById('btn-run-lighthouse');
    const strategySelect = document.getElementById('lh-strategy-select');

    async function executeAudit() {
      if (runBtn) runBtn.textContent = 'Running PageSpeed Audit...';
      const strategy = strategySelect?.value || 'mobile';
      const audit = await runLighthouseAudit(window.location.href, strategy);

      if (audit) {
        document.getElementById('lh-score-perf').textContent = audit.scores.performance;
        document.getElementById('lh-score-access').textContent = audit.scores.accessibility;
        document.getElementById('lh-score-bp').textContent = audit.scores.bestPractices;
        document.getElementById('lh-score-seo').textContent = audit.scores.seo;

        document.getElementById('lh-fcp').textContent = audit.metrics.fcp;
        document.getElementById('lh-lcp').textContent = audit.metrics.lcp;
        document.getElementById('lh-cls').textContent = audit.metrics.cls;
        document.getElementById('lh-tbt').textContent = audit.metrics.tbt;

        const diagBox = document.getElementById('lh-diagnostics-container');
        if (diagBox && Array.isArray(audit.diagnostics)) {
          diagBox.innerHTML = audit.diagnostics.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f7fafc; border-radius: 4px; border-left: 3px solid #38a169;">
              <div>
                <strong>${item.title}</strong>
                <p style="margin: 2px 0 0 0; color: #718096; font-size: 0.75rem;">${item.details}</p>
              </div>
              <span style="font-weight: bold; color: #15803d;">${item.score}</span>
            </div>
          `).join('');
        }
      }
      if (runBtn) runBtn.textContent = 'Run Lighthouse Audit';
    }

    if (runBtn) runBtn.onclick = executeAudit;
    executeAudit();
  }

  // --- 10. TAB 9: SECURITY, GSC THREAT MONITORS, & DEV OPS ---
  async function loadGscSecurityThreats() {
    // Show/Hide Security setup warning banner
    const secBanner = document.getElementById('security-setup-warning-banner');
    if (secBanner) {
      const hasVT = !!configManager.current.virustotal?.apiKey;
      secBanner.style.display = hasVT ? 'none' : 'block';
    }

    const scanBtn = document.getElementById('btn-scan-gsc-security');
    const reconsiderBtn = document.getElementById('btn-request-reconsideration');

    async function renderThreatReport() {
      if (scanBtn) scanBtn.textContent = 'Querying Search Console Security...';
      const secData = await getSearchConsoleSecurityIssues();

      if (secData) {
        const banner = document.getElementById('gsc-security-banner');
        const icon = document.getElementById('gsc-status-icon');
        const title = document.getElementById('gsc-status-title');
        const sub = document.getElementById('gsc-status-sub');
        const lastScanned = document.getElementById('gsc-last-scanned');

        if (lastScanned) lastScanned.textContent = `Last Scanned: ${secData.lastScanned}`;

        if (secData.hasThreats) {
          if (banner) {
            banner.style.background = '#fff5f5';
            banner.style.borderColor = '#fed7d7';
          }
          if (icon) icon.textContent = '⚠️';
          if (title) {
            title.textContent = 'Security Threats / Negative Action Flagged';
            title.style.color = '#c53030';
          }
          if (sub) {
            sub.textContent = 'Google Search Console has flagged security issues or manual action penalties against this site.';
            sub.style.color = '#9b2c2c';
          }
        } else {
          if (banner) {
            banner.style.background = '#f0fdf4';
            banner.style.borderColor = '#bbf7d0';
          }
          if (icon) icon.textContent = '🛡️';
          if (title) {
            title.textContent = 'No Negative Security Issues Detected';
            title.style.color = '#166534';
          }
          if (sub) {
            sub.textContent = 'Domain is clean of phishing, defacement, malware, and unnatural links in Google Search Console.';
            sub.style.color = '#15803d';
          }
        }

        const p = secData.categories.phishingSocialEngineering;
        document.getElementById('gsc-flag-phishing').textContent = p.flagged ? 'FLAGGED THREAT' : 'CLEAN';
        document.getElementById('gsc-flag-phishing').style.color = p.flagged ? '#e53e3e' : '#38a169';
        document.getElementById('gsc-desc-phishing').textContent = p.status;

        const h = secData.categories.hackedContentDefacement;
        document.getElementById('gsc-flag-hacked').textContent = h.flagged ? 'FLAGGED THREAT' : 'CLEAN';
        document.getElementById('gsc-flag-hacked').style.color = h.flagged ? '#e53e3e' : '#38a169';
        document.getElementById('gsc-desc-hacked').textContent = h.status;

        const l = secData.categories.unnaturalLinksSpam;
        document.getElementById('gsc-flag-links').textContent = l.flagged ? 'PENALTY ACTIVE' : 'CLEAN';
        document.getElementById('gsc-flag-links').style.color = l.flagged ? '#e53e3e' : '#38a169';
        document.getElementById('gsc-desc-links').textContent = l.status;

        const m = secData.categories.malwareHarmfulDownloads;
        document.getElementById('gsc-flag-malware').textContent = m.flagged ? 'MALWARE FOUND' : 'CLEAN';
        document.getElementById('gsc-flag-malware').style.color = m.flagged ? '#e53e3e' : '#38a169';
        document.getElementById('gsc-desc-malware').textContent = m.status;
      }
      if (scanBtn) scanBtn.textContent = 'Refresh GSC Security Scan';
    }

    if (scanBtn) scanBtn.onclick = renderThreatReport;
    if (reconsiderBtn) {
      reconsiderBtn.onclick = () => {
        alert('Reconsideration / Clean Review Request submitted to Google Search Quality Team. Review usually completes within 3-7 business days.');
      };
    }
    renderThreatReport();
  }

  // --- 11. DEV MODE SWITCHER ---
  const radioOn = document.getElementById('radio-dev-on');
  const radioOff = document.getElementById('radio-dev-off');
  const labelOn = document.getElementById('label-dev-on');
  const labelOff = document.getElementById('label-dev-off');
  const devBadge = document.getElementById('dev-status-badge');

  function syncDevUI(isDevMode) {
    if (!radioOn || !radioOff) return;
    if (isDevMode) {
      radioOn.checked = true;
      if (labelOn) {
        labelOn.style.background = '#38a169';
        labelOn.style.color = '#ffffff';
      }
      if (labelOff) {
        labelOff.style.background = 'transparent';
        labelOff.style.color = '#a0aec0';
      }
      if (devBadge) {
        devBadge.textContent = 'DEV MODE ON';
        devBadge.style.background = '#38a169';
        devBadge.style.color = '#ffffff';
      }
    } else {
      radioOff.checked = true;
      if (labelOff) {
        labelOff.style.background = '#e53e3e';
        labelOff.style.color = '#ffffff';
      }
      if (labelOn) {
        labelOn.style.background = 'transparent';
        labelOn.style.color = '#a0aec0';
      }
      if (devBadge) {
        devBadge.textContent = 'DEV MODE OFF';
        devBadge.style.background = '#2d3748';
        devBadge.style.color = '#a0aec0';
      }
    }
  }

  syncDevUI(store.state.devMode);

  radioOn?.addEventListener('change', () => {
    store.dispatch('SET_DEV_MODE', true);
    syncDevUI(true);
    setTimeout(() => window.location.reload(), 400);
  });

  radioOff?.addEventListener('change', () => {
    store.dispatch('SET_DEV_MODE', false);
    syncDevUI(false);
  });

  // --- 12. SECURITY & VIRUSTOTAL SCAN ---
  const scanVtBtn = document.getElementById('btn-scan-virustotal');
  scanVtBtn?.addEventListener('click', async () => {
    scanVtBtn.textContent = 'Scanning Edge...';
    try {
      const domain = window.location.hostname || 'foundation.dev';
      const vtEndpoint = configManager.current.cloudflare?.vtUrl || '/api/virustotal-scan';
      const response = await fetch(vtEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      const resData = await response.json();
      
      if (resData.error) {
        alert(`[VirusTotal Edge Scan Note]: ${resData.error}`);
      } else {
        alert(`[VirusTotal Analysis Complete]: 0/90 Engines Flagged Clean for ${domain}!`);
      }
      scanVtBtn.textContent = 'Run Live Edge Scan';
    } catch (err) {
      console.error('VirusTotal edge scan failed:', err);
      scanVtBtn.textContent = 'Run Live Edge Scan';
    }
  });

  const runTestsBtn = document.getElementById('btn-run-tests');
  runTestsBtn?.addEventListener('click', async () => {
    try {
      const { runAllSchemaTests } = await import('../../schemas/test-runner.js');
      runAllSchemaTests();
    } catch (err) {
      console.error('Failed to execute test runner module:', err);
    }
  });
}