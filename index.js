// index.js
import { errorHandler } from './core/error-handler.js';
import { store } from './core/store.js';
import { authManager } from './core/auth.js';
import { Router } from './router/router.js';
import { themeEngine } from './core/theme.js';
import { logger } from './core/logger.js';
import { configManager } from './core/config.js';
import { initNavbar } from './core/navbar.js';

// Critical Web Components
import './components/global/ContentCard.js';
import './components/global/AuthorCard.js';
import './components/global/HeroBanner.js';
import './components/global/FeatureGrid.js';
import './components/global/PricingTable.js';
import './components/global/CtaBlock.js';
import './components/global/AppNavbar.js';
import './components/global/AppFooter.js';
import './components/global/TooltipElement.js';
import './components/global/BentoGrid.js';
import './components/global/PriceCard.js';
import './components/global/GoogleReviews.js';
import './components/global/AdSenseUnit.js';
import './components/global/CryptoCheckout.js';

// Automated Test Suites
import { runSchemaTests, runStoreTests, runRouterTests, runServicesTests } from './tests/index.js';
import { toast } from './utils/toast.js';

// Critical Web Components
import './components/global/PhotoGallery.js';
import './components/global/VideoLibrary.js';
import './components/global/RadioStreamPlayer.js';

// Page Controllers (Lazily Loaded in Route Splitting / pageLoaded events)
import { initHomePage } from './pages/home/home.js';

// Catch and suppress non-critical browser extension message channel errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('message channel closed before a response was received')) {
    event.preventDefault(); // Suppress noisy extension channel error
  }
});

logger.info('Foundation Core initializing...');

/**
 * Emergency Console Bypass for Local Development
 * Usage in Browser Console: foundationDevBypass()
 */
window.foundationDevBypass = function() {
  window.__FOUNDATION_DEV_BYPASS__ = true;
  window.__FOUNDATION_FREEZE_TEST_STATE__ = true;
  window.store = store;
  store.dispatch('SET_USER', {
    uid: 'admin_bypass',
    email: 'admin@earlalex.com',
    displayName: 'Bypass Admin',
    isAdmin: true,
    role: 'admin'
  });
  store.dispatch('SET_DEV_MODE', true);
  console.log('%c[Security Bypass Granted]: Emergency Console Dev Bypass Active. Verbosity logging enabled. Test state frozen.', 'color: #38a169; font-weight: bold;');
  window.router?.navigateTo('/admin');
};

/**
 * Headless Playwright / CLI programmatic test execution trigger
 * Usage in headless scripts: await window.runFoundationTests()
 */
window.runFoundationTests = async function() {
  console.log('[Automation API]: Programmatic test suite trigger invoked.');
  try {
    const mod = await import('./tests/index.js');
    const results = await mod.runAllTests();
    return results;
  } catch (err) {
    console.error('[Automation API]: Headless test runner failure:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Helper to update simulation badge visibility based on route and admin state
 */
function updateSimulationBadgeVisibility(state) {
  let badge = document.getElementById('simulation-active-badge');
  const currentPath = window.location.pathname;
  const isAdmin = state.user?.isAdmin || window.__FOUNDATION_DEV_BYPASS__;
  const isAdminRoute = currentPath.endsWith('/admin') || currentPath.includes('/admin');

  // Strict check: Only show if simulation is active AND user is admin AND on the /admin route
  if (state.simulatedUserTier && isAdmin && isAdminRoute) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'simulation-active-badge';
      document.body.appendChild(badge);
    }
    const roleCapitalized = state.simulatedUserTier.charAt(0).toUpperCase() + state.simulatedUserTier.slice(1);
    const activeTheme = state.theme || 'dark';

    // Read pending tasks
    let pendingCount = 0;
    try {
      const pendingTasks = JSON.parse(localStorage.getItem('foundation_pending_tasks') || '[]');
      pendingCount = Array.isArray(pendingTasks) ? pendingTasks.length : 0;
    } catch (e) {}

    badge.innerHTML = `
      <span class="badge-short-text">[ Simulation Mode ]</span>
      <span class="badge-full-text" style="display: flex; flex-direction: column; gap: 4px; padding: 6px; font-size: 0.8rem; text-align: left; line-height: 1.4;">
        <div>SIMULATION MODE: Viewing site as [ <strong>${roleCapitalized}</strong> ]</div>
        <div>Active Theme: [ <strong>${activeTheme.toUpperCase()}</strong> ] | Task Queue: [ <strong>${pendingCount} Pending</strong> ]</div>
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <button id="btn-return-admin-sim" style="background: #ffffff; color: #3182ce; border: none; padding: 4px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem; transition: background 0.2s;">
            Return to Admin
          </button>
          <button id="btn-reset-test-state" style="background: #e53e3e; color: #ffffff; border: none; padding: 4px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.75rem; transition: background 0.2s;">
            Reset Test State
          </button>
        </div>
      </span>
    `;

    const btn = badge.querySelector('#btn-return-admin-sim');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        store.dispatch('SET_SIMULATED_USER_TIER', null);
        window.router.navigateTo('/admin');
      });
    }

    const btnReset = badge.querySelector('#btn-reset-test-state');
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Clean up mock/simulated states completely
        store.dispatch('SET_SIMULATED_USER_TIER', null);
        store.dispatch('LOGOUT');

        try {
          localStorage.removeItem('foundation_pending_tasks');
          localStorage.removeItem('foundation_low_stock_alerts');
          localStorage.removeItem('foundation_spark_tasks');
          sessionStorage.clear();
        } catch (err) {}

        console.log('[Dev Mode Badge]: Simulated session data flushed cleanly.');
        window.location.reload();
      });
    }
  } else {
    if (badge) {
      badge.remove();
    }
  }
}

async function boot() {
  console.log('[DEBUG INDEX.JS]: Booting Foundation Core...');
  // Lazy-load Non-critical Web Components (Directive 5)
  try {
    import('./components/global/AppointmentPicker.js');
    import('./components/global/TestimonialSlider.js');
    import('./components/global/ChatWidget.js');
  } catch (err) {
    console.warn('[Lazy Load Components]: Failed to defer non-critical components.', err);
  }

  // Initialize Active Plugins & Hooks
  try {
    const { pluginManager } = await import('./core/plugins.js');
    pluginManager.initializeActivePlugins();

    const { doAction } = await import('./core/hooks.js');
    await doAction('foundation_init');
  } catch (err) {
    console.error('[Foundation Init Hooks]: Active plugins initialization failed.', err);
  }

  // 1. Initialize Master Configuration (reads LocalStorage / Firestore)
  const isInstalled = await configManager.init();

  // 2. Boot Test Suites in Dev Mode
  if (store.state.devMode) {
    logger.group('Dev Mode Test Suite Execution');
    window.store = store;
    window.logger = logger;
    
    runSchemaTests();
    runStoreTests();
    await runRouterTests();
    await runServicesTests();
    
    logger.groupEnd();
  }

  // 3. Mount Router Instance
  window.router = new Router({
    '/home': {
      title: 'Home',
      description: 'Welcome to Foundation - A custom zero-build web framework.',
      viewPath: './pages/home/home.html'
    },
    '/docs': {
      template: './pages/docs/docs.html',
      controller: './pages/docs/docs.js',
      title: 'Platform Documentation & Setup Guide | Foundation',
      viewPath: './pages/docs/docs.html'
    },
    '/about': {
      title: 'About Me',
      description: 'Learn more about the creator and platform architect.',
      viewPath: './pages/about/about.html'
    },
    '/gallery': {
      title: 'Photo Gallery',
      description: 'Instagram-Style Photo Showcase & Blueprints Portfolio.',
      viewPath: './pages/gallery/gallery.html'
    },
    '/videos': {
      title: 'Video Streaming Library',
      description: 'YouTube/Twitch-Style Video Streaming Portal & Masterminds.',
      viewPath: './pages/videos/videos.html'
    },
    '/events': {
      title: 'Events & Live Meets',
      description: 'Upcoming webinars and interactive video sessions.',
      viewPath: './pages/events/events.html'
    },
    '/contact': {
      title: 'Contact & Appointments',
      description: 'Schedule a consultation or send an inquiry.',
      viewPath: './pages/contact/contact.html'
    },
    '/detail': {
      title: 'Publication Detail',
      description: 'Read full articles, publications, and event details.',
      viewPath: './pages/detail/detail.html'
    },
    '/admin': {
      title: 'Admin Dashboard',
      description: 'Manage settings and site metadata.',
      viewPath: './pages/admin/admin.html'
    },
    '/login': {
      title: 'Sign In / Register',
      description: 'Log in to your Foundation account portal.',
      viewPath: './pages/login.html'
    },
    '/account': {
      title: 'Customer Dashboard',
      description: 'Manage your unlocked premium publications and subscription billing.',
      viewPath: './pages/account.html'
    },
    '/education': {
      title: 'Education',
      description: 'Master sovereign engineering, zero-build pipelines, and automation.',
      viewPath: './pages/education/education.html'
    },
    '/podcast': {
      title: 'Podcast',
      description: 'Listen to technical deep-dives on zero-build and edge deployment.',
      viewPath: './pages/podcast/podcast.html'
    },
    '/shop': {
      title: 'Artisanal Shop',
      description: 'Curated artisanal wellness products and merchandise.',
      viewPath: './pages/shop/shop.html'
    },
    '/tag': {
      title: 'Tag Archive',
      description: 'Browse tagged content archive.',
      viewPath: './pages/tag/tag.html'
    },
    '/privacy': {
      title: 'Privacy Policy | Foundation',
      description: 'Platform Privacy Policy and Data Safeguards.',
      viewPath: './pages/legal/privacy.html'
    },
    '/terms': {
      title: 'Terms of Service | Foundation',
      description: 'Platform Terms of Service and Usage Agreement.',
      viewPath: './pages/legal/terms.html'
    },
    '/cookies': {
      title: 'Cookie Settings & Preferences | Foundation',
      description: 'Manage cookie preferences and tracking consent.',
      viewPath: './pages/legal/cookies.html'
    },
    '/404': {
      title: 'Page Not Found',
      description: 'The page you requested could not be found.',
      viewPath: './pages/404.html'
    }
  });

  // 4. Initialize Top Global Navbar Header
  initNavbar();

  // Initialize Translation Engine
  try {
    const { i18n } = await import('./core/i18n.js');
    i18n.translatePage();
  } catch (err) {
    console.warn('[Translation Engine]: Failed to trigger on boot:', err);
  }

  // Initialize Global Website Footer Features
  initGlobalFooter();

  // Active Simulation Mode Observer - Restricted to Admin Route & Admin Users Only
  store.subscribe((state) => {
    updateSimulationBadgeVisibility(state);
  });

  // 5. Hard Guard: If uninstalled, render Setup Wizard. Otherwise, initialize route cleanly.
  if (!configManager.current.isInstalled && !window.__FOUNDATION_DEV_BYPASS__) {
    logger.warn('[Core]: Platform unconfigured. Intercepting route to render Setup Wizard.');
    window.router.renderSetupWizard();
  } else {
    await window.router.init();
  }

  // Mount Chat Widget globally if enabled and available
  const chatbotEnabled = configManager.current.chatbot?.enabled !== false && configManager.current.features?.chatWidget !== false;
  if (chatbotEnabled) {
    const chatWidget = document.createElement('chat-widget');
    document.body.appendChild(chatWidget);
  }

  // Global Footer Newsletter Form Logic
  const footerConsent = document.getElementById('footer-newsletter-consent');
  const footerSubmit = document.getElementById('btn-footer-newsletter-submit');
  const footerForm = document.getElementById('footer-newsletter-form');

  if (footerConsent && footerSubmit) {
    footerConsent.addEventListener('change', (e) => {
      footerSubmit.disabled = !e.target.checked;
      if (e.target.checked) {
        footerSubmit.style.cursor = 'pointer';
        footerSubmit.style.opacity = '1';
      } else {
        footerSubmit.style.cursor = 'not-allowed';
        footerSubmit.style.opacity = '0.5';
      }
    });
  }

  footerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('footer-newsletter-email');
    if (!emailInput) return;

    const email = emailInput.value.trim();
    if (!email) return;

    try {
      const { toast } = await import('./utils/toast.js');
      toast.success(`Successfully subscribed ${email} to our newsletter!`);
      footerForm.reset();
      if (footerSubmit) {
        footerSubmit.disabled = true;
        footerSubmit.style.cursor = 'not-allowed';
        footerSubmit.style.opacity = '0.5';
      }
    } catch (err) {
      console.error('[Footer Newsletter]: Subscription error', err);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

async function initGlobalFooter() {
  const footerContainer = document.getElementById('global-footer');
  if (!footerContainer) return;
  footerContainer.innerHTML = '<app-footer></app-footer>';
}

// Single Unified Page Lifecycle Listener
window.addEventListener('pageLoaded', (e) => {
  logger.log(`Page lifecycle transition -> ${e.detail.path}`);

  // Re-evaluate simulation badge visibility on path transition
  updateSimulationBadgeVisibility(store.state);

  // Re-translate page items dynamically on transition
  setTimeout(async () => {
    try {
      const { i18n } = await import('./core/i18n.js');
      i18n.translatePage();
    } catch (err) {}
  }, 100);

  // Guard: Skip page controllers if platform is unconfigured / running setup wizard
  const isConfigured = configManager.current.isInstalled === true;
  if (!isConfigured && !window.__FOUNDATION_DEV_BYPASS__) return;

  if (e.detail.path === '/home') {
    initHomePage();
  } else if (e.detail.path === '/docs') {
    import('./pages/docs/docs.js').then(m => m.initDocsPage());
  } else if (e.detail.path === '/about') {
    import('./pages/about/about.js').then(m => m.initAboutPage());
  } else if (e.detail.path === '/gallery') {
    import('./pages/gallery/gallery.js').then(m => m.initGalleryPage());
  } else if (e.detail.path === '/events') {
    import('./pages/events/events.js').then(m => m.initEventsPage());
  } else if (e.detail.path === '/contact') {
    import('./pages/contact/contact.js').then(m => m.initContactPage());
  } else if (e.detail.path === '/education') {
    import('./pages/education/education.js').then(m => m.initEducationPage());
  } else if (e.detail.path === '/podcast') {
    import('./pages/podcast/podcast.js').then(m => m.initPodcastPage());
  } else if (e.detail.path === '/shop') {
    import('./pages/shop/shop.js').then(m => m.initShopPage());
  } else if (e.detail.path === '/tag' || e.detail.path.startsWith('/tag/')) {
    import('./pages/tag/tag.js').then(m => m.initTagPage());
  } else if (e.detail.path === '/detail') {
    import('./pages/detail/detail.js').then(m => m.initDetailPage());
  } else if (e.detail.path === '/admin') {
    import('./pages/admin/admin.js').then(m => m.initAdminPage());
  } else if (e.detail.path === '/account') {
    import('./pages/account.js').then(m => m.initAccountPage());
  } else if (e.detail.path === '/login') {
    import('./pages/login.js').then(m => m.initLoginPage());
  } else if (e.detail.path === '/videos') {
    import('./pages/videos/videos.js').then(m => m.initVideosPage());
  } else if (e.detail.path === '/docs') {
    import('./pages/docs/docs.js').then(m => m.initDocsPage());
  } else if (e.detail.path === '/privacy' || e.detail.path === '/terms' || e.detail.path === '/cookies') {
    import('./pages/legal/legal.js').then(m => m.initLegalPage(e.detail.path));
  }
});
