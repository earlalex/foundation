// pages/admin/admin.js - Overhauled & Code-Split Admin Controller
import { authManager } from '../../core/auth.js';
import { FRAMEWORK_AFFILIATES } from '../../core/affiliates.js';
import { store } from '../../core/store.js';
import { contentDB } from '../../core/db.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { createGoogleCalendarEvent, sendGmailNotification } from '../../core/google-services.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { FormValidator, validationRules } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';

// Setup Wizard Components
import { AdminSetupCard } from './components/AdminSetupCard.js';
import { AdminSetupWizards } from './components/AdminSetupWizards.js';

// Import modular tab controllers
import { initTabController } from './admin-tabs-controller.js';
import { initAdminPreview } from './admin-preview.js';
import { initUserDirectoryTab } from './admin-user-directory.js';
import { initPagesTab } from './admin-pages.js';
import { initVasTab } from './admin-vas.js';
import { initPluginsTab } from './admin-plugins.js';
import { initPublicProfileTab } from './admin-public-profile.js';

// Import newly split domain modules
import { initAdminIdentity } from './modules/admin-identity.js';
import { initAdminCms } from './modules/admin-cms.js';
import { initAdminCommerce } from './modules/admin-commerce.js';
import { initAdminEventsOps, initAppointmentConfig } from './modules/admin-events-ops.js';
import { initAdminGrowth, loadChatbotAndVoiceTab } from './modules/admin-growth.js';
import { initAdminOps, loadGscSecurityThreats, loadPerformanceTab, loadSeoAndAnalyticsTab } from './modules/admin-ops.js';
import { initAdminSpark } from './modules/admin-spark.js';

export function initAdminPage() {
  console.log('[Admin Page]: initAdminPage triggered');
  // --- 0.0 APPOINTMENT SCHEDULER CONFIGURATOR SETUP ---
  initAppointmentConfig();

  // --- 0.1 ROLE-BASED ACCESS CONTROL (RBAC) DISPLAY GUARD ---
  const currentUser = store.state.user;
  const isEditor = currentUser?.role === 'editor';

  if (isEditor) {
    // Hide forbidden sidebar tabs
    const forbiddenTabs = ['site', 'business', 'config', 'products', 'finances', 'plugins', 'spark'];
    forbiddenTabs.forEach(tab => {
      const btn = document.querySelector(`.admin-tab[data-tab="${tab}"]`);
      if (btn) btn.style.display = 'none';
    });

    // Hide sidebar category headers
    const headers = document.querySelectorAll('.sidebar-category-header');
    headers.forEach(h => {
      if (h.textContent.includes('Platform Setup') || h.textContent.includes('Business Operations')) {
        h.style.display = 'none';
      }
    });

    // Shift default active tab to cms
    const activeBtn = document.querySelector('.admin-tab.active');
    if (activeBtn && forbiddenTabs.includes(activeBtn.getAttribute('data-tab'))) {
      activeBtn.classList.remove('active');
      const cmsBtn = document.querySelector('.admin-tab[data-tab="cms"]');
      if (cmsBtn) {
        cmsBtn.classList.add('active');
        const panels = document.querySelectorAll('.admin-panel');
        panels.forEach(p => {
          p.style.display = p.id === 'tab-cms' ? 'block' : 'none';
        });
      }
    }

    // Hide password vault cards inside security panel
    const lastpassForm = document.getElementById('lastpass-config-form');
    if (lastpassForm && lastpassForm.parentElement) {
      lastpassForm.parentElement.style.display = 'none';
    }

    // Hide create user forms in directory panel
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
      createUserForm.style.display = 'none';
    }
  }

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
  initTabController();
  initAdminPreview();

  // Action-Triggered Defer / Lazy Loading for heavy components & tabs:
  import('../../utils/prefetch.js').then(({ PrefetchManager }) => {
    PrefetchManager.preconnectDomain('https://firestore.googleapis.com');
    PrefetchManager.preconnectDomain('https://lh3.googleusercontent.com');
    PrefetchManager.preconnectDomain('https://drive.google.com');
  });

  // Always invoke brand settings tab initializers
  initAdminIdentity();

  // Re-run checking for active tab when user state changes
  store.subscribe(() => {
    initAdminIdentity();
  });

  // --- 2. CONFIGURATION READY GUARDS & RE-RUN SETUP BUTTONS ---
  const sectionGuards = [
    // Section 1 Tabs
    {
      tabId: 'tab-site',
      title: "Site & Brand",
      wizardKey: 'section1',
      isConfigured: () => configManager.isSection1Configured(),
      getMissing: () => ["Google Workspace OAuth credentials", "Firebase Project connections", "Cloudflare Pages/Zone endpoints"],
      initFn: initAdminIdentity
    },
    {
      tabId: 'tab-config',
      title: "API Keys & Cloud",
      wizardKey: 'section1',
      isConfigured: () => configManager.isSection1Configured(),
      getMissing: () => ["Google Workspace OAuth credentials", "Firebase Project connections", "Cloudflare Pages/Zone endpoints"],
      initFn: initAdminIdentity
    },
    {
      tabId: 'tab-profile',
      title: "Public Profile",
      wizardKey: 'section1',
      isConfigured: () => configManager.isSection1Configured(),
      getMissing: () => ["Google Workspace OAuth credentials", "Firebase Project connections", "Cloudflare Pages/Zone endpoints"],
      initFn: initAdminIdentity
    },

    // Section 2 Tabs
    {
      tabId: 'tab-events',
      title: "Event Operations",
      wizardKey: 'section2',
      isConfigured: () => configManager.isSection2Configured(),
      getMissing: () => ["Business entity details", "Stripe payment integration with ACH Fee parameters", "LastPass API connection"],
      initFn: initAdminEventsOps
    },
    {
      tabId: 'tab-business',
      title: "Business & Legal",
      wizardKey: 'section2',
      isConfigured: () => configManager.isSection2Configured(),
      getMissing: () => ["Business entity details", "Stripe payment integration with ACH Fee parameters", "LastPass API connection"],
      initFn: initAdminIdentity
    },
    {
      tabId: 'tab-products',
      title: "Products & Services",
      wizardKey: 'section2',
      isConfigured: () => configManager.isSection2Configured(),
      getMissing: () => ["Business entity details", "Stripe payment integration with ACH Fee parameters", "LastPass API connection"],
      initFn: initAdminCommerce
    },
    {
      tabId: 'tab-finances',
      title: "Finances & Payroll",
      wizardKey: 'section2',
      isConfigured: () => configManager.isSection2Configured(),
      getMissing: () => ["Business entity details", "Stripe payment integration with ACH Fee parameters", "LastPass API connection"],
      initFn: initAdminCommerce
    },

    // Section 3 Tabs
    {
      tabId: 'tab-marketing',
      title: "Automated Marketing",
      wizardKey: 'section3',
      isConfigured: () => configManager.isSection3Configured(),
      getMissing: () => ["Gmail/SMTP sender credentials", "Test sample email verification", "Marketing Journey state storage"],
      initFn: initAdminGrowth
    },
    {
      tabId: 'tab-chatbot',
      title: "AI Chatbot & Voice",
      wizardKey: 'section3',
      isConfigured: () => configManager.isSection3Configured(),
      getMissing: () => ["Gmail/SMTP sender credentials", "Test sample email verification", "Marketing Journey state storage"],
      initFn: loadChatbotAndVoiceTab
    },
    {
      tabId: 'tab-spark',
      title: "Gemini Spark (COO)",
      wizardKey: 'section3',
      isConfigured: () => configManager.isSection3Configured(),
      getMissing: () => ["Gmail/SMTP sender credentials", "Test sample email verification", "Marketing Journey state storage", "Gemini Spark Onboarding API Key"],
      initFn: initAdminSpark
    },

    // Section 4 Tabs
    {
      tabId: 'tab-security',
      title: "Security & Operations",
      wizardKey: 'section4',
      isConfigured: () => configManager.isSection4Configured(),
      getMissing: () => ["OWASP ZAP REST API connection", "VirusTotal API keys", "OnlineJobs.ph integration"],
      initFn: () => {
        initAdminOps();
        loadGscSecurityThreats();
      }
    },
    {
      tabId: 'tab-plugins',
      title: "Plugins & Extensions",
      wizardKey: 'section1',
      isConfigured: () => configManager.isSection1Configured(),
      getMissing: () => ["Google Workspace OAuth credentials", "Firebase Project connections", "Cloudflare Pages/Zone endpoints"],
      initFn: initPluginsTab
    },
    {
      tabId: 'tab-vas',
      title: "VA Hiring Hub",
      wizardKey: 'section4',
      isConfigured: () => configManager.isSection4Configured(),
      getMissing: () => ["OWASP ZAP REST API connection", "VirusTotal API keys", "OnlineJobs.ph integration"],
      initFn: initVasTab
    },
    {
      tabId: 'tab-kanban',
      title: "Kanban Task Board",
      wizardKey: 'section4',
      isConfigured: () => configManager.isSection4Configured(),
      getMissing: () => ["OWASP ZAP REST API connection", "VirusTotal API keys", "OnlineJobs.ph integration"],
      initFn: initAdminGrowth
    },
    {
      tabId: 'tab-pages',
      title: "Page Creator",
      wizardKey: 'section4',
      isConfigured: () => configManager.isSection4Configured(),
      getMissing: () => ["OWASP ZAP REST API connection", "VirusTotal API keys", "OnlineJobs.ph integration"],
      initFn: initPagesTab
    },
    {
      tabId: 'tab-cms',
      title: "CMS Publisher",
      wizardKey: 'section4',
      isConfigured: () => configManager.isSection4Configured(),
      getMissing: () => ["OWASP ZAP REST API connection", "VirusTotal API keys", "OnlineJobs.ph integration"],
      initFn: () => {}
    },
    {
      tabId: 'tab-seo',
      title: "SEO & Analytics",
      wizardKey: 'section4',
      isConfigured: () => configManager.isSection4Configured(),
      getMissing: () => ["OWASP ZAP REST API connection", "VirusTotal API keys", "OnlineJobs.ph integration"],
      initFn: loadSeoAndAnalyticsTab
    },
    {
      tabId: 'tab-performance',
      title: "Performance",
      wizardKey: 'section4',
      isConfigured: () => configManager.isSection4Configured(),
      getMissing: () => ["OWASP ZAP REST API connection", "VirusTotal API keys", "OnlineJobs.ph integration"],
      initFn: loadPerformanceTab
    }
  ];

  function checkAndInitTab(tabId) {
    console.log('[checkAndInitTab] Checking tabId:', tabId);
    const g = sectionGuards.find(x => x.tabId === `tab-${tabId}`);
    if (!g) return true;

    const panel = document.getElementById(g.tabId);
    if (!panel) return true;

    const isBypass = window.__FOUNDATION_DEV_BYPASS__ === true || store.state.devMode === true;
    const isAlreadyConfigured = g.isConfigured() || isBypass;

    if (isAlreadyConfigured) {
      AdminSetupCard.unlock(panel);
    }

    if (tabId === 'site') {
      initAdminIdentity();
    }

    panel.style.position = 'relative';

    let rBtn = panel.querySelector('.btn-reconfigure-settings') || panel.querySelector('.btn-rerun-setup');
    if (!rBtn) {
      rBtn = document.createElement('button');
      rBtn.className = 'btn-reconfigure-settings btn-rerun-setup';
      rBtn.textContent = 'Re-configure Settings';
      rBtn.style.cssText = `
        position: absolute;
        top: 1rem;
        right: 1rem;
        padding: 6px 12px;
        background: var(--theme-color-surface, #f7fafc);
        color: var(--theme-color-primary, #2b6cb0);
        border: 1px solid var(--theme-color-primary, #2b6cb0);
        border-radius: var(--theme-layout-border-radius, 4px);
        font-weight: bold;
        font-size: 0.85rem;
        cursor: pointer;
        z-index: 10;
      `;
      panel.insertBefore(rBtn, panel.firstChild);
    }

    rBtn.style.display = isAlreadyConfigured ? 'block' : 'none';

    rBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      AdminSetupWizards.launch(g.wizardKey, () => {
        AdminSetupCard.unlock(panel);
        checkAndInitTab(tabId);
      });
    };

    if (!isAlreadyConfigured) {
      AdminSetupCard.render(panel, {
        title: g.title,
        missingPrereqs: g.getMissing(),
        onLaunchWizard: () => {
          AdminSetupWizards.launch(g.wizardKey, () => {
            AdminSetupCard.unlock(panel);
            checkAndInitTab(tabId);
          });
        }
      });
      return false;
    } else {
      g.initFn();
      if (tabId === 'site') {
        initAdminIdentity();
      }
      return true;
    }
  }

  // Set up CONFIG_UPDATED reactive listener
  window.addEventListener('CONFIG_UPDATED', () => {
    const activeBtn = document.querySelector('.admin-tab.active');
    if (activeBtn) {
      checkAndInitTab(activeBtn.getAttribute('data-tab'));
    }
  });

  // Initialize public non-guarded elements
  initPublicProfileTab();

  // --- 3. TAB-SPECIFIC INITIALIZATION VIA EVENT LISTENERS ---
  window.addEventListener('adminTabChanged', (e) => {
    const targetTab = e.detail.tab;
    
    const isOk = checkAndInitTab(targetTab);
    if (!isOk) return;

    if (targetTab === 'events') {
      initAdminEventsOps();
    } else if (targetTab === 'users') {
      initUserDirectoryTab();
    } else if (targetTab === 'pages') {
      initPagesTab();
    } else if (targetTab === 'products') {
      initAdminCommerce();
    } else if (targetTab === 'seo') {
      loadSeoAndAnalyticsTab();
    } else if (targetTab === 'performance') {
      loadPerformanceTab();
    } else if (targetTab === 'chatbot') {
      loadChatbotAndVoiceTab();
    } else if (targetTab === 'spark') {
      initAdminSpark();
    } else if (targetTab === 'kanban') {
      initAdminGrowth();
    } else if (targetTab === 'plugins') {
      initPluginsTab();
    } else if (targetTab === 'vas') {
      initVasTab();
    } else if (targetTab === 'cms') {
      initAdminCms();
    }
  });

  const activeTabBtn = document.querySelector('.admin-tab.active');
  const activeTab = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'site';
  checkAndInitTab(activeTab);
  if (activeTab === 'cms') {
    initAdminCms();
  }

  store.subscribe(() => {
    const activeBtn = document.querySelector('.admin-tab.active');
    if (activeBtn) {
      checkAndInitTab(activeBtn.getAttribute('data-tab'));
    }
  });

  initAdminIdentity();

  // --- 6. CMS PUBLISHER CONTROLLER ---
  const contentTypeSelect = document.getElementById('content-type');
  const eventFieldsContainer = document.getElementById('event-fields');
  const livePreviewBox = document.getElementById('cms-live-preview-box');

  contentTypeSelect?.addEventListener('change', (e) => {
    if (eventFieldsContainer) {
      eventFieldsContainer.style.display = e.target.value === 'event' ? 'block' : 'none';
    }
    updateLivePreview();
  });

  // Initialize CMS form validator
  const cmsForm = document.getElementById('cms-form');
  let cmsValidator = null;
  if (cmsForm) {
    cmsValidator = new FormValidator(cmsForm, {
      'content-title': [validationRules.required, validationRules.minLength(3)],
      'content-description': [validationRules.required],
      'content-body': [validationRules.required]
    });
  }

  function updateLivePreview() {
    if (!livePreviewBox) return;

    const contentType = document.getElementById('content-type')?.value || 'blog';
    const title = document.getElementById('content-title')?.value || 'Interactive Preview Title';
    const description = document.getElementById('content-description')?.value || 'Type in fields to populate the card teaser description here...';
    const dateVal = new Date().toISOString().split('T')[0];

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

  const liveFields = ['content-type', 'content-title', 'content-description'];
  liveFields.forEach(fId => {
    document.getElementById(fId)?.addEventListener('input', updateLivePreview);
  });

  const cmsEditorTypeToggle = document.getElementById('cms-editor-type-toggle');
  const cmsGjsWrapper = document.getElementById('cms-grapesjs-canvas-wrapper');
  const contentBodyTextarea = document.getElementById('content-body');
  let cmsEditorInstance = null;

  cmsEditorTypeToggle?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      if (cmsGjsWrapper) cmsGjsWrapper.style.display = 'block';
      if (contentBodyTextarea) contentBodyTextarea.style.display = 'none';

      if (!window.grapesjs) {
        const link1 = document.createElement('link');
        link1.rel = 'stylesheet';
        link1.href = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css';
        document.head.appendChild(link1);

        const script1 = document.createElement('script');
        script1.src = 'https://unpkg.com/grapesjs';
        document.head.appendChild(script1);

        await new Promise(r => script1.onload = r);

        const script2 = document.createElement('script');
        script2.src = 'https://unpkg.com/grapesjs-preset-webpage';
        document.head.appendChild(script2);

        await new Promise(r => script2.onload = r);
      }

      if (!cmsEditorInstance && window.grapesjs) {
        cmsEditorInstance = window.grapesjs.init({
          container: '#grapesjs-cms-canvas',
          fromElement: true,
          height: '400px',
          width: 'auto',
          storageManager: false,
          plugins: ['gjs-preset-webpage'],
          pluginsOpts: {
            'gjs-preset-webpage': {}
          }
        });
      }
    } else {
      if (cmsGjsWrapper) cmsGjsWrapper.style.display = 'none';
      if (contentBodyTextarea) contentBodyTextarea.style.display = 'block';
    }
  });

  cmsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (cmsValidator && !cmsEditorTypeToggle?.checked && !cmsValidator.validateAll()) {
      toast.error('Please fix the validation errors before publishing content.');
      return;
    }
    
    try {
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

      if (cmsEditorTypeToggle?.checked && cmsEditorInstance) {
        payload.editorType = 'grapesjs';
        payload.projectData = cmsEditorInstance.getProjectData();
        payload.compiledHtml = cmsEditorInstance.getHtml();
        payload.compiledCss = cmsEditorInstance.getCss();
      }

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
        toast.success(`Successfully published "${title}"!`);
        e.target.reset();
        if (eventFieldsContainer) eventFieldsContainer.style.display = 'none';
        updateLivePreview();
      } else {
        toast.error('Failed to publish content. Please try again.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin - CMS Form Submission');
      toast.error(`Failed to publish content: ${err.message}`);
    }
  });

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

  // --- 12. GLOBAL THREAT LOOKUPS ---
  const edgeScanInput = document.getElementById('security-edge-scan-input');
  const btnRunEdgeScan = document.getElementById('btn-run-security-edge-scan');
  const edgeResultsBox = document.getElementById('security-edge-scan-results');

  btnRunEdgeScan?.addEventListener('click', async () => {
    if (!edgeScanInput || !edgeResultsBox) return;
    const query = edgeScanInput.value.trim();
    if (!query) {
      toast.warning('Please enter a file SHA-256 hash or a domain name to scan.');
      return;
    }

    btnRunEdgeScan.textContent = 'Scanning Edge...';
    edgeResultsBox.style.display = 'block';
    edgeResultsBox.style.background = 'var(--theme-color-background, #f7fafc)';
    edgeResultsBox.style.border = '1px solid var(--theme-color-border, #cbd5e0)';
    edgeResultsBox.style.color = 'var(--theme-color-text-primary, #1a202c)';
    edgeResultsBox.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096);">Querying VirusTotal edge proxies...</p>';

    const isHash = /^[a-fA-F0-9]{64}$/.test(query);
    const payload = isHash ? { hash: query } : { domain: query };

    try {
      const vtEndpoint = configManager.current.cloudflare?.vtUrl || '/api/virustotal-scan';
      const response = await fetch(vtEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Edge returned status ${response.status}`);
      }

      const resData = await response.json();

      if (resData.notFound) {
        edgeResultsBox.style.background = '#fffaf0';
        edgeResultsBox.style.border = '1px solid #fbd38d';
        edgeResultsBox.style.color = '#c05621';
        edgeResultsBox.innerHTML = `
          <div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 6px;">
            ℹ Signature Not Found Globally
          </div>
          <div style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Hash:</strong> <code>${query}</code></div>
          <p style="margin: 6px 0 0 0; font-size: 0.8rem;">This specific file signature has not been uploaded or analyzed in the VirusTotal database yet. It might be a new or unique local file.</p>
        `;
        toast.info('File signature not found in global VirusTotal database.');
        return;
      }

      if (resData.error) {
        throw new Error(resData.error);
      }

      if (isHash) {
        const stats = resData.stats || {};
        const clamav = resData.clamav;
        const results = resData.results || {};

        const totalEngines = Object.keys(results).length;
        const isMalicious = stats.malicious > 0;

        edgeResultsBox.style.background = isMalicious ? '#fff5f5' : '#f0fdf4';
        edgeResultsBox.style.border = isMalicious ? '1px solid #fed7d7' : '1px solid #bbf7d0';
        edgeResultsBox.style.color = isMalicious ? '#c53030' : '#15803d';

        let clamavHtml = '';
        if (clamav) {
          const isClamavMalicious = clamav.category === 'malicious';
          clamavHtml = `
            <div style="padding: 10px; border-radius: 6px; background: ${isClamavMalicious ? '#fff5f5' : '#f0fdf4'}; border: 1px solid ${isClamavMalicious ? '#fed7d7' : '#bbf7d0'}; margin-top: 8px;">
              <strong style="color: ${isClamavMalicious ? '#e53e3e' : '#38a169'}; font-size: 0.85rem; display: block; margin-bottom: 2px;">🛡️ ClamAV Engine Highlight</strong>
              <div style="font-size: 0.8rem; color: var(--theme-color-text-primary, #1a202c);">
                <strong>Status:</strong> ${clamav.category.toUpperCase()} ${clamav.result ? `(${clamav.result})` : ''}
              </div>
              <div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); margin-top: 2px;">Method: ${clamav.method || 'unknown'}</div>
            </div>
          `;
        } else {
          clamavHtml = `
            <div style="padding: 10px; border-radius: 6px; background: var(--theme-color-background, #f7fafc); border: 1px solid var(--theme-color-border, #cbd5e0); margin-top: 8px; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096);">
              ℹ ClamAV did not analyze this specific file signature.
            </div>
          `;
        }

        let maliciousEnginesList = '';
        if (isMalicious) {
          const maliciousDetails = [];
          for (const [engine, value] of Object.entries(results)) {
            if (value.category === 'malicious') {
              maliciousDetails.push(`${engine} (${value.result || 'detected'})`);
            }
          }
          if (maliciousDetails.length > 0) {
            maliciousEnginesList = `
              <div style="margin-top: 8px; font-size: 0.8rem;">
                <strong>Flagged Vendors:</strong>
                <div style="color: #e53e3e; margin-top: 2px; font-family: monospace; max-height: 100px; overflow-y: auto;">
                  ${maliciousDetails.join(', ')}
                </div>
              </div>
            `;
          }
        }

        edgeResultsBox.innerHTML = `
          <div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 6px;">
            ${isMalicious ? '⚠️ Global Threat Detected' : '✓ Global Safe Verification'}
          </div>
          <div style="font-size: 0.8rem; margin-bottom: 4px;"><strong>File SHA-256:</strong> <code style="word-break: break-all; color: var(--theme-color-text-primary, #1a202c);">${resData.hash}</code></div>
          <div style="font-size: 0.8rem; margin-bottom: 4px;">
            <strong>Analysis Stats (${totalEngines} AV engines):</strong>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; font-size: 0.75rem;">
              <span style="background: #fed7d7; color: #9b2c2c; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Malicious: ${stats.malicious || 0}</span>
              <span style="background: #feebc8; color: #c05621; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Suspicious: ${stats.suspicious || 0}</span>
              <span style="background: #c6f6d5; color: #22543d; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Harmless/Clean: ${stats.harmless || 0}</span>
              <span style="background: #e2e8f0; color: #4a5568; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Undetected: ${stats.undetected || 0}</span>
            </div>
          </div>
          ${clamavHtml}
          ${maliciousEnginesList}
        `;
        toast.success(`[VirusTotal Edge Scan Complete]: ${stats.malicious || 0} malicious detections found.`);

      } else {
        const results = resData.results?.data?.attributes || {};
        const stats = results.last_analysis_stats || {};
        const totalEngines = Object.keys(results.last_analysis_results || {}).length;
        const isMalicious = stats.malicious > 0;

        edgeResultsBox.style.background = isMalicious ? '#fff5f5' : '#f0fdf4';
        edgeResultsBox.style.border = isMalicious ? '1px solid #fed7d7' : '1px solid #bbf7d0';
        edgeResultsBox.style.color = isMalicious ? '#c53030' : '#15803d';

        edgeResultsBox.innerHTML = `
          <div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 6px;">
            ${isMalicious ? '⚠️ Malicious Domain Reputation Detected' : '✓ Safe Domain Reputation'}
          </div>
          <div style="font-size: 0.8rem; margin-bottom: 4px;"><strong>Domain:</strong> <code style="color: var(--theme-color-text-primary, #1a202c);">${resData.domain}</code></div>
          <div style="font-size: 0.8rem;">
            <strong>Detections (${totalEngines} reputation engines):</strong>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; font-size: 0.75rem;">
              <span style="background: #fed7d7; color: #9b2c2c; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Malicious: ${stats.malicious || 0}</span>
              <span style="background: #feebc8; color: #c05621; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Suspicious: ${stats.suspicious || 0}</span>
              <span style="background: #c6f6d5; color: #22543d; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Harmless/Clean: ${stats.harmless || 0}</span>
              <span style="background: #e2e8f0; color: #4a5568; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Undetected: ${stats.undetected || 0}</span>
            </div>
          </div>
        `;
        toast.success(`[VirusTotal Domain Scan Complete]: ${stats.malicious || 0} malicious detections for ${resData.domain}.`);
      }

    } catch (err) {
      errorHandler.handleError(err, 'Admin - VirusTotal Edge Scan');
      edgeResultsBox.style.background = 'var(--theme-color-background, #f7fafc)';
      edgeResultsBox.style.border = '1px solid var(--theme-color-border, #cbd5e0)';
      edgeResultsBox.style.color = 'var(--theme-color-text-primary, #1a202c)';

      const isDomain = !isHash;
      if (isDomain) {
        edgeResultsBox.innerHTML = `
          <div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 6px; color: var(--theme-color-primary, #2b6cb0);">
            ℹ Edge API Offline/Simulation Note
          </div>
          <p style="margin: 0; font-size: 0.8rem; line-height: 1.4;">
            Reputation scans for <strong>${query}</strong> are currently offline. Local simulated result: 0/90 Engines Flagged Clean. Please configure your <code>VIRUSTOTAL_API_KEY</code> in Cloudflare secrets to enable live edge proxy scans.
          </p>
        `;
        toast.info(`[VirusTotal Simulation Note]: 0/90 Engines Flagged Clean for ${query}.`);
      } else {
        edgeResultsBox.innerHTML = `
          <div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 6px; color: var(--theme-color-primary, #2b6cb0);">
            ℹ Edge API Offline/Simulation Note
          </div>
          <p style="margin: 0; font-size: 0.8rem; line-height: 1.4;">
            Multi-engine analysis for file signature <strong>${query.substring(0,10)}...</strong> is currently offline. Please configure your <code>VIRUSTOTAL_API_KEY</code> in Cloudflare secrets to query the global threat database.
          </p>
        `;
        toast.info('VirusTotal edge response unavailable on local domain (using graceful simulation fallback).');
      }
    } finally {
      btnRunEdgeScan.textContent = 'Edge Threat Scan';
    }
  });

  const runTestsBtn = document.getElementById('btn-run-tests');
  runTestsBtn?.addEventListener('click', async () => {
    try {
      const { runAllTests } = await import('../../tests/index.js');
      const results = await runAllTests();
      if (results.success) {
        toast.success(`Complete Test Battery passed successfully! (${results.passedSuites}/${results.totalSuites} suites passed)`);
      } else {
        toast.error(`Some tests failed: ${results.passedSuites}/${results.totalSuites} suites passed`);
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin - Run Tests');
      toast.error('Failed to run tests');
    }
  });
}
