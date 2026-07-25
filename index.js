// index.js
import { errorHandler } from './core/error-handler.js';
import { store } from './core/store.js';
import { authManager } from './core/auth.js';
import { Router } from './router/router.js';
import { themeEngine } from './core/theme.js';
import { logger } from './core/logger.js';

// Web Components
import './components/global/ContentCard.js';
import './components/global/AuthorCard.js';

// Automated Test Suites
import { runAllSchemaTests } from './schemas/test-runner.js';
import { runStoreTests } from './core/test-store.js';
import { runRouterTests } from './router/test-router.js';
import { runServicesTests } from './core/test-services.js';

// Page Controllers
import { initAdminPage } from './pages/admin/admin.js';
import { initHomePage } from './pages/home/home.js';

logger.info('Foundation Core initialized in native ES module mode.');

const routesManifest = {
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
};

document.addEventListener('DOMContentLoaded', async () => {
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
  
  window.router = new Router(routesManifest);
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