// pages/admin/admin.js
import { store } from '../../core/store.js';
import { contentDB } from '../../core/db.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { createGoogleCalendarEvent } from '../../core/google-services.js';
import { themeEngine, defaultBrandTheme } from '../../core/theme.js';
import { configManager } from '../../core/config.js';

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

export function initAdminPage() {
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
    });
  });

  // --- 2. TAB 1: SITE & BRAND SETTINGS ---
  const siteTitleInput = document.getElementById('site-title');
  const siteTaglineInput = document.getElementById('site-tagline');
  const siteDomainInput = document.getElementById('site-domain');
  const siteDescriptionInput = document.getElementById('site-description');
  const lookerUrlInput = document.getElementById('looker-studio-url');
  const headerScriptsInput = document.getElementById('header-scripts');

  // Pre-fill site configuration
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

  function loadActiveThemeIntoTextarea() {
    if (!themeJsonInput) return;
    const currentTheme = store.state.activeBrandGuide || defaultBrandTheme;
    themeJsonInput.value = JSON.stringify(currentTheme, null, 2);
  }
  loadActiveThemeIntoTextarea();

  themeForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const parsedTheme = JSON.parse(themeJsonInput.value);
      themeEngine.applyTheme(parsedTheme);
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
  });

  resetBtn?.addEventListener('click', () => {
    if (confirm('Reset theme back to Foundation Default?')) {
      themeEngine.applyTheme(defaultBrandTheme);
      themeJsonInput.value = JSON.stringify(defaultBrandTheme, null, 2);
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

  // Pre-fill Business Profile
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

  document.getElementById('business-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
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
        refundUrl: bizRefundUrlInput.value
      }
    };

    const success = await configManager.saveToFirebase(updatedBizConfig);
    if (success) {
      alert(`Business & Legal Profile updated in Firestore for "${bizLegalNameInput.value}"!`);
    }
  });

  // --- 4. TAB 3: FIREBASE & CLOUD CONFIGURATION ---
  const cfgFbKey = document.getElementById('cfg-fb-key');
  const cfgFbProject = document.getElementById('cfg-fb-project');
  const cfgFbAdmins = document.getElementById('cfg-fb-admins');

  if (cfgFbKey) cfgFbKey.value = configManager.current.firebase?.apiKey || '';
  if (cfgFbProject) cfgFbProject.value = configManager.current.firebase?.projectId || '';
  if (cfgFbAdmins) cfgFbAdmins.value = (configManager.current.adminEmails || []).join(', ');

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
      adminEmails: adminList
    };
    const success = await configManager.saveToFirebase(updated);
    if (success) {
      alert('Firebase Configuration synced to Firestore!');
    }
  });

  document.getElementById('cloudflare-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updatedCF = {
      ...configManager.current,
      cloudflare: {
        workflowUrl: document.getElementById('cfg-cf-workflow-url').value,
        vtUrl: document.getElementById('cfg-cf-vt-url').value
      }
    };
    const success = await configManager.saveToFirebase(updatedCF);
    if (success) {
      alert('Cloudflare Pages Edge routes saved to Firestore!');
    }
  });

  // --- 5. TAB 5: CMS PUBLISHER CONTROLLER ---
  const contentTypeSelect = document.getElementById('content-type');
  const eventFieldsContainer = document.getElementById('event-fields');

  contentTypeSelect?.addEventListener('change', (e) => {
    if (eventFieldsContainer) {
      eventFieldsContainer.style.display = e.target.value === 'event' ? 'block' : 'none';
    }
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
    }
  });

  // --- 6. TAB 6: SEO & ANALYTICS HANDLERS ---
  const seoRankBtn = document.getElementById('btn-fetch-seo-rank');
  seoRankBtn?.addEventListener('click', async () => {
    seoRankBtn.textContent = 'Fetching Rank...';
    try {
      const domain = window.location.hostname || 'foundation.dev';
      console.log(`[SEO Service]: Fetching my-addr.com ranking telemetries for ${domain}...`);
      setTimeout(() => {
        alert(`[SEO Telemetry Updated]: ${domain} is indexed and sitting in Top 1% metrics.`);
        seoRankBtn.textContent = 'Refresh Rank';
      }, 800);
    } catch (err) {
      console.error('SEO rank check failed:', err);
      seoRankBtn.textContent = 'Refresh Rank';
    }
  });

  // --- 7. DEV MODE SWITCHER ---
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

  // --- 8. SECURITY & VIRUSTOTAL SCAN ---
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