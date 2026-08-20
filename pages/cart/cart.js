// pages/cart/cart.js - Controller for Dedicated Cart & Secure Checkout Page
import { store } from '../../core/store.js';
import { eventCart } from '../../utils/eventCart.js';
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { cleanTitle, escapeHTML } from '../../utils/universalRenderer.js';

export async function initCartPage() {
  const container = document.getElementById('cart-items-tbody');
  if (!container) return;

  // Refresh in-memory cart state from sessionStorage
  eventCart.cart = eventCart.loadCart();

  const form = document.getElementById('cart-checkout-form');

  // Pre-fill user details if logged in
  const currentUser = store.state.user;
  const emailInput = form ? form.querySelector('#cart-customer-email') : document.getElementById('cart-customer-email');
  const nameInput = form ? form.querySelector('#cart-customer-name') : document.getElementById('cart-customer-name');

  if (currentUser) {
    if (emailInput && !emailInput.value) emailInput.value = currentUser.email || '';
    if (nameInput && !nameInput.value) nameInput.value = currentUser.displayName || currentUser.name || '';
  }

  // Same billing checkbox toggle listener
  const sameBillingCheck = form ? form.querySelector('#cart-same-billing') : document.getElementById('cart-same-billing');
  const billingBlock = form ? form.querySelector('#billing-address-block') : document.getElementById('billing-address-block');
  if (sameBillingCheck && billingBlock) {
    sameBillingCheck.addEventListener('change', () => {
      billingBlock.style.display = sameBillingCheck.checked ? 'none' : 'block';
    });
  }

  // Payment Method Selection radio listeners
  const paymentRadios = form ? form.querySelectorAll('input[name="paymentMethod"]') : document.querySelectorAll('input[name="paymentMethod"]');
  const paymentLabels = form ? form.querySelectorAll('.payment-option-label') : document.querySelectorAll('.payment-option-label');
  const cryptoPanel = form ? form.querySelector('#cart-crypto-panel') : document.getElementById('cart-crypto-panel');

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      paymentLabels.forEach(lbl => {
        const input = lbl.querySelector('input');
        if (input && input.checked) {
          lbl.classList.add('active');
        } else {
          lbl.classList.remove('active');
        }
      });

      if (cryptoPanel) {
        if (radio.value === 'web3_crypto') {
          cryptoPanel.style.display = 'block';
          renderCryptoComponent();
        } else {
          cryptoPanel.style.display = 'none';
        }
      }

      renderCartSummary();
    });
  });

  // Render initial items & totals
  renderCartTable();
  renderCartSummary();

  // Handle Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await executeOrderCheckout();
    });
  }
}

function renderCartTable() {
  const tbody = document.getElementById('cart-items-tbody');
  if (!tbody) return;

  const cartSummary = eventCart.getCartSummary();
  const items = cartSummary.items || [];

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem 1.5rem; color: var(--theme-color-text-secondary, #718096);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🛒</div>
          <h3 style="margin: 0 0 0.5rem 0; color: var(--theme-color-text-primary, #1a202c);">Your Cart is Currently Empty</h3>
          <p style="margin: 0 0 1.25rem 0; font-size: 0.9rem;">Browse our courses, books, and artisanal products to add items.</p>
          <a href="/shop" onclick="event.preventDefault(); window.router?.navigateTo('/shop');" class="btn-primary" style="display: inline-block; padding: 8px 18px; font-weight: bold; border-radius: 6px; text-decoration: none;">
            Explore Catalog
          </a>
        </td>
      </tr>
    `;
    const submitBtn = document.getElementById('btn-cart-submit');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const submitBtn = document.getElementById('btn-cart-submit');
  if (submitBtn) submitBtn.disabled = false;

  tbody.innerHTML = items.map((item) => {
    const itemTotal = (item.price * item.quantity).toFixed(2);
    const typeLabel = (item.type || 'product').toUpperCase();

    // Icon helper by item type
    let icon = '📦';
    if (item.type === 'book') icon = '📚';
    if (item.type === 'education' || item.type === 'course') icon = '🎓';
    if (item.type === 'event' || item.type === 'ticket') icon = '🎟️';
    if (item.type === 'consultation') icon = '💬';

    return `
      <tr data-id="${item.id}">
        <td>
          <div class="cart-item-info">
            <div class="cart-item-thumb">${icon}</div>
            <div>
              <span style="font-size: 0.72rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: var(--theme-color-background, #edf2f7); color: var(--theme-color-primary, #2b6cb0); text-transform: uppercase;">${typeLabel}</span>
              <div style="font-weight: 700; color: var(--theme-color-text-primary, #1a202c); margin-top: 2px;">${cleanTitle(item.name || 'Catalog Item')}</div>
            </div>
          </div>
        </td>
        <td style="font-weight: 600;">$${item.price.toFixed(2)}</td>
        <td>
          <div class="cart-qty-ctrl">
            <button type="button" class="cart-qty-btn btn-qty-minus" data-id="${item.id}">-</button>
            <span class="cart-qty-val">${item.quantity}</span>
            <button type="button" class="cart-qty-btn btn-qty-plus" data-id="${item.id}">+</button>
          </div>
        </td>
        <td style="font-weight: 800; color: var(--theme-color-text-primary, #1a202c);">$${itemTotal}</td>
        <td>
          <button type="button" class="cart-remove-btn btn-remove-item" data-id="${item.id}">🗑️ Remove</button>
        </td>
      </tr>
    `;
  }).join('');

  // Wire event handlers for minus, plus, remove
  tbody.querySelectorAll('.btn-qty-minus').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const item = items.find(i => i.id === id);
      if (item) {
        eventCart.updateItemQuantity(id, item.quantity - 1);
        renderCartTable();
        renderCartSummary();
      }
    };
  });

  tbody.querySelectorAll('.btn-qty-plus').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const item = items.find(i => i.id === id);
      if (item) {
        eventCart.updateItemQuantity(id, item.quantity + 1);
        renderCartTable();
        renderCartSummary();
      }
    };
  });

  tbody.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      eventCart.removeItem(id);
      renderCartTable();
      renderCartSummary();
      toast.info('Item removed from cart.');
    };
  });
}

function renderCartSummary() {
  const summary = eventCart.getCartSummary();
  const subtotalEl = document.getElementById('summary-subtotal');
  const taxEl = document.getElementById('summary-tax');
  const serviceFeeEl = document.getElementById('summary-service-fee');
  const achLine = document.getElementById('summary-ach-fee-line');
  const grandTotalEl = document.getElementById('summary-grand-total');

  const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'stripe_card';
  const isAch = selectedPayment === 'stripe_ach';

  const achFee = isAch ? 5.00 : 0.00;
  const grandTotal = summary.total + achFee;

  if (subtotalEl) subtotalEl.textContent = `$${summary.subtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${summary.tax.toFixed(2)}`;
  if (serviceFeeEl) serviceFeeEl.textContent = `$${summary.serviceFee.toFixed(2)}`;

  if (achLine) {
    achLine.style.display = isAch ? 'flex' : 'none';
  }

  if (grandTotalEl) grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
}

function renderCryptoComponent() {
  const form = document.getElementById('cart-checkout-form');
  const cryptoPanel = form ? form.querySelector('#cart-crypto-panel') : document.getElementById('cart-crypto-panel');
  if (!cryptoPanel) return;

  const cartSummary = eventCart.getCartSummary();
  const emailInput = form ? form.querySelector('#cart-customer-email') : document.getElementById('cart-customer-email');
  const email = emailInput ? emailInput.value.trim() : '';
  const itemsJson = escapeHTML(JSON.stringify(cartSummary.items || []));

  cryptoPanel.innerHTML = `
    <crypto-checkout
      amount-usd="${cartSummary.total}"
      checkout-type="product"
      buyer-email="${email}"
      items-json="${itemsJson}">
    </crypto-checkout>
  `;
}

async function executeOrderCheckout() {
  const form = document.getElementById('cart-checkout-form');
  const cartSummary = eventCart.getCartSummary();
  if (!cartSummary.items || cartSummary.items.length === 0) {
    toast.warning('Your cart is empty.');
    return;
  }

  const emailInput = form ? form.querySelector('#cart-customer-email') : document.getElementById('cart-customer-email');
  const nameInput = form ? form.querySelector('#cart-customer-name') : document.getElementById('cart-customer-name');
  const customerEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const customerName = nameInput ? nameInput.value.trim() : '';

  if (!customerEmail) {
    toast.error('Please enter a valid email address.');
    return;
  }

  const selectedPayment = form ? form.querySelector('input[name="paymentMethod"]:checked')?.value : document.querySelector('input[name="paymentMethod"]:checked')?.value || 'stripe_card';
  const submitBtn = document.getElementById('btn-cart-submit');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '🔒 Processing Order...';
  }

  try {
    // 1. Account Lookup / Ingestion (WITHOUT granting purchasedProducts entitlements prior to payment completion)
    const existingUser = await contentDB.getUser(customerEmail);
    const updatedUser = await contentDB.registerOrMergeUser({
      email: customerEmail,
      name: customerName,
      role: existingUser?.role || 'subscriber'
    });

    if (updatedUser && store.state.user?.email === customerEmail) {
      store.dispatch('SET_USER', updatedUser);
    }

    // 2. Process Payment Option
    if (selectedPayment === 'web3_crypto') {
      toast.info('Please connect your Web3 wallet in the payment section above to authorize payment.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🔒 Complete Secure Purchase';
      }
      return;
    }

    if (selectedPayment === 'stripe_card' || selectedPayment === 'stripe_ach') {
      const isAch = selectedPayment === 'stripe_ach';

      // Resolve authoritative catalog entries from contentDB using getContentById
      const validatedLineItems = await Promise.all(cartSummary.items.map(async i => {
        const catalogRecord = await contentDB.getContentById(i.id);
        const officialPrice = catalogRecord?.price !== undefined ? Number(catalogRecord.price) : Number(i.price);
        return {
          id: i.id,
          name: catalogRecord?.title || i.name,
          type: catalogRecord?.type || i.type || 'product',
          amount: Math.round(officialPrice * 100), // cents
          quantity: i.quantity,
          currency: 'USD'
        };
      }));

      // Call /api/stripe-checkout serverless endpoint
      try {
        const response = await fetch('/api/stripe-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: customerEmail,
            userEmail: customerEmail,
            enableAch: isAch,
            lineItems: validatedLineItems,
            successUrl: `${window.location.origin}/account?session_id={CHECKOUT_SESSION_ID}&payment=success`,
            cancelUrl: `${window.location.origin}/cart?payment=cancelled`
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.url) {
            // Save pending order items to sessionStorage before redirecting
            sessionStorage.setItem('foundation_pending_checkout_items', JSON.stringify(cartSummary.items));
            eventCart.clearCart();
            window.location.href = resData.url;
            return;
          }
          toast.error(`Stripe checkout error: ${resData.error || 'Failed to generate payment session URL.'}`);
        } else {
          const errData = await response.json().catch(() => ({}));
          toast.error(errData.error || 'Payment processing failed. Please verify payment details.');
        }
      } catch (stripeErr) {
        console.error('[Cart Checkout]: Stripe backend call error:', stripeErr);
        toast.error('Unable to connect to payment gateway. Please try again.');
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🔒 Complete Secure Purchase';
      }
      return;
    }

  } catch (err) {
    console.error('[Cart Checkout Error]:', err);
    toast.error(`Checkout failed: ${err.message}`);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🔒 Complete Secure Purchase';
    }
  }
}
