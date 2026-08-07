// router/router.js
import { validateSchema, Type } from '../core/validator.js';
import { store } from '../core/store.js';
import { configManager } from '../core/config.js';

const RouteMetaSchema = {
  title: Type.string,
  description: Type.optional(Type.string),
  viewPath: Type.optional(Type.string)
};

/**
 * Universal sanitization helper to neutralize HTML/script injection from untrusted input fields,
 * search parameters, or dynamic route path slugs.
 * @param {string} str - The raw string to sanitize
 * @returns {string} The sanitized/escaped string
 */
export function sanitizeInputString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<[^>]*>/g, '') // strip any standard HTML tags
    .replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
}

export class Router {
  #isLoading = false;

  constructor(routesManifest = {}, isTestInstance = false) {
    this.appContainer = document.getElementById('app');
    this.routesManifest = routesManifest;
    this.isTestInstance = isTestInstance;
    this.currentRoute = null;

    // Capture referral code if present
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = urlParams.get('ref');
      if (ref) {
        sessionStorage.setItem('foundation_ref_id', sanitizeInputString(ref));
      }
    }

    // Dynamically map /login for unit test instances to prevent 404 falling back on redirecting
    if (this.isTestInstance && !this.routesManifest['/login']) {
      this.routesManifest['/login'] = { title: 'Login', viewPath: './pages/login.html' };
    }

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

  async loadRouteModule(cleanPath) {
    try {
      if (cleanPath === '/admin') {
        await import('../pages/admin/admin.js');
      } else if (cleanPath === '/about') {
        await import('../pages/about/about.js');
      } else if (cleanPath === '/events') {
        await import('../pages/events/events.js');
      } else if (cleanPath === '/contact') {
        await import('../pages/contact/contact.js');
      } else if (cleanPath === '/education') {
        await import('../pages/education/education.js');
      } else if (cleanPath === '/podcast') {
        await import('../pages/podcast/podcast.js');
      } else if (cleanPath === '/shop') {
        await import('../pages/shop/shop.js');
      } else if (cleanPath === '/tag' || cleanPath.startsWith('/tag/')) {
        await import('../pages/tag/tag.js');
      } else if (cleanPath === '/detail') {
        await import('../pages/detail/detail.js');
      } else if (cleanPath === '/account') {
        await import('../pages/account.js');
      }
    } catch (importErr) {
      console.error(`[Router loadRouteModule]: Graceful defensive catch. Failed to dynamically import page controller module for route "${cleanPath}". Diagnostic details: ${importErr.stack || importErr.message || importErr}`);
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
    if (this.currentRoute && this.currentRoute !== fullPath) {
      sessionStorage.setItem('foundation_previous_route', this.currentRoute);
    }
    this.currentRoute = fullPath;

    if (this.#isLoading) return;
    this.#isLoading = true;

    // Trigger router before navigation action hook
    try {
      const { doAction } = await import('../core/hooks.js');
      await doAction('router_before_route', fullPath);
    } catch (err) {
      console.error('[Router Hook]: router_before_route action callback execution failed.', err);
    }

    // Dynamic Route-Based Code Splitting: loadRouteModule
    try {
      const urlObj = new URL(fullPath, window.location.origin);
      let rawPath = urlObj.pathname || '/';
      if (rawPath.endsWith('/index.html')) {
        rawPath = rawPath.replace(/\/index\.html$/, '');
      }
      while (rawPath.length > 1 && rawPath.endsWith('/')) {
        rawPath = rawPath.slice(0, -1);
      }
      let relPath = rawPath;
      if (this.basePath !== '/' && rawPath.startsWith(this.basePath.slice(0, -1))) {
        relPath = rawPath.slice(this.basePath.length - 1);
      }
      if (!relPath.startsWith('/')) {
        relPath = '/' + relPath;
      }
      let cleanPath = (relPath === '/' || relPath === '/home' || relPath === '') ? '/home' : relPath;

      await this.loadRouteModule(cleanPath);
    } catch (importErr) {
      console.warn('[Router Splitting]: Dynamic route module load failed.', importErr);
    }

    try {
      // 0. FIRST-RUN SETUP WIZARD GUARD
      const isConfigured = configManager.current.isInstalled === true;
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
      } else if (relPath.startsWith('/tag/')) {
        cleanPath = '/tag';
      } else if (relPath.startsWith('/pages/')) {
        const slug = sanitizeInputString(relPath.substring(7)); // strip '/pages/' and sanitize!
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
      const simulatedTier = store.state.simulatedUserTier;
      const currentRole = simulatedTier || currentUser?.role || 'prospect'; // fallback is prospect (guest)
      const isDevConsoleBypass = window.__FOUNDATION_DEV_BYPASS__ === true || store.state.devMode === true;
      const hasUserSession = simulatedTier ? (simulatedTier !== 'prospect') : !!currentUser;

      // Unauthenticated / Prospect Persona gatekeeping (Bypass if developer mode/bypass is active or if Google Auth is actively processing in the background)
      if (!hasUserSession && !isDevConsoleBypass && (cleanPath === '/account' || cleanPath === '/admin')) {
        if (sessionStorage.getItem('firebase_auth_in_progress') === 'true') {
          console.log('[Router Guard]: Auth is actively processing in the background. Skipping login redirection.');
          this.#isLoading = false;
          return;
        }
        this.#isLoading = false;
        sessionStorage.setItem('intended_destination', cleanPath);
        await this.loadRoute('/login');
        return;
      }

      // Editor Persona Access Constraints
      const isEditor = currentRole === 'editor';
      const isPrimaryAdmin = currentRole === 'admin' || (currentUser && configManager.current.adminEmails?.includes(currentUser.email) && !simulatedTier);

      // Hard gate check for Admin Panel (Directive 1 Lockdown)
      if (cleanPath === '/admin') {
        const hasAccess = isPrimaryAdmin || isEditor || isDevConsoleBypass;
        if (!hasAccess) {
          console.warn('[Router Guard]: Access Denied to /admin for role:', currentRole);
          // If unauthenticated user or guest, immediately redirect to /login
          if (!hasUserSession && !isDevConsoleBypass) {
            this.#isLoading = false;
            sessionStorage.setItem('intended_destination', '/admin');
            await this.loadRoute('/login');
            return;
          }
          // If authenticated non-admin (Subscriber or Member), redirect directly to /account
          this.#isLoading = false;
          await this.loadRoute('/account');
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
      let htmlContent = await response.text();

      this.appContainer.innerHTML = htmlContent;

      // Fallback View Container Check: prevent blank white screen viewport rendering
      if (!this.appContainer.innerHTML || this.appContainer.innerHTML.trim() === '') {
        console.warn(`[Router]: Empty template content parsed for path "${cleanPath}". Rendering fallback view.`);
        this.appContainer.innerHTML = `
          <section class="section-container" style="max-width: 600px; margin: 4rem auto; padding: 3rem 2rem; text-align: center; border-radius: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); background: var(--theme-color-surface, #ffffff);">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🔄</div>
            <h2 style="font-size: 1.75rem; margin-bottom: 0.5rem;">Reloading Content</h2>
            <p style="color: var(--theme-color-text-secondary, #718096); margin-bottom: 1.5rem; line-height: 1.6;">
              Please wait while we refresh the current layout view...
            </p>
            <button onclick="window.router.navigateTo('/home')" class="btn-primary" style="padding: 10px 24px; font-weight: bold;">Go to Homepage</button>
          </section>
        `;
      }

      this.updateMetadata(cleanPath);
      this.appContainer.focus();

      // Dispatch PUSH_HISTORY to store
      store.dispatch('PUSH_HISTORY', cleanPath);

      // Trigger router after navigation action hook
      try {
        const { doAction } = await import('../core/hooks.js');
        await doAction('router_after_route', cleanPath);
      } catch (err) {
        console.error('[Router Hook]: router_after_route action callback execution failed.', err);
      }

      // Dispatch pageLoaded event with the clean path for navbar to use
      window.dispatchEvent(new CustomEvent('pageLoaded', { 
        detail: { path: cleanPath, fullPath: fullPath, query: urlObj.search } 
      }));

      // Google Analytics 4 virtual page view tracking (Directive 2)
      try {
        const { trackPageView } = await import('../utils/analytics.js');
        trackPageView(cleanPath, document.title);
      } catch (err) {
        // silent catch
      }

      // ARIA Route Change Announcement and Focus Shifting (Directive 1)
      try {
        const announcer = document.getElementById('a11y-announcer');
        if (announcer) {
          announcer.textContent = `Navigated to ${document.title || 'Page'}`;
        }
        const appContainer = document.getElementById('app');
        if (appContainer) {
          appContainer.focus();
        }
      } catch (e) {
        console.warn('[A11y Announcer]: Failed to announce route transition:', e.message);
      }
    } catch (err) {
      this.appContainer.innerHTML = '<section style="padding: 2rem; text-align: center;"><h1>404 - Page Not Found</h1></section>';
      this.updateMetadata('/404');
      window.dispatchEvent(new CustomEvent('pageLoaded', { detail: { path: '/404', fullPath: fullPath } }));
    } finally {
      this.#isLoading = false;
    }
  }

  async renderSetupWizard() {
    await import('../pages/admin/components/AdminSetupWizards.js');
    this.appContainer.innerHTML = `<master-setup-wizard></master-setup-wizard>`;
  }

  updateMetadata(path) {
    const routeInfo = this.routesManifest[path];
    const siteTitle = configManager.current.siteTitle || 'Foundation';
    const siteDomain = configManager.current.siteDomain || window.location.origin;
    const siteLogo = configManager.current.siteLogo?.src || `${siteDomain}/assets/logo.png`;

    let title = 'Home';
    let description = 'Welcome to Foundation - A custom zero-build web framework.';

    if (routeInfo) {
      title = routeInfo.title;
      description = routeInfo.description || description;
    } else {
      const segments = path.split('/').filter(Boolean);
      const rawTitle = segments.pop() || 'Home';
      title = rawTitle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Set traditional SEO
    document.title = `${title} | ${siteTitle}`;
    this.setMetaTag('name', 'description', description);
    this.setMetaTag('name', 'keywords', `${title.toLowerCase()}, ${siteTitle.toLowerCase()}, zero-build, framework, single page application`);

    // Set canonical link
    const canonicalUrl = `${siteDomain}${path}`;
    this.setLinkTag('canonical', canonicalUrl);

    // Set Open Graph tags (SEO, AEO, AIO, GEO)
    this.setMetaTag('property', 'og:title', `${title} | ${siteTitle}`);
    this.setMetaTag('property', 'og:description', description);
    this.setMetaTag('property', 'og:image', siteLogo);
    this.setMetaTag('property', 'og:url', canonicalUrl);
    this.setMetaTag('property', 'og:type', 'website');
    this.setMetaTag('name', 'twitter:card', 'summary_large_image');

    // Programmatic Structured JSON-LD Data Injection for AI and Search Crawlers
    this.injectJsonLdSchema(path, title, description, canonicalUrl, siteTitle, siteDomain, siteLogo);
  }

  setMetaTag(attrType, attrValue, contentValue) {
    let el = document.querySelector(`meta[${attrType}="${attrValue}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrType, attrValue);
      document.head.appendChild(el);
    }
    el.content = contentValue;
  }

  setLinkTag(rel, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
  }

  injectJsonLdSchema(path, title, description, canonicalUrl, siteTitle, siteDomain, siteLogo) {
    // Remove existing dynamic json-ld scripts
    document.querySelectorAll('script[type="application/ld+json"].dynamic-schema').forEach(el => el.remove());

    const schemas = [];
    const orgProfile = configManager.current.businessProfile || {};

    // 1. Organization Schema
    const orgSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteDomain}/#organization`,
      "name": orgProfile.legalName || siteTitle,
      "url": siteDomain,
      "logo": siteLogo,
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": orgProfile.phone || "",
        "contactType": "customer service",
        "email": orgProfile.supportEmail || orgProfile.email || ""
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": orgProfile.address || "",
        "addressLocality": orgProfile.city || "",
        "addressRegion": orgProfile.state || "",
        "postalCode": orgProfile.zip || "",
        "addressCountry": orgProfile.country || "US"
      }
    };
    schemas.push(orgSchema);

    // 2. Specific Page Schemas (AEO, AIO, GEO & GEO)
    if (path === '/events') {
      const eventSchema = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Consultation & Strategic Strategy Sessions",
        "startDate": new Date().toISOString(),
        "endDate": new Date(Date.now() + 365*24*60*60*1000).toISOString(),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
        "location": {
          "@type": "VirtualLocation",
          "url": `${siteDomain}/contact`
        },
        "description": "Premium strategic sessions to audit architectures, serverless workloads, and SPA scaling pipelines.",
        "offers": {
          "@type": "Offer",
          "url": `${siteDomain}/contact`,
          "price": "150.00",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        }
      };
      schemas.push(eventSchema);
    } else if (path === '/contact') {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How do I schedule a 1-on-1 strategic consultation?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Select an available date and time slot directly on our interactive consultation calendar. Provide your contact info, pay any required upfront deposits securely via Stripe, and receive a Google Meet video conference link synced directly to your calendar."
            }
          },
          {
            "@type": "Question",
            "name": "What is the average response time for standard inquiries?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Our typical response turnaround is under 24 business hours for all standard messages delivered through our secure contact channels."
            }
          }
        ]
      };
      schemas.push(faqSchema);
    } else if (path === '/home') {
      const prodSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": `${siteTitle} Developer Subscriptions`,
        "description": "Gain full premium course learning materials, downloadable guides, and serverless developer bundles.",
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": "29.00",
          "highPrice": "150.00",
          "priceCurrency": "USD",
          "seller": {
            "@type": "Organization",
            "name": orgProfile.legalName || siteTitle
          }
        }
      };
      schemas.push(prodSchema);
    }

    // Inject scripts
    schemas.forEach(schema => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.className = 'dynamic-schema';
      script.text = JSON.stringify(schema);
      document.head.appendChild(script);
    });
  }
}
