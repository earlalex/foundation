// tests/router.test.js - Expanded SPA Router & RBAC Security Matrix Tests
import { Router } from '../router/router.js';
import { authManager } from '../core/auth.js';
import { store } from '../core/store.js';
import { configManager } from '../core/config.js';

export async function runRouterTests() {
  console.group('  Running Overhauled SPA Router Test Suite...');
  let totalTests = 0;
  let passedTests = 0;

  async function assertTest(testName, testFn) {
    totalTests++;
    try {
      await testFn();
      console.log(`%c    PASS: ${testName}`, 'color: #38a169; font-weight: bold;');
      passedTests++;
    } catch (err) {
      console.error(`    FAIL: ${testName}\n     Reason: ${err.message}`);
    }
  }

  // Define full Route Manifest matching our core pages
  const testManifest = {
    '/home': { title: 'Home', description: 'Welcome to Foundation - A custom zero-build web framework.', viewPath: './pages/home/home.html' },
    '/about': { title: 'About Me', description: 'Learn more about the creator.', viewPath: './pages/about/about.html' },
    '/events': { title: 'Events & Live Meets', description: 'Upcoming webinars and interactive video sessions.', viewPath: './pages/events/events.html' },
    '/contact': { title: 'Contact & Appointments', description: 'Schedule a consultation.', viewPath: './pages/contact/contact.html' },
    '/education': { title: 'Education', description: 'Master sovereign engineering.', viewPath: './pages/education/education.html' },
    '/podcast': { title: 'Podcast', description: 'Listen to technical deep-dives.', viewPath: './pages/podcast/podcast.html' },
    '/shop': { title: 'Artisanal Shop', description: 'Curated artisanal wellness products.', viewPath: './pages/shop/shop.html' },
    '/account': { title: 'Customer Dashboard', description: 'Manage premium publications.', viewPath: './pages/account.html' },
    '/admin': { title: 'Admin Dashboard', description: 'Manage settings and site metadata.', viewPath: './pages/admin/admin.html' },
    '/tag': { title: 'Tag Archive', description: 'Browse tagged content archive.', viewPath: './pages/tag/tag.html' },
    '/login': { title: 'Sign In / Register', description: 'Log in portal.', viewPath: './pages/login.html' },
    '/404': { title: 'Page Not Found', description: 'The page you requested could not be found.', viewPath: './pages/404.html' }
  };

  // Ensure DOM container is mounted
  let appContainer = document.getElementById('app');
  if (!appContainer) {
    appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);
  }

  // Preserve initial states
  const originalFetch = window.fetch;
  const originalBypass = window.__FOUNDATION_DEV_BYPASS__;
  const originalDevMode = store.state.devMode;
  const originalUser = store.state.user;
  const originalSimUser = store.state.simulatedUserTier;
  const originalConfig = { ...configManager.current };

  // Setup mock configuration state
  configManager.current = {
    ...configManager.current,
    isInstalled: true,
    adminEmails: ['admin@earlalex.com'],
    siteTitle: 'Test Foundation Site',
    siteDomain: 'https://test.foundation.dev'
  };

  // Mock fetch to resolve templates cleanly without hitting real endpoints
  window.fetch = async (url) => {
    return {
      ok: true,
      text: async () => `<div id="mock-view-root">Mock Content for ${url}</div>`
    };
  };

  // Instantiate clean test Router
  const testRouter = new Router(testManifest, true);

  // Core Integrity Checks across ALL listed routes
  const routesToVerify = [
    '/home',
    '/events',
    '/education',
    '/podcast',
    '/shop',
    '/about',
    '/contact',
    '/account',
    '/admin',
    '/tag/sustainability' // tests dynamic tagging matching /tag
  ];

  for (const r of routesToVerify) {
    await assertTest(`Route Integrity: Navigation to "${r}" resolves smoothly without throwing`, async () => {
      // Set to Dev Mode/Bypass so access gate checks pass unconditionally
      window.__FOUNDATION_DEV_BYPASS__ = true;
      store.dispatch('SET_DEV_MODE', true);

      await testRouter.loadRoute(r);
      const html = appContainer.innerHTML;
      if (!html || html.includes('404 - Page Not Found')) {
        throw new Error(`Route "${r}" loaded as 404 or empty view.`);
      }
    });

    await assertTest(`Route Integrity: "${r}" updates document.title and canonical tags correctly`, async () => {
      await testRouter.loadRoute(r);

      const expectedTitleKeyword = r.startsWith('/tag/') ? 'Tag' : testManifest[r]?.title || 'Home';
      if (!document.title.includes('Test Foundation Site')) {
        throw new Error(`document.title is missing the site domain name. Got: "${document.title}"`);
      }

      const canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl || !canonicalEl.href.includes('https://test.foundation.dev')) {
        throw new Error(`Canonical meta link tag is missing or misconfigured for: ${r}`);
      }
    });
  }

  // --- RBAC Matrix Access Guards Testing ---

  // Clean up flags first
  window.__FOUNDATION_DEV_BYPASS__ = false;
  store.dispatch('SET_DEV_MODE', false);

  await assertTest('RBAC Matrix: Prospect (Anonymous Guest) is blocked from /admin and redirected to /login', async () => {
    store.dispatch('LOGOUT');
    store.dispatch('SET_SIMULATED_USER_TIER', 'prospect');

    await testRouter.loadRoute('/admin');

    // Check if view has login-like elements or is locked
    const isRedirectedToLogin = document.title.includes('Sign In') || appContainer.innerHTML.includes('Sign In');
    const isLockedScreen = appContainer.innerHTML.includes('Access Restricted') || appContainer.innerHTML.includes('admin-lock-signin-btn');

    if (!isRedirectedToLogin && !isLockedScreen) {
      throw new Error('Prospect was allowed to view /admin route without authentication.');
    }
  });

  await assertTest('RBAC Matrix: Prospect (Anonymous Guest) is blocked from /account and redirected to /login', async () => {
    store.dispatch('LOGOUT');
    store.dispatch('SET_SIMULATED_USER_TIER', 'prospect');

    await testRouter.loadRoute('/account');
    const isRedirectedToLogin = document.title.includes('Sign In') || appContainer.innerHTML.includes('Sign In');
    if (!isRedirectedToLogin) {
      throw new Error('Prospect was allowed to view /account route without authentication.');
    }
  });

  await assertTest('RBAC Matrix: Subscriber is allowed into /account but blocked from /admin', async () => {
    store.dispatch('SET_USER', { uid: 'sub_user_1', email: 'sub@example.com', isAdmin: false, role: 'subscriber' });
    store.dispatch('SET_SIMULATED_USER_TIER', 'subscriber');

    // /account check
    await testRouter.loadRoute('/account');
    if (document.title.includes('Sign In')) {
      throw new Error('Subscriber was locked out of /account dashboard.');
    }

    // /admin check
    await testRouter.loadRoute('/admin');
    const isLockedOrRedirected = appContainer.innerHTML.includes('Access Restricted') || document.title.includes('Home') || document.title.includes('Customer Dashboard') || appContainer.innerHTML.includes('account');
    if (!isLockedOrRedirected) {
      throw new Error('Subscriber was allowed to enter /admin dashboard.');
    }
  });

  await assertTest('RBAC Matrix: Member is allowed into /account but blocked from /admin', async () => {
    store.dispatch('SET_USER', { uid: 'mem_user_1', email: 'member@example.com', isAdmin: false, role: 'member' });
    store.dispatch('SET_SIMULATED_USER_TIER', 'member');

    // /account check
    await testRouter.loadRoute('/account');
    if (document.title.includes('Sign In')) {
      throw new Error('Member was locked out of /account.');
    }

    // /admin check
    await testRouter.loadRoute('/admin');
    const isLockedOrRedirected = appContainer.innerHTML.includes('Access Restricted') || document.title.includes('Home') || document.title.includes('Customer Dashboard') || appContainer.innerHTML.includes('account');
    if (!isLockedOrRedirected) {
      throw new Error('Member was allowed to enter /admin.');
    }
  });

  await assertTest('RBAC Matrix: Admin possesses full access to both /account and /admin', async () => {
    store.dispatch('SET_USER', { uid: 'admin_user_1', email: 'admin@earlalex.com', isAdmin: true, role: 'admin' });
    store.dispatch('SET_SIMULATED_USER_TIER', 'admin');

    // Check account
    await testRouter.loadRoute('/account');
    if (document.title.includes('Sign In')) {
      throw new Error('Admin was locked out of /account.');
    }

    // Check admin
    await testRouter.loadRoute('/admin');
    const isLocked = appContainer.innerHTML.includes('Access Restricted');
    if (isLocked) {
      throw new Error('Primary Admin was locked out of /admin dashboard.');
    }
  });

  // Restore states cleanly
  window.fetch = originalFetch;
  window.__FOUNDATION_DEV_BYPASS__ = originalBypass;
  store.dispatch('SET_DEV_MODE', originalDevMode);
  store.dispatch('SET_USER', originalUser);
  store.dispatch('SET_SIMULATED_USER_TIER', originalSimUser);
  configManager.current = originalConfig;

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Router Overhaul Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more over-hauled Router tests failed.');
  }
}
