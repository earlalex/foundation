// index.js
import { errorHandler } from '/core/error-handler.js';
import { store } from '/core/store.js';
import { authManager } from '/core/auth.js';
import { Router } from '/router/router.js';

import { runAllSchemaTests } from '/schemas/test-runner.js';
import { runStoreTests } from '/core/test-store.js';
import { runRouterTests } from '/router/test-router.js';

import { initAdminPage } from '/pages/admin/admin.js';
import { initHomePage } from '/pages/home/home.js';

console.log('Foundation Core initialized.');

const routesManifest = {
  '/home': { 
    title: 'Home', 
    description: 'Welcome to Foundation - A custom zero-build web framework.', 
    viewPath: '/pages/home/home.html' 
  },
  '/admin': { 
    title: 'Admin Dashboard', 
    description: 'Manage settings and site metadata.', 
    viewPath: '/pages/admin/admin.html' 
  },
  '/404': { 
    title: 'Page Not Found', 
    description: 'The page you requested could not be found.',
    viewPath: '/pages/404.html'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (store.state.devMode) {
    console.log('[Dev Mode Active]: Running test suites...');
    window.store = store;
    runAllSchemaTests();
    runStoreTests();
    await runRouterTests();
  }

  window.router = new Router(routesManifest);
});

// Single Unified Page Lifecycle Listener
window.addEventListener('pageLoaded', (e) => {
  console.log(`[Lifecycle]: Page loaded -> ${e.detail.path}`);
  if (e.detail.path === '/home') {
    initHomePage();
  } else if (e.detail.path === '/admin') {
    initAdminPage();
  }
});