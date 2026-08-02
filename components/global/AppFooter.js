// components/global/AppFooter.js - Custom Web Component for Global Website Footer
import { configManager } from '../../core/config.js';
import { FRAMEWORK_AFFILIATES } from '../../core/affiliates.js';

export class AppFooter extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const currentYear = new Date().getFullYear();
    const siteTitle = configManager.current?.siteTitle || 'Foundation';
    const siteTagline = configManager.current?.siteTagline || 'A custom zero-build web framework for modern serverless architectures.';
    const footerCfg = configManager.current?.footer || {};

    const cloudflareUrl = FRAMEWORK_AFFILIATES.cloudflare?.url || 'https://pages.cloudflare.com/';
    const stripeUrl = FRAMEWORK_AFFILIATES.stripe?.url || 'https://stripe.com/';
    const googleUrl = FRAMEWORK_AFFILIATES.googleWorkspace?.url || 'https://workspace.google.com/';

    this.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          background-color: var(--theme-color-surface, #ffffff);
          border-top: 1px solid var(--theme-color-border, #e2e8f0);
          color: var(--theme-color-text-primary, #1a202c);
          font-family: var(--theme-font-body, system-ui, sans-serif);
        }
        .footer-inner-shell {
          max-width: var(--theme-layout-container-max-width, 1200px);
          margin: 0 auto;
          padding: 3rem 1.5rem 1.5rem 1.5rem;
        }
        .footer-columns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 2rem;
          margin-bottom: 2.5rem;
        }
        .footer-col {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .footer-col-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--theme-color-text-primary, #1a202c);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .footer-brand-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--theme-color-primary, #2b6cb0);
          margin: 0;
        }
        .footer-text {
          font-size: 0.875rem;
          color: var(--theme-color-text-secondary, #4a5568);
          line-height: 1.5;
          margin: 0;
        }
        .footer-links-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .footer-links-list a {
          color: var(--theme-color-text-secondary, #4a5568);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          transition: color 0.15s ease-in-out;
        }
        .footer-links-list a:hover {
          color: var(--theme-color-primary, #2b6cb0);
        }
        .social-links-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .social-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--theme-color-border, #e2e8f0);
          color: var(--theme-color-text-secondary, #4a5568);
          text-decoration: none;
          transition: all 0.2s ease-in-out;
        }
        .social-icon-btn:hover {
          background-color: var(--theme-color-primary, #2b6cb0);
          color: #ffffff;
          border-color: var(--theme-color-primary, #2b6cb0);
        }
        .social-icon-btn svg {
          width: 18px;
          height: 18px;
          fill: currentColor;
        }
        .footer-bottom-bar {
          border-top: 1px solid var(--theme-color-border, #edf2f7);
          padding-top: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          font-size: 0.8rem;
          color: var(--theme-color-text-secondary, #718096);
        }
        .powered-by-link {
          color: var(--theme-color-text-primary, #2d3748);
          text-decoration: underline;
          font-weight: 600;
        }
        .powered-by-link:hover {
          color: var(--theme-color-primary, #2b6cb0);
        }
      </style>

      <div class="footer-inner-shell">
        <div class="footer-columns-grid">
          <!-- Column 1: Brand & Identity -->
          <div class="footer-col">
            <h4 class="footer-brand-title">${siteTitle}</h4>
            <p class="footer-text">${siteTagline}</p>
          </div>

          <!-- Column 2: Legal & Policies -->
          <div class="footer-col">
            <h5 class="footer-col-title">Legal & Policies</h5>
            <ul class="footer-links-list">
              <li><a href="${footerCfg.termsUrl || '/terms'}" data-link>Terms of Use</a></li>
              <li><a href="${footerCfg.privacyUrl || '/privacy'}" data-link>Privacy Policy</a></li>
              <li><a href="${footerCfg.cookiesUrl || '/cookies'}" data-link>Cookie Settings</a></li>
            </ul>
          </div>

          <!-- Column 3: Newsletter Subscription -->
          <div class="footer-col">
            <h5 class="footer-col-title">Newsletter</h5>
            <p class="footer-text">Subscribe to our newsletter for exclusive updates.</p>
            <form id="footer-newsletter-form" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem;">
              <div style="display: flex; gap: 0.25rem;">
                <input 
                  type="email" 
                  id="footer-newsletter-email" 
                  placeholder="Your Email Address" 
                  required 
                  style="flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 6px); font-size: 0.85rem; color: var(--theme-color-text-primary, #1a202c);" 
                />
                <button 
                  type="submit" 
                  id="btn-footer-newsletter-submit" 
                  disabled 
                  style="padding: 10px 16px; background: var(--theme-color-primary, #2b6cb0); color: #ffffff; border: none; border-radius: var(--theme-layout-border-radius, 6px); font-weight: bold; font-size: 0.85rem; cursor: not-allowed; opacity: 0.5; transition: all 0.2s;"
                >
                  Subscribe
                </button>
              </div>
              <label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.75rem; cursor: pointer; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.3;">
                <input type="checkbox" id="footer-newsletter-consent" style="margin-top: 2px;" />
                <span>I agree to receive email communications and accept the privacy policy.</span>
              </label>
            </form>
          </div>

          <!-- Column 4: Social Media Links -->
          <div class="footer-col">
            <h5 class="footer-col-title">Follow Us</h5>
            <div class="social-links-row">
              <a href="https://x.com" target="_blank" class="social-icon-btn" aria-label="Twitter/X">
                <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 7.75 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.285L1.254 2.25h6.81l4.7 6.223zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://linkedin.com" target="_blank" class="social-icon-btn" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
              </a>
              <a href="https://youtube.com" target="_blank" class="social-icon-btn" aria-label="YouTube">
                <svg viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <a href="https://github.com" target="_blank" class="social-icon-btn" aria-label="GitHub">
                <svg viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.7 1.07 3.35.82.1-.65.35-1.07.63-1.32-2.2-.25-4.52-1.1-4.52-4.9 0-1.08.38-1.96 1-2.65-.1-.25-.43-1.26.1-2.6 0 0 .8-.25 2.65.98a9 9 0 0 1 4.7 0c1.85-1.23 2.65-.98 2.65-.98.54 1.34.2 2.35.1 2.6.64.69 1 1.57 1 2.65 0 3.8-2.3 4.65-4.5 4.9.35.3.68.9.68 1.83V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
              </a>
              <a href="https://facebook.com" target="_blank" class="social-icon-btn" aria-label="Facebook">
                <svg viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg>
              </a>
              <a href="https://instagram.com" target="_blank" class="social-icon-btn" aria-label="Instagram">
                <svg viewBox="0 0 24 24"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6m11.15 1.75a1.15 1.15 0 1 1-1.15 1.15 1.15 1.15 0 0 1 1.15-1.15M12 7a5 5 0 1 1-5 5 5 5 0 0 1 5-5m0 2a3 3 0 1 0 3 3 3 3 0 0 0-3-3z"/></svg>
              </a>
            </div>
          </div>
        </div>

        <!-- Bottom Bar with 3rd Party Partner Attributions -->
        <div class="footer-bottom-bar">
          <div>
            &copy; ${currentYear} ${siteTitle}. All rights reserved.
          </div>
          <div>
            Powered by 
            <a href="${cloudflareUrl}" target="_blank" rel="noopener noreferrer" class="powered-by-link">Cloudflare Pages & Workers</a>, 
            <a href="${stripeUrl}" target="_blank" rel="noopener noreferrer" class="powered-by-link">Stripe</a>, and 
            <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" class="powered-by-link">Google Workspace</a>.
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const consentCheckbox = this.querySelector('#footer-newsletter-consent');
    const submitBtn = this.querySelector('#btn-footer-newsletter-submit');
    const form = this.querySelector('#footer-newsletter-form');

    if (consentCheckbox && submitBtn) {
      consentCheckbox.addEventListener('change', (e) => {
        submitBtn.disabled = !e.target.checked;
        if (e.target.checked) {
          submitBtn.style.cursor = 'pointer';
          submitBtn.style.opacity = '1';
        } else {
          submitBtn.style.cursor = 'not-allowed';
          submitBtn.style.opacity = '0.5';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = this.querySelector('#footer-newsletter-email');
        if (!emailInput) return;
        const email = emailInput.value.trim();
        if (!email) return;

        try {
          const { toast } = await import('../../utils/toast.js');
          toast.success(`Successfully subscribed ${email} to our newsletter!`);
          form.reset();
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.style.opacity = '0.5';
          }
        } catch (err) {
          console.error('[AppFooter]: Newsletter subscription failed:', err);
        }
      });
    }
  }
}

if (!customElements.get('app-footer')) {
  customElements.define('app-footer', AppFooter);
}