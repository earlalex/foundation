// index.js
import { errorHandler } from './core/error-handler.js';
import { store } from './core/store.js';
import { authManager } from './core/auth.js';
import { Router } from './router/router.js';
import { themeEngine } from './core/theme.js';
import { logger } from './core/logger.js';
import { configManager } from './core/config.js';

// Web Components
import './components/global/ContentCard.js';
import './components/global/AuthorCard.js';

// Automated Test Suites
import { runAllSchemaTests } from './schemas/test-runner.js';
import { runStoreTests } from './core/test-store.js';
import { runRouterTests } from './router/test-router.js';
import { runServicesTests } from './core/test-services.js';

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
  // 1. Initialize Firestore Master Configuration
  await configManager.init();

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
  
  // 3. Mount Router
  window.router = new Router({
    '/home': {
      title: 'Home',
      description: 'Welcome to Foundation - A custom zero-build web framework.',
      viewPath: './pages/home/home.html'
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
});

// Single Unified Page Lifecycle Listener
window.addEventListener('pageLoaded', (e) => {
  logger.log(`Page lifecycle transition -> ${e.detail.path}`);
  if (e.detail.path === '/home') {
    initHomePage();
  } else if (e.detail.path === '/admin') {
    initAdminPage();
  }
});