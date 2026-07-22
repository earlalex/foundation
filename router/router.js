// router/router.js
import { validateSchema, Type } from '/core/validator.js';

// Schema to ensure route metadata in routes.json or manual config is valid
const RouteMetaSchema = {
  title: Type.string,
  description: Type.optional(Type.string)
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
        // Will automatically be caught and toasted by our global error-handler!
        throw err;
      }
    }
  }

  init() {
    // 1. Intercept link clicks across the site
    document.body.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      
      // Only intercept internal links that don't have target="_blank" or data-native
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
    // Normalize path: '/' becomes '/home'
    let cleanPath = path === '/' ? '/home' : path;
    let viewPath = `/pages${cleanPath}.html`;

    try {
      let response = await fetch(viewPath);

      // Automatic fallback to 404 page if view file doesn't exist
      if (!response.ok) {
        console.warn(`[Router]: View path "${viewPath}" returned status ${response.status}. Fetching 404 fallback.`);
        cleanPath = '/404';
        viewPath = '/pages/404.html';
        response = await fetch(viewPath);
        
        if (!response.ok) {
          throw new Error('Fallback 404.html view file is missing from /pages!');
        }
      }

      const htmlContent = await response.text();
      
      // Inject HTML into main target container
      this.appContainer.innerHTML = htmlContent;

      // Update SEO Title & Meta Description dynamically
      this.updateMetadata(cleanPath);

      // Accessibility: Shift focus to main app wrapper on transition
      this.appContainer.focus();

      // Dispatch event so view-specific components know when to mount
      window.dispatchEvent(new CustomEvent('pageLoaded', { 
        detail: { path: cleanPath, fullPath: path } 
      }));

    } catch (err) {
      // Uncaught errors during routing will trigger global error handler toast
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
      // Auto-generate title from path name if omitted (e.g. /blog/hello-world -> Hello World)
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