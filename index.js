// index.js

// 1. Core Framework Imports
import { errorHandler } from '/core/error-handler.js';
import { store } from '/core/store.js';
import { authManager } from '/core/auth.js';
import { Router } from '/router/router.js';

// 2. Automated Test Suite Imports
import { runAllSchemaTests } from '/schemas/test-runner.js';
import { runStoreTests } from '/core/test-store.js';
import { runRouterTests } from '/router/test-router.js';

// 3. Page Controller Imports
import { initAdminPage } from '/pages/admin/admin.js';
import { initHomePage } from '/pages/home/home.js';

console.log('🚀 Foundation Core initialized.');

// 4. SEO Route Metadata Manifest
const routesManifest = {
  '/home': { 
    title: 'Home', 
    description: 'Welcome to Foundation — A custom zero-build web framework.',
    viewPath: '/pages/home/home.html'
  },
  '/admin': { 
    title: 'Admin Dashboard', 
    description: 'Manage settings and site metadata.',
    viewPath: '/pages/admin/admin.html'
  },
  '/404': { 
    title: 'Page Not Found', 
    description: 'The page you requested could not be found.' 
  }
};

// 5. Master Application Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Check store state for Dev Mode
  if (store.state.devMode) {
    console.log('🛠️ [Dev Mode Active]: Exposing debugging tools & running test suites...');
    
    // Expose globals for console debugging
    window.store = store;

    // Run automated unit test suites
    runAllSchemaTests();
    runStoreTests();
    await runRouterTests();
  }

  // Initialize live SPA Router
  window.router = new Router(routesManifest);
});

// 6. View Lifecycle Listener
window.addEventListener('pageLoaded', (e) => {
  console.log(`[Lifecycle]: Page loaded -> ${e.detail.path}`);

  // Bind controller logic when navigating to /admin
  if (e.detail.path === '/admin') {
    initAdminPage();
  }
});

// 7. View Lifecycle Listener for Home Page
window.addEventListener('pageLoaded', (e) => {
  console.log(`[Lifecycle]: Page loaded -> ${e.detail.path}`);

  if (e.detail.path === '/home') {
    initHomePage(); // 👈 Trigger home page rendering
  } else if (e.detail.path === '/admin') {
    initAdminPage();
  }
});