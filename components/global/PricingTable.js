// components/global/PricingTable.js
export class PricingTable extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || 'Enterprise Access';
    const price = this.getAttribute('price') || '$27';
    const period = this.getAttribute('period') || '/month';
    const desc = this.getAttribute('description') || 'Unrestricted backoffice tools, automated pipelines & visual editors.';

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const sanitizedTitle = escapeHTML(title);
    const sanitizedPrice = escapeHTML(price);
    const sanitizedPeriod = escapeHTML(period);
    const sanitizedDesc = escapeHTML(desc);

    this.innerHTML = `
      <div class="pricing-table" style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #bee3f8); border-radius: var(--theme-layout-border-radius, 12px); padding: 2.5rem; text-align: center; margin: 2rem auto; max-width: 450px; font-family: var(--theme-font-font-family, system-ui, sans-serif); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.05));">
        <h2 style="color: var(--theme-color-text-primary, #1a202c); margin-top: 0; font-size: 1.75rem; font-weight: var(--theme-font-heading-weight, 800);">${sanitizedTitle}</h2>
        <div style="margin: 1.5rem 0;">
          <span style="font-size: 3rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0);">${sanitizedPrice}</span>
          <span style="color: var(--theme-color-text-secondary, #718096); font-size: 1.1rem;">${sanitizedPeriod}</span>
        </div>
        <p style="color: var(--theme-color-text-secondary, #4a5568); margin-bottom: 1.5rem; line-height: 1.5; font-size: 0.95rem;">${sanitizedDesc}</p>
        <button class="btn-primary" style="padding: 12px 30px; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: var(--theme-layout-border-radius, 6px); font-weight: bold; cursor: pointer; font-size: 1rem; width: 100%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">Get Started</button>
      </div>
    `;
  }
}

if (!customElements.get('pricing-table')) {
  customElements.define('pricing-table', PricingTable);
}
