import { errorHandler } from '/core/error-handler.js';
import { validateSchema, Type } from '/core/validator.js';
console.log('Foundation system guard initialized.');

import { Router } from '/router/router.js';

// Route metadata manifest for quick SEO overrides
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

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Router
  window.router = new Router(routesManifest);
});

// View Lifecycle Listener
window.addEventListener('pageLoaded', (e) => {
  console.log(`[Lifecycle]: Page loaded -> ${e.detail.path}`);
});


import { runAllSchemaTests } from '/schemas/test-runner.js';

document.addEventListener('DOMContentLoaded', () => {
  // Run test suite
  runAllSchemaTests();
});

/* Error Handling Test
import { errorHandler } from '/core/error-handler.js';
import { validateSchema, Type } from '/core/validator.js';

console.log('🚀 Foundation Core initialized.');

// 1. Define a strict test schema
const BlogPostSchema = {
  title: Type.string,
  views: Type.number,
  published: Type.boolean
};

// --- TEST 1: Valid Data (Should pass silently) ---
try {
  const validData = { title: 'My First Post', views: 100, published: true };
  validateSchema(BlogPostSchema, validData);
  console.log('✅ Test 1 Passed: Valid schema approved.');
} catch (err) {
  console.error('❌ Test 1 Failed:', err);
}

// --- TEST 2: Schema Validation Error (Should trigger warning toast) ---
setTimeout(() => {
  console.log('🧪 Running Test 2: Invalid Schema...');
  const invalidData = { title: 'My First Post', views: 'one hundred', published: true };
  
  // This will throw a ValidationError, caught automatically by errorHandler
  validateSchema(BlogPostSchema, invalidData);
}, 1500);

// --- TEST 3: Async / Network Error (Should trigger error toast) ---
setTimeout(() => {
  console.log('🧪 Running Test 3: Unhandled Promise Rejection...');
  // Simulating a failed API request
  Promise.reject(new Error('Failed to fetch user settings from server.'));
}, 3500);
*/