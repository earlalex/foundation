// utils/observer.js - Scroll-Reveal Intersection Observer

/**
 * Initializes IntersectionObserver to trigger smooth 300ms fade-in
 * and subtle 10px Y-axis slide-up transitions (.fade-in-up) as cards scroll into view.
 */
export function initScrollReveal() {
  const options = {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target); // Unobserve to trigger only once
      }
    });
  }, options);

  // Find all elements with .fade-in-up class and observe them
  const targets = document.querySelectorAll('.fade-in-up, .reveal-on-scroll');
  targets.forEach(target => {
    // Add default base class if not present
    if (!target.classList.contains('fade-in-up')) {
      target.classList.add('fade-in-up');
    }
    observer.observe(target);
  });
}
