// pages/events/events.js
import { contentDB } from '../../core/db.js';
import { eventCart } from '../../utils/eventCart.js';
import { store } from '../../core/store.js';
import { toast } from '../../utils/toast.js';
import { errorHandler } from '../../core/error-handler.js';

let currentActiveEvent = null;

export function convertGoogleDriveLink(url) {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    let id = '';
    const matchD = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) {
      id = matchD[1];
    } else {
      const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchId && matchId[1]) {
        id = matchId[1];
      }
    }
    if (id) {
      return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  }
  return url;
}

function renderVideoPlayer(url) {
  if (!url) return '';
  const convertedUrl = convertGoogleDriveLink(url);

  // If YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let ytId = '';
    const matchV = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (matchV && matchV[1]) {
      ytId = matchV[1];
    } else {
      const parts = url.split('/');
      ytId = parts[parts.length - 1];
    }
    return `
      <iframe src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen style="width: 100%; aspect-ratio: 16/9; border-radius: 8px;"></iframe>
    `;
  }

  // Direct MP4 or direct stream from Google Drive
  return `
    <video src="${convertedUrl}" controls style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: #000;"></video>
  `;
}


export async function initEventsPage() {
  // Load Customizable Hero Override (Directive 2)
  try {
    const pageData = await contentDB.getCustomPageBySlug('events');
    if (pageData && pageData.hero) {
      const hero = pageData.hero;
      const heroSection = document.getElementById('events-hero');
      const titleEl = document.getElementById('events-hero-title');
      const subtitleEl = document.getElementById('events-hero-subtitle');
      const primaryCta = document.getElementById('events-hero-primary-cta');
      const secondaryCta = document.getElementById('events-hero-secondary-cta');

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
    console.warn('[Events Page]: Custom hero loader failed.', err);
  }

  renderEventsGrid();
  setupEventListeners();
  renderCart();

  if (window.sessionStorage.getItem('open_cart_on_load') === 'true') {
    window.sessionStorage.removeItem('open_cart_on_load');
    setTimeout(() => {
      openCartSidebar();
    }, 150);
  }
}

async function renderEventsGrid() {
  const grid = document.getElementById('events-grid');
  if (!grid) return;

  try {
    const events = await contentDB.getAllEvents();
    if (!events || events.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--theme-color-surface, #ffffff); border-radius: 8px; border: 1px dashed var(--theme-color-border, #cbd5e0);">
          <p style="color: #718096; margin: 0; font-size: 1.05rem; font-weight: 600;">No upcoming events scheduled yet.</p>
          <p style="color: var(--theme-color-text-secondary); margin: var(--spacing-8) 0 0 0; font-size: 0.875rem;">No active items registered yet. Click 'Create Item' above to get started.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = events.map(evt => {
      const isVirtual = evt.location?.type === 'virtual';
      const locStr = isVirtual
        ? `Virtual Session (Meet / Webinar)`
        : `${evt.location?.venueName || evt.location || 'In-Person'}, ${evt.location?.address || ''}`;

      return `
        <article class="card" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1.5rem; background: var(--theme-color-surface, #ffffff); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div>
            ${evt.flyerUrl ? `
              <div style="margin: -1.5rem -1.5rem 1.25rem -1.5rem; border-radius: 8px 8px 0 0; overflow: hidden; aspect-ratio: 4/5; background: #e2e8f0;">
                <img src="${convertGoogleDriveLink(evt.flyerUrl)}" alt="${evt.title} Flyer" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--theme-color-primary, #2b6cb0); font-weight: 700; margin-bottom: 0.75rem;">
              <span>📅 ${evt.date || 'TBD'}</span>
              <span>⏰ ${evt.startTime || 'TBD'}</span>
            </div>
            <h3 style="margin: 0 0 0.75rem 0; font-size: 1.35rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c);">${evt.title}</h3>
            <p style="margin: 0 0 1.25rem 0; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5; min-height: 4.5rem;">
              ${evt.description}
            </p>
            <div style="font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.25rem;">
              <span>📍</span> <span>${locStr}</span>
            </div>
          </div>
          <button class="btn-primary btn-register-trigger" data-id="${evt.id}" style="width: 100%; text-align: center; padding: 10px; font-weight: bold; border-radius: 6px;">
            Register & Select Tickets
          </button>
        </article>
      `;
    }).join('');

    // Wire up trigger buttons
    document.querySelectorAll('.btn-register-trigger').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const evt = await contentDB.getContentById(id);
        if (evt) {
          openBookingModal(evt);
        }
      });
    });

  } catch (err) {
    errorHandler.handleError(err, 'Events Page Grid Load');
    grid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--theme-color-danger, #e53e3e); text-align: center;">Failed to load events grid.</p>`;
  }
}

function openBookingModal(evt) {
  currentActiveEvent = evt;
  const modal = document.getElementById('booking-modal');
  if (!modal) return;

  document.getElementById('modal-event-title').textContent = evt.title;
  document.getElementById('modal-event-date').textContent = `📅 ${evt.date}`;

  // Dynamically render Hero Banner Image
  const bannerContainer = document.getElementById('modal-banner-container');
  if (bannerContainer) {
    if (evt.bannerUrl) {
      bannerContainer.style.backgroundImage = `url('${convertGoogleDriveLink(evt.bannerUrl)}')`;
      bannerContainer.style.display = 'block';
    } else {
      bannerContainer.style.display = 'none';
    }
  }

  // Dynamically render Promo Video
  const videoContainer = document.getElementById('modal-video-container');
  if (videoContainer) {
    if (evt.promoVideoUrl) {
      videoContainer.innerHTML = renderVideoPlayer(evt.promoVideoUrl);
      videoContainer.style.display = 'block';
    } else {
      videoContainer.innerHTML = '';
      videoContainer.style.display = 'none';
    }
  }

  // Render Flyer, Agenda & Lineup (Directive 3)
  const richContainer = document.getElementById('modal-rich-details-container');
  if (richContainer) {
    const hasRichData = evt.flyerImageUrl || evt.agenda || evt.lineup;
    if (hasRichData) {
      const flyerImgSrc = convertGoogleDriveLink(evt.flyerImageUrl || evt.flyerUrl || '');
      const agendaList = evt.agenda || [];
      const lineupObj = evt.lineup || {};

      const hostsHtml = (lineupObj.hosts || []).map(h => `<span style="display:inline-block; background:#ebf8ff; color:#2b6cb0; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; margin-right:4px; margin-bottom:4px;">🎤 Host: ${h}</span>`).join('');
      const headlinersHtml = (lineupObj.headliners || []).map(h => `<span style="display:inline-block; background:#faf5ff; color:#805ad5; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; margin-right:4px; margin-bottom:4px;">⭐ Headliner: ${h}</span>`).join('');
      const castHtml = (lineupObj.castAndAct || []).map(c => `<span style="display:inline-block; background:#e6fffa; color:#319795; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; margin-right:4px; margin-bottom:4px;">👥 Cast: ${c}</span>`).join('');
      const performersHtml = (lineupObj.openersAndPerformers || []).map(p => `<span style="display:inline-block; background:#fff5f5; color:#e53e3e; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; margin-right:4px; margin-bottom:4px;">🎵 Act: ${p}</span>`).join('');

      const lineupHtml = [hostsHtml, headlinersHtml, castHtml, performersHtml].filter(Boolean).join('');

      const agendaHtml = agendaList.map((item, idx) => `
        <details ${idx === 0 ? 'open' : ''} style="border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 6px; background:#f8fafc; padding: 0.75rem; margin-bottom: 0.5rem; cursor:pointer;">
          <summary style="font-weight: bold; font-size: 0.9rem; outline:none; display:flex; justify-content:space-between; align-items:center;">
            <span>⏱️ ${item.time} - ${item.title}</span>
            <span style="font-size:0.8rem; color:#718096; font-weight:normal;">(by ${item.speaker || 'TBD'})</span>
          </summary>
          <p style="margin: 0.5rem 0 0 0; font-size: 0.825rem; color:#4a5568; line-height:1.4; text-align: left !important;">${item.description}</p>
        </details>
      `).join('');

      richContainer.innerHTML = `
        <!-- Left: Flyer & Lineup -->
        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${flyerImgSrc ? `
            <div style="border-radius: 8px; overflow:hidden; border: 1px solid #e2e8f0; aspect-ratio: 4/5; background:#edf2f7;">
              <img src="${flyerImgSrc}" alt="Event Flyer" style="width:100%; height:100%; object-fit:cover;" />
            </div>
          ` : ''}
          ${lineupHtml ? `
            <div>
              <h3 style="margin:0 0 0.5rem 0; font-size:0.9rem; font-weight:bold; color:var(--theme-color-text-primary);">Event Lineup & Cast</h3>
              <div style="display:flex; flex-wrap:wrap;">${lineupHtml}</div>
            </div>
          ` : ''}
        </div>

        <!-- Right: Collapsible Agenda Timeline -->
        <div>
          <h3 style="margin:0 0 0.75rem 0; font-size:1rem; font-weight:800; color:var(--theme-color-text-primary);">collapsible Event Agenda Timeline</h3>
          <div style="max-height: 400px; overflow-y:auto; padding-right:0.25rem;">
            ${agendaHtml || '<p style="color:#a0aec0;font-size:0.85rem;">No agenda items posted.</p>'}
          </div>
        </div>
      `;
      richContainer.style.display = 'grid';
    } else {
      richContainer.innerHTML = '';
      richContainer.style.display = 'none';
    }
  }

  renderTicketTiers(evt);
  renderVendorPackages(evt);
  renderSponsorshipPackages(evt);

  // Reset tab active state
  document.querySelectorAll('.booking-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.color = 'var(--theme-color-text-secondary, #4a5568)';
    btn.style.borderBottomColor = 'transparent';
  });
  const firstTab = document.querySelector('.booking-tab-btn[data-tab="tickets"]');
  if (firstTab) {
    firstTab.classList.add('active');
    firstTab.style.color = 'var(--theme-color-primary, #2b6cb0)';
    firstTab.style.borderBottomColor = 'var(--theme-color-primary, #2b6cb0)';
  }

  document.querySelectorAll('.booking-section-panel').forEach(panel => {
    panel.style.display = panel.id === 'booking-sec-tickets' ? 'block' : 'none';
  });

  modal.style.display = 'flex';
}

function renderTicketTiers(evt) {
  const container = document.getElementById('ticket-tiers-container');
  if (!container) return;

  const tickets = evt.ticketTypes || [];
  if (tickets.length === 0) {
    container.innerHTML = `<p style="color: #a0aec0; text-align: center;">No tickets listed for this event.</p>`;
    return;
  }

  container.innerHTML = tickets.map(t => {
    const remaining = Math.max(0, (t.capacity || 0) - (t.sold || 0));
    const isSoldOut = remaining <= 0;
    const isLowInventory = remaining > 0 && remaining <= 5;
    const inventoryText = isSoldOut
      ? `<span style="color: var(--theme-color-danger, #e53e3e); font-weight: bold;">SOLD OUT</span>`
      : isLowInventory
        ? `<span style="color: var(--theme-color-danger, #e53e3e); font-weight: bold;">Only ${remaining} tickets left!</span>`
        : `<span style="color: var(--theme-color-accent, #38a169); font-weight: 600;">Available (${remaining} remaining)</span>`;

    return `
      <div class="ticket-card" style="border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1.25rem; background: var(--theme-color-background, #f7fafc); display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
          <div>
            <h4 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--theme-color-text-primary, #2d3748);">${t.name}</h4>
            <div style="font-size: 0.8rem; margin-top: 0.25rem;">${inventoryText}</div>
          </div>
          <div style="font-size: 1.35rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c);">$${Number(t.price).toFixed(2)}</div>
        </div>

        <!-- Accordion Description -->
        <details style="font-size: 0.85rem; color: var(--theme-color-text-secondary, #718096); cursor: pointer;">
          <summary style="font-weight: 600; color: var(--theme-color-primary, #2b6cb0); outline: none;">View description & inclusions</summary>
          <p style="margin: 0.5rem 0 0 0; line-height: 1.4;">${t.description}</p>
        </details>

        <!-- Quantity input & add button -->
        <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: flex-end; margin-top: 0.25rem;">
          <div style="display: flex; align-items: center; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; overflow: hidden; background: white;">
            <button class="qty-btn" onclick="this.nextElementSibling.stepDown()" style="background: #edf2f7; border: none; padding: 6px 12px; cursor: pointer; font-weight: bold;">-</button>
            <input class="qty-input" type="number" value="1" min="1" max="${remaining || 10}" readonly style="width: 45px; text-align: center; border: none; font-weight: bold; outline: none;" />
            <button class="qty-btn" onclick="this.previousElementSibling.stepUp()" style="background: #edf2f7; border: none; padding: 6px 12px; cursor: pointer; font-weight: bold;">+</button>
          </div>
          <button class="btn-primary btn-add-ticket-cart" data-id="${t.id}" data-price="${t.price}" data-name="${t.name}" data-price-id="${t.stripePriceId || ''}" ${isSoldOut ? 'disabled style="background: #cbd5e0; cursor: not-allowed;"' : ''} style="padding: 8px 16px; font-size: 0.85rem; font-weight: bold; border-radius: 4px;">
            ${isSoldOut ? 'Sold Out' : 'Add to Cart'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Wire add-to-cart handlers
  container.querySelectorAll('.btn-add-ticket-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tId = e.target.getAttribute('data-id');
      const price = Number(e.target.getAttribute('data-price'));
      const name = e.target.getAttribute('data-name');
      const priceId = e.target.getAttribute('data-price-id') || null;
      const qtyInput = e.target.parentElement.querySelector('.qty-input');
      const qty = qtyInput ? Number(qtyInput.value) : 1;

      eventCart.addItem(evt.id, 'ticket', tId, qty, price, name, priceId);
      toast.success(`Added ${qty}x ${name} to your registration cart!`);
      renderCart();
      openCartSidebar();
    });
  });
}

function renderVendorPackages(evt) {
  const tbody = document.getElementById('vendor-packages-tbody');
  if (!tbody) return;

  const packages = evt.vendorPackages || [];
  if (packages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #a0aec0;">No vendor packages listed for this event.</td></tr>`;
    return;
  }

  tbody.innerHTML = packages.map(pkg => {
    const perksList = pkg.perks?.map(p => `• ${p}`).join('<br>') || '';
    const remaining = Math.max(0, (pkg.capacity || 0) - (pkg.sold || 0));
    const isSoldOut = remaining <= 0;

    return `
      <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
        <td style="padding: 12px 10px;">
          <strong style="color: var(--theme-color-text-primary, #2d3748);">${pkg.name}</strong>
          <div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); margin-top: 2px;">
            ${isSoldOut ? '<span style="color:#e53e3e;font-weight:bold;">Sold Out</span>' : `Only ${remaining} left!`}
          </div>
        </td>
        <td style="padding: 12px 10px; font-size: 0.85rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.4;">
          ${perksList}
        </td>
        <td style="padding: 12px 10px; font-weight: bold; color: var(--theme-color-text-primary, #1a202c);">$${Number(pkg.price).toFixed(2)}</td>
        <td style="padding: 12px 10px; text-align: right;">
          <button class="btn-primary btn-add-vendor-cart" data-id="${pkg.id}" data-price="${pkg.price}" data-name="${pkg.name}" data-price-id="${pkg.stripePriceId || ''}" ${isSoldOut ? 'disabled style="background: #cbd5e0; cursor: not-allowed;"' : ''} style="padding: 6px 12px; font-size: 0.8rem; font-weight: bold; border-radius: 4px;">
            ${isSoldOut ? 'Sold Out' : 'Reserve Space'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Wire reserve booth handlers
  tbody.querySelectorAll('.btn-add-vendor-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pkgId = e.target.getAttribute('data-id');
      const price = Number(e.target.getAttribute('data-price'));
      const name = e.target.getAttribute('data-name');
      const priceId = e.target.getAttribute('data-price-id') || null;

      eventCart.addItem(evt.id, 'vendor_booth', pkgId, 1, price, name, priceId);
      toast.success(`Reserved 1x ${name}!`);
      renderCart();
      openCartSidebar();
    });
  });
}

function renderSponsorshipPackages(evt) {
  const tbody = document.getElementById('sponsorship-packages-tbody');
  if (!tbody) return;

  const sponsors = evt.sponsorshipPackages || [];
  if (sponsors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #a0aec0;">No sponsorship opportunities listed for this event.</td></tr>`;
    return;
  }

  tbody.innerHTML = sponsors.map(sp => {
    const remaining = Math.max(0, (sp.capacity || 0) - (sp.sold || 0));
    const isSoldOut = remaining <= 0;

    return `
      <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
        <td style="padding: 12px 10px;">
          <strong style="color: var(--theme-color-text-primary, #2d3748);">${sp.tier}</strong>
          <div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); margin-top: 2px;">
            ${isSoldOut ? '<span style="color:#e53e3e;font-weight:bold;">Sold Out</span>' : `Only ${remaining} left!`}
          </div>
        </td>
        <td style="padding: 12px 10px; font-size: 0.85rem; color: var(--theme-color-text-secondary, #4a5568);">${sp.logoPlacement}</td>
        <td style="padding: 12px 10px; text-align: center; font-weight: bold; color: var(--theme-color-text-secondary, #4a5568);">${sp.complimentaryTickets} passes</td>
        <td style="padding: 12px 10px; font-weight: bold; color: var(--theme-color-text-primary, #1a202c);">$${Number(sp.price).toFixed(2)}</td>
        <td style="padding: 12px 10px; text-align: right;">
          <button class="btn-primary btn-add-sponsor-cart" data-id="${sp.id}" data-price="${sp.price}" data-name="${sp.tier} Sponsor" data-price-id="${sp.stripePriceId || ''}" ${isSoldOut ? 'disabled style="background: #cbd5e0; cursor: not-allowed;"' : ''} style="padding: 6px 12px; font-size: 0.8rem; font-weight: bold; border-radius: 4px;">
            ${isSoldOut ? 'Sold Out' : 'Reserve Sponsor'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Wire reserve sponsor handlers
  tbody.querySelectorAll('.btn-add-sponsor-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const spId = e.target.getAttribute('data-id');
      const price = Number(e.target.getAttribute('data-price'));
      const name = e.target.getAttribute('data-name');
      const priceId = e.target.getAttribute('data-price-id') || null;

      eventCart.addItem(evt.id, 'sponsorship', spId, 1, price, name, priceId);
      toast.success(`Reserved 1x ${name} Package!`);
      renderCart();
      openCartSidebar();
    });
  });
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const countBadge = document.getElementById('cart-count-badge');
  if (!container) return;

  const summary = eventCart.getCartSummary();
  const items = summary.items;

  // Render badge count
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  if (countBadge) {
    countBadge.textContent = totalCount;
    countBadge.style.display = totalCount > 0 ? 'flex' : 'none';
  }

  // Update line total elements
  document.getElementById('cart-lbl-subtotal').textContent = `$${summary.subtotal.toFixed(2)}`;
  document.getElementById('cart-lbl-tax').textContent = `$${summary.tax.toFixed(2)}`;
  document.getElementById('cart-lbl-fee').textContent = `$${summary.serviceFee.toFixed(2)}`;
  document.getElementById('cart-lbl-total').textContent = `$${summary.total.toFixed(2)}`;

  if (items.length === 0) {
    container.innerHTML = `<p style="color: #a0aec0; text-align: center; margin-top: 3rem; font-style: italic;">Your registration cart is empty.</p>`;
    return;
  }

  container.innerHTML = items.map(item => {
    let typeLabel = 'Ticket';
    let labelColor = 'var(--theme-color-primary, #2b6cb0)';
    let labelBg = '#ebf8ff';

    if (item.type === 'vendor_booth') {
      typeLabel = 'Exhibitor Space';
      labelColor = '#319795';
      labelBg = '#e6fffa';
    } else if (item.type === 'sponsorship') {
      typeLabel = 'Sponsor Tier';
      labelColor = '#805ad5';
      labelBg = '#faf5ff';
    }

    return `
      <div style="border-bottom: 1px solid var(--theme-color-border, #edf2f7); padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
        <div style="flex: 1;">
          <span style="font-size: 0.65rem; text-transform: uppercase; font-weight: bold; color: ${labelColor}; background: ${labelBg}; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">
            ${typeLabel}
          </span>
          <h5 style="margin: 0; font-size: 0.95rem; font-weight: bold; color: var(--theme-color-text-primary, #2d3748);">${item.name}</h5>
          <div style="font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096); margin-top: 2px;">
            ${item.quantity}x @ $${item.price.toFixed(2)} each
          </div>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
          <strong style="font-size: 0.95rem; color: var(--theme-color-text-primary, #1a202c);">$${(item.price * item.quantity).toFixed(2)}</strong>
          <button class="btn-remove-cart-item" data-id="${item.id}" style="background: transparent; border: none; color: var(--theme-color-danger, #e53e3e); font-size: 0.75rem; cursor: pointer; text-decoration: underline; padding: 0;">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire remove button actions
  container.querySelectorAll('.btn-remove-cart-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      eventCart.removeItem(id);
      renderCart();
      toast.info('Item removed from registration cart.');
    });
  });
}

function openCartSidebar() {
  const sidebar = document.getElementById('cart-sidebar');
  if (sidebar) {
    sidebar.style.right = '0px';
  }
}

function closeCartSidebar() {
  const sidebar = document.getElementById('cart-sidebar');
  if (sidebar) {
    sidebar.style.right = '-420px';
  }
}

function setupEventListeners() {
  // Modal close trigger
  document.getElementById('btn-close-booking')?.addEventListener('click', () => {
    document.getElementById('booking-modal').style.display = 'none';
  });

  // Modal sub-tabs switcher
  document.querySelectorAll('.booking-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.booking-tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.color = 'var(--theme-color-text-secondary, #4a5568)';
        b.style.borderBottomColor = 'transparent';
      });

      e.target.classList.add('active');
      e.target.style.color = 'var(--theme-color-primary, #2b6cb0)';
      e.target.style.borderBottomColor = 'var(--theme-color-primary, #2b6cb0)';

      const tabCode = e.target.getAttribute('data-tab');
      document.querySelectorAll('.booking-section-panel').forEach(panel => {
        panel.style.display = panel.id === `booking-sec-${tabCode}` ? 'block' : 'none';
      });
    });
  });

  // Floating Cart Button click toggles sidebar
  document.getElementById('btn-floating-cart')?.addEventListener('click', () => {
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar) {
      if (sidebar.style.right === '0px') {
        closeCartSidebar();
      } else {
        openCartSidebar();
      }
    }
  });

  // Close Cart Sidebar
  document.getElementById('btn-close-cart')?.addEventListener('click', closeCartSidebar);

  // Cart checkout secure payment processing
  document.getElementById('btn-cart-checkout')?.addEventListener('click', async () => {
    const summary = eventCart.getCartSummary();
    if (summary.items.length === 0) {
      toast.warning('Your registration cart is empty!');
      return;
    }

    const checkoutBtn = document.getElementById('btn-cart-checkout');
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Preparing Secure Gateway...';

    try {
      const user = store.state.user;
      const refId = sessionStorage.getItem('foundation_ref_id') || '';

      const lineItemsMetadata = {
        type: 'event_registration',
        eventId: summary.eventId,
        userId: user?.uid || 'guest',
        affiliateId: refId,
        cartItems: JSON.stringify(summary.items)
      };

      const lineItems = summary.items.map(item => {
        if (item.stripePriceId) {
          return {
            priceId: item.stripePriceId,
            quantity: item.quantity
          };
        } else {
          return {
            amount: Math.round(item.price * 100), // in cents
            name: item.name,
            quantity: item.quantity,
            currency: 'USD'
          };
        }
      });

      if (summary.tax > 0) {
        lineItems.push({
          amount: Math.round(summary.tax * 100),
          name: 'Event Tax (8.25%)',
          quantity: 1,
          currency: 'USD'
        });
      }

      if (summary.serviceFee > 0) {
        lineItems.push({
          amount: Math.round(summary.serviceFee * 100),
          name: 'Processing Fee',
          quantity: 1,
          currency: 'USD'
        });
      }

      const response = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user?.email || 'guest@example.com',
          role: store.state.simulatedUserTier || user?.role || 'subscriber',
          productId: currentActiveEvent?.title || 'Event Registration',
          lineItems,
          currency: 'USD',
          affiliateId: refId,
          mode: 'payment',
          metadata: lineItemsMetadata
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Checkout session request rejected');
      }

      const resData = await response.json();
      if (resData.url) {
        toast.info('Directing to Stripe secure checkout...');
        // Clear cart immediately on successful checkout session creation
        eventCart.clearCart();
        renderCart();
        closeCartSidebar();
        document.getElementById('booking-modal').style.display = 'none';

        // Post-action review prompt trigger (Directive 3)
        setTimeout(() => {
          toast.info("Enjoying Foundation? Help us grow by leaving a quick 5-star Google review!", 6000);
        }, 2000);

        // Redirect to stripe checkout
        window.location.href = resData.url;
      } else {
        throw new Error('No checkout URL returned from stripe endpoint');
      }

    } catch (err) {
      errorHandler.handleError(err, 'Events Cart Checkout Redirect');
      toast.error(`Checkout connection failed: ${err.message}`);
    } finally {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Proceed to Secure Checkout';
    }
  });
}
