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

// Automated Test Suites
import { runAllSchemaTests, runStoreTests, runRouterTests, runServicesTests } from './tests/index.js';

// Page Controllers
import { initAdminPage } from './pages/admin/admin.js';
import { initHomePage } from './pages/home/home.js';

logger.info('Foundation Core initializing...');

/**
 * Emergency Console Bypass for Local Development
 * Usage in Browser Console: foundationDevBypass()
 */
window.foundationDevBypass = function() {
  window.__FOUNDATION_DEV_BYPASS__ = true;
  store.dispatch('SET_DEV_MODE', true);
  console.log('%c[Security Bypass Granted]: Emergency Console Dev Bypass Active.', 'color: #38a169; font-weight: bold;');
  window.router?.loadRoute('/admin');
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Master Configuration (reads LocalStorage / Firestore)
  const isInstalled = await configManager.init();

  // 2. Boot Test Suites in Dev Mode
  if (store.state.devMode) {
    logger.group('Dev Mode Test Suite Execution');
    window.store = store;
    window.logger = logger;
    
    runAllSchemaTests();
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
    '/404': {
      title: 'Page Not Found',
      description: 'The page you requested could not be found.',
      viewPath: './pages/404.html'
    }
  });

  // 4. Initialize Top Global Navbar Header
  initNavbar();

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
});

// Single Unified Page Lifecycle Listener
window.addEventListener('pageLoaded', (e) => {
  logger.log(`Page lifecycle transition -> ${e.detail.path}`);
  
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
    initAdminPage();
  }
});