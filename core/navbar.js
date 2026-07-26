// core/navbar.js
import { store } from './store.js';
import { configManager } from './config.js';

export function initNavbar() {
  const headerContainer = document.getElementById('global-header');
  if (!headerContainer) return;

  const siteTitle = configManager.current.siteTitle || 'Foundation';

  headerContainer.innerHTML = `
    <nav style="background: var(--theme-color-surface, #ffffff); border-bottom: 1px solid var(--theme-color-border, #e2e8f0); padding: 0.75rem 1.5rem; font-family: system-ui, sans-serif;">
      <div style="max-width: var(--theme-layout-container-max-width, 1000px); margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
        <!-- Brand / Identity -->
        <a href="/home" style="text-decoration: none; font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); display: flex; align-items: center; gap: 0.5rem;">
          ${configManager.current.siteLogo?.src ? `<img src="${configManager.current.siteLogo.src}" alt="${siteTitle}" style="height: 28px; width: auto;" />` : ''}
          <span>${siteTitle}</span>
        </a>

        <!-- Navigation Links -->
        <div id="nav-menu" style="display: flex; gap: 1.25rem; align-items: center;">
          <a href="/home" class="nav-link" data-path="/home" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">Home</a>
          <a href="/about" class="nav-link" data-path="/about" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">About</a>
          <a href="/events" class="nav-link" data-path="/events" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">Events</a>
          <a href="/contact" class="nav-link" data-path="/contact" style="color: var(--theme-color-text-secondary, #4a5568); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">Contact</a>
          <a href="/admin" id="nav-admin-link" class="nav-link" data-path="/admin" style="display: none; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; font-size: 0.9rem; background: #ebf8ff; padding: 4px 10px; border-radius: 4px;">
            Command Center
          </a>
        </div>
      </div>
    </nav>
  `;

  function updateActiveLink(currentPath) {
    const navLinks = document.querySelectorAll('.nav-link');
    const activeRoute = (currentPath === '/' || currentPath === '') ? '/home' : currentPath;

    navLinks.forEach((link) => {
      const linkPath = link.getAttribute('data-path') || link.getAttribute('href');
      
      if (activeRoute.startsWith(linkPath)) {
        link.style.color = 'var(--theme-color-primary, #2b6cb0)';
        link.style.borderBottom = '2px solid var(--theme-color-primary, #2b6cb0)';
        link.style.fontWeight = 'bold';
      } else {
        link.style.color = 'var(--theme-color-text-secondary, #4a5568)';
        link.style.borderBottom = 'none';
        link.style.fontWeight = '600';
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
  });

  store.subscribe((state) => {
    syncAdminLinkVisibility(state);
  });

  updateActiveLink(window.location.pathname);
  syncAdminLinkVisibility(store.state);
}