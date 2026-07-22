// index.js
import { Router } from '/router/router.js';

// Optional: Metadata helper mapping for key routes
const routesManifest = {
  '/home': { title: 'Welcome Home' },
  '/admin': { title: 'Admin Control Center' },
  '/404': { title: 'Page Not Found' }
};

document.addEventListener('DOMContentLoaded', () => {
  window.router = new Router(routesManifest);
});

// Listen for view-specific initialization logic
window.addEventListener('pageLoaded', (e) => {
  console.log(`Successfully navigated to: ${e.detail.path}`);
  // Here we can run view-specific component mounting!
});