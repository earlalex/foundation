// components/global/PriceCard.js
export class PriceCard extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || 'Pro Plan';
    const price = this.getAttribute('price') || '$29/mo';
    const description = this.getAttribute('description') || 'Unlock full learning credentials and courses.';
    const buttonText = this.getAttribute('button-text') || 'Subscribe Now';
    const productId = this.getAttribute('product-id') || 'member_subscription';

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
    const sanitizedDescription = escapeHTML(description);
    const sanitizedButtonText = escapeHTML(buttonText);
    const sanitizedProductId = escapeHTML(productId);

    this.innerHTML = `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; border-top: 4px solid var(--theme-color-primary, #1e40af);">
        <div>
          <h3 style="margin-top: 0; font-size: 1.25rem; font-weight: bold; color: var(--theme-color-text-primary, #1e293b);">${sanitizedTitle}</h3>
          <div style="font-size: 2rem; font-weight: 800; color: var(--theme-color-primary, #1e40af); margin: 0.5rem 0;">${sanitizedPrice}</div>
          <p style="font-size: 0.9rem; color: var(--theme-color-text-secondary, #475569); line-height: 1.5; margin-bottom: 1.5rem;">${sanitizedDescription}</p>
        </div>
        <button class="btn-primary" data-product="${sanitizedProductId}" style="width: 100%;">${sanitizedButtonText}</button>
      </div>
    `;

    this.querySelector('button')?.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { toast } = await import('../../utils/toast.js');
        const { store } = await import('../../core/store.js');
        const user = store.state.user;
        if (!user) {
          toast.warning('Please sign in to proceed with payment.');
          window.router?.navigateTo('/login');
          return;
        }

        toast.info('Initializing secure checkout...');
        const response = await fetch('/api/stripe-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            productId: productId,
            amount: 2900,
            currency: 'USD',
            mode: 'subscription'
          })
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast.error('Failed to generate checkout link.');
        }
      } catch (err) {
        console.error('Checkout error:', err);
      }
    });
  }
}

if (!customElements.get('price-card')) {
  customElements.define('price-card', PriceCard);
}
