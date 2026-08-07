// pages/docs/docs.js
export async function initDocsPage() {
  console.log('[Docs Page]: Initializing deep-linking scroll handling and sidebar highlights...');

  const navItems = document.querySelectorAll('.docs-nav-item');
  const sections = [
    { id: 'media-suite', headerId: 'media-suite' },
    { id: 'royalties', headerId: 'royalties' },
    { id: 'crypto-payments', headerId: 'crypto-payments' },
    { id: 'architecture', headerId: 'architecture' },
    { id: 'setup-wizard', headerId: 'setup-wizard' }
  ];

  // Helper to clear and apply active styles on sidebar items
  const highlightSidebarItem = (targetId) => {
    navItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href === `#${targetId}`) {
        item.style.background = 'var(--theme-color-primary, #2b6cb0)';
        item.style.color = '#ffffff';
      } else {
        item.style.background = 'transparent';
        item.style.color = 'var(--theme-color-text-secondary, #4a5568)';
      }
    });
  };

  // Set up click listeners for smooth sidebar item scrolling
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const href = item.getAttribute('href');
      const targetId = href.substring(1);
      const targetEl = document.getElementById(targetId);

      if (targetEl) {
        // Update URL hash without causing a default browser jump
        window.history.pushState(null, '', window.location.pathname + window.location.search + href);

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        highlightSidebarItem(targetId);
      }
    });
  });

  // Handle initial page load scroll and highlight from URL hash fragment
  const handleInitialHash = () => {
    const hash = window.location.hash;
    if (hash) {
      const targetId = hash.substring(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        console.log(`[Docs Page]: Initial deep-link detected for hash: ${hash}. Scrolling...`);
        // Slight timeout to let DOM fully mount and compute positions
        setTimeout(() => {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          highlightSidebarItem(targetId);
        }, 150);
      }
    } else {
      // Default highlight first item if no hash exists
      highlightSidebarItem('media-suite');
    }
  };

  handleInitialHash();

  // Create an intersection observer to dynamically highlight sidebar items on scroll
  try {
    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          highlightSidebarItem(id);
        }
      });
    }, observerOptions);

    sections.forEach(sec => {
      const el = document.getElementById(sec.headerId);
      if (el) {
        observer.observe(el);
      }
    });
  } catch (err) {
    console.warn('[Docs Page]: IntersectionObserver failed to initialize, falling back.', err);
  }
}
