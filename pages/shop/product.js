// pages/shop/product.js - Public Storefront Variant Selector & E-Commerce Web3 Controller
import { decrementStock } from '../../utils/inventory.js';
import { processCryptoCheckout } from '../../utils/backend-web3.js';
import { toast } from '../../utils/toast.js';
import { stripeService } from '../../core/stripe.js';
import { configManager } from '../../core/config.js';

/**
 * Renders the interactive e-commerce product storefront details panel
 * @param {Object} product
 * @returns {string} Compiled HTML template
 */
export function renderProductStorefront(product) {
  if (!product) return '';

  const isPhysical = product.isPhysicalProduct || false;
  const isHandmade = product.isHandmade || false;
  const priceUSD = ((product.pricing?.basePrice || 0) / 100).toFixed(2);
  const currency = product.pricing?.currency || 'USD';

  // Determine stock availability badge details
  let availabilityHtml = '';
  if (product.inventory && product.inventory.trackInventory) {
    const qty = product.inventory.stockQuantity || 0;
    const threshold = product.inventory.lowStockThreshold || 3;

    if (qty <= 0) {
      availabilityHtml = `<span style="background: #fed7d7; color: #9b2c2c; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; display: inline-block;">❌ Sold Out</span>`;
    } else if (qty <= threshold) {
      availabilityHtml = `<span style="background: #feebc8; color: #c05621; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; display: inline-block;">⚠️ Only ${qty} left - Handmade to order</span>`;
    } else {
      availabilityHtml = `<span style="background: #c6f6d5; color: #22543d; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; display: inline-block;">✓ In Stock</span>`;
    }
  } else {
    availabilityHtml = `<span style="background: #e2e8f0; color: #4a5568; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; display: inline-block;">✓ Unlimited Digital</span>`;
  }

  // Generate variations swatches/selectors
  const variationsHtml = (product.variations || []).map(v => {
    const optionName = v.optionName;
    const values = v.values || [];

    return `
      <div class="product-variation-row" style="margin-bottom: 1.25rem; text-align: left;">
        <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--theme-color-text-primary, #1a202c);">${optionName}:</label>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${values.map((val, idx) => `
            <button class="variation-swatch-btn ${idx === 0 ? 'active' : ''}"
                    data-option-name="${optionName}"
                    data-value="${val}"
                    style="padding: 6px 14px; background: ${idx === 0 ? 'var(--theme-color-primary, #2b6cb0)' : '#edf2f7'};
                           color: ${idx === 0 ? 'white' : '#2d3748'};
                           border: 1px solid ${idx === 0 ? 'var(--theme-color-primary, #2b6cb0)' : '#cbd5e0'};
                           border-radius: 4px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              ${val}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Craft details / materials list for handmade goods
  let craftDetailsHtml = '';
  if (isHandmade && product.craftDetails) {
    const details = product.craftDetails;
    const materialsList = (details.materials || []).map(m => `<span style="background: #e2e8f0; color: #4a5568; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">${m}</span>`).join(' ');

    craftDetailsHtml = `
      <div style="background: var(--theme-color-surface-alt, #f8fafc); border: 1px solid var(--theme-color-border, #edf2f7); padding: 1.25rem; border-radius: 8px; margin-top: 1.5rem; text-align: left;">
        <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); text-transform: uppercase;">🔨 Artisan Craft Details</h4>
        <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 6px; color: #4a5568;">
          <div><strong>Materials Used:</strong> <div style="display:inline-flex; gap:4px; flex-wrap:wrap; margin-top:2px;">${materialsList}</div></div>
          <div><strong>Production Lead Time:</strong> ${details.productionLeadTime || 'Standard'}</div>
          ${details.dimensions ? `<div><strong>Dimensions:</strong> ${details.dimensions.length} x ${details.dimensions.width} x ${details.dimensions.height} ${details.dimensions.unit}</div>` : ''}
          ${details.weight ? `<div><strong>Weight:</strong> ${details.weight.value} ${details.weight.unit}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Web3 / NFT Details
  let web3DetailsHtml = '';
  if (product.enableNftCounterpart) {
    web3DetailsHtml = `
      <div style="background: #ebf8ff; border: 1px solid #bee3f8; padding: 1rem; border-radius: 8px; margin-top: 1rem; text-align: left; display: flex; align-items: flex-start; gap: 0.75rem;">
        <div style="font-size: 1.5rem;">⛓️</div>
        <div>
          <strong style="color: #2b6cb0; font-size: 0.85rem; display: block; margin-bottom: 2px;">ERC-1155 Digital Certificate Enabled</strong>
          <span style="font-size: 0.78rem; color: #2c5282; line-height: 1.4; display: block;">This physical artisanal piece includes a Web3 Digital Certificate of Authenticity minted directly to your MetaMask or Web3 wallet address upon checkout verification.</span>
        </div>
      </div>
    `;
  }

  // Standard CTA Payment buttons
  const checkoutButtons = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem;">
      <button id="btn-buy-stripe" class="btn-primary" style="padding: 12px; font-size: 1rem; font-weight: bold; border-radius: 6px; width: 100%; cursor: pointer;">
        💳 Buy with Credit Card ($${priceUSD})
      </button>

      ${(product.enableCryptoPayment && configManager.current?.features?.web3CryptoCheckout !== false) ? `
        <button id="btn-buy-crypto" style="padding: 12px; font-size: 1rem; font-weight: bold; border-radius: 6px; width: 100%; cursor: pointer; background: #805ad5; color: white; border: none; transition: background 0.2s;">
          ⛓️ Buy with Crypto (MATIC / ETH)
        </button>
      ` : ''}
    </div>
  `;

  return `
    <div class="product-storefront-wrapper" style="font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem;">
      <!-- Left Column: Media / Product image -->
      <div class="product-media-panel" style="display: flex; flex-direction: column; gap: 1rem;">
        <img id="storefront-main-image" src="${product.preview?.featuredImage?.src || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd'}" alt="${product.title}" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); object-fit: cover; max-height: 400px;" />
      </div>

      <!-- Right Column: Purchasing Controls -->
      <div class="product-purchasing-panel" style="display: flex; flex-direction: column; justify-content: flex-start; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); letter-spacing: 1px;">${product.category}</span>
          ${availabilityHtml}
        </div>

        <h1 style="font-size: 2rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin: 0 0 0.5rem 0; line-height: 1.25;">
          ${product.title}
        </h1>

        <div style="font-size: 1.50rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 1rem;">
          ${currency === 'USD' ? '$' : ''}${priceUSD} <span style="font-size: 0.9rem; color: #718096; font-weight: normal;">${currency}</span>
        </div>

        <p style="font-size: 0.95rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.6; margin: 0 0 1.5rem 0;">
          ${product.description}
        </p>

        <hr style="border: none; border-top: 1px solid var(--theme-color-border, #edf2f7); margin-bottom: 1.25rem;" />

        <!-- Selection Controls -->
        <div id="product-variants-container">
          ${variationsHtml}
        </div>

        ${web3DetailsHtml}
        ${craftDetailsHtml}
        ${checkoutButtons}
      </div>
    </div>
  `;
}

/**
 * Initializes interactive listeners for the variations selection and checkout actions.
 * @param {Object} product
 */
export function initProductStorefrontListeners(product) {
  if (!product) return;

  const selectedVariations = {};

  // Default values
  (product.variations || []).forEach(v => {
    selectedVariations[v.optionName] = v.values?.[0] || '';
  });

  const getSelectionString = () => {
    return Object.entries(selectedVariations)
      .map(([name, val]) => `${name}:${val}`)
      .join('|') || 'default';
  };

  // Swatch selections
  const container = document.getElementById('product-variants-container');
  if (container) {
    container.querySelectorAll('.variation-swatch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const optionName = btn.dataset.optionName;
        const val = btn.dataset.value;

        selectedVariations[optionName] = val;

        // Reset others in the same row
        container.querySelectorAll(`.variation-swatch-btn[data-option-name="${optionName}"]`).forEach(b => {
          b.style.background = '#edf2f7';
          b.style.color = '#2d3748';
          b.style.borderColor = '#cbd5e0';
        });

        // Set active style
        btn.style.background = 'var(--theme-color-primary, #2b6cb0)';
        btn.style.color = 'white';
        btn.style.borderColor = 'var(--theme-color-primary, #2b6cb0)';

        console.log(`[Storefront]: Selected variation:`, selectedVariations);
      });
    });
  }

  // Stripe Checkout
  document.getElementById('btn-buy-stripe')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (product.inventory?.trackInventory && product.inventory.stockQuantity <= 0) {
      toast.error('This product is sold out!');
      return;
    }

    toast.info('Directing to Stripe secure checkout...');

    // Stripe direct checkout session or simulation
    try {
      const selectedVariant = getSelectionString();
      const response = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant,
          qty: 1,
          action: 'product_purchase'
        })
      });

      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        // Fallback simulation
        await decrementStock(product.id, selectedVariant, 1);

        // Save order locally
        const orderId = 'order_' + Date.now();
        const orders = JSON.parse(localStorage.getItem('foundation_local_orders') || '{}');
        orders[orderId] = {
          id: orderId,
          type: 'order',
          productId: product.id,
          productTitle: product.title,
          variantId: selectedVariant,
          qty: 1,
          paymentMethod: 'Stripe Credit Card (Simulated)',
          paymentStatus: 'Paid',
          fulfillmentStatus: 'Pending Production',
          shippingDetails: { carrier: '', trackingNumber: '', shippedAt: '' },
          buyerEmail: 'buyer_stripe@example.com',
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('foundation_local_orders', JSON.stringify(orders));

        toast.success('Simulation Purchase Successful! Stock updated and order logged.');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      toast.error(`Checkout failed: ${err.message}`);
    }
  });

  // Crypto Checkout
  document.getElementById('btn-buy-crypto')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (product.inventory?.trackInventory && product.inventory.stockQuantity <= 0) {
      toast.error('This product is sold out!');
      return;
    }

    const walletAddress = prompt('Enter your ERC-20/1155 Web3 Wallet Address to authorize transfer & mint NFT certificate (e.g. 0x...):');
    if (!walletAddress) {
      toast.warning('Crypto payment cancelled. Web3 wallet address required.');
      return;
    }

    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      toast.error('Invalid Ethereum/Polygon public address formatting.');
      return;
    }

    toast.info('Initializing decentralized smart contract routing simulation...');

    try {
      const selectedVariant = getSelectionString();
      const res = await processCryptoCheckout(product.id, selectedVariant, 1, walletAddress, 'MATIC');
      if (res.success) {
        toast.success(`Crypto transaction confirmed! MATIC routed. Stock decremented.`);
        if (res.nftReceipt) {
          toast.success(`🏆 NFT Certificate of Authenticity successfully minted to ${walletAddress}! Token ID: ${res.nftReceipt.tokenId}`);
        }
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err) {
      toast.error(`Web3 transaction failed: ${err.message}`);
    }
  });
}
