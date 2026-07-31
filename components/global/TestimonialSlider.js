// components/global/TestimonialSlider.js
export class TestimonialSlider extends HTMLElement {
  connectedCallback() {
    const text = this.getAttribute('text') || '"Foundation completely accelerated our small business launch. We customized our design system, integrated payment rails, and onboarded VAs under 2 days."';
    const author = this.getAttribute('author') || 'Sarah Jenkins, Founder';

    this.innerHTML = `
      <div class="testimonial-slider" style="background: var(--theme-color-background, #f7fafc); border-radius: var(--theme-layout-border-radius, 12px); padding: 3rem 2rem; text-align: center; font-family: var(--theme-font-font-family, system-ui, sans-serif); max-width: 700px; margin: 2rem auto; border: 1px solid var(--theme-color-border, #edf2f7); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.02));">
        <div style="font-size: 2.5rem; color: var(--theme-color-primary, #2b6cb0); line-height: 1; margin-bottom: 1rem;">“</div>
        <p style="font-size: 1.2rem; font-style: italic; color: var(--theme-color-text-primary, #1a202c); line-height: 1.6; margin: 0 0 1.5rem 0;">${text}</p>
        <div style="font-weight: bold; color: var(--theme-color-primary, #2b6cb0); font-size: 0.95rem;">${author}</div>
      </div>
    `;
  }
}

if (!customElements.get('testimonial-slider')) {
  customElements.define('testimonial-slider', TestimonialSlider);
}
