// components/global/FeatureGrid.js
export class FeatureGrid extends HTMLElement {
  connectedCallback() {
    const hasCustomPillars = this.hasAttribute('title-1') || this.hasAttribute('title-2');

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    if (hasCustomPillars) {
      // Fallback for custom configured grids
      const title1 = this.getAttribute('title-1') || 'Strategy Pillar';
      const desc1 = this.getAttribute('desc-1') || 'Our framework delivers end-to-end operational visibility with secure localized data caches.';
      const title2 = this.getAttribute('title-2') || 'Execution Pillar';
      const desc2 = this.getAttribute('desc-2') || 'Automate and scale workflows instantly, decoupled from browser SDK limits.';

      const sanitizedTitle1 = escapeHTML(title1);
      const sanitizedDesc1 = escapeHTML(desc1);
      const sanitizedTitle2 = escapeHTML(title2);
      const sanitizedDesc2 = escapeHTML(desc2);

      this.innerHTML = `
        <div class="feature-grid" style="display: flex; gap: 2rem; flex-wrap: wrap; padding: 3rem 1.5rem; background: var(--theme-color-surface, #ffffff); font-family: var(--theme-font-font-family, system-ui, sans-serif);">
          <div class="feature-card" style="flex: 1; min-width: 250px; background: var(--theme-color-background, #f7fafc); padding: 2rem; border-radius: var(--theme-layout-border-radius, 8px); border: 1px solid var(--theme-color-border, #edf2f7); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.02)); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h3 style="color: var(--theme-color-primary, #2b6cb0); font-size: 1.25rem; margin-top: 0; font-weight: var(--theme-font-heading-weight, 700);">${sanitizedTitle1}</h3>
              <p style="color: var(--theme-color-text-secondary, #4a5568); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem;">${sanitizedDesc1}</p>
            </div>
            <a href="/docs#architecture" class="learn-more-link" data-link style="font-weight: bold; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.25rem; margin-top: auto;">
              Learn More <span aria-hidden="true">→</span>
            </a>
          </div>
          <div class="feature-card" style="flex: 1; min-width: 250px; background: var(--theme-color-background, #f7fafc); padding: 2rem; border-radius: var(--theme-layout-border-radius, 8px); border: 1px solid var(--theme-color-border, #edf2f7); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.02)); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h3 style="color: var(--theme-color-primary, #2b6cb0); font-size: 1.25rem; margin-top: 0; font-weight: var(--theme-font-heading-weight, 700);">${sanitizedTitle2}</h3>
              <p style="color: var(--theme-color-text-secondary, #4a5568); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem;">${sanitizedDesc2}</p>
            </div>
            <a href="/docs#architecture" class="learn-more-link" data-link style="font-weight: bold; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.25rem; margin-top: auto;">
              Learn More <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      `;
    } else {
      // 5 Core Feature Cards for Platform
      const features = [
        {
          title: 'Dynamic Publishing & Content',
          desc: 'Client-side markdown publishing, custom podcast feeds, and edge caching strategies.',
          link: '/docs#media-suite',
          icon: '✍️'
        },
        {
          title: 'E-Commerce & Royalty Splits',
          desc: 'Flexible splits engine for digital and physical items with real-time currency/crypto conversions.',
          link: '/docs#royalties',
          icon: '📊'
        },
        {
          title: 'Web3 & Crypto Payments',
          desc: 'EVM & Solana browser wallet connections, stablecoin settlements, and custom Stripe integration.',
          link: '/docs#crypto-payments',
          icon: '💳'
        },
        {
          title: 'Zero-Build Architecture & Caching',
          desc: 'Optimized SPA router with static preloads, custom service worker caching, and SEO optimization.',
          link: '/docs#architecture',
          icon: '⚡'
        },
        {
          title: 'Master Onboarding & Setup',
          desc: 'Platform master configuration, Google workspace auto-provisioning, and Wise integration.',
          link: '/docs#setup-wizard',
          icon: '⚙️'
        }
      ];

      this.innerHTML = `
        <div class="feature-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; padding: 3rem 1.5rem; background: var(--theme-color-surface, #ffffff); font-family: var(--theme-font-font-family, system-ui, sans-serif);">
          ${features.map(f => `
            <div class="feature-card" style="background: var(--theme-color-surface-alt, #f8fafc); padding: 2rem; border-radius: var(--theme-layout-border-radius, 8px); border: 1px solid var(--theme-color-border, #e2e8f0); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.02)); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s;">
              <div>
                <div style="font-size: 2rem; margin-bottom: 1rem; color: var(--theme-color-primary, #2b6cb0);">${f.icon}</div>
                <h3 style="color: var(--theme-color-text-primary, #1a202c); font-size: 1.2rem; margin-top: 0; margin-bottom: 0.75rem; font-weight: var(--theme-font-heading-weight, 700);">${escapeHTML(f.title)}</h3>
                <p style="color: var(--theme-color-text-secondary, #4a5568); line-height: 1.6; font-size: 0.9rem; margin-bottom: 1.5rem; text-align: left !important;">${escapeHTML(f.desc)}</p>
              </div>
              <a href="${f.link}" class="learn-more-link" data-link style="font-weight: bold; color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.25rem; margin-top: auto;">
                Learn More <span aria-hidden="true">→</span>
              </a>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Bind SPA routing for all learn-more links in FeatureGrid
    this.querySelectorAll('.learn-more-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const href = link.getAttribute('href');
        window.router?.navigateTo(href);
      });
    });
  }
}

if (!customElements.get('feature-grid')) {
  customElements.define('feature-grid', FeatureGrid);
}
