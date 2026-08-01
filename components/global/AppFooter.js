// components/global/AppFooter.js
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';

export class AppFooter extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  async render() {
    const footerCfg = configManager.current.footer || {
      brand: { show: true, title: "Foundation", tagline: "A custom zero-build web framework." },
      legal: { show: true, heading: "Legal & Policies", links: [] },
      newsletter: { show: true, heading: "Newsletter", text: "Subscribe for exclusive updates.", consentCopy: "I agree to receive communications." },
      social: { show: true, heading: "Follow Us", links: [] }
    };

    let colsHtml = '';

    if (footerCfg.brand?.show !== false) {
      colsHtml += `
        <div class="footer-column brand-column">
          <h3 class="footer-title">${footerCfg.brand.title || 'Foundation'}</h3>
          <p class="footer-tagline">${footerCfg.brand.tagline || ''}</p>
          <span class="footer-copyright">&copy; 2026 ${footerCfg.brand.title || 'Foundation'} Framework. All rights reserved.</span>
        </div>
      `;
    }

    if (footerCfg.legal?.show !== false) {
      colsHtml += `
        <div class="footer-column links-column">
          <h4 class="footer-heading">${footerCfg.legal.heading || 'Legal & Policies'}</h4>
          <ul class="footer-links">
            ${(footerCfg.legal.links || []).map(link => `<li><a href="${link.url}" class="spa-footer-link">${link.label}</a></li>`).join('')}
          </ul>
        </div>
      `;
    }

    if (footerCfg.newsletter?.show !== false) {
      colsHtml += `
        <div class="footer-column newsletter-column">
          <h4 class="footer-heading">${footerCfg.newsletter.heading || 'Newsletter'}</h4>
          <p class="newsletter-text">${footerCfg.newsletter.text || ''}</p>
          <form id="footer-newsletter-form" class="newsletter-form">
            <input type="email" id="newsletter-email" placeholder="Your Email Address" required class="newsletter-input" />
            <button type="submit" id="newsletter-submit" class="btn-primary newsletter-btn" disabled>Subscribe</button>
            <label class="newsletter-consent">
              <input type="checkbox" id="newsletter-consent-cb" required />
              <span>${footerCfg.newsletter.consentCopy || ''}</span>
            </label>
          </form>
        </div>
      `;
    }

    if (footerCfg.social?.show !== false) {
      colsHtml += `
        <div class="footer-column social-column">
          <h4 class="footer-heading">${footerCfg.social.heading || 'Follow Us'}</h4>
          <div class="footer-social-icons">
            ${(footerCfg.social.links || []).map(link => `
              <a href="${link.url}" target="_blank" aria-label="${link.name}" class="social-icon-link" id="footer-icon-${link.name}"></a>
            `).join('')}
          </div>
        </div>
      `;
    }

    this.innerHTML = `<div class="footer-container">${colsHtml}</div>`;

    // Fetch SVG icons
    try {
      const iconSetType = configManager.current.iconSet || 'default';
      let iconData = null;

      if (iconSetType === 'default') {
        const response = await fetch('./assets/icons/default-set.json');
        if (response.ok) {
          iconData = await response.json();
        }
      } else if (iconSetType === 'custom' && configManager.current.customIconData) {
        iconData = configManager.current.customIconData;
      }

      if (iconData) {
        const iconKeys = ['twitter', 'linkedin', 'youtube', 'github', 'facebook', 'instagram'];
        iconKeys.forEach(key => {
          const el = this.querySelector(`#footer-icon-${key}`);
          if (el && iconData[key]) {
            el.innerHTML = iconData[key];
          }
        });
      }
    } catch (err) {
      console.warn('[Footer Icons]: Bypassed SVG injection.', err);
    }

    // Event listeners
    const consentCb = this.querySelector('#newsletter-consent-cb');
    const submitBtn = this.querySelector('#newsletter-submit');
    const newsletterForm = this.querySelector('#footer-newsletter-form');

    if (consentCb && submitBtn) {
      consentCb.addEventListener('change', (e) => {
        submitBtn.disabled = !e.target.checked;
      });
    }

    newsletterForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.querySelector('#newsletter-email')?.value;
      if (!email) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Subscribing...';

      try {
        const { contentDB } = await import('../../core/db.js');
        const { createGoogleContact } = await import('../../core/google-services.js');

        await contentDB.saveUser({
          email,
          role: 'subscriber',
          name: email.split('@')[0],
          newsletterSubscribed: true,
          consentDate: new Date().toISOString()
        });

        await createGoogleContact({
          name: email.split('@')[0],
          email,
          role: 'Subscriber'
        });

        toast.success('Successfully subscribed to our newsletter!');
        newsletterForm.reset();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Subscribe';
      } catch (err) {
        console.error('[Footer Newsletter]: Error', err);
        toast.error('Failed to subscribe.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Subscribe';
      }
    });

    this.querySelectorAll('.spa-footer-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        window.router?.navigateTo(href);
      });
    });
  }
}

if (!customElements.get('app-footer')) {
  customElements.define('app-footer', AppFooter);
}
