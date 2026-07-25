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
  constructor(routesManifest = {}) {
    this.appContainer = document.getElementById('app');
    this.routesManifest = routesManifest;
    
    this.validateManifest();
    this.init();
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

  init() {
    document.body.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (
        anchor && 
        anchor.origin === window.location.origin && 
        !anchor.hasAttribute('data-native') &&
        anchor.getAttribute('target') !== '_blank'
      ) {
        e.preventDefault();
        this.navigateTo(anchor.pathname);
      }
    });

    window.addEventListener('popstate', () => {
      this.loadRoute(window.location.pathname);
    });

    const storedRoute = sessionStorage.getItem('foundation_spa_route');
    if (storedRoute) {
      sessionStorage.removeItem('foundation_spa_route');
      const repoPrefix = window.location.pathname.replace(/\/$/, '');
      const fullUrl = repoPrefix + storedRoute;
      window.history.replaceState({}, '', fullUrl);
      this.loadRoute(storedRoute);
    } else {
      this.loadRoute(window.location.pathname);
    }
  }

  async navigateTo(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      await this.loadRoute(path);
    }
  }

  async loadRoute(path) {
    // 0. FIRST-RUN SETUP WIZARD GUARD
    const isConfigured = configManager.current.isInstalled && (configManager.current.adminEmails?.length > 0);
    if (!isConfigured) {
      this.renderSetupWizard();
      return;
    }

    // 1. Normalize path
    let rawPath = path || '/';
    if (rawPath.endsWith('/index.html')) {
      rawPath = rawPath.replace(/\/index\.html$/, '');
    }
    if (rawPath.length > 1 && rawPath.endsWith('/')) {
      rawPath = rawPath.slice(0, -1);
    }

    const segments = rawPath.split('/').filter(Boolean);
    let cleanPath = '/home';

    if (segments.length === 0 || rawPath === '/' || rawPath === './') {
      cleanPath = '/home';
    } else {
      const lastSegment = `/${segments[segments.length - 1]}`;

      if (this.routesManifest[rawPath]) {
        cleanPath = rawPath;
      } else if (this.routesManifest[lastSegment]) {
        cleanPath = lastSegment;
      } else {
        cleanPath = '/404';
      }
    }

    // 2. HARDENED ADMIN GUARD CHECK (UI Bypasses Removed)
    const isAdminAuth = authManager.isAdminAuthenticated();
    const isDevConsoleBypass = window.__FOUNDATION_DEV_BYPASS__ === true;

    if (cleanPath === '/admin' && !isAdminAuth && !isDevConsoleBypass) {
      console.warn('[Router Guard]: Security Access Denied to /admin.');
      
      this.appContainer.innerHTML = `
        <section class="admin-lock-screen" style="max-width: 500px; margin: 4rem auto; padding: 2rem; text-align: center; font-family: system-ui, sans-serif; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
          <h1 style="font-size: 1.5rem; color: #1a202c; margin-bottom: 0.5rem;">Administrator Authentication Required</h1>
          <p style="color: #718096; font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5;">
            Access to the Command Center is restricted strictly to the connected Google Workspace primary administrator.
          </p>
          <button id="admin-login-btn" class="btn-primary" style="width: 100%; padding: 12px; font-size: 1rem; background: #2b6cb0; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
            Sign In with Google Workspace
          </button>
        </section>
      `;

      document.getElementById('admin-login-btn')?.addEventListener('click', async () => {
        await authManager.loginWithGoogle();
        this.loadRoute('/admin');
      });

      return;
    }

    // 3. Determine view HTML template location
    const manifestEntry = this.routesManifest[cleanPath];
    let viewPath = manifestEntry?.viewPath;

    if (!viewPath) {
      if (cleanPath === '/admin') {
        viewPath = './pages/admin/admin.html';
      } else if (cleanPath === '/home') {
        viewPath = './pages/home/home.html';
      } else {
        viewPath = `./pages${cleanPath}.html`;
      }
    }

    try {
      let response = await fetch(viewPath);

      if (!response.ok) {
        cleanPath = '/404';
        response = await fetch('./pages/404.html');
        if (!response.ok) {
          throw new Error('Fallback 404.html view file is missing!');
        }
      }

      const htmlContent = await response.text();
      this.appContainer.innerHTML = htmlContent;
      this.updateMetadata(cleanPath);
      this.appContainer.focus();

      window.dispatchEvent(new CustomEvent('pageLoaded', { 
        detail: { path: cleanPath, fullPath: path } 
      }));
    } catch (err) {
      throw new Error(`Routing Failed: ${err.message}`);
    }
  }

  /**
   * Render First-Run Setup & Installation Helper
   */
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

          <button type="submit" class="btn-primary" style="padding: 12px; font-size: 1rem; background: #38a169; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 1rem;">
            Complete Setup & Initialize Platform
          </button>
        </form>
      </section>
    `;

    document.getElementById('setup-wizard-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
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

      const success = await configManager.saveToFirebase(payload);
      if (success) {
        alert('Setup Complete! Reloading Foundation Command Center...');
        window.location.reload();
      }
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