// index.js
import { errorHandler } from './core/error-handler.js';
import { store } from './core/store.js';
import { authManager } from './core/auth.js';
import { Router } from './router/router.js';
import { themeEngine } from './core/theme.js';
import { logger } from './core/logger.js';
import { configManager } from './core/config.js';
import { initNavbar } from './core/navbar.js';

// Web Components
import './components/global/ContentCard.js';
import './components/global/AuthorCard.js';
import './components/global/ChatWidget.js';
import './components/global/HeroBanner.js';
import './components/global/FeatureGrid.js';
import './components/global/PricingTable.js';
import './components/global/TestimonialSlider.js';
import './components/global/CtaBlock.js';
import './components/global/AppointmentPicker.js';
import './components/global/AppNavbar.js';
import './components/global/AppFooter.js';
import './components/global/TooltipElement.js';
import './components/global/BentoGrid.js';
import './components/global/PriceCard.js';

// Automated Test Suites
import { runSchemaTests, runStoreTests, runRouterTests, runServicesTests } from './tests/index.js';
import { toast } from './utils/toast.js';

// Page Controllers (Lazily Loaded in Route Splitting / pageLoaded events)
import { initHomePage } from './pages/home/home.js';

logger.info('Foundation Core initializing...');

/**
 * Emergency Console Bypass for Local Development
 * Usage in Browser Console: foundationDevBypass()
 */
window.foundationDevBypass = function() {
  window.__FOUNDATION_DEV_BYPASS__ = true;
  window.store = store;
  store.dispatch('SET_USER', {
    uid: 'admin_bypass',
    email: 'admin@example.com',
    displayName: 'Bypass Admin',
    isAdmin: true,
    role: 'admin'
  });
  store.dispatch('SET_DEV_MODE', true);
  console.log('%c[Security Bypass Granted]: Emergency Console Dev Bypass Active.', 'color: #38a169; font-weight: bold;');
  window.router?.navigateTo('/admin');
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
    badge.innerHTML = `
      <span class="badge-short-text">[ Simulation Mode ]</span>
      <span class="badge-full-text">
        <span>SIMULATION MODE: Viewing site as [ <strong>${roleCapitalized}</strong> ]</span>
        <button id="btn-return-admin-sim" style="background: #ffffff; color: #e53e3e; border: none; padding: 4px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.8rem; margin-left: 5px; transition: background 0.2s;">
          Return to Admin Command Center
        </button>
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
  } else {
    if (badge) {
      badge.remove();
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
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
    '/about': {
      title: 'About Me',
      description: 'Learn more about the creator and platform architect.',
      viewPath: './pages/about/about.html'
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
  if (!isInstalled && !window.__FOUNDATION_DEV_BYPASS__) {
    logger.warn('[Core]: Platform unconfigured. Intercepting route to render Setup Wizard.');
    window.router.renderSetupWizard();
  } else {
    await window.router.init();
  }

  // Mount Chat Widget globally if enabled and available
  const chatbotEnabled = configManager.current.chatbot?.enabled !== false;
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
});

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
  const isConfigured = configManager.current.isInstalled && (configManager.current.adminEmails?.length > 0);
  if (!isConfigured && !window.__FOUNDATION_DEV_BYPASS__) return;

  if (e.detail.path === '/home') {
    initHomePage();
  } else if (e.detail.path === '/about') {
    import('./pages/about/about.js').then(m => m.initAboutPage());
  } else if (e.detail.path === '/events') {
    import('./pages/events/events.js').then(m => m.initEventsPage());
  } else if (e.detail.path === '/contact') {
    import('./pages/contact/contact.js').then(m => m.initContactPage());
  } else if (e.detail.path === '/detail') {
    import('./pages/detail/detail.js').then(m => m.initDetailPage());
  } else if (e.detail.path === '/admin') {
    import('./pages/admin/admin.js').then(m => m.initAdminPage());
  } else if (e.detail.path === '/account') {
    import('./pages/account.js').then(m => m.initAccountPage());
  }
});