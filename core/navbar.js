// core/navbar.js
import { store } from './store.js';

export function initNavbar() {
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (!navToggle || !navMenu) return;

  // 1. Toggle mobile hamburger drawer
  navToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // 2. Close mobile menu on link click
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // 3. Highlight current active route
  function updateActiveLink(currentPath) {
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === currentPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // 4. Auth Guard: Show/Hide Admin Link in Navbar
  function syncAdminLinkVisibility(state) {
    const adminLink = document.getElementById('nav-admin-link');
    if (adminLink) {
      adminLink.style.display = state.user?.isAdmin ? 'inline-block' : 'none';
    }
  }

  // Listen for router page changes
  document.addEventListener('pageLoaded', (e) => {
    const currentPath = e.detail?.path || window.location.pathname;
    updateActiveLink(currentPath);
  });

  // Reactive subscription to state updates (e.g. login/logout)
  store.subscribe((state) => {
    syncAdminLinkVisibility(state);
  });

  // Initial setup
  updateActiveLink(window.location.pathname);
  syncAdminLinkVisibility(store.state);
}