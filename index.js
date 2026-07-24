// index.js

// 1. Core Framework Imports (Imported ONLY ONCE at the top)
import { errorHandler } from '/core/error-handler.js';
import { store } from '/core/store.js';
import { authManager } from '/core/auth.js';
import { Router } from '/router/router.js';
import { runRouterTests } from '/router/test-router.js';

// 2. Automated Test Suite Imports
import { runAllSchemaTests } from '/schemas/test-runner.js';
import { runStoreTests } from '/core/test-store.js';

console.log('🚀 Foundation Core initialized.');

// Expose globals to window for dev console testing
window.store = store;

// 3. SEO Route Metadata Manifest
const routesManifest = {
  '/home': { 
    title: 'Home', 
    description: 'Welcome to Foundation — A custom zero-build web framework.' 
  },
  '/admin': { 
    title: 'Admin Dashboard', 
    description: 'Manage settings and site metadata.' 
  },
  '/404': { 
    title: 'Page Not Found', 
    description: 'The page you requested could not be found.' 
  }
};

// 4. Single Master Application Initialization (Marked ASYNC here)
document.addEventListener('DOMContentLoaded', async () => {
  // A. Run test suites automatically
  runAllSchemaTests();
  runStoreTests();
  await runRouterTests();

  // B. Initialize live SPA Router for actual user navigation
  window.router = new Router(routesManifest);
});

// 5. View Lifecycle Event Listener
window.addEventListener('pageLoaded', (e) => {
  console.log(`[Lifecycle]: Page loaded -> ${e.detail.path}`);
});