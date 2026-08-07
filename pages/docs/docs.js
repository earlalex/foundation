// pages/docs/docs.js
import { logger } from '../../core/logger.js';

/**
 * Initializes the Platform Documentation & Setup Guide page controller.
 * Sets up smooth scrolling behavior for sidebar navigation links, deep-link hash
 * navigation, and active section tracking via IntersectionObserver.
 * 
 * @returns {Function} Cleanup/destructor function called on route transitions.
 */
export function initDocsPage() {
  logger.info('[Docs Controller]: Initializing documentation hub...');

  const sidebarLinks = document.querySelectorAll('.docs-nav-link, .docs-nav-item');
  const sections = document.querySelectorAll('.docs-content section');

  if (!sidebarLinks.length || !sections.length) {
    logger.warn('[Docs Controller]: Sidebar links or content sections not found in DOM.');
    return () => {};
  }

  // Active styling constants matching design system tokens
  const activeBorderColor = 'var(--theme-color-primary, #2b6cb0)';
  const activeBgColor = 'var(--theme-color-surface-alt, #f8fafc)';
  const defaultColor = 'var(--theme-color-text-primary, #1a202c)';
  const activeColor = 'var(--theme-color-primary, #2b6cb0)';

  // Helper to reset and apply active styles on sidebar items
  function setActiveLink(targetHref) {
    sidebarLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === targetHref) {
        link.style.borderLeftColor = activeBorderColor;
        link.style.backgroundColor = activeBgColor;
        link.style.color = activeColor;
        link.setAttribute('aria-current', 'location');
      } else {
        link.style.borderLeftColor = 'transparent';
        link.style.backgroundColor = 'transparent';
        link.style.color = defaultColor;
        link.removeAttribute('aria-current');
      }
    });
  }

  // Active section tracking via IntersectionObserver
  let observer = null;
  try {
    const observerOptions = {
      root: null, // relative to document viewport
      rootMargin: '-10% 0px -70% 0px', // focused top-middle window slice
      threshold: 0
    };

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          if (id) {
            setActiveLink(`#${id}`);
          }
        }
      });
    }, observerOptions);

    sections.forEach((section) => observer.observe(section));
  } catch (err) {
    logger.warn('[Docs Controller]: IntersectionObserver initialization failed:', err);
  }

  // Smooth-scroll click handlers for sidebar links
  sidebarLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      const targetElement = document.querySelector(href);
      if (targetElement) {
        // Update hash in address bar without full page refresh
        window.history.pushState(null, '', href);

        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        setActiveLink(href);
      }
    });
  });

  // Check and handle deep-link hash fragment on initial page load
  const handleInitialHash = () => {
    const hash = window.location.hash;
    if (hash) {
      const targetElement = document.querySelector(hash);
      if (targetElement) {
        logger.info(`[Docs Controller]: Initial deep-link hash detected: ${hash}. Scrolling...`);
        setTimeout(() => {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          setActiveLink(hash);
        }, 200);
      }
    } else if (sidebarLinks.length > 0) {
      // Default to first section link if no hash exists
      const firstHref = sidebarLinks[0].getAttribute('href');
      if (firstHref) setActiveLink(firstHref);
    }
  };

  handleInitialHash();

  // Return destructor cleanup function to disconnect observers on view navigation
  return () => {
    logger.info('[Docs Controller]: Cleaning up documentation lifecycle hooks...');
    if (observer) {
      observer.disconnect();
    }
  };
}