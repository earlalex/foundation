// pages/admin/admin-events.js
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { errorHandler } from '../../core/error-handler.js';
import { store } from '../../core/store.js';
import { stripeService } from '../../core/stripe.js';
import { configManager } from '../../core/config.js';

let activeEventId = 'sample-summit'; // default active event workspace

export async function initAdminEventsTab() {
  setupDynamicRowAdding();
  setupLocationToggle();
  setupAppointmentConfigurator();
  await ensureMockRegistrationsSeeded();
  await loadEventBuilderWorkspace();
  await loadRegistrantsRoster();

  // Handle main form submission
  const form = document.getElementById('admin-event-builder-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleEventSave();
    });
  }

  // Handle reset button
  document.getElementById('btn-admin-reset-event-form')?.addEventListener('click', () => {
    form.reset();
    document.getElementById('admin-event-id').value = '';
    document.getElementById('admin-ticket-list').innerHTML = '';
    document.getElementById('admin-vendor-list').innerHTML = '';
    document.getElementById('admin-sponsor-list').innerHTML = '';
    toast.info('Event Builder form cleared.');
  });

  // Handle Export CSV
  document.getElementById('btn-admin-export-attendees')?.addEventListener('click', exportRosterToCSV);

  // Handle Broadcast to Attendees
  document.getElementById('btn-admin-broadcast-attendees')?.addEventListener('click', broadcastToAttendees);
}

function setupLocationToggle() {
  const select = document.getElementById('admin-event-loc-type');
  const physicalFields = document.getElementById('admin-event-physical-fields');
  const virtualFields = document.getElementById('admin-event-virtual-fields');

  select?.addEventListener('change', (e) => {
    if (e.target.value === 'virtual') {
      if (physicalFields) physicalFields.style.display = 'none';
      if (virtualFields) virtualFields.style.display = 'block';
    } else {
      if (physicalFields) physicalFields.style.display = 'grid';
      if (virtualFields) virtualFields.style.display = 'none';
    }
  });
}

async function ensureMockRegistrationsSeeded() {
  try {
    const list = await contentDB.getAllRegistrations();
    if (list.length === 0) {
      const mockReg = {
        id: 'mock_reg_1',
        eventId: 'sample-summit',
        email: 'registrant1@example.com',
        userId: 'mock_user_1',
        accessCode: 'ASC-12345',
        cartItems: JSON.stringify([
          { type: 'ticket', quantity: 1, name: 'Early Bird Pass', price: 49.00 }
        ]),
        createdAt: new Date().toISOString()
      };
      await contentDB.saveRegistration(mockReg);
    }
  } catch (err) {
    console.warn('[Admin Events]: Mock registration seeding failed:', err);
  }
}

function setupDynamicRowAdding() {
  // 1. Ticket Rows
  document.getElementById('btn-admin-add-ticket-row')?.addEventListener('click', () => {
    addTicketRow();
  });

  // 2. Vendor Rows
  document.getElementById('btn-admin-add-vendor-row')?.addEventListener('click', () => {
    addVendorRow();
  });

  // 3. Sponsor Rows
  document.getElementById('btn-admin-add-sponsor-row')?.addEventListener('click', () => {
    addSponsorRow();
  });
}

function addTicketRow(data = {}) {
  const container = document.getElementById('admin-ticket-list');
  if (!container) return;

  const id = data.id || 't_' + Math.random().toString(36).substring(2, 7);
  const stripeProductId = data.stripeProductId || '';
  const stripePriceId = data.stripePriceId || '';

  const stripeBadge = stripePriceId
    ? `<div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); display: flex; align-items: center; gap: 4px;">
         <span>ID: <code>${stripePriceId}</code></span>
         <button type="button" class="btn-copy-stripe-id" data-copy="${stripePriceId}" style="padding: 1px 4px; font-size: 0.7rem; border: 1px solid #cbd5e0; border-radius: 3px; background: white; cursor: pointer;">[ Copy Stripe ID ]</button>
         <a href="https://dashboard.stripe.com/test/products/${stripeProductId}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: bold; text-decoration: underline;">View</a>
       </div>`
    : '<span style="font-size: 0.75rem; color: #a0aec0;">Unsynced</span>';

  const row = document.createElement('div');
  row.className = 'admin-ticket-row';
  row.style.cssText = 'display: grid; grid-template-columns: 1.5fr 1fr 1fr 2fr 1.5fr auto; gap: 0.5rem; align-items: center; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem;';
  row.innerHTML = `
    <input type="hidden" class="ticket-id" value="${id}" />
    <input type="hidden" class="ticket-stripe-product-id" value="${stripeProductId}" />
    <input type="hidden" class="ticket-stripe-price-id" value="${stripePriceId}" />
    <input type="text" class="ticket-name" placeholder="Tier Name (e.g. Early Bird)" value="${data.name || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="number" step="0.01" class="ticket-price" placeholder="Price ($)" value="${data.price || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="number" class="ticket-capacity" placeholder="Capacity" value="${data.capacity || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="text" class="ticket-desc" placeholder="Brief perks description..." value="${data.description || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <div class="stripe-info-container" style="min-width: 0; overflow: hidden; text-overflow: ellipsis;">${stripeBadge}</div>
    <button type="button" class="btn-remove-row" style="background: transparent; border: none; color: #e53e3e; font-size: 1.25rem; font-weight: bold; cursor: pointer;">&times;</button>
  `;

  row.querySelector('.btn-remove-row').onclick = () => row.remove();
  const copyBtn = row.querySelector('.btn-copy-stripe-id');
  if (copyBtn) {
    copyBtn.onclick = (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(copyBtn.dataset.copy);
      toast.success(`Copied Stripe Price ID: ${copyBtn.dataset.copy}`);
    };
  }
  container.appendChild(row);
}

function addVendorRow(data = {}) {
  const container = document.getElementById('admin-vendor-list');
  if (!container) return;

  const id = data.id || 'v_' + Math.random().toString(36).substring(2, 7);
  const stripeProductId = data.stripeProductId || '';
  const stripePriceId = data.stripePriceId || '';

  const stripeBadge = stripePriceId
    ? `<div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); display: flex; align-items: center; gap: 4px;">
         <span>ID: <code>${stripePriceId}</code></span>
         <button type="button" class="btn-copy-stripe-id" data-copy="${stripePriceId}" style="padding: 1px 4px; font-size: 0.7rem; border: 1px solid #cbd5e0; border-radius: 3px; background: white; cursor: pointer;">[ Copy Stripe ID ]</button>
         <a href="https://dashboard.stripe.com/test/products/${stripeProductId}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: bold; text-decoration: underline;">View</a>
       </div>`
    : '<span style="font-size: 0.75rem; color: #a0aec0;">Unsynced</span>';

  const row = document.createElement('div');
  row.className = 'admin-vendor-row';
  row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 3fr 1.5fr auto; gap: 0.5rem; align-items: center; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem;';

  const perksJoined = Array.isArray(data.perks) ? data.perks.join(', ') : '';

  row.innerHTML = `
    <input type="hidden" class="vendor-id" value="${id}" />
    <input type="hidden" class="vendor-stripe-product-id" value="${stripeProductId}" />
    <input type="hidden" class="vendor-stripe-price-id" value="${stripePriceId}" />
    <input type="text" class="vendor-name" placeholder="Package Name" value="${data.name || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="number" step="0.01" class="vendor-price" placeholder="Price ($)" value="${data.price || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="number" class="vendor-capacity" placeholder="Capacity" value="${data.capacity || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="text" class="vendor-perks" placeholder="Perks (comma-separated list)" value="${perksJoined}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <div class="stripe-info-container" style="min-width: 0; overflow: hidden; text-overflow: ellipsis;">${stripeBadge}</div>
    <button type="button" class="btn-remove-row" style="background: transparent; border: none; color: #e53e3e; font-size: 1.25rem; font-weight: bold; cursor: pointer;">&times;</button>
  `;

  row.querySelector('.btn-remove-row').onclick = () => row.remove();
  const copyBtn = row.querySelector('.btn-copy-stripe-id');
  if (copyBtn) {
    copyBtn.onclick = (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(copyBtn.dataset.copy);
      toast.success(`Copied Stripe Price ID: ${copyBtn.dataset.copy}`);
    };
  }
  container.appendChild(row);
}

function addSponsorRow(data = {}) {
  const container = document.getElementById('admin-sponsor-list');
  if (!container) return;

  const id = data.id || 's_' + Math.random().toString(36).substring(2, 7);
  const stripeProductId = data.stripeProductId || '';
  const stripePriceId = data.stripePriceId || '';

  const stripeBadge = stripePriceId
    ? `<div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); display: flex; align-items: center; gap: 4px;">
         <span>ID: <code>${stripePriceId}</code></span>
         <button type="button" class="btn-copy-stripe-id" data-copy="${stripePriceId}" style="padding: 1px 4px; font-size: 0.7rem; border: 1px solid #cbd5e0; border-radius: 3px; background: white; cursor: pointer;">[ Copy Stripe ID ]</button>
         <a href="https://dashboard.stripe.com/test/products/${stripeProductId}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: bold; text-decoration: underline;">View</a>
       </div>`
    : '<span style="font-size: 0.75rem; color: #a0aec0;">Unsynced</span>';

  const row = document.createElement('div');
  row.className = 'admin-sponsor-row';
  row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 2fr 1fr 1fr 1.5fr auto; gap: 0.5rem; align-items: center; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem;';
  row.innerHTML = `
    <input type="hidden" class="sponsor-id" value="${id}" />
    <input type="hidden" class="sponsor-stripe-product-id" value="${stripeProductId}" />
    <input type="hidden" class="sponsor-stripe-price-id" value="${stripePriceId}" />
    <input type="text" class="sponsor-tier" placeholder="Sponsorship Tier" value="${data.tier || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="number" step="0.01" class="sponsor-price" placeholder="Price ($)" value="${data.price || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="text" class="sponsor-placement" placeholder="Logo Placement" value="${data.logoPlacement || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="number" class="sponsor-passes" placeholder="Complimentary passes" value="${data.complimentaryTickets || ''}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <input type="number" class="sponsor-capacity" placeholder="Capacity" value="${data.capacity || '1'}" required style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
    <div class="stripe-info-container" style="min-width: 0; overflow: hidden; text-overflow: ellipsis;">${stripeBadge}</div>
    <button type="button" class="btn-remove-row" style="background: transparent; border: none; color: #e53e3e; font-size: 1.25rem; font-weight: bold; cursor: pointer;">&times;</button>
  `;

  row.querySelector('.btn-remove-row').onclick = () => row.remove();
  const copyBtn = row.querySelector('.btn-copy-stripe-id');
  if (copyBtn) {
    copyBtn.onclick = (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(copyBtn.dataset.copy);
      toast.success(`Copied Stripe Price ID: ${copyBtn.dataset.copy}`);
    };
  }
  container.appendChild(row);
}

async function loadEventBuilderWorkspace() {
  try {
    const event = await contentDB.getContentById(activeEventId);
    if (!event) return;

    document.getElementById('admin-event-id').value = event.id || '';
    document.getElementById('admin-event-title').value = event.title || '';
    document.getElementById('admin-event-slug').value = event.slug || '';
    document.getElementById('admin-event-date').value = event.date || '';
    document.getElementById('admin-event-desc').value = event.description || '';
    document.getElementById('admin-event-access').value = event.accessVisibility || event.access?.visibility || 'public';

    // Prefill Media fields
    if (document.getElementById('admin-event-flyer')) {
      document.getElementById('admin-event-flyer').value = event.flyerUrl || '';
    }
    if (document.getElementById('admin-event-banner')) {
      document.getElementById('admin-event-banner').value = event.bannerUrl || '';
    }
    if (document.getElementById('admin-event-promo')) {
      document.getElementById('admin-event-promo').value = event.promoVideoUrl || '';
    }

    if (event.location?.type === 'virtual') {
      document.getElementById('admin-event-loc-type').value = 'virtual';
      document.getElementById('admin-event-meeturl').value = event.location?.meetingUrl || event.meetUrl || '';
      document.getElementById('admin-event-physical-fields').style.display = 'none';
      document.getElementById('admin-event-virtual-fields').style.display = 'block';
    } else {
      document.getElementById('admin-event-loc-type').value = 'physical';
      document.getElementById('admin-event-venue').value = event.location?.venueName || event.location || '';
      document.getElementById('admin-event-address').value = event.location?.address || '';
      document.getElementById('admin-event-physical-fields').style.display = 'grid';
      document.getElementById('admin-event-virtual-fields').style.display = 'none';
    }

    // Load ticket tiers
    const ticketContainer = document.getElementById('admin-ticket-list');
    if (ticketContainer) {
      ticketContainer.innerHTML = '';
      (event.ticketTypes || []).forEach(t => addTicketRow(t));
    }

    // Load vendor rows
    const vendorContainer = document.getElementById('admin-vendor-list');
    if (vendorContainer) {
      vendorContainer.innerHTML = '';
      (event.vendorPackages || []).forEach(v => addVendorRow(v));
    }

    // Load sponsor rows
    const sponsorContainer = document.getElementById('admin-sponsor-list');
    if (sponsorContainer) {
      sponsorContainer.innerHTML = '';
      (event.sponsorshipPackages || []).forEach(s => addSponsorRow(s));
    }

  } catch (err) {
    console.warn('[Admin Events]: Failed to load active event builder workspace', err);
  }
}

async function handleEventSave() {
  try {
    const id = document.getElementById('admin-event-id').value || 'event_' + Date.now();
    const title = document.getElementById('admin-event-title').value;
    const slug = document.getElementById('admin-event-slug').value;
    const date = document.getElementById('admin-event-date').value;
    const desc = document.getElementById('admin-event-desc').value;
    const locType = document.getElementById('admin-event-loc-type').value;
    const accessVisibility = document.getElementById('admin-event-access').value;

    const flyerUrl = document.getElementById('admin-event-flyer')?.value || '';
    const bannerUrl = document.getElementById('admin-event-banner')?.value || '';
    const promoVideoUrl = document.getElementById('admin-event-promo')?.value || '';

    const location = {
      type: locType,
      venueName: locType === 'physical' ? document.getElementById('admin-event-venue').value : 'Google Meet',
      address: locType === 'physical' ? document.getElementById('admin-event-address').value : '',
      meetingUrl: locType === 'virtual' ? document.getElementById('admin-event-meeturl').value : ''
    };

    // Gather ticket rows with automatic Stripe registration
    toast.info('Synchronizing ticketing and packages with Stripe...');
    const ticketTypes = [];
    for (const row of document.querySelectorAll('.admin-ticket-row')) {
      let tStripeProductId = row.querySelector('.ticket-stripe-product-id').value;
      let tStripePriceId = row.querySelector('.ticket-stripe-price-id').value;
      const tName = row.querySelector('.ticket-name').value;
      const tPrice = Number(row.querySelector('.ticket-price').value);
      const tDesc = row.querySelector('.ticket-desc').value;

      if (!tStripeProductId || !tStripePriceId) {
        const stripeRes = await stripeService.registerStripeProduct(
          `${title} - ${tName}`,
          tDesc || `Ticket for ${title}`,
          Math.round(tPrice * 100),
          'usd',
          false
        );
        tStripeProductId = stripeRes.productId;
        tStripePriceId = stripeRes.priceId;
      }

      ticketTypes.push({
        id: row.querySelector('.ticket-id').value,
        stripeProductId: tStripeProductId,
        stripePriceId: tStripePriceId,
        name: tName,
        price: tPrice,
        capacity: Number(row.querySelector('.ticket-capacity').value),
        sold: 0,
        description: tDesc
      });
    }

    // Gather vendor packages with automatic Stripe registration
    const vendorPackages = [];
    for (const row of document.querySelectorAll('.admin-vendor-row')) {
      let vStripeProductId = row.querySelector('.vendor-stripe-product-id').value;
      let vStripePriceId = row.querySelector('.vendor-stripe-price-id').value;
      const vName = row.querySelector('.vendor-name').value;
      const vPrice = Number(row.querySelector('.vendor-price').value);
      const perksRaw = row.querySelector('.vendor-perks').value || '';
      const perks = perksRaw.split(',').map(p => p.trim()).filter(p => p.length > 0);

      if (!vStripeProductId || !vStripePriceId) {
        const stripeRes = await stripeService.registerStripeProduct(
          `${title} - Vendor: ${vName}`,
          `Exhibitor package for ${title}. Perks: ${perks.join(', ')}`,
          Math.round(vPrice * 100),
          'usd',
          false
        );
        vStripeProductId = stripeRes.productId;
        vStripePriceId = stripeRes.priceId;
      }

      vendorPackages.push({
        id: row.querySelector('.vendor-id').value,
        stripeProductId: vStripeProductId,
        stripePriceId: vStripePriceId,
        name: vName,
        price: vPrice,
        capacity: Number(row.querySelector('.vendor-capacity').value),
        sold: 0,
        perks
      });
    }

    // Gather sponsors packages with automatic Stripe registration
    const sponsorshipPackages = [];
    for (const row of document.querySelectorAll('.admin-sponsor-row')) {
      let sStripeProductId = row.querySelector('.sponsor-stripe-product-id').value;
      let sStripePriceId = row.querySelector('.sponsor-stripe-price-id').value;
      const sTier = row.querySelector('.sponsor-tier').value;
      const sPrice = Number(row.querySelector('.sponsor-price').value);
      const sPlacement = row.querySelector('.sponsor-placement').value;
      const sPasses = Number(row.querySelector('.sponsor-passes').value);

      if (!sStripeProductId || !sStripePriceId) {
        const stripeRes = await stripeService.registerStripeProduct(
          `${title} - Sponsor: ${sTier}`,
          `Sponsorship package for ${title}. Placement: ${sPlacement}. Includes ${sPasses} passes.`,
          Math.round(sPrice * 100),
          'usd',
          false
        );
        sStripeProductId = stripeRes.productId;
        sStripePriceId = stripeRes.priceId;
      }

      sponsorshipPackages.push({
        id: row.querySelector('.sponsor-id').value,
        stripeProductId: sStripeProductId,
        stripePriceId: sStripePriceId,
        tier: sTier,
        price: sPrice,
        logoPlacement: sPlacement,
        complimentaryTickets: sPasses,
        capacity: Number(row.querySelector('.sponsor-capacity').value),
        sold: 0
      });
    }

    const eventPayload = {
      type: 'event',
      id,
      title,
      slug,
      date,
      description: desc,
      location,
      flyerUrl,
      bannerUrl,
      promoVideoUrl,
      ticketTypes,
      vendorPackages,
      sponsorshipPackages,
      accessVisibility,
      updatedAt: new Date().toISOString()
    };

    const success = await contentDB.saveEvent(eventPayload);
    if (success) {
      toast.success(`Successfully saved event configuration for "${title}"!`);
      activeEventId = id;
      await loadEventBuilderWorkspace();
      await loadRegistrantsRoster();
    } else {
      toast.error('Failed to save event. Try again.');
    }
  } catch (err) {
    errorHandler.handleError(err, 'Admin - Event Save');
    toast.error(`Save failed: ${err.message}`);
  }
}


async function loadRegistrantsRoster() {
  const tbody = document.getElementById('admin-registrants-tbody');
  if (!tbody) return;

  try {
    const list = await contentDB.getAllRegistrations();
    const eventRegs = list.filter(r => r.eventId === activeEventId || !r.eventId);

    // Compute sales margins
    let totalTicketSold = 0;
    let vendorBoothsCount = 0;
    let sponsorsCount = 0;

    if (eventRegs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #a0aec0; border: 1px dashed var(--theme-color-border);">No registrations logged for this event.<br><span style="font-size:0.8rem;color:#718096;">No active items registered yet. Click 'Create Item' above to get started.</span></td></tr>`;
      updateSalesCounters(0, 0, 0);
      return;
    }

    tbody.innerHTML = eventRegs.map(reg => {
      let boughtList = [];
      try {
        boughtList = JSON.parse(reg.cartItems || '[]');
      } catch (e) {}

      boughtList.forEach(i => {
        if (i.type === 'ticket') totalTicketSold += i.quantity;
        if (i.type === 'vendor_booth') vendorBoothsCount += i.quantity;
        if (i.type === 'sponsorship') sponsorsCount += i.quantity;
      });

      const itemsText = boughtList.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const localDate = new Date(reg.createdAt || reg.date || Date.now()).toLocaleDateString();

      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
          <td style="padding: 10px;">${localDate}</td>
          <td style="padding: 10px;">
            <strong>${reg.email}</strong>
            <div style="font-size: 0.75rem; color: #718096;">ID: ${reg.userId || 'guest'}</div>
          </td>
          <td style="padding: 10px; font-family: monospace; font-weight: bold; color: var(--theme-color-primary, #2b6cb0);">${reg.accessCode}</td>
          <td style="padding: 10px; font-size: 0.85rem; color: var(--theme-color-text-secondary, #4a5568);">${itemsText}</td>
          <td style="padding: 10px; text-align: right;">
            <span style="padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; background: #c6f6d5; color: #22543d;">Confirmed</span>
          </td>
        </tr>
      `;
    }).join('');

    updateSalesCounters(totalTicketSold, vendorBoothsCount, sponsorsCount);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-color-danger, #e53e3e); padding: 1.5rem;">Failed to load roster.</td></tr>`;
  }
}

function updateSalesCounters(tickets, vendors, sponsors) {
  const tk = document.getElementById('admin-lbl-ticket-sales');
  const vd = document.getElementById('admin-lbl-vendor-sales');
  const sp = document.getElementById('admin-lbl-sponsor-sales');

  if (tk) tk.textContent = `${tickets} Tickets Sold`;
  if (vd) vd.textContent = `${vendors} Booths Occupied`;
  if (sp) sp.textContent = `${sponsors} Active Sponsors`;
}

async function exportRosterToCSV() {
  try {
    const list = await contentDB.getAllRegistrations();
    const eventRegs = list.filter(r => r.eventId === activeEventId || !r.eventId);

    if (eventRegs.length === 0) {
      toast.warning('No registrants found to export.');
      return;
    }

    const headers = ['Date Registered', 'Email', 'User ID', 'Access Code', 'Purchased Items', 'Status'];
    const rows = eventRegs.map(reg => {
      let itemsList = [];
      try {
        itemsList = JSON.parse(reg.cartItems || '[]');
      } catch (e) {}
      const itemsText = itemsList.map(i => `${i.quantity}x ${i.name}`).join(' | ');

      return [
        new Date(reg.createdAt).toLocaleDateString(),
        reg.email,
        reg.userId || 'guest',
        reg.accessCode,
        itemsText,
        'Confirmed'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`);
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendee-roster-${activeEventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Attendee roster exported to CSV successfully!');
  } catch (e) {
    toast.error('CSV Export failed.');
  }
}

async function broadcastToAttendees() {
  try {
    const list = await contentDB.getAllRegistrations();
    const eventRegs = list.filter(r => r.eventId === activeEventId || !r.eventId);

    if (eventRegs.length === 0) {
      toast.warning('No registered attendees found to pre-load for broadcast.');
      return;
    }

    // Grab list of attendee emails
    const emails = [...new Set(eventRegs.map(r => r.email))].join(', ');

    // Redirect or populate Email template creator block
    const tabCmsBtn = document.querySelector('.admin-tab[data-tab="users"]');
    if (tabCmsBtn) {
      tabCmsBtn.click();

      const massEmailTarget = document.getElementById('mass-email-target-role');
      if (massEmailTarget) massEmailTarget.value = 'all';

      const massEmailSubject = document.getElementById('mass-email-subject');
      if (massEmailSubject) massEmailSubject.value = `Important Update: Ascension Avenue Summit 2026 Attendees`;

      const massEmailBody = document.getElementById('mass-email-body');
      if (massEmailBody) {
        massEmailBody.value = `Dear Summit Participant,\n\nWe are extremely excited for you to participate in the upcoming Ascension Avenue Summit 2026. Here is some important logistical information regarding the venue stages and presentation times...\n\nSincerely,\nThe Event Directors`;
      }

      toast.success(`Pre-loaded ${eventRegs.length} attendees inside the Gmail Mass Email Broadcaster workspace!`);
    } else {
      toast.info(`Attendees emails collected: ${emails}`);
    }
  } catch (e) {
    toast.error('Failed to pre-load broadcast roster.');
  }
}

function setupAppointmentConfigurator() {
  const form = document.getElementById('appointment-config-form');
  if (!form) return;

  const apptCfg = configManager.current.appointments || {};

  // Populate days checkboxes
  const dayCheckboxes = form.querySelectorAll('input[name="appt-days"]');
  const operatingDays = apptCfg.operatingDays || ["Mon", "Tue", "Wed", "Thu", "Fri"];
  dayCheckboxes.forEach(cb => {
    cb.checked = operatingDays.includes(cb.value);
  });

  // Populate basic inputs
  const startTime = document.getElementById('appt-cfg-start');
  const endTime = document.getElementById('appt-cfg-end');
  const duration = document.getElementById('appt-cfg-duration');
  const buffer = document.getElementById('appt-cfg-buffer');

  if (startTime) startTime.value = apptCfg.operatingHoursStart || "09:00";
  if (endTime) endTime.value = apptCfg.operatingHoursEnd || "17:00";
  if (duration) duration.value = apptCfg.slotDuration || "30";
  if (buffer) buffer.value = apptCfg.bufferTime || "15";

  // Populate payment rule checkbox
  const requirePayment = document.getElementById('appt-cfg-require-payment');
  const monetizationDetails = document.getElementById('appt-monetization-details');

  if (requirePayment) {
    requirePayment.checked = !!apptCfg.requirePayment;
    if (monetizationDetails) {
      monetizationDetails.style.display = requirePayment.checked ? 'flex' : 'none';
    }

    requirePayment.addEventListener('change', (e) => {
      if (monetizationDetails) {
        monetizationDetails.style.display = e.target.checked ? 'flex' : 'none';
      }
    });
  }

  // Populate monetization details
  const totalFee = document.getElementById('appt-cfg-total-fee');
  const depositAmount = document.getElementById('appt-cfg-deposit-amount');
  const depositPercentage = document.getElementById('appt-cfg-deposit-percentage');
  const autoInvoice = document.getElementById('appt-cfg-auto-invoice');

  if (totalFee) totalFee.value = ((apptCfg.totalFee || 15000) / 100).toFixed(2);
  if (depositAmount) depositAmount.value = ((apptCfg.depositAmount || 5000) / 100).toFixed(2);
  if (depositPercentage) depositPercentage.value = apptCfg.depositPercentage || 50;
  if (autoInvoice) autoInvoice.checked = !!apptCfg.autoInvoice;

  // Radio button for deposit structure
  const structures = form.querySelectorAll('input[name="appt-cfg-structure"]');
  structures.forEach(rad => {
    rad.checked = rad.value === (apptCfg.depositStructure || "full");
  });

  // Populate notifications
  const notifyAdmin = document.getElementById('appt-cfg-notify-admin');
  const notifyAppointee = document.getElementById('appt-cfg-notify-appointee');
  const dashboardAlerts = document.getElementById('appt-cfg-dashboard-alerts');

  if (notifyAdmin) notifyAdmin.checked = !!apptCfg.notifyAdminEmail;
  if (notifyAppointee) notifyAppointee.checked = !!apptCfg.notifyAppointeeEmail;
  if (dashboardAlerts) dashboardAlerts.checked = !!apptCfg.dashboardAlerts;

  // Handle Save
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = form.querySelector('button[type="submit"]');
    const originalText = saveBtn?.textContent;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      const selectedDays = Array.from(form.querySelectorAll('input[name="appt-days"]:checked')).map(cb => cb.value);
      const activeStructure = form.querySelector('input[name="appt-cfg-structure"]:checked')?.value || 'full';

      const updatedAppointments = {
        operatingDays: selectedDays,
        operatingHoursStart: startTime?.value || "09:00",
        operatingHoursEnd: endTime?.value || "17:00",
        slotDuration: duration?.value || "30",
        bufferTime: buffer?.value || "15",
        requirePayment: !!requirePayment?.checked,
        totalFee: Math.round(parseFloat(totalFee?.value || "150.00") * 100),
        depositStructure: activeStructure,
        depositAmount: Math.round(parseFloat(depositAmount?.value || "50.00") * 100),
        depositPercentage: parseInt(depositPercentage?.value || "50", 10),
        autoInvoice: !!autoInvoice?.checked,
        notifyAdminEmail: !!notifyAdmin?.checked,
        notifyAppointeeEmail: !!notifyAppointee?.checked,
        dashboardAlerts: !!dashboardAlerts?.checked
      };

      const success = await configManager.saveToFirebase({
        ...configManager.current,
        appointments: updatedAppointments
      });

      if (success) {
        toast.success('Consultation & Appointment settings saved successfully!');
      } else {
        toast.error('Failed to save settings. Please try again.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin Events - Appointment Config Save');
      toast.error(`Error saving settings: ${err.message}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  });
}
