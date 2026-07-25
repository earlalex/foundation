// router/router.js
import { validateSchema, Type } from '../core/validator.js';
import { authManager } from '../core/auth.js';
import { store } from '../core/store.js';

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
    // 1. Intercept link clicks across the site
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

    // 2. Handle back/forward navigation
    window.addEventListener('popstate', () => {
      this.loadRoute(window.location.pathname);
    });

    // 3. Check for GitHub Pages SPA stored subroute
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
        // Correctly route all unrecognized paths to /404
        cleanPath = '/404';
      }
    }

    // 2. ADMIN GUARD CHECK (Bypassed if Dev Mode is ON or User is Admin)
    const isDevModeActive = store.state.devMode === true;
    const isAdminAuth = authManager.isAdminAuthenticated();

    if (cleanPath === '/admin' && !isAdminAuth && !isDevModeActive) {
      console.warn('[Router Guard]: Access denied to /admin. User is not authenticated as admin and Dev Mode is OFF.');
      
      this.appContainer.innerHTML = `
        <section class="admin-lock-screen" style="text-align: center; padding: 4rem 2rem; font-family: system-ui, sans-serif;">
          <h1>🔒 Admin Authorization Required</h1>
          <p style="color: #4a5568; margin-bottom: 1.5rem;">Please log in with an authorized Google Admin account or enable Dev Mode to access control settings.</p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button id="admin-login-btn" style="padding: 12px 24px; font-size: 16px; background: #3182ce; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              Sign In with Google
            </button>
            <button id="dev-bypass-btn" style="padding: 12px 24px; font-size: 16px; background: #38a169; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              Enable Dev Mode Bypass
            </button>
          </div>
        </section>
      `;

      document.getElementById('admin-login-btn')?.addEventListener('click', async () => {
        await authManager.loginWithGoogle();
        this.loadRoute('/admin');
      });

      document.getElementById('dev-bypass-btn')?.addEventListener('click', () => {
        store.dispatch('SET_DEV_MODE', true);
        this.loadRoute('/admin');
      });

      return;
    }

    if (cleanPath === '/admin' && isDevModeActive) {
      console.log('[Router Guard]: Dev Mode Active -> Granting direct access to /admin view.');
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

      // 4. Automatic fallback to 404 page if view template fails to fetch
      if (!response.ok) {
        console.warn(`[Router]: View path "${viewPath}" returned status ${response.status}. Fetching 404 fallback.`);
        cleanPath = '/404';
        response = await fetch('./pages/404.html');
        
        if (!response.ok) {
          throw new Error('Fallback 404.html view file is missing from /pages!');
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