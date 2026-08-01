// utils/observer.js
// Zero-dependency Scroll Reveal Intersection Observer Utility

export function initScrollReveal() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-up');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -20px 0px'
  });

  const targets = document.querySelectorAll('.card, section, .reveal-on-scroll, content-card, hero-banner');
  targets.forEach(el => {
    if (!el.classList.contains('fade-in-up')) {
      el.classList.add('reveal-on-scroll');
      observer.observe(el);
    }
  });
}
