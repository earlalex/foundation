// utils/lazyLoader.js - IntersectionObserver-based Lazy Loader for Images, Iframes, and heavy widgets

/**
 * LazyLoader handles native & fallback viewport lazy loading and media prefetching.
 */
class LazyLoader {
  #observer;

  constructor() {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.#observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target;

            // Handle image/iframe loading
            if (target.dataset.src) {
              target.src = target.dataset.src;
              target.removeAttribute('data-src');
            }

            // Handle deferred component rendering / placeholder replacements
            if (typeof target.lazyRender === 'function') {
              target.lazyRender();
            }

            this.#observer.unobserve(target);
          }
        });
      }, {
        rootMargin: '200px 0px' // Prefetch media 200px before they scroll into viewport
      });
    }
  }

  /**
   * Observe an element for lazy loading
   * @param {HTMLElement} element - DOM element to monitor
   */
  observe(element) {
    if (this.#observer && element) {
      this.#observer.observe(element);
    } else if (element) {
      // Fallback if IntersectionObserver is unsupported: load/render immediately
      if (element.dataset.src) {
        element.src = element.dataset.src;
        element.removeAttribute('data-src');
      }
      if (typeof element.lazyRender === 'function') {
        element.lazyRender();
      }
    }
  }

  /**
   * Applies lazy loading decorations on container children
   * @param {HTMLElement} parent - Container element
   */
  scan(parent = document.body) {
    // Media elements (images & iframes)
    const media = parent.querySelectorAll('img[data-src], iframe[data-src]');
    media.forEach((el) => {
      // Enforce native lazy loading hint
      el.setAttribute('loading', 'lazy');
      this.observe(el);
    });

    // Below-the-fold heavy containers/widgets
    const placeholders = parent.querySelectorAll('.lazy-widget-placeholder');
    placeholders.forEach((el) => {
      this.observe(el);
    });
  }
}

export const lazyLoader = new LazyLoader();
