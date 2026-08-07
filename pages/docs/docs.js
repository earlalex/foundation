// pages/docs/docs.js
import { logger } from '../../core/logger.js';

/**
 * Initializes the Platform Documentation & Setup Guide page controller.
 * Sets up smooth scrolling behavior for the sidebar navigation links and active
 * section tracking via an IntersectionObserver.
 */
export function initDocsPage() {
  logger.info('[Docs Controller]: Initializing documentation hub...');

  const sidebarLinks = document.querySelectorAll('.docs-nav-link');
  const sections = document.querySelectorAll('.docs-content section');

  if (!sidebarLinks.length || !sections.length) {
    logger.warn('[Docs Controller]: Sidebar links or content sections not found in DOM.');
    return;
  }

  // Define active styling constants matching the design system
  const activeBorderColor = 'var(--theme-color-primary, #2b6cb0)';
  const activeBgColor = 'var(--theme-color-background, #f7fafc)';
  const defaultColor = 'var(--theme-color-text-primary, #1a202c)';
  const activeColor = 'var(--theme-color-primary, #2b6cb0)';

  // Reset helper for all links
  function resetAllLinks() {
    sidebarLinks.forEach(link => {
      link.style.borderLeftColor = 'transparent';
      link.style.backgroundColor = 'transparent';
      link.style.color = defaultColor;
      link.removeAttribute('aria-current');
    });
  }

  // Active section tracking via IntersectionObserver
  const observerOptions = {
    root: null, // relative to document viewport
    rootMargin: '-10% 0px -70% 0px', // focused top-middle window slice
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        const targetLink = document.querySelector(`.docs-nav-link[href="#${id}"]`);

        if (targetLink) {
          resetAllLinks();
          targetLink.style.borderLeftColor = activeBorderColor;
          targetLink.style.backgroundColor = activeBgColor;
          targetLink.style.color = activeColor;
          targetLink.setAttribute('aria-current', 'location');
        }
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // Smooth-scroll click handlers for sidebar links to integrate cleanly with SPA router
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      const targetElement = document.querySelector(href);

      if (targetElement) {
        // Update hash in address bar without trigger page reload
        window.history.pushState(null, null, href);

        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Set active state manually on click
        resetAllLinks();
        link.style.borderLeftColor = activeBorderColor;
        link.style.backgroundColor = activeBgColor;
        link.style.color = activeColor;
        link.setAttribute('aria-current', 'location');
      }
    });
  });

  // Check if hash exists in initial load (e.g. /docs#setup-wizard)
  if (window.location.hash) {
    const hash = window.location.hash;
    const targetElement = document.querySelector(hash);
    if (targetElement) {
      setTimeout(() => {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 300);
    }
  }

  // Return destructor function to clean up observers on view transition
  return () => {
    logger.info('[Docs Controller]: Cleaning up documentation lifecycle hooks...');
    observer.disconnect();
  };
}
