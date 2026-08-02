// pages/shop/shop.js
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';

export async function initShopPage() {
  console.log('[Shop Page]: Initializing storefront...');

  // 1. Load Customizable Hero Override
  try {
    const pageData = await contentDB.getCustomPageBySlug('shop');
    if (pageData && pageData.hero) {
      const hero = pageData.hero;
      const heroSection = document.getElementById('shop-hero');
      const titleEl = document.getElementById('shop-hero-title');
      const subtitleEl = document.getElementById('shop-hero-subtitle');
      const primaryCta = document.getElementById('shop-hero-primary-cta');
      const secondaryCta = document.getElementById('shop-hero-secondary-cta');

      if (heroSection) {
        if (hero.enabled === false) {
          heroSection.style.display = 'none';
        } else {
          heroSection.style.display = 'block';
          if (hero.backgroundGradient) {
            heroSection.style.background = hero.backgroundGradient;
          }
          if (hero.heroImageUrl) {
            heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${hero.heroImageUrl}')`;
            heroSection.style.backgroundSize = 'cover';
            heroSection.style.backgroundPosition = 'center';
          }
        }
      }

      if (titleEl && hero.title) titleEl.textContent = hero.title;
      if (subtitleEl && hero.subtitle) subtitleEl.textContent = hero.subtitle;

      if (primaryCta) {
        if (hero.primaryCtaText) primaryCta.textContent = hero.primaryCtaText;
        if (hero.primaryCtaUrl) primaryCta.setAttribute('href', hero.primaryCtaUrl);
      }
      if (secondaryCta) {
        if (hero.secondaryCtaText) secondaryCta.textContent = hero.secondaryCtaText;
        if (hero.secondaryCtaUrl) secondaryCta.setAttribute('href', hero.secondaryCtaUrl);
      }
    }
  } catch (err) {
    console.warn('[Shop Page]: Hero loader failed.', err);
  }

  // 2. Load Products Catalog
  const container = document.getElementById('shop-products-container');
  if (!container) return;

  try {
    const products = await contentDB.getContentByType('product', 20);

    // Fallback static seed list specifically formatted for Shop layout if empty
    const catalog = (products && products.length > 0) ? products : [
      {
        id: 'sovereign-botanical-oil',
        title: 'Sovereign Botanical Elixir',
        description: 'Handmade organic apothecary oil formulated with direct natural botanical extracts to sharpen sensory focus.',
        category: 'Apothecary',
        pricing: { basePrice: 4500, currency: 'USD' },
        inventory: 4, // Leaves 4 in stock - trigger live low inventory alert
        tags: ['Zero-Build', 'Sovereignty']
      },
      {
        id: 'foundation-merch-hoodie',
        title: 'Foundation Core Heavy Hoodie',
        description: 'Official premium 400GSM organic cotton black pullover sweater featuring embroidered zero-build schematics.',
        category: 'Merchandise',
        pricing: { basePrice: 8500, currency: 'USD' },
        inventory: 20,
        tags: ['Sovereignty']
      },
      {
        id: '1-on-1-architecture-consultation',
        title: '1-on-1 Strategic Systems Session',
        description: 'Deep-dive strategic consultation session. Full architecture audit, serverless scaling map, and API review.',
        category: 'Consulting',
        pricing: { basePrice: 15000, currency: 'USD' },
        inventory: 2,
        tags: ['Zero-Build', 'AI-Tools']
      }
    ];

    const renderCatalog = (categoryFilter = 'all') => {
      const filtered = catalog.filter(p => {
        if (categoryFilter === 'all') return true;
        return p.category === categoryFilter;
      });

      if (filtered.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#a0aec0;">No items found in this category.</p>`;
        return;
      }

      container.innerHTML = filtered.map(item => {
        const id = item.id;
        const title = item.title || 'Product Item';
        const description = item.description || '';
        const price = (item.pricing?.basePrice || item.price || 1500) / 100;
        const inv = item.inventory !== undefined ? item.inventory : 12;
        const tags = item.tags || ['Zero-Build'];

        const tagsHtml = tags.map(t => `
          <a href="/tag/${t}" style="background: #e6fffa; color: #319795; font-size: 0.75rem; font-weight: bold; text-decoration: none; padding: 2px 6px; border-radius: 4px;" class="tag-chip">🏷️ ${t}</a>
        `).join(' ');

        // Live Inventory Alerts Check
        const isLowStock = inv > 0 && inv <= 5;
        const alertBadge = isLowStock
          ? `<span style="background:#fff5f5; color:#e53e3e; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; border:1px solid #fed7d7; display:inline-block; margin-top:4px;">⚠️ Low Stock: Only ${inv} left!</span>`
          : `<span style="color:#38a169; font-size:0.75rem; font-weight:bold;">🟢 In Stock</span>`;

        return `
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1.5rem; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.02); height: 100%;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                <div style="display: flex; gap: 0.25rem;">${tagsHtml}</div>
                <div>${alertBadge}</div>
              </div>
              <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c);">${title}</h3>
              <p style="margin: 0 0 1.25rem 0; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5; min-height: 3rem;">${description}</p>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #edf2f7; padding-top: 1rem; margin-top: 1rem;">
              <span style="font-size: 1.5rem; font-weight: 800; color: var(--theme-color-text-primary);">$${price.toFixed(2)}</span>
              <button class="btn-primary btn-add-product-cart" data-id="${id}" data-price="${price}" data-name="${title}" style="padding: 8px 16px; font-weight: bold; border-radius: 4px; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; cursor: pointer;">
                [ Add to Cart ]
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Add cart handlers
      container.querySelectorAll('.btn-add-product-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const name = e.target.getAttribute('data-name');
          toast.success(`Successfully added "${name}" to your shopping basket!`);
        });
      });
    };

    renderCatalog('all');

    // Wire up category filters
    document.querySelectorAll('.shop-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.shop-filter-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'white';
          b.style.color = 'var(--theme-color-text-secondary)';
        });
        e.target.classList.add('active');
        e.target.style.background = 'var(--theme-color-primary, #2b6cb0)';
        e.target.style.color = 'white';

        const category = e.target.getAttribute('data-category');
        renderCatalog(category);
      });
    });

  } catch (err) {
    console.error('[Shop Catalog Load Error]:', err);
    container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ef4444;">Error loading product catalog.</p>`;
  }
}
