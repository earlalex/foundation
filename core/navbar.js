// core/navbar.js
import { store } from './store.js';
import { configManager } from './config.js';

export function initNavbar() {
  const headerContainer = document.getElementById('global-header');
  if (!headerContainer) return;

  const siteTitle = configManager.current.siteTitle || 'Foundation';

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
          ${configManager.current.siteLogo?.src ? `<img src="${configManager.current.siteLogo.src}" alt="${siteTitle}" style="height: 28px; width: auto;" />` : ''}
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
          <a href="/home" class="nav-link" data-path="/home" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">Home</a>
          <a href="/about" class="nav-link" data-path="/about" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">About</a>
          <a href="/events" class="nav-link" data-path="/events" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">Events</a>
          <a href="/contact" class="nav-link" data-path="/contact" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">Contact</a>
          <a href="/admin" id="nav-admin-link" class="nav-link" data-path="/admin" style="display: none; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; font-size: 0.9rem; background: #ebf8ff; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">
            Command Center
          </a>
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

  function updateActiveLink(currentPath) {
    const navLinks = document.querySelectorAll('.nav-link');
    // Normalize path by stripping base path prefix and trailing slashes
    let activeRoute = currentPath || window.location.pathname;
    if (activeRoute.endsWith('/index.html')) {
      activeRoute = activeRoute.replace(/\/index\.html$/, '');
    }
    const segments = activeRoute.split('/').filter(Boolean);
    const cleanRoute = segments.length > 0 ? '/' + segments[segments.length - 1] : '/home';

    navLinks.forEach((link) => {
      const linkPath = link.getAttribute('data-path') || link.getAttribute('href');
      const isMatch = (cleanRoute === linkPath) || (cleanRoute === '/' && linkPath === '/home');

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

  function syncAdminLinkVisibility(state) {
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) {
      const isDevOrAdmin = state.user?.isAdmin || state.devMode || window.__FOUNDATION_DEV_BYPASS__;
      adminLink.style.display = isDevOrAdmin ? 'inline-block' : 'none';
    }
  }

  document.addEventListener('pageLoaded', (e) => {
    const currentPath = e.detail?.path || window.location.pathname;
    updateActiveLink(currentPath);
    // Auto-close hamburger menu on path transitions
    if (navMenu) {
      navMenu.classList.remove('mobile-open');
    }
  });

  store.subscribe((state) => {
    syncAdminLinkVisibility(state);
  });

  updateActiveLink(window.location.pathname);
  syncAdminLinkVisibility(store.state);
}