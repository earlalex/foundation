// components/global/AdSenseUnit.js
import { store } from '../../core/store.js';

export class AdSenseUnit extends HTMLElement {
  static get observedAttributes() {
    return ['client-id', 'slot-id', 'format', 'responsive'];
  }

  constructor() {
    super();
    this.clientId = "";
    this.slotId = "";
    this.format = "auto";
    this.responsive = "true";
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'client-id') this.clientId = newValue;
    if (name === 'slot-id') this.slotId = newValue;
    if (name === 'format') this.format = newValue;
    if (name === 'responsive') this.responsive = newValue;
    this.render();
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id') || this.clientId;
    this.slotId = this.getAttribute('slot-id') || this.slotId;
    this.format = this.getAttribute('format') || this.format;
    this.responsive = this.getAttribute('responsive') || this.responsive;

    // React to store changes to suppress/render ads dynamically
    this.unsubscribe = store.subscribe(() => {
      this.render();
    });

    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  shouldRenderAd() {
    const user = store.state.user;
    const simulatedTier = store.state.simulatedUserTier;
    const userRole = simulatedTier || user?.role || 'prospect';

    // Member and Admin Paid Ad-free experience guard
    const isPaidMember = userRole === 'member' || userRole === 'affiliate' || userRole === 'admin' || (user?.isAdmin && !simulatedTier);
    if (isPaidMember) {
      return false;
    }
    return true;
  }

  render() {
    if (!this.shouldRenderAd()) {
      // Suppress ad rendering gracefully for premium members/admins
      this.innerHTML = `
        <div class="adsense-member-safeguard" style="display: none !important;">Ad suppressed for premium members.</div>
      `;
      return;
    }

    if (!this.clientId || !this.slotId) {
      // Render simulated preview in local dev, or placeholder if publisher ID is missing
      this.innerHTML = `
        <div class="adsense-placeholder-preview" style="
          background: #edf2f7;
          border: 1px dashed #cbd5e0;
          border-radius: var(--theme-layout-border-radius, 8px);
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: center;
          font-family: system-ui, sans-serif;
          color: #718096;
        ">
          <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; color: #4a5568; margin-bottom: 0.5rem;">Sponsored Advertisement</div>
          <div style="font-size: 0.95rem; font-weight: bold; color: #2d3748;">AdSense Ad Slot: ${this.slotId || 'Simulated Unit'}</div>
          <div style="font-size: 0.75rem; color: #718096; margin-top: 4px;">Google AdSense will render live ads here for guest and free visitors. (Format: ${this.format})</div>
        </div>
      `;
      return;
    }

    // Securely inject script tag and live ins elements
    this.innerHTML = `
      <div class="adsense-unit-wrapper" style="margin: 1.5rem 0; text-align: center; overflow: hidden; width: 100%;">
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="${this.clientId}"
             data-ad-slot="${this.slotId}"
             data-ad-format="${this.format}"
             data-full-width-responsive="${this.responsive}"></ins>
      </div>
    `;

    this.loadAdSenseScript();
  }

  loadAdSenseScript() {
    if (window.__adsense_script_loaded__) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.warn("[AdSenseUnit]: AdSense script push skipped or retry blocked.", e);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.clientId}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      window.__adsense_script_loaded__ = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.warn("[AdSenseUnit]: AdSense script push skipped.", e);
      }
    };
    document.head.appendChild(script);
  }
}

if (!customElements.get('adsense-unit')) {
  customElements.define('adsense-unit', AdSenseUnit);
}
