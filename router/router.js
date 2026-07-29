// router/router.js
import { validateSchema, Type } from '../core/validator.js';
import { authManager } from '../core/auth.js';
import { store } from '../core/store.js';
import { configManager } from '../core/config.js';

const RouteMetaSchema = {
  title: Type.string,
  description: Type.optional(Type.string),
  viewPath: Type.optional(Type.string)
};

export class Router {
  #isLoading = false;

  constructor(routesManifest = {}, isTestInstance = false) {
    this.appContainer = document.getElementById('app');
    this.routesManifest = routesManifest;
    this.isTestInstance = isTestInstance;

    // Calculate the repository or base path prefix of the SPA
    let path = window.location.pathname;
    if (path.endsWith('/index.html')) {
      path = path.replace(/\/index\.html$/, '');
    }

    // Normalize trailing slash for route matching
    let cleanPath = path;
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    // Find if the path ends with any of our defined routes in routesManifest
    let matchedRoute = '';
    for (const route of Object.keys(this.routesManifest)) {
      if (route !== '/' && (cleanPath === route || cleanPath.endsWith(route))) {
        matchedRoute = route;
        break;
      }
    }

    let base = '/';
    if (matchedRoute) {
      // Strip matchedRoute from the end of cleanPath to find the subdirectory/basePath prefix
      const index = cleanPath.lastIndexOf(matchedRoute);
      base = cleanPath.slice(0, index);
    } else {
      base = cleanPath;
    }

    // Ensure basePath ends with a single slash and is correctly formatted
    if (!base.endsWith('/')) {
      base = base + '/';
    }
    if (!base.startsWith('/')) {
      base = '/' + base;
    }
    this.basePath = base;
    
    this.validateManifest();
    this.bindClickEvents();
  }

  validateManifest() {
    for (const [path, meta] of Object.entries(this.routesManifest)) {
      try {
        validateSchema(RouteMetaSchema, meta, `routesManifest['${path}']`);
      } catch (err) {
        throw err;
      }
    }
  }

  bindClickEvents() {
    document.body.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (
        anchor && 
        anchor.origin === window.location.origin && 
        !anchor.hasAttribute('data-native') &&
        anchor.getAttribute('target') !== '_blank'
      ) {
        e.preventDefault();
        this.navigateTo(anchor.pathname + anchor.search);
      }
    });

    window.addEventListener('popstate', () => {
      this.loadRoute(window.location.pathname + window.location.search);
    });
  }

  async init() {
    const storedRoute = sessionStorage.getItem('foundation_spa_route');
    if (storedRoute) {
      sessionStorage.removeItem('foundation_spa_route');
      let repoPrefix = window.location.pathname;
      if (repoPrefix.endsWith('/index.html')) {
        repoPrefix = repoPrefix.replace(/\/index\.html$/, '');
      }
      repoPrefix = repoPrefix.replace(/\/$/, '');

      const fullUrl = repoPrefix + storedRoute;
      window.history.replaceState({}, '', fullUrl);
      await this.loadRoute(storedRoute);
    } else {
      let currentPath = window.location.pathname + window.location.search;
      // Normalize trailing slash and index.html in the current browser URL
      let urlObj = new URL(currentPath, window.location.origin);
      let pathname = urlObj.pathname || '/';
      let originalPathname = pathname;

      if (pathname.endsWith('/index.html')) {
        pathname = pathname.replace(/\/index\.html$/, '');
      }
      while (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }

      if (pathname !== originalPathname) {
        const cleanUrl = pathname + urlObj.search;
        window.history.replaceState({}, '', cleanUrl);
        await this.loadRoute(cleanUrl);
      } else {
        await this.loadRoute(currentPath);
      }
    }
  }

  async navigateTo(path) {
    // Normalize target path (remove leading/trailing slashes for comparison)
    let cleanTarget = path;
    if (cleanTarget.endsWith('/')) {
      cleanTarget = cleanTarget.slice(0, -1);
    }
    if (!cleanTarget.startsWith('/')) {
      cleanTarget = '/' + cleanTarget;
    }

    const currentFull = window.location.pathname + window.location.search;
    let cleanCurrent = currentFull;
    if (cleanCurrent.endsWith('/')) {
      cleanCurrent = cleanCurrent.slice(0, -1);
    }
    if (!cleanCurrent.startsWith('/')) {
      cleanCurrent = '/' + cleanCurrent;
    }

    // Strip basePath from cleanCurrent to get the relative route path
    let relativeCurrent = cleanCurrent;
    if (this.basePath !== '/' && cleanCurrent.startsWith(this.basePath.slice(0, -1))) {
      relativeCurrent = cleanCurrent.slice(this.basePath.length - 1);
    }
    if (!relativeCurrent.startsWith('/')) {
      relativeCurrent = '/' + relativeCurrent;
    }

    if (relativeCurrent !== cleanTarget) {
      // Build the full URL to push to history
      const pushUrl = this.basePath + cleanTarget.replace(/^\//, '');
      window.history.pushState({}, '', pushUrl);
      await this.loadRoute(cleanTarget);
    }
  }

  async loadRoute(fullPath) {
    if (this.#isLoading) return;
    this.#isLoading = true;

    try {
      // 0. FIRST-RUN SETUP WIZARD GUARD
      const isConfigured = configManager.current.isInstalled && (configManager.current.adminEmails?.length > 0);
      if (!isConfigured && !this.isTestInstance && !window.__FOUNDATION_DEV_BYPASS__) {
        this.renderSetupWizard();
        return;
      }

      // 1. Normalize path
      const urlObj = new URL(fullPath, window.location.origin);
      let rawPath = urlObj.pathname || '/';

      if (rawPath.endsWith('/index.html')) {
        rawPath = rawPath.replace(/\/index\.html$/, '');
      }
      
      while (rawPath.length > 1 && rawPath.endsWith('/')) {
        rawPath = rawPath.slice(0, -1);
      }

      // Strip basePath prefix to get the clean relative path
      let relPath = rawPath;
      if (this.basePath !== '/' && rawPath.startsWith(this.basePath.slice(0, -1))) {
        relPath = rawPath.slice(this.basePath.length - 1);
      }
      if (!relPath.startsWith('/')) {
        relPath = '/' + relPath;
      }

      let cleanPath = '/home';
      let isCustomDynamicPage = false;
      let customPageData = null;

      if (relPath === '/' || relPath === '/home' || relPath === '') {
        cleanPath = '/home';
      } else if (this.routesManifest[relPath]) {
        cleanPath = relPath;
      } else if (relPath.startsWith('/pages/')) {
        const slug = relPath.substring(7); // strip '/pages/'
        try {
          const { contentDB } = await import('../core/db.js');
          customPageData = await contentDB.getCustomPageBySlug(slug);
          if (customPageData) {
            isCustomDynamicPage = true;
            cleanPath = relPath;
          } else {
            cleanPath = '/404';
          }
        } catch (dbErr) {
          console.warn('[Router]: Dynamic page check error:', dbErr);
          cleanPath = '/404';
        }
      } else {
        cleanPath = '/404';
      }

      // --- RBAC Access & Persona Checking ---
      const currentUser = store.state.user;
      const currentRole = currentUser?.role || 'prospect'; // fallback is prospect (guest)
      const isDevConsoleBypass = window.__FOUNDATION_DEV_BYPASS__ === true || store.state.devMode === true;

      // Unauthenticated / Prospect Persona gatekeeping
      if (!currentUser && (cleanPath === '/account' || cleanPath === '/admin')) {
        this.#isLoading = false;
        await this.loadRoute('/login');
        return;
      }

      // Subscriber Persona payload Paywall Gatekeeping: Upgrade notice
      if (currentRole === 'subscriber' && cleanPath === '/admin') {
        this.#isLoading = false;
        await this.loadRoute('/home');
        return;
      }

      // Editor Persona Access Constraints
      const isEditor = currentRole === 'editor';
      const isPrimaryAdmin = currentRole === 'admin' || (currentUser && configManager.current.adminEmails?.includes(currentUser.email));

      // Hard gate check for Admin Panel
      if (cleanPath === '/admin') {
        const hasAccess = isPrimaryAdmin || isEditor || isDevConsoleBypass;
        if (!hasAccess) {
          console.warn('[Router Guard]: Access Denied to /admin for role:', currentRole);
          this.appContainer.innerHTML = `
            <section class="admin-lock-screen" style="max-width: 500px; margin: 4rem auto; padding: 2rem; text-align: center; font-family: system-ui, sans-serif; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
              <h1 style="font-size: 1.5rem; color: #1a202c; margin-bottom: 0.5rem;">Access Restricted</h1>
              <p style="color: #718096; font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5;">
                Access to the Admin Dashboard requires an Administrator or Content Editor account.
              </p>
              <button onclick="window.router.navigateTo('/home')" class="btn-primary" style="width: 100%; padding: 12px; font-size: 1rem; background: #2b6cb0; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                Return Home
              </button>
            </section>
          `;
          return;
        }
      }

      // Custom page access level evaluation
      if (isCustomDynamicPage && customPageData) {
        const requiredAccess = customPageData.access?.visibility || 'public';
        let satisfiesGate = true;

        if (requiredAccess === 'subscriber' && currentRole === 'prospect') {
          satisfiesGate = false;
        } else if ((requiredAccess === 'member' || requiredAccess === 'paid') && (currentRole === 'prospect' || currentRole === 'subscriber')) {
          satisfiesGate = false;
        }

        if (!satisfiesGate) {
          this.appContainer.innerHTML = `
            <section style="max-width: 600px; margin: 4rem auto; padding: 3rem 2rem; text-align: center; border-radius: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); background: var(--theme-color-surface, #ffffff);">
              <div style="font-size: 4rem; margin-bottom: 1rem;">🔒</div>
              <h2 style="font-size: 1.75rem; margin-bottom: 0.5rem;">Content Locked</h2>
              <p style="color: var(--theme-color-text-secondary, #718096); margin-bottom: 1.5rem; line-height: 1.6;">
                ${requiredAccess === 'subscriber'
                  ? 'This page is reserved for our registered Free Subscribers.'
                  : 'Upgrade to Member ($29/mo) to unlock full access to this course/publication.'}
              </p>
              ${currentRole === 'prospect'
                ? `<button onclick="window.router.navigateTo('/login')" class="btn-primary" style="padding: 10px 24px; font-weight: bold;">Sign In / Create Account</button>`
                : `<button onclick="window.router.navigateTo('/account')" class="btn-primary" style="padding: 10px 24px; font-weight: bold;">Upgrade in Account Dashboard</button>`}
            </section>
          `;
          this.updateMetadata(cleanPath);
          window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { path: cleanPath, fullPath: fullPath } }));
          return;
        }
      }

      // 3. Determine view HTML template location
      let viewPath = '';
      if (isCustomDynamicPage) {
        viewPath = './pages/pages.html';
      } else {
        const manifestEntry = this.routesManifest[cleanPath];
        viewPath = manifestEntry?.viewPath;
        if (!viewPath) {
          if (cleanPath === '/admin') {
            viewPath = './pages/admin/admin.html';
          } else if (cleanPath === '/home') {
            viewPath = './pages/home/home.html';
          } else {
            viewPath = `./pages${cleanPath}.html`;
          }
        }
      }

      // Resolve viewPath relative to the SPA base path
      let resolvedViewPath = viewPath;
      if (viewPath.startsWith('./')) {
        resolvedViewPath = this.basePath + viewPath.slice(2);
      } else if (viewPath.startsWith('pages/')) {
        resolvedViewPath = this.basePath + viewPath;
      }

      let response = await fetch(resolvedViewPath);
      if (!response.ok) {
        cleanPath = '/404';
        const fallbackPath = this.basePath + 'pages/404.html';
        response = await fetch(fallbackPath);
      }
      const htmlContent = await response.text();

      this.appContainer.innerHTML = htmlContent;
      this.updateMetadata(cleanPath);
      this.appContainer.focus();

      // Dispatch PUSH_HISTORY to store
      store.dispatch('PUSH_HISTORY', cleanPath);

      // Dispatch pageLoaded event with the clean path for navbar to use
      window.dispatchEvent(new CustomEvent('pageLoaded', { 
        detail: { path: cleanPath, fullPath: fullPath, query: urlObj.search } 
      }));
    } catch (err) {
      this.appContainer.innerHTML = '<section style="padding: 2rem; text-align: center;"><h1>404 - Page Not Found</h1></section>';
      this.updateMetadata('/404');
      window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { path: '/404', fullPath: fullPath } }));
    } finally {
      this.#isLoading = false;
    }
  }

  renderSetupWizard() {
    this.appContainer.innerHTML = `
      <section style="max-width: 650px; margin: 3rem auto; padding: 2rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-family: system-ui, sans-serif; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 2rem;">
          <h1 style="margin: 0 0 0.5rem 0; color: #2b6cb0;">🚀 Foundation Setup Wizard</h1>
          <p style="margin: 0; color: #718096; font-size: 0.95rem;">Configure your primary Google Workspace owner and site settings to initialize the framework.</p>
        </div>
        <form id="setup-wizard-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div>
            <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">Primary Google Workspace Admin Email (Owner):</label>
            <input type="email" id="wizard-admin-email" placeholder="owner@yourdomain.com" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box;" />
            <span style="font-size: 0.75rem; color: #718096;">System Administrator status will be anchored exclusively to this Google account.</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">Website Title:</label>
              <input type="text" id="wizard-site-title" placeholder="My Web Platform" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box;" />
            </div>
            <div>
              <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">Base Domain URL:</label>
              <input type="url" id="wizard-site-domain" value="${window.location.origin}" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box;" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">Firebase API Key:</label>
              <input type="text" id="wizard-fb-key" placeholder="AIzaSy..." required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box;" />
            </div>
            <div>
              <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">Firebase Project ID:</label>
              <input type="text" id="wizard-fb-project" placeholder="my-app-id" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box;" />
            </div>
          </div>
          <button type="submit" id="btn-submit-wizard" class="btn-primary" style="padding: 12px; font-size: 1rem; background: #38a169; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 1rem;">
            Complete Setup & Initialize Platform
          </button>
        </form>
      </section>
    `;

    document.getElementById('setup-wizard-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-wizard');
      if (submitBtn) submitBtn.textContent = 'Saving & Initializing...';

      const adminEmail = document.getElementById('wizard-admin-email').value.trim();
      const siteTitle = document.getElementById('wizard-site-title').value.trim();
      const siteDomain = document.getElementById('wizard-site-domain').value.trim();
      const apiKey = document.getElementById('wizard-fb-key').value.trim();
      const projectId = document.getElementById('wizard-fb-project').value.trim();

      const payload = {
        siteTitle,
        siteDomain,
        adminEmails: [adminEmail],
        firebase: { apiKey, projectId },
        isInstalled: true
      };

      await configManager.saveSetupCredentials(payload);
      // Reload page cleanly so Firebase initializes with the saved keys on boot
      window.location.href = window.location.origin + '/home';
    });
  }

  updateMetadata(path) {
    const routeInfo = this.routesManifest[path];
    if (routeInfo) {
      document.title = `${routeInfo.title} | Foundation`;
      if (routeInfo.description) {
        this.setMetaDescription(routeInfo.description);
      }
    } else {
      const segments = path.split('/').filter(Boolean);
      const rawTitle = segments.pop() || 'Home';
      const formattedTitle = rawTitle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      document.title = `${formattedTitle} | Foundation`;
    }
  }

  setMetaDescription(descriptionText) {
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = descriptionText;
  }
}
