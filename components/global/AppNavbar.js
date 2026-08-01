// components/global/AppNavbar.js
import { store } from '../../core/store.js';
import { configManager } from '../../core/config.js';

export class AppNavbar extends HTMLElement {
  connectedCallback() {
    this.render();
    this.unsubscribe = store.subscribe(() => {
      this.render();
    });
  }

  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const siteTitle = configManager.current.siteTitle || 'Foundation';
    const navigation = configManager.current.navigation || [];
    const state = store.state;
    const currentRole = state.simulatedUserTier || state.user?.role || 'prospect';
    const isBypass = state.user?.isAdmin || window.__FOUNDATION_DEV_BYPASS__;

    this.innerHTML = `
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
      <nav aria-label="Main Navigation" style="background: var(--theme-color-surface, #ffffff); border-bottom: 1px solid var(--theme-color-border, #e2e8f0); padding: 0.75rem 1.5rem; font-family: system-ui, sans-serif; position: relative; z-index: 9999;">
        <div class="nav-container">
          <!-- Brand / Identity -->
          <a href="/home" style="text-decoration: none; font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); display: flex; align-items: center; gap: 0.5rem;">
            ${configManager.current.siteLogo?.src ? `<img src="${configManager.current.siteLogo.src}" alt="${siteTitle}" width="28" height="28" loading="lazy" style="height: 28px; width: auto;" />` : ''}
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
            ${navigation.map(item => {
              let displayLink = false;
              const reqRole = item.requiredRole || 'public';
              if (reqRole === 'public') {
                displayLink = true;
              } else if (reqRole === 'subscriber') {
                displayLink = !!state.user;
              } else if (reqRole === 'member') {
                displayLink = ['member', 'affiliate', 'admin'].includes(currentRole) || isBypass;
              } else if (reqRole === 'admin') {
                displayLink = currentRole === 'admin' || isBypass;
              }

              if (!displayLink) return '';

              return `
                <a href="${item.url}" target="${item.target || '_self'}" class="nav-link dynamic-nav-link" data-path="${item.url}" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">${item.label}</a>
              `;
            }).join('')}

            <a href="/admin" id="nav-admin-link" class="nav-link" data-path="/admin" style="display: ${currentRole === 'admin' || currentRole === 'editor' || isBypass ? 'inline-block' : 'none'}; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; font-size: 0.9rem; background: #ebf8ff; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">
              Command Center
            </a>

            <a href="${state.user ? '/account' : '/login'}" id="nav-auth-link" class="nav-link" data-path="${state.user ? '/account' : '/login'}" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; font-size: 0.9rem; background: #edf2f7; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">
              ${state.user ? 'My Dashboard' : 'Sign In / Register'}
            </a>
          </div>
        </div>
      </nav>
    `;

    // Re-bind listeners
    const hamburgerBtn = this.querySelector('#nav-hamburger-btn');
    const navMenu = this.querySelector('#nav-menu');
    if (hamburgerBtn && navMenu) {
      hamburgerBtn.addEventListener('click', () => {
        navMenu.classList.toggle('mobile-open');
      });
    }

    const authLink = this.querySelector('#nav-auth-link');
    if (authLink && !state.user) {
      authLink.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const { authManager } = await import('../../core/auth.js');
          await authManager.loginWithGoogle();
        } catch (err) {
          console.error('[AppNavbar Auth]: Google login failed:', err);
        }
      });
    }

    // Active path styling
    this.updateActiveLink();
  }

  updateActiveLink() {
    const navLinks = this.querySelectorAll('.nav-link');
    let activeRoute = window.location.pathname;
    const basePath = window.router?.basePath || '/';
    if (basePath !== '/' && activeRoute.startsWith(basePath.slice(0, -1))) {
      activeRoute = activeRoute.slice(basePath.length - 1);
    }
    if (!activeRoute.startsWith('/')) {
      activeRoute = '/' + activeRoute;
    }
    if (activeRoute.endsWith('/index.html')) {
      activeRoute = activeRoute.replace(/\/index\.html$/, '');
    }
    while (activeRoute.length > 1 && activeRoute.endsWith('/')) {
      activeRoute = activeRoute.slice(0, -1);
    }
    if (activeRoute === '/' || activeRoute === '') {
      activeRoute = '/home';
    }

    navLinks.forEach((link) => {
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
}

if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', AppNavbar);
}
