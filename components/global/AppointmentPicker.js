// components/global/AppointmentPicker.js
export class AppointmentPicker extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <section class="appointment-picker-widget" style="padding: var(--theme-spacing-24, 24px); background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: var(--theme-layout-border-radius, 8px); box-shadow: var(--theme-layout-box-shadow, 0 4px 6px rgba(0,0,0,0.05)); margin: var(--theme-spacing-24, 24px) 0;">
        <h2 style="font-size: clamp(1.4rem, 3vw, 1.85rem); color: var(--theme-color-primary, #2b6cb0); font-weight: var(--theme-font-heading-weight, 800); margin-bottom: var(--theme-spacing-12, 12px); text-align: left;">Schedule a Consultation</h2>
        <p style="color: var(--theme-color-text-secondary, #4a5568); font-size: 0.95rem; margin-bottom: var(--theme-spacing-20, 20px); line-height: 1.5; text-align: left;">Pick an available date and time slot from our real-time calendar to book your session instantly.</p>
        <div style="display: flex; justify-content: center; margin-bottom: var(--theme-spacing-16, 16px);">
          <a href="/contact" class="btn-primary" style="background: var(--theme-color-primary, #2b6cb0); color: #ffffff; padding: 12px 28px; border-radius: var(--theme-layout-border-radius, 6px); font-weight: bold; text-decoration: none; display: inline-block;">Open Scheduling Calendar</a>
        </div>
      </section>
    `;
  }
}

if (!customElements.get('appointment-picker')) {
  customElements.define('appointment-picker', AppointmentPicker);
}
