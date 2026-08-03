// components/global/FeatureGrid.js
export class FeatureGrid extends HTMLElement {
  connectedCallback() {
    const title1 = this.getAttribute('title-1') || 'Strategy Pillar';
    const desc1 = this.getAttribute('desc-1') || 'Our framework delivers end-to-end operational visibility with secure localized data caches.';
    const title2 = this.getAttribute('title-2') || 'Execution Pillar';
    const desc2 = this.getAttribute('desc-2') || 'Automate and scale workflows instantly, decoupled from browser SDK limits.';

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const sanitizedTitle1 = escapeHTML(title1);
    const sanitizedDesc1 = escapeHTML(desc1);
    const sanitizedTitle2 = escapeHTML(title2);
    const sanitizedDesc2 = escapeHTML(desc2);

    this.innerHTML = `
      <div class="feature-grid" style="display: flex; gap: 2rem; flex-wrap: wrap; padding: 3rem 1.5rem; background: var(--theme-color-surface, #ffffff); font-family: var(--theme-font-font-family, system-ui, sans-serif);">
        <div style="flex: 1; min-width: 250px; background: var(--theme-color-background, #f7fafc); padding: 2rem; border-radius: var(--theme-layout-border-radius, 8px); border: 1px solid var(--theme-color-border, #edf2f7); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.02));">
          <h3 style="color: var(--theme-color-primary, #2b6cb0); font-size: 1.25rem; margin-top: 0; font-weight: var(--theme-font-heading-weight, 700);">${sanitizedTitle1}</h3>
          <p style="color: var(--theme-color-text-secondary, #4a5568); line-height: 1.6; font-size: 0.95rem;">${sanitizedDesc1}</p>
        </div>
        <div style="flex: 1; min-width: 250px; background: var(--theme-color-background, #f7fafc); padding: 2rem; border-radius: var(--theme-layout-border-radius, 8px); border: 1px solid var(--theme-color-border, #edf2f7); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.02));">
          <h3 style="color: var(--theme-color-primary, #2b6cb0); font-size: 1.25rem; margin-top: 0; font-weight: var(--theme-font-heading-weight, 700);">${sanitizedTitle2}</h3>
          <p style="color: var(--theme-color-text-secondary, #4a5568); line-height: 1.6; font-size: 0.95rem;">${sanitizedDesc2}</p>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('feature-grid')) {
  customElements.define('feature-grid', FeatureGrid);
}
