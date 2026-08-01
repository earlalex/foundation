// components/global/CtaBlock.js
export class CtaBlock extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || 'Ready to Scale?';
    const subtitle = this.getAttribute('subtitle') || 'Join Foundation today and experience zero-build speed.';
    const btnText = this.getAttribute('btn-text') || 'Sign Up Now';
    const btnUrl = this.getAttribute('btn-url') || '/login';

    this.innerHTML = `
      <section class="cta-block" aria-label="${title}" style="padding: var(--theme-spacing-40, 40px) var(--theme-spacing-24, 24px); text-align: center; background: linear-gradient(135deg, var(--theme-color-primary, #2b6cb0) 0%, var(--theme-color-primary-hover, #2c5282) 100%); color: #ffffff; border-radius: var(--theme-layout-border-radius, 8px); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.05)); margin: var(--theme-spacing-24, 24px) 0;">
        <h2 style="color: #ffffff; font-size: clamp(1.4rem, 3vw, 1.85rem); font-weight: var(--theme-font-heading-weight, 800); margin-bottom: var(--theme-spacing-8, 8px); line-height: 1.2;">${title}</h2>
        <p style="color: rgba(255, 255, 255, 0.9); font-size: 1rem; max-width: 600px; margin: 0 auto var(--theme-spacing-20, 20px); line-height: 1.5;">${subtitle}</p>
        <a href="${btnUrl}" class="btn-primary" style="background: #ffffff; color: var(--theme-color-primary, #2b6cb0); border-radius: var(--theme-layout-border-radius, 6px); font-weight: bold; padding: 10px 24px; text-decoration: none; display: inline-block;">${btnText}</a>
      </section>
    `;
  }
}

if (!customElements.get('cta-block')) {
  customElements.define('cta-block', CtaBlock);
}
