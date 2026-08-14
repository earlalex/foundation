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
        #utility-header {
          background: var(--theme-color-surface-alt, #f8fafc);
          border-bottom: 1px solid var(--theme-color-border, #e2e8f0);
          padding: 0.35rem 1.5rem;
          font-size: 0.85rem;
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          position: relative;
          z-index: 10000;
        }
        .utility-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: var(--theme-color-text-secondary, #4a5568);
        }
        .utility-right {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
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
          letter-spacing: 0.05em;
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
          #utility-header {
            display: none !important;
          }
          .mobile-utility-item {
            display: flex !important;
          }
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

      <div id="utility-header">
        <!-- Left Group -->
        <div class="utility-left">
          <span>${siteTitle}</span>
          <span style="font-size: 0.75rem; background: var(--theme-color-border, #cbd5e1); color: var(--theme-color-text-secondary, #4a5568); padding: 1px 6px; border-radius: 4px; font-weight: 500;">Network OK</span>
        </div>
        <!-- Right Group -->
        <div class="utility-right" style="display: flex; align-items: center; gap: 1rem;">
          <!-- Real-Time Notification Bell Dropdown -->
          <notification-center></notification-center>

          <!-- Accessible High-Contrast Toggle -->
          <button id="nav-high-contrast-toggle" class="nav-link" style="background: transparent; border: none; cursor: pointer; color: var(--theme-color-text-secondary, #4a5568); font-weight: 600; font-size: 0.85rem;" aria-label="Toggle High Contrast Mode">
            🌓 Contrast
          </button>

          <!-- Multi-Language Selector Dropdown -->
          <label for="nav-lang-selector" class="sr-only">Select Language</label>
          <select id="nav-lang-selector" aria-label="Select Language" style="padding: 2px 6px; border-radius: 4px; border: 1px solid var(--theme-color-border, #cbd5e0); background: var(--theme-color-surface, #ffffff); color: var(--theme-color-text-secondary, #4a5568); font-size: 0.8rem; font-weight: 600; cursor: pointer; outline: none;">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>

          <!-- My Profile / Account Link -->
          <a href="/account" id="nav-profile-link" class="nav-link" data-path="/account" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; display: none;">My Profile</a>

          <!-- Admin Dashboard Link -->
          <a href="/admin" id="nav-admin-link" class="nav-link" data-path="/admin" style="display: none; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; background: #ebf8ff; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">Admin Dashboard</a>

          <!-- Sign In / Sign Out Button -->
          <button id="nav-auth-btn" class="nav-link" style="color: var(--theme-color-primary, #2b6cb0); border: none; background: #edf2f7; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.85rem; cursor: pointer;">
            Sign In
          </button>
        </div>
      </div>

      <nav id="main-header" style="background: var(--theme-color-surface, #ffffff); border-bottom: 1px solid var(--theme-color-border, #e2e8f0); padding: 0.75rem 1.5rem; font-family: system-ui, sans-serif; position: relative; z-index: 9999;">
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
            ${((configManager.current?.navigation && configManager.current.navigation.length > 0) ? configManager.current.navigation : [
              { label: "Home", url: "/home", target: "_self", requiredRole: "public" },
              { label: "Documentation", url: "/docs", target: "_self", requiredRole: "public" },
              { label: "Shop", url: "/shop", target: "_self", requiredRole: "public" },
              { label: "Events", url: "/events", target: "_self", requiredRole: "public" },
              { label: "Gallery", url: "/gallery", target: "_self", requiredRole: "public" },
              { label: "Videos", url: "/videos", target: "_self", requiredRole: "public" },
              { label: "Education", url: "/education", target: "_self", requiredRole: "public" },
              { label: "Podcast", url: "/podcast", target: "_self", requiredRole: "public" },
              { label: "About", url: "/about", target: "_self", requiredRole: "public" },
              { label: "Contact", url: "/contact", target: "_self", requiredRole: "public" }
            ]).map(item => `
              <a href="${item.url}" target="${item.target || '_self'}" class="nav-link dynamic-nav-link" data-path="${item.url}" data-role="${item.requiredRole || 'public'}" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">${item.label}</a>
            `).join('')}

            <!-- Integrated Top Navigation Cart Button Toggle -->
            <button id="nav-cart-btn" class="nav-link" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; color: var(--theme-color-text-secondary, #4a5568); font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; position: relative; outline: none;">
              <span>🛒</span> <span class="nav-cart-text">Cart</span>
              <span id="cart-count-badge" style="background: var(--theme-color-danger, #e53e3e); color: white; font-size: 0.75rem; font-weight: bold; border-radius: 50%; min-width: 20px; height: 20px; display: none; align-items: center; justify-content: center; padding: 2px; position: absolute; top: -6px; right: -6px; transition: transform 0.15s ease-in-out;">0</span>
            </button>

            <!-- Mobile-only utility items inside the mobile drawer menu -->
            <hr class="mobile-utility-item" style="width: 100%; border: none; border-top: 1px solid var(--theme-color-border, #cbd5e1); margin: 0.5rem 0; display: none;" />
            <div class="mobile-utility-item" style="display: none; flex-direction: column; gap: 0.75rem; width: 100%;">
              <!-- My Profile / Account Link -->
              <a href="/account" id="mobile-nav-profile-link" class="nav-link" data-path="/account" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; padding: 8px 12px; border-radius: 6px; background: var(--theme-color-background, #f7fafc);">My Profile</a>

              <!-- Admin Dashboard Link -->
              <a href="/admin" id="mobile-nav-admin-link" class="nav-link" data-path="/admin" style="display: none; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; background: #ebf8ff; padding: 8px 12px; border-radius: 6px;">Admin Dashboard</a>

              <!-- Sign In / Sign Out Button -->
              <button id="mobile-nav-auth-btn" class="nav-link" style="color: var(--theme-color-primary, #2b6cb0); border: none; background: #edf2f7; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 0.9rem; cursor: pointer; text-align: left; width: 100%;">
                Sign In
              </button>

              <!-- Accessible High-Contrast Toggle -->
              <button id="mobile-nav-high-contrast-toggle" class="nav-link" style="background: transparent; border: none; cursor: pointer; color: var(--theme-color-text-secondary, #4a5568); font-weight: 600; font-size: 0.9rem; padding: 8px 12px; border-radius: 6px; background: var(--theme-color-background, #f7fafc); text-align: left;" aria-label="Toggle High Contrast Mode">
                🌓 Contrast
              </button>

              <!-- Multi-Language Selector Dropdown -->
              <div style="display: flex; align-items: center; gap: 0.5rem; padding: 8px 12px; border-radius: 6px; background: var(--theme-color-background, #f7fafc);">
                <label for="mobile-nav-lang-selector" style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0; color: var(--theme-color-text-secondary, #4a5568);">Lang:</label>
                <select id="mobile-nav-lang-selector" aria-label="Select Language" style="flex: 1; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--theme-color-border, #cbd5e0); background: var(--theme-color-surface, #ffffff); color: var(--theme-color-text-secondary, #4a5568); font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none;">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </nav>
    `;

    // Hook Hamburger Toggle
    const hamburgerBtn = document.getElementById('nav-hamburger-btn');
    const navMenu = document.getElementById('nav-menu');
    if (hamburgerBtn && navMenu) {
      hamburgerBtn.onclick = () => {
        navMenu.classList.toggle('mobile-open');
      };
    }

    // Hook Cart Toggle click to toggle cart sidebar globally
    const cartBtn = document.getElementById('nav-cart-btn');
    if (cartBtn) {
      cartBtn.onclick = () => {
        const sidebar = document.getElementById('cart-sidebar');
        if (sidebar) {
          if (sidebar.style.right === '0px') {
            sidebar.style.right = '-420px';
            document.body.classList.remove('cart-drawer-open');
          } else {
            sidebar.style.right = '0px';
            document.body.classList.add('cart-drawer-open');
          }
        } else {
          // If we are not on /events, navigate to /events and open cart on load
          window.sessionStorage.setItem('open_cart_on_load', 'true');
          window.router?.navigateTo('/events');
        }
      };
    }

    // High-contrast toggle for both desktop and mobile
    ['nav-high-contrast-toggle', 'mobile-nav-high-contrast-toggle'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.onclick = (e) => {
          e.preventDefault();
          const current = localStorage.getItem('foundation_high_contrast') === 'true';
          themeEngine.setHighContrastMode(!current);
        };
      }
    });

    // Language selector for both desktop and mobile
    ['nav-lang-selector', 'mobile-nav-lang-selector'].forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        select.value = localStorage.getItem('foundation_language') || 'en';
        select.onchange = async (e) => {
          try {
            const { i18n } = await import('../../core/i18n.js');
            await i18n.setLanguage(e.target.value);
          } catch (err) {
            console.warn('[Navbar i18n]: Translation module failed to load:', err);
          }
        };
      }
    });

    // Auth Button click handler
    ['nav-auth-btn', 'mobile-nav-auth-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const state = store.state;
          const { authManager } = await import('../../core/auth.js');
          if (state.user) {
            try {
              await authManager.logout();
            } catch (err) {
              console.error('[Navbar Auth]: Logout failed:', err);
            }
          } else {
            try {
              await authManager.loginWithGoogle();
            } catch (err) {
              console.error('[Navbar Auth]: Google login failed:', err);
            }
          }
        };
      }
    });

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
          // If it is an auth button or contrast button or lang selector, avoid border-bottom
          if (link.id === 'nav-auth-btn' || link.id === 'mobile-nav-auth-btn' || link.id === 'nav-high-contrast-toggle' || link.id === 'mobile-nav-high-contrast-toggle') {
            link.style.borderBottom = 'none';
            return;
          }
          link.style.color = 'var(--theme-color-text-secondary, #4a5568)';
          link.style.borderBottom = '2px solid transparent';
          link.style.fontWeight = '600';
          link.style.opacity = '0.85';
        }
      });
    }

    function syncNavbarVisibility(state) {
      const user = state.user;
      const currentRole = state.simulatedUserTier || user?.role || 'prospect';
      const adminEmails = configManager.current?.adminEmails || ['admin@earlalex.com'];
      const isPrimaryAdmin = currentRole === 'admin' || (user && adminEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase()) && !state.simulatedUserTier);
      const isEditor = currentRole === 'editor';
      const isDevConsoleBypass = window.__FOUNDATION_DEV_BYPASS__ === true || state.devMode === true;

      const hasAdminAccess = (isPrimaryAdmin || isEditor || isDevConsoleBypass) && currentRole !== 'subscriber' && currentRole !== 'member';
      const isBypass = state.user?.isAdmin || window.__FOUNDATION_DEV_BYPASS__;

      // Profile Link
      ['nav-profile-link', 'mobile-nav-profile-link'].forEach(id => {
        const profileLink = document.getElementById(id);
        if (profileLink) {
          profileLink.style.display = state.user ? 'inline-block' : 'none';
        }
      });

      // Admin Link
      ['nav-admin-link', 'mobile-nav-admin-link'].forEach(id => {
        const adminLink = document.getElementById(id);
        if (adminLink) {
          adminLink.style.display = hasAdminAccess ? 'inline-block' : 'none';
        }
      });

      // Auth Button text
      const authBtnElement = document.getElementById('nav-auth-btn');
      if (authBtnElement) {
        authBtnElement.textContent = state.user ? 'Sign Out' : 'Sign In';
      }
      const mobileAuthBtnElement = document.getElementById('mobile-nav-auth-btn');
      if (mobileAuthBtnElement) {
        mobileAuthBtnElement.textContent = state.user ? 'Sign Out' : 'Sign In';
      }

      const features = configManager.current.features || {};

      document.querySelectorAll('.dynamic-nav-link').forEach(link => {
        const path = link.getAttribute('data-path');
        if (path === '/videos' && features.videoPortal === false) {
          link.style.display = 'none';
          return;
        }
        if (path === '/gallery' && features.photoGallery === false) {
          link.style.display = 'none';
          return;
        }
        if (path === '/podcast' && features.webRadioPlayer === false) {
          link.style.display = 'none';
          return;
        }

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
