// router/router.js

export class Router {
  constructor(routesManifest = {}) {
    this.appContainer = document.getElementById('app');
    this.routesManifest = routesManifest; // Optional metadata mapping
    this.init();
  }

  init() {
    // 1. Intercept link clicks across the site
    document.body.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (anchor && anchor.origin === window.location.origin && !anchor.hasAttribute('data-native')) {
        e.preventDefault();
        this.navigateTo(anchor.pathname);
      }
    });

    // 2. Handle back/forward navigation
    window.addEventListener('popstate', () => {
      this.loadRoute(window.location.pathname);
    });

    // 3. Initial load on page hit
    this.loadRoute(window.location.pathname);
  }

  async navigateTo(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      await this.loadRoute(path);
    }
  }

  async loadRoute(path) {
    // Clean up trailing slash, default '/' to '/home'
    let cleanPath = path === '/' ? '/home' : path;

    // Resolve target static HTML file path
    let viewPath = `/pages${cleanPath}.html`;

    try {
      let response = await fetch(viewPath);

      // Automatic fallback to 404 page if view doesn't exist
      if (!response.ok) {
        console.warn(`[Router]: Route "${viewPath}" not found. Falling back to 404.`);
        viewPath = '/pages/404.html';
        response = await fetch(viewPath);
      }

      const htmlContent = await response.text();
      
      // Inject HTML into app wrapper
      this.appContainer.innerHTML = htmlContent;

      // Update SEO Title & Metadata if defined in routes.json, else set default title
      this.updateMetadata(cleanPath);

      // Accessibility: Focus main content container on transition
      this.appContainer.focus();

      // Trigger custom router event (useful for attaching view-specific scripts)
      window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { path: cleanPath } }));

    } catch (err) {
      console.error('[Router Error]: Failed to load view', err);
      this.appContainer.innerHTML = '<h2>An unexpected error occurred while loading this page.</h2>';
    }
  }

  updateMetadata(path) {
    const routeInfo = this.routesManifest[path];
    if (routeInfo && routeInfo.title) {
      document.title = `${routeInfo.title} | Foundation`;
    } else {
      // Fallback title formatting (e.g. /blog/hello-world -> Hello World)
      const formattedTitle = path.split('/').pop().replace(/-/g, ' ');
      const capitalized = formattedTitle.charAt(0).toUpperCase() + formattedTitle.slice(1);
      document.title = `${capitalized} | Foundation`;
    }
  }
}