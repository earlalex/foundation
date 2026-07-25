// router/router.js
import { validateSchema, Type } from '../core/validator.js';
import { authManager } from '../core/auth.js';
import { store } from '../core/store.js';

// Schema to ensure route metadata in routes.json or manual config is valid
const RouteMetaSchema = {
  title: Type.string,
  description: Type.optional(Type.string),
  viewPath: Type.optional(Type.string)
};

export class Router {
  constructor(routesManifest = {}) {
    this.appContainer = document.getElementById('app');
    this.routesManifest = routesManifest;
    
    // Validate provided routes manifest structure on initialization
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

    // 2. Handle back/forward navigation in the browser
    window.addEventListener('popstate', () => {
      this.loadRoute(window.location.pathname);
    });

    // 3. Initial page load hit
    this.loadRoute(window.location.pathname);
  }

  async navigateTo(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      await this.loadRoute(path);
    }
  }

  async loadRoute(path) {
    // 1. Normalize path
    let cleanPath = path || '/';

    // Strip trailing slash if present (unless root '/')
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    // Normalize root or index.html to default '/home'
    if (cleanPath === '/' || cleanPath.endsWith('/index.html') || cleanPath === './') {
      cleanPath = '/home';
    }

    // Extract subroute key if running under a repository subpath (e.g. /foundation/admin -> /admin)
    if (!this.routesManifest[cleanPath]) {
      const lastSegment = cleanPath.split('/').filter(Boolean).pop();
      if (lastSegment && this.routesManifest[`/${lastSegment}`]) {
        cleanPath = `/${lastSegment}`;
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
      
      // Inject HTML into app container
      this.appContainer.innerHTML = htmlContent;

      // Update SEO Title & Meta Description dynamically
      this.updateMetadata(cleanPath);

      // Accessibility: Shift focus to main app wrapper on transition
      this.appContainer.focus();

      // Dispatch event so page controllers (initAdminPage, initHomePage) know when to mount
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