// pages/shop/shop.js
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { lazyLoader } from '../../utils/lazyLoader.js';

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
    const products = await contentDB.getContentByType('product', 50);

    // Dynamic schema aggregation + fallback static mock list covering all required categories
    const catalog = (products && products.length > 0) ? products : [
      {
        id: 'handmade-artisan-mug',
        title: 'Handmade Artisan Mug',
        description: 'An elegant, wheel-thrown ceramic mug perfect for your morning brew. Hand-crafted and individually glazed.',
        category: 'Artisanal Merch',
        pricing: { basePrice: 2400, currency: 'USD' },
        inventory: { stockQuantity: 15, lowStockThreshold: 3, trackInventory: true },
        tags: ["Zero-Build", "Sovereignty", "Ceramic"],
        rating: 4.8,
        date: '2026-01-15',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400'
      },
      {
        id: 'sovereign-botanical-oil',
        title: 'Sovereign Botanical Elixir',
        description: 'Handmade organic apothecary oil formulated with direct natural botanical extracts to sharpen sensory focus.',
        category: 'Apothecary',
        pricing: { basePrice: 4500, currency: 'USD' },
        inventory: { stockQuantity: 4, lowStockThreshold: 5, trackInventory: true },
        tags: ['Zero-Build', 'Sovereignty', 'Botanical'],
        rating: 4.9,
        date: '2026-03-10',
        image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=400'
      },
      {
        id: 'foundation-merch-hoodie',
        title: 'Foundation Core Heavy Hoodie',
        description: 'Official premium 400GSM organic cotton black pullover sweater featuring embroidered zero-build schematics.',
        category: 'Artisanal Merch',
        pricing: { basePrice: 8500, currency: 'USD' },
        inventory: { stockQuantity: 20, lowStockThreshold: 5, trackInventory: true },
        tags: ['Sovereignty', 'Apparel', 'Style'],
        rating: 4.7,
        date: '2026-02-01',
        image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400'
      },
      {
        id: 'sovereign-dev-tee',
        title: 'Sovereign Developer Tee',
        description: 'Premium heavyweight cotton tee featuring responsive CSS bento grid blueprints on the reverse back panel.',
        category: 'Apparel',
        pricing: { basePrice: 2999, currency: 'USD' },
        inventory: { stockQuantity: 35, lowStockThreshold: 5, trackInventory: true },
        tags: ['Apparel', 'Style', 'Zero-Build'],
        rating: 4.6,
        date: '2026-04-05',
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=400'
      },
      {
        id: 'architecture-starter-kit',
        title: 'Zero-Build Architecture Starter Kit',
        description: 'Comprehensive bundle including native components templates, local outbox sync config, and production guides.',
        category: 'Digital Downloads',
        pricing: { basePrice: 4900, currency: 'USD' },
        inventory: { stockQuantity: 999, lowStockThreshold: 0, trackInventory: false },
        tags: ['Zero-Build', 'AI-Tools', 'Code'],
        rating: 4.8,
        date: '2026-05-12',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400'
      },
      {
        id: 'ascension-summit-pass',
        title: 'Ascension Summit 2026 VIP Pass',
        description: 'All-inclusive VIP admission ticket to the signature physical Ascension Summit 2026 including front-row seats and recordings.',
        category: 'Event Tickets',
        pricing: { basePrice: 29900, currency: 'USD' },
        inventory: { stockQuantity: 12, lowStockThreshold: 5, trackInventory: true },
        tags: ['Live-Summit', 'Networking'],
        rating: 5.0,
        date: '2026-06-20',
        image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=400'
      },
      {
        id: 'ambient-focus-album',
        title: 'Ambient Focus & Flow Soundtracks',
        description: 'High-fidelity cinematic soundscapes and dark-ambient drone loops engineered to trigger intense alpha wave focus.',
        category: 'Audio/Music',
        pricing: { basePrice: 1999, currency: 'USD' },
        inventory: { stockQuantity: 999, lowStockThreshold: 0, trackInventory: false },
        tags: ['Audio', 'Music', 'Focus'],
        rating: 4.5,
        date: '2026-07-15',
        image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=400'
      }
    ];

    // Current filter states
    let activeCategory = 'all';
    let searchQuery = '';
    let activeSort = 'default';

    const renderStars = (rating = 4.8) => {
      const fullStars = Math.floor(rating);
      const emptyStars = 5 - fullStars;
      return `<span style="color: #ecc94b; letter-spacing: 1px;">` + '★'.repeat(fullStars) + '☆'.repeat(emptyStars) + `</span><span style="font-size: 0.8rem; color: #718096; margin-left: 6px; font-weight: bold;">${rating}</span>`;
    };

    const filterAndRenderCatalog = () => {
      // 1. Filter by category
      let filtered = catalog.filter(p => {
        if (activeCategory === 'all') return true;
        return p.category === activeCategory;
      });

      // 2. Filter by search query (text matching in title, description, and tags)
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(p => {
          const matchTitle = (p.title || '').toLowerCase().includes(query);
          const matchDesc = (p.description || '').toLowerCase().includes(query);
          const matchTags = (p.tags || []).some(t => t.toLowerCase().includes(query));
          return matchTitle || matchDesc || matchTags;
        });
      }

      // 3. Sort
      if (activeSort === 'price-asc') {
        filtered.sort((a, b) => {
          const pA = a.pricing?.basePrice || a.price || 0;
          const pB = b.pricing?.basePrice || b.price || 0;
          return pA - pB;
        });
      } else if (activeSort === 'price-desc') {
        filtered.sort((a, b) => {
          const pA = a.pricing?.basePrice || a.price || 0;
          const pB = b.pricing?.basePrice || b.price || 0;
          return pB - pA;
        });
      } else if (activeSort === 'newest') {
        filtered.sort((a, b) => {
          const dA = new Date(a.date || '2026-01-01');
          const dB = new Date(b.date || '2026-01-01');
          return dB - dA;
        });
      } else if (activeSort === 'rating-desc') {
        filtered.sort((a, b) => {
          const rA = a.rating || 0;
          const rB = b.rating || 0;
          return rB - rA;
        });
      }

      // 4. Render Empty Fallback
      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; background: #ffffff; border: 1px dashed var(--theme-color-border, #cbd5e1); border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.01);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
            <h3 style="font-size: 1.35rem; font-weight: bold; margin: 0 0 0.5rem 0; color: var(--theme-color-text-primary, #1a202c);">No Products Match Your Search</h3>
            <p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.95rem; margin-bottom: 1.5rem; max-width: 400px;">
              Try adjusting your keyword query, removing filters, or resetting the search to view all items.
            </p>
            <button id="btn-reset-search" class="btn-primary" style="padding: 10px 24px; font-weight: bold; border-radius: 6px; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; cursor: pointer; transition: all 0.2s;">
              Reset Search & Filters
            </button>
          </div>
        `;

        document.getElementById('btn-reset-search')?.addEventListener('click', () => {
          const searchInput = document.getElementById('shop-search-input');
          const sortSelect = document.getElementById('shop-sort-select');

          if (searchInput) searchInput.value = '';
          if (sortSelect) sortSelect.value = 'default';

          searchQuery = '';
          activeSort = 'default';
          activeCategory = 'all';

          document.querySelectorAll('.shop-filter-btn').forEach(btn => {
            if (btn.getAttribute('data-category') === 'all') {
              btn.classList.add('active');
              btn.style.background = 'var(--theme-color-primary, #2b6cb0)';
              btn.style.color = 'white';
            } else {
              btn.classList.remove('active');
              btn.style.background = 'white';
              btn.style.color = 'var(--theme-color-text-secondary)';
            }
          });

          filterAndRenderCatalog();
        });
        return;
      }

      // 5. Render products
      container.innerHTML = filtered.map(item => {
        const id = item.id;
        const title = item.title || 'Product Item';
        const description = item.description || '';
        const price = (item.pricing?.basePrice || item.price || 1500) / 100;
        const tags = item.tags || ['Zero-Build'];
        const rating = item.rating || 4.8;
        const defaultImg = 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400';
        const imgUrl = item.image || item.preview?.featuredImage?.src || defaultImg;

        const tagsHtml = tags.map(t => `
          <a href="/tag/${t}" style="background: #e6fffa; color: #319795; font-size: 0.72rem; font-weight: bold; text-decoration: none; padding: 2px 6px; border-radius: 4px;" class="tag-chip">🏷️ ${t}</a>
        `).join(' ');

        // Determine stock availability badge details gracefully
        let stockQty = 12;
        let isTracked = true;
        let isLowStock = false;

        if (typeof item.inventory === 'object' && item.inventory !== null) {
          stockQty = item.inventory.stockQuantity !== undefined ? item.inventory.stockQuantity : 12;
          isTracked = item.inventory.trackInventory !== false;
          const threshold = item.inventory.lowStockThreshold || 3;
          isLowStock = isTracked && stockQty <= threshold;
        } else if (typeof item.inventory === 'number') {
          stockQty = item.inventory;
          isLowStock = stockQty <= 5;
        }

        let alertBadge = `<span style="color:#38a169; font-size:0.75rem; font-weight:bold;">🟢 In Stock</span>`;
        if (isTracked) {
          if (stockQty <= 0) {
            alertBadge = `<span style="background:#fed7d7; color:#9b2c2c; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; border:1px solid #feb2b2; display:inline-block;">❌ Sold Out</span>`;
          } else if (isLowStock) {
            alertBadge = `<span style="background:#fff5f5; color:#e53e3e; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; border:1px solid #fed7d7; display:inline-block;">⚠️ Low Stock: ${stockQty} left!</span>`;
          }
        } else {
          alertBadge = `<span style="background:#e2e8f0; color:#4a5568; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; display:inline-block;">✓ Unlimited Digital</span>`;
        }

        return `
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; overflow: hidden; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s; height: 100%;">

            <!-- Product Thumbnail Image with lazyLoader scan formatting -->
            <div style="position: relative; padding-bottom: 60%; height: 0; background: #f7fafc; overflow: hidden; border-bottom: 1px solid #edf2f7;">
              <img data-src="${imgUrl}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
                   alt="${title}"
                   class="lazy-product-img"
                   style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transition: opacity 0.3s ease-in;" />
            </div>

            <div style="padding: 1.25rem; display: flex; flex-direction: column; flex-grow: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); letter-spacing: 0.5px; background: #ebf8ff; padding: 2px 8px; border-radius: 12px;">
                  ${item.category}
                </span>
                <div>${alertBadge}</div>
              </div>

              <h3 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); line-height: 1.3;">${title}</h3>

              <!-- Star Ratings -->
              <div style="margin-bottom: 0.75rem; display: flex; align-items: center;">
                ${renderStars(rating)}
              </div>

              <p style="margin: 0 0 1.25rem 0; font-size: 0.88rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5; min-height: 2.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
                ${description}
              </p>

              <div style="margin-top: auto;">
                <div style="display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 1rem;">${tagsHtml}</div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #edf2f7; padding-top: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                  <span style="font-size: 1.4rem; font-weight: 900; color: var(--theme-color-text-primary, #1a202c);">$${price.toFixed(2)}</span>

                  <div style="display: flex; gap: 0.5rem; width: 100%; margin-top: 0.5rem;">
                    <button class="btn-primary btn-add-product-cart" data-id="${id}" data-price="${price}" data-name="${title}"
                            style="flex: 1; padding: 10px 12px; font-size: 0.85rem; font-weight: bold; border-radius: 6px; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; cursor: pointer; transition: background 0.2s;">
                      [ Add to Cart ]
                    </button>
                    <button class="btn-secondary btn-quick-view" data-id="${id}"
                            style="padding: 10px 12px; font-size: 0.85rem; font-weight: bold; border-radius: 6px; background: white; color: var(--theme-color-text-secondary, #4a5568); border: 1px solid var(--theme-color-border, #cbd5e1); cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                      Quick View
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        `;
      }).join('');

      // Invoke the IntersectionObserver scan on our lazy image elements
      lazyLoader.scan(container);

      // Add cart handlers
      container.querySelectorAll('.btn-add-product-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const name = e.target.getAttribute('data-name');
          toast.success(`Successfully added "${name}" to your shopping basket!`);
        });
      });

      // Add Quick View / Deep Dive handlers
      container.querySelectorAll('.btn-quick-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const id = e.target.getAttribute('data-id');
          if (id) {
            window.router.navigateTo(`/detail?id=${id}`);
          }
        });
      });
    };

    // Initial render
    filterAndRenderCatalog();

    // Wire up search input keyup handler
    const searchInput = document.getElementById('shop-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        filterAndRenderCatalog();
      });
    }

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

        activeCategory = e.target.getAttribute('data-category');
        filterAndRenderCatalog();
      });
    });

    // Wire up sort select dropdown
    const sortSelect = document.getElementById('shop-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        activeSort = e.target.value;
        filterAndRenderCatalog();
      });
    }

  } catch (err) {
    console.error('[Shop Catalog Load Error]:', err);
    container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ef4444;padding:3rem;">Error loading product catalog.</p>`;
  }
}
