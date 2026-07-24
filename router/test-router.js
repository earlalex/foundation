// router/test-router.js
import { Router } from '/router/router.js';
import { authManager } from '/core/auth.js';

export async function runRouterTests() {
  console.group('🧪 Running SPA Router Test Suite...');
  let totalTests = 0;
  let passedTests = 0;

  async function assertTest(testName, testFn) {
    totalTests++;
    try {
      await testFn();
      console.log(`%c  ✅ PASS: ${testName}`, 'color: #38a169; font-weight: bold;');
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${testName}\n     Reason: ${err.message}`);
    }
  }

  const testManifest = {
    '/home': { title: 'Home', description: 'Welcome home' },
    '/about': { title: 'About Us', description: 'Our story' },
    '/admin': { title: 'Admin Dashboard', description: 'Gated admin panel' },
    '/404': { title: 'Page Not Found', description: '404 Error' }
  };

  let appContainer = document.getElementById('app');
  if (!appContainer) {
    appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);
  }

  const testRouter = new Router(testManifest);

  // --- TEST 1: Initial Manifest Parsing ---
  await assertTest('Router stores route manifest correctly', () => {
    if (!testRouter) throw new Error('Router instance failed to initialize.');
  });

  // --- TEST 2: Lifecycle Event Listener Dispatch ---
  await assertTest('Dispatches "pageLoaded" custom event on navigation', async () => {
    let receivedPath = '';

    const handlePageLoaded = (e) => {
      // Filter out initial home/boot events if any
      if (e.detail?.path === '/about') {
        receivedPath = e.detail.path;
      }
    };

    window.addEventListener('pageLoaded', handlePageLoaded);

    await testRouter.loadRoute('/about');

    window.removeEventListener('pageLoaded', handlePageLoaded);

    if (receivedPath !== '/about') {
      throw new Error(`Expected event detail path to be "/about", received "${receivedPath}"`);
    }
  });

  // --- TEST 3: Document Title & Metadata Updates ---
  await assertTest('Updates document.title based on route manifest', async () => {
    await testRouter.loadRoute('/about');
    
    // Checks if the document title starts with or contains the manifest title
    if (!document.title.includes('About Us')) {
      throw new Error(`Expected document.title to contain "About Us", received "${document.title}"`);
    }
  });

  // --- TEST 4: Admin Guard Protection (Unauthenticated) ---
  await assertTest('Blocks unauthenticated user from accessing /admin', async () => {
    // Force unauthenticated state
    const originalAdminCheck = authManager.isAdminAuthenticated;
    authManager.isAdminAuthenticated = () => false;

    await testRouter.loadRoute('/admin');

    const appHTML = appContainer.innerHTML.toLowerCase();
    
    // Check for common lock screen indicators
    const isLocked = appHTML.includes('admin') || 
                     appHTML.includes('authorization') || 
                     appHTML.includes('required') || 
                     appHTML.includes('sign in') ||
                     appHTML.includes('🔒');

    // Restore method
    authManager.isAdminAuthenticated = originalAdminCheck;

    if (!isLocked) {
      throw new Error('Unauthenticated user was allowed into /admin view!');
    }
  });

  // --- TEST 5: Fallback 404 Routing for Non-Existent Paths ---
  await assertTest('Routes unknown path to 404 handler or fallback page', async () => {
    await testRouter.loadRoute('/some-random-non-existent-page-123');
    
    const is404 = document.title.includes('Page Not Found') || 
                  document.title.includes('404') || 
                  appContainer.innerHTML.includes('404');
    
    if (!is404) {
      throw new Error('Non-existent route did not resolve to 404 handling.');
    }
  });

  // --- SUMMARY ---
  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n📊 Router Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '🎉' : '⚠️'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}