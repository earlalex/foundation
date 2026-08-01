// components/global/HeroBanner.js
export class HeroBanner extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || 'Welcome to Foundation';
    const subtitle = this.getAttribute('subtitle') || 'A custom zero-build web framework';
    const ctaText = this.getAttribute('cta-text') || 'Get Started';
    const ctaUrl = this.getAttribute('cta-url') || '#';

    this.innerHTML = `
      <section class="hero-banner" aria-label="${title}" style="padding: 5rem 2rem; text-align: center; background: linear-gradient(135deg, var(--theme-color-background, #f7fafc) 0%, var(--theme-color-surface, #ffffff) 100%); font-family: var(--theme-font-font-family, system-ui, sans-serif); border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
        <h1 style="font-size: 3rem; font-weight: var(--theme-font-heading-weight, 800); margin-bottom: 1rem; color: var(--theme-color-primary, #2b6cb0); line-height: 1.2;">${title}</h1>
        <p style="font-size: 1.25rem; color: var(--theme-color-text-secondary, #4a5568); max-width: 650px; margin: 0 auto 2rem; line-height: 1.6;">${subtitle}</p>
        <a href="${ctaUrl}" class="btn-primary" style="padding: 12px 28px; background: var(--theme-color-primary, #2b6cb0); color: white; border-radius: var(--theme-layout-border-radius, 6px); text-decoration: none; font-weight: bold; display: inline-block; box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(43, 108, 176, 0.25));">${ctaText}</a>
      </section>
    `;
  }
}

if (!customElements.get('hero-banner')) {
  customElements.define('hero-banner', HeroBanner);
}
