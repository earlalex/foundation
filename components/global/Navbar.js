// components/global/Navbar.js - Foundation Global Header Navigation Controller
import { store } from '../../core/store.js';
import { configManager } from '../../core/config.js';
import { themeEngine } from '../../core/theme.js';

/**
 * Initializes the global navigation header container (#global-header)
 */
export function initNavbar() {
  try {
    const headerContainer = document.getElementById('global-header');
    if (!headerContainer) return;

    const siteTitle = configManager.current?.siteTitle || 'Foundation';

    headerContainer.innerHTML = `
      <style>
        .nav-container {
          max-width: var(--theme-layout-container-max-width, 1200px);
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
        }
        .nav-menu {
          display: flex;
          gap: 1.25rem;
          align-items: center;
        }
        .hamburger-btn {
          display: none;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px;
          color: var(--theme-color-text-primary, #1a202c);
          align-items: center;
          justify-content: center;
        }

        /* Animated count badge scaling pulse */
        @keyframes pulse-badge {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .pulse-badge {
          animation: pulse-badge 0.3s ease-out;
        }

        @media (max-width: 768px) {
          .hamburger-btn {
            display: flex !important;
          }
          .nav-menu {
            display: none !important;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
            gap: 0.75rem;
            background: var(--theme-color-surface, #ffffff);
            padding: 1rem 0 0.5rem 0;
            margin-top: 0.5rem;
            border-top: 1px solid var(--theme-color-border, #e2e8f0);
          }
          .nav-menu.mobile-open {
            display: flex !important;
          }
          .nav-link {
            width: 100%;
            padding: 8px 12px !important;
            border-radius: 6px;
            background: var(--theme-color-background, #f7fafc);
          }
        }
      </style>
      <nav style="background: var(--theme-color-surface, #ffffff); border-bottom: 1px solid var(--theme-color-border, #e2e8f0); padding: 0.75rem 1.5rem; font-family: system-ui, sans-serif; position: relative; z-index: 9999;">
        <div class="nav-container">
          <!-- Brand / Identity -->
          <a href="/home" style="text-decoration: none; font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); display: flex; align-items: center; gap: 0.5rem;">
            ${configManager.current?.siteLogo?.src ? `<img src="${configManager.current.siteLogo.src}" alt="${siteTitle}" style="height: 28px; width: auto;" />` : ''}
            <span>${siteTitle}</span>
          </a>

          <!-- Hamburger Icon Button for Mobile -->
          <button id="nav-hamburger-btn" class="hamburger-btn" aria-label="Toggle Navigation Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <!-- Navigation Links -->
          <div id="nav-menu" class="nav-menu">
            ${(configManager.current?.navigation || [
              { label: "Home", url: "/home", target: "_self", requiredRole: "public" },
              { label: "About", url: "/about", target: "_self", requiredRole: "public" },
              { label: "Events", url: "/events", target: "_self", requiredRole: "public" },
              { label: "Education", url: "/education", target: "_self", requiredRole: "public" },
              { label: "Podcast", url: "/podcast", target: "_self", requiredRole: "public" },
              { label: "Shop", url: "/shop", target: "_self", requiredRole: "public" },
              { label: "Contact", url: "/contact", target: "_self", requiredRole: "public" }
            ]).map(item => `
              <a href="${item.url}" target="${item.target || '_self'}" class="nav-link dynamic-nav-link" data-path="${item.url}" data-role="${item.requiredRole || 'public'}" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">${item.label}</a>
            `).join('')}

            <!-- Integrated Top Navigation Cart Button Toggle -->
            <button id="nav-cart-btn" class="nav-link" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; color: var(--theme-color-text-secondary, #4a5568); font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; position: relative; outline: none;">
              <span>🛒</span> <span class="nav-cart-text">Cart</span>
              <span id="cart-count-badge" style="background: var(--theme-color-danger, #e53e3e); color: white; font-size: 0.75rem; font-weight: bold; border-radius: 50%; min-width: 20px; height: 20px; display: none; align-items: center; justify-content: center; padding: 2px; position: absolute; top: -6px; right: -6px; transition: transform 0.15s ease-in-out;">0</span>
            </button>

            <a href="/admin" id="nav-admin-link" class="nav-link" data-path="/admin" style="display: none; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; font-size: 0.9rem; background: #ebf8ff; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">
              Command Center
            </a>
            <a href="/login" id="nav-auth-link" class="nav-link" data-path="/login" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; font-size: 0.9rem; background: #edf2f7; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">
              Sign In / Register
            </a>

            <!-- Multi-Language Selector Dropdown -->
            <select id="nav-lang-selector" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--theme-color-border, #cbd5e0); background: var(--theme-color-surface, #ffffff); color: var(--theme-color-text-secondary, #4a5568); font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none; transition: border-color 0.2s;">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>

            <!-- Accessible High-Contrast Toggle -->
            <button id="nav-high-contrast-toggle" class="nav-link" style="background: transparent; border: none; cursor: pointer; color: var(--theme-color-text-secondary, #4a5568); font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px;" aria-label="Toggle High Contrast Mode">
              🌓 Contrast
            </button>
          </div>
        </div>
      </nav>
    `;

    // Hook Hamburger Toggle
    const hamburgerBtn = document.getElementById('nav-hamburger-btn');
    const navMenu = document.getElementById('nav-menu');
    if (hamburgerBtn && navMenu) {
      hamburgerBtn.addEventListener('click', () => {
        navMenu.classList.toggle('mobile-open');
      });
    }

    // Hook Cart Toggle click to toggle cart sidebar globally
    const cartBtn = document.getElementById('nav-cart-btn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('cart-sidebar');
        if (sidebar) {
          if (sidebar.style.right === '0px') {
            sidebar.style.right = '-420px';
          } else {
            sidebar.style.right = '0px';
          }
        } else {
          // If we are not on /events, navigate to /events and open cart on load
          window.sessionStorage.setItem('open_cart_on_load', 'true');
          window.router?.navigateTo('/events');
        }
      });
    }

    // Hook Google Auth Sign-In for unauthenticated navbar link
    const authLink = document.getElementById('nav-auth-link');
    if (authLink) {
      authLink.addEventListener('click', async (e) => {
        const state = store.state;
        if (!state.user) {
          e.preventDefault();
          e.stopPropagation();
          try {
            const { authManager } = await import('../../core/auth.js');
            await authManager.loginWithGoogle();
          } catch (err) {
            console.error('[Navbar Auth]: Google login failed:', err);
          }
        }
      });
    }

    function updateActiveLink(currentPath) {
      const navLinks = document.querySelectorAll('.nav-link');
      let activeRoute = currentPath || window.location.pathname;

      // Normalize path by stripping base path prefix
      const basePath = window.router?.basePath || '/';
      if (basePath !== '/' && activeRoute.startsWith(basePath.slice(0, -1))) {
        activeRoute = activeRoute.slice(basePath.length - 1);
      }

      if (!activeRoute.startsWith('/')) {
        activeRoute = '/' + activeRoute;
      }

      // Remove index.html suffix
      if (activeRoute.endsWith('/index.html')) {
        activeRoute = activeRoute.replace(/\/index\.html$/, '');
      }

      // Remove trailing slashes
      while (activeRoute.length > 1 && activeRoute.endsWith('/')) {
        activeRoute = activeRoute.slice(0, -1);
      }

      // Handle root path - convert to /home
      if (activeRoute === '/' || activeRoute === '') {
        activeRoute = '/home';
      }

      navLinks.forEach((link) => {
        if (link.id === 'nav-cart-btn') return; // skip cart button from highlighting

        const linkPath = link.getAttribute('data-path') || link.getAttribute('href');
        const isMatch = activeRoute === linkPath;

        if (isMatch) {
          link.style.color = 'var(--theme-color-primary, #2b6cb0)';
          link.style.borderBottom = '2px solid var(--theme-color-primary, #2b6cb0)';
          link.style.fontWeight = 'bold';
          link.style.opacity = '1';
        } else {
          link.style.color = 'var(--theme-color-text-secondary, #4a5568)';
          link.style.borderBottom = '2px solid transparent';
          link.style.fontWeight = '600';
          link.style.opacity = '0.85';
        }
      });
    }

    function syncNavbarVisibility(state) {
      const currentRole = state.simulatedUserTier || state.user?.role || 'prospect';
      const isBypass = state.user?.isAdmin || window.__FOUNDATION_DEV_BYPASS__;

      const adminLink = document.getElementById('nav-admin-link');
      if (adminLink) {
        const hasAdminAccess = currentRole === 'admin' || currentRole === 'editor' || (state.user?.isAdmin && !state.simulatedUserTier) || window.__FOUNDATION_DEV_BYPASS__;
        adminLink.style.display = hasAdminAccess ? 'inline-block' : 'none';
      }

      const authLinkElement = document.getElementById('nav-auth-link');
      if (authLinkElement) {
        if (state.user) {
          authLinkElement.textContent = 'My Dashboard';
          authLinkElement.setAttribute('href', '/account');
          authLinkElement.setAttribute('data-path', '/account');
        } else {
          authLinkElement.textContent = 'Sign In / Register';
          authLinkElement.setAttribute('href', '/login');
          authLinkElement.setAttribute('data-path', '/login');
        }
      }

      document.querySelectorAll('.dynamic-nav-link').forEach(link => {
        const requiredRole = link.getAttribute('data-role');
        if (!requiredRole || requiredRole === 'public') {
          link.style.display = 'inline-block';
        } else if (requiredRole === 'subscriber') {
          link.style.display = state.user ? 'inline-block' : 'none';
        } else if (requiredRole === 'member') {
          const hasAccess = ['member', 'affiliate', 'admin'].includes(currentRole) || isBypass;
          link.style.display = hasAccess ? 'inline-block' : 'none';
        } else if (requiredRole === 'admin') {
          const hasAccess = currentRole === 'admin' || isBypass;
          link.style.display = hasAccess ? 'inline-block' : 'none';
        }
      });
    }

    window.addEventListener('pageLoaded', (e) => {
      const currentPath = e.detail?.path || window.location.pathname;
      updateActiveLink(currentPath);
      // Auto-close hamburger menu on path transitions
      if (navMenu) {
        navMenu.classList.remove('mobile-open');
      }
    });

    store.subscribe((state) => {
      syncNavbarVisibility(state);

      // Reactive Cart Badge update
      const countBadge = document.getElementById('cart-count-badge');
      if (countBadge) {
        const items = state.cart?.items || [];
        const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

        const currentVal = parseInt(countBadge.textContent || '0', 10);
        countBadge.textContent = totalCount;
        countBadge.style.display = totalCount > 0 ? 'flex' : 'none';

        // Trigger scale pulse animation on change
        if (totalCount !== currentVal && totalCount > 0) {
          countBadge.classList.remove('pulse-badge');
          void countBadge.offsetWidth; // trigger reflow
          countBadge.classList.add('pulse-badge');
        }
      }
    });

    // Multi-Language Selector Dropdown listener & logic
    const langSelector = document.getElementById('nav-lang-selector');
    if (langSelector) {
      langSelector.value = localStorage.getItem('foundation_language') || 'en';
      langSelector.addEventListener('change', async (e) => {
        try {
          const { i18n } = await import('../../core/i18n.js');
          i18n.setLanguage(e.target.value);
        } catch (err) {
          console.warn('[Navbar i18n]: Translation module failed to load dynamically:', err);
        }
      });
    }

    // Accessible High-Contrast Toggle listener & logic
    const contrastBtn = document.getElementById('nav-high-contrast-toggle');
    if (contrastBtn) {
      contrastBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const current = localStorage.getItem('foundation_high_contrast') === 'true';
        themeEngine.setHighContrastMode(!current);
      });
    }

    // Auto-translate on navbar initialization or store sync
    setTimeout(async () => {
      try {
        const { i18n } = await import('../../core/i18n.js');
        i18n.translatePage();
      } catch (e) {}
    }, 100);

    window.addEventListener('languageChanged', () => {
      setTimeout(async () => {
        try {
          const { i18n } = await import('../../core/i18n.js');
          i18n.translatePage();
        } catch (e) {}
      }, 50);
    });

    updateActiveLink(window.location.pathname);
    syncNavbarVisibility(store.state);
  } catch (err) {
    console.error('[Navbar Safe try/catch Init]: Failed to initialize navbar dynamically', err);
  }
}
