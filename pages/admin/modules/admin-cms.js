// pages/admin/modules/admin-cms.js
import { contentDB } from '../../../core/db.js';
import { toast } from '../../../utils/toast.js';
import { getAssetSplits, saveAssetSplits } from '../../../core/royalties.js';

let currentEditingItem = null;

export function initAdminCms() {
  console.log('[CMS Module]: initAdminCms triggered');
  const cmsTab = document.getElementById('tab-cms');
  if (!cmsTab) {
    console.error('[CMS Module]: Could not find #tab-cms container!');
    return;
  }

  // Inject Contributor Royalty Splits card into the #cms-form if not already present
  const cmsForm = document.getElementById('cms-form');
  if (cmsForm && !document.getElementById('cms-splits-card')) {
    injectCmsSplitsCard(cmsForm);
  }

  // 1. Create or ensure the content manager card is present
  let managerCard = document.getElementById('cms-content-manager-card');
  if (!managerCard) {
    console.log('[CMS Module]: Creating #cms-content-manager-card dynamically...');
    managerCard = document.createElement('div');
    managerCard.id = 'cms-content-manager-card';
    managerCard.style.cssText = `
      background: var(--theme-color-surface, #ffffff);
      border: 1px solid var(--theme-color-border, #e2e8f0);
      padding: 1.5rem;
      border-radius: var(--theme-layout-border-radius, 8px);
      margin-top: 1.5rem;
    `;
    cmsTab.appendChild(managerCard);
  }

  // 2. Create or ensure the Public Site & Page Manager card is present (Directive 4)
  let heroConfigCard = document.getElementById('cms-hero-configurator-card');
  if (!heroConfigCard) {
    console.log('[CMS Module]: Creating #cms-hero-configurator-card dynamically...');
    heroConfigCard = document.createElement('div');
    heroConfigCard.id = 'cms-hero-configurator-card';
    heroConfigCard.style.cssText = `
      background: var(--theme-color-surface, #ffffff);
      border: 1px solid var(--theme-color-border, #e2e8f0);
      padding: 1.5rem;
      border-radius: var(--theme-layout-border-radius, 8px);
      margin-top: 1.5rem;
    `;
    cmsTab.appendChild(heroConfigCard);
  }

  // 3. Render Categories & Items List
  renderContentManager(managerCard);

  // 4. Render Public Site & Page Manager panel (Directive 4)
  renderHeroConfigurator(heroConfigCard);

  // Hook into form submit of #cms-form to reset editing state and refresh lists
  if (cmsForm) {
    const originalSubmitBtn = cmsForm.querySelector('button[type="submit"]');

    if (cmsForm.dataset.listenerBound !== 'true') {
      cmsForm.dataset.listenerBound = 'true';

      // Capture phase interceptor to validate split total percentages (Must equal 100% if custom splits are configured)
      cmsForm.addEventListener('submit', async (e) => {
        const rows = cmsForm.querySelectorAll('.cms-split-row');
        if (rows.length > 0) {
          let sum = 0;
          rows.forEach(row => {
            sum += parseFloat(row.querySelector('.cms-split-pct').value || 0);
          });

          if (Math.abs(sum - 100) > 0.01) {
            e.preventDefault();
            e.stopPropagation();
            toast.error(`Contributor Royalty splits must sum up to exactly 100%! Current sum: ${sum}%`);
            return;
          }

          // Gather splits
          const splits = [];
          rows.forEach(row => {
            const userEmail = row.querySelector('.cms-split-user').value;
            splits.push({
              userId: userEmail,
              userEmail: userEmail,
              role: row.querySelector('.cms-split-role').value,
              percentage: parseFloat(row.querySelector('.cms-split-pct').value || 0)
            });
          });

          const contentId = document.getElementById('content-id').value;
          const contentType = document.getElementById('content-type').value;

          try {
            await saveAssetSplits(contentId, contentType, splits);
            console.log('[CMS Splits]: Split structures saved successfully for content:', contentId);
          } catch (err) {
            e.preventDefault();
            e.stopPropagation();
            toast.error(`Failed to save royalty splits: ${err.message}`);
            return;
          }
        }
      }, { capture: true });

      cmsForm.addEventListener('submit', async () => {
        // Wait briefly for standard saveContent to resolve, then refresh
        setTimeout(() => {
          currentEditingItem = null;
          const idInput = document.getElementById('content-id');
          if (idInput) idInput.readOnly = false;
          if (originalSubmitBtn) originalSubmitBtn.textContent = 'Publish Content Entry';

          // Clear splits rows
          const rowsContainer = document.getElementById('cms-splits-rows-container');
          if (rowsContainer) rowsContainer.innerHTML = '';
          const totalDisp = document.getElementById('cms-splits-total-display');
          if (totalDisp) {
            totalDisp.textContent = 'Total Split: 0%';
            totalDisp.style.color = '#718096';
          }

          renderContentManager(managerCard);
        }, 800);
      });
    }
  }
}

/**
 * Injects the "Contributor Royalty Splits" accordion card right into the #cms-form.
 */
function injectCmsSplitsCard(form) {
  const splitsCard = document.createElement('div');
  splitsCard.id = 'cms-splits-card';
  splitsCard.style.cssText = `
    background: var(--theme-color-surface-alt, #f8fafc);
    border: 1px solid var(--theme-color-border, #cbd5e0);
    border-radius: var(--theme-layout-border-radius, 8px);
    padding: 1.25rem;
    margin-top: 1rem;
    margin-bottom: 1rem;
  `;

  splitsCard.innerHTML = `
    <h3 style="margin: 0; font-size: 1rem; color: var(--theme-color-primary, #2b6cb0); cursor: pointer; display: flex; align-items: center; justify-content: space-between;" id="cms-splits-header">
      <span>🤝 Contributor Royalty Splits & Allocations</span>
      <span id="cms-splits-toggle-arrow">▶</span>
    </h3>
    <div id="cms-splits-body" style="display: none; margin-top: 1rem; border-top: 1px dashed #cbd5e0; padding-top: 1rem;">
      <p style="font-size: 0.82rem; color: var(--theme-color-text-secondary, #718096); margin-bottom: 1rem; line-height: 1.4;">
        Configure dynamic royalty split allocations. The total percentage must sum up to exactly 100%. Unconfigured assets default to 100% Admin allocation.
      </p>
      <div id="cms-splits-rows-container" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <button type="button" id="btn-cms-add-split" class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem; background: #319795; border: none; cursor: pointer;">
          + Add Contributor Row
        </button>
        <div id="cms-splits-total-display" style="font-weight: bold; font-size: 0.95rem; color: #718096;">
          Total Split: 0%
        </div>
      </div>
    </div>
  `;

  // Insert before the submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    form.insertBefore(splitsCard, submitBtn);
  } else {
    form.appendChild(splitsCard);
  }

  // Accordion toggle
  const header = splitsCard.querySelector('#cms-splits-header');
  const body = splitsCard.querySelector('#cms-splits-body');
  const arrow = splitsCard.querySelector('#cms-splits-toggle-arrow');
  if (header && body && arrow) {
    header.onclick = () => {
      if (body.style.display === 'none') {
        body.style.display = 'block';
        arrow.textContent = '▼';
      } else {
        body.style.display = 'none';
        arrow.textContent = '▶';
      }
    };
  }

  // Add Row Handler
  const addBtn = splitsCard.querySelector('#btn-cms-add-split');
  if (addBtn) {
    addBtn.onclick = () => {
      addCmsSplitRow();
    };
  }
}

/**
 * Appends a new contributor split row to the accordion splits rows container.
 */
async function addCmsSplitRow(initialData = null) {
  const container = document.getElementById('cms-splits-rows-container');
  if (!container) return;

  // Retrieve existing users to auto-populate select dropdown
  let usersList = [];
  try {
    usersList = await contentDB.getAllUsers();
  } catch (err) {}

  const fallbackEmails = [
    'admin@earlalex.com',
    'editor@earlalex.com',
    'director@earlalex.com',
    'writer@earlalex.com',
    'designer@earlalex.com',
    'guest_creator@earlalex.com'
  ];

  const uniqueEmails = Array.from(new Set([
    ...usersList.map(u => u.email).filter(Boolean),
    ...fallbackEmails
  ]));

  const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);

  const rowDiv = document.createElement('div');
  rowDiv.id = rowId;
  rowDiv.className = 'cms-split-row';
  rowDiv.style.cssText = `
    display: grid;
    grid-template-columns: 2fr 1fr 1fr auto;
    gap: 0.5rem;
    align-items: center;
    background: white;
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  `;

  const userOptions = uniqueEmails.map(email => {
    const isSelected = initialData && initialData.userEmail === email ? 'selected' : '';
    return `<option value="${email}" ${isSelected}>${email}</option>`;
  }).join('');

  const roles = ['Director', 'Editor', 'Writer', 'Guest', 'Designer', 'Artist', 'Publisher'];
  const roleOptions = roles.map(r => {
    const isSelected = initialData && initialData.role === r ? 'selected' : '';
    return `<option value="${r}" ${isSelected}>${r}</option>`;
  }).join('');

  const initialPct = initialData ? initialData.percentage : 0;

  rowDiv.innerHTML = `
    <select class="cms-split-user" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;">
      ${userOptions}
    </select>
    <select class="cms-split-role" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;">
      ${roleOptions}
    </select>
    <div style="display: flex; align-items: center; gap: 4px;">
      <input type="number" class="cms-split-pct" min="0" max="100" step="1" value="${initialPct}" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
      <span style="font-size: 0.85rem; font-weight: bold; color: #4a5568;">%</span>
    </div>
    <button type="button" class="btn-cms-delete-split-row" style="background: none; border: none; color: #e53e3e; cursor: pointer; font-size: 1.1rem; padding: 4px;" title="Delete Row">✕</button>
  `;

  container.appendChild(rowDiv);

  // Wire up real-time percentage change validator
  const pctInput = rowDiv.querySelector('.cms-split-pct');
  pctInput.addEventListener('input', () => validateCmsSplitsTotal());

  // Wire delete row
  rowDiv.querySelector('.btn-cms-delete-split-row').onclick = () => {
    rowDiv.remove();
    validateCmsSplitsTotal();
  };

  validateCmsSplitsTotal();
}

/**
 * Validates real-time split totals, updating the display text and colors accordingly.
 */
function validateCmsSplitsTotal() {
  const rows = document.querySelectorAll('.cms-split-row');
  let sum = 0;
  rows.forEach(row => {
    sum += parseFloat(row.querySelector('.cms-split-pct').value || 0);
  });

  const display = document.getElementById('cms-splits-total-display');
  if (display) {
    display.textContent = `Total Split: ${sum}%`;
    if (Math.abs(sum - 100) < 0.01) {
      display.style.color = '#38a169'; // Green if valid 100%
    } else {
      display.style.color = '#e53e3e'; // Red if invalid
    }
  }
}

/**
 * Loads configured splits into the form fields.
 */
export async function loadSplitsIntoCmsForm(splits) {
  const container = document.getElementById('cms-splits-rows-container');
  if (!container) return;

  container.innerHTML = '';

  if (splits && splits.length > 0) {
    // Open accordion body
    const body = document.getElementById('cms-splits-body');
    const arrow = document.getElementById('cms-splits-toggle-arrow');
    if (body && arrow) {
      body.style.display = 'block';
      arrow.textContent = '▼';
    }

    for (const split of splits) {
      await addCmsSplitRow(split);
    }
  }
}

async function renderContentManager(container) {
  try {
    const allContent = await contentDB.getAllContent();
    const allPages = await contentDB.getAllCustomPages();

    // Combine standard content and custom pages
    const combined = [
      ...allContent,
      ...allPages.map(p => ({ ...p, type: 'page' }))
    ];

    // Filter unique by ID
    const uniqueMap = {};
    combined.forEach(item => {
      uniqueMap[item.id] = item;
    });
    const items = Object.values(uniqueMap);

    const types = [
      { id: 'all', label: 'All Content' },
      { id: 'blog', label: 'Blog' },
      { id: 'book', label: 'Book' },
      { id: 'education', label: 'Education' },
      { id: 'event', label: 'Event' },
      { id: 'howto', label: 'How-To' },
      { id: 'podcast', label: 'Podcast' },
      { id: 'portfolio', label: 'Portfolio' },
      { id: 'sponsor', label: 'Sponsor' },
      { id: 'product', label: 'Product' },
      { id: 'page', label: 'Page' }
    ];

    // Read or default active filter type
    const activeType = container.dataset.activeType || 'all';

    container.innerHTML = `
      <h3 style="margin-top: 0; font-size: 1.15rem; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 1rem;">
        CMS Content Library
      </h3>
      <p style="margin: 0 0 1.25rem 0; color: var(--theme-color-text-secondary, #718096); font-size: 0.85rem;">
        View, edit, duplicate, or delete any seeded or custom content item. Changes persist to local fallback and Firestore.
      </p>

      <!-- Category Filter Tabs -->
      <div style="display: flex; gap: 0.25rem; overflow-x: auto; border-bottom: 2px solid var(--theme-color-border, #e2e8f0); padding-bottom: 0.25rem; margin-bottom: 1.25rem; -webkit-overflow-scrolling: touch;">
        ${types.map(t => `
          <button class="cms-category-tab ${activeType === t.id ? 'active' : ''}" data-type="${t.id}" style="
            background: ${activeType === t.id ? 'var(--theme-color-primary, #2b6cb0)' : 'transparent'};
            color: ${activeType === t.id ? 'white' : 'var(--theme-color-text-secondary, #4a5568)'};
            border: none;
            padding: 6px 12px;
            font-size: 0.85rem;
            font-weight: bold;
            border-radius: var(--theme-layout-border-radius, 4px);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
          ">
            ${t.label}
          </button>
        `).join('')}
      </div>

      <!-- Content Items Table -->
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--theme-color-border, #edf2f7); color: var(--theme-color-text-secondary, #4a5568); font-weight: bold;">
              <th style="padding: 10px;">ID / Slug</th>
              <th style="padding: 10px;">Title</th>
              <th style="padding: 10px;">Type</th>
              <th style="padding: 10px;">Visibility</th>
              <th style="padding: 10px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="cms-library-tbody">
            <!-- Filtered items render here -->
          </tbody>
        </table>
      </div>
    `;

    // Wire tab selectors
    container.querySelectorAll('.cms-category-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        container.dataset.activeType = e.target.dataset.type;
        renderContentManager(container);
      });
    });

    // Filter items
    const filteredItems = items.filter(item => {
      if (activeType === 'all') return true;
      return item.type === activeType;
    });

    const tbody = document.getElementById('cms-library-tbody');
    if (!tbody) return;

    if (filteredItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #cbd5e0); padding: 2rem;">No items found for this category.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredItems.map(item => `
      <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
        <td style="padding: 10px; font-family: monospace; font-size: 0.8rem; color: var(--theme-color-text-secondary);">${item.id}</td>
        <td style="padding: 10px; font-weight: bold; color: var(--theme-color-text-primary, #2d3748);">${item.title}</td>
        <td style="padding: 10px;"><span style="text-transform: capitalize; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${item.type}</span></td>
        <td style="padding: 10px;"><span style="text-transform: capitalize; color: ${item.access?.visibility === 'public' ? '#38a169' : '#d69e2e'}; font-weight: 600;">${item.access?.visibility || 'public'}</span></td>
        <td style="padding: 10px; text-align: right;">
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn-cms-edit btn-primary" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.75rem;">Edit</button>
            <button class="btn-cms-duplicate" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.75rem; background: #319795; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Copy</button>
            <button class="btn-cms-delete" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.75rem; background: #ef4444; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Wire actions
    tbody.querySelectorAll('.btn-cms-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const item = items.find(x => x.id === id);
        if (!item) return;

        // Load item into form
        currentEditingItem = item;

        const typeSelect = document.getElementById('content-type');
        const idInput = document.getElementById('content-id');
        const titleInput = document.getElementById('content-title');
        const descriptionInput = document.getElementById('content-description');
        const visibilityInput = document.getElementById('content-visibility');
        const bodyInput = document.getElementById('content-body');
        const affiliateInput = document.getElementById('content-affiliate-code');

        if (typeSelect) {
          typeSelect.value = item.type;
          typeSelect.dispatchEvent(new Event('change'));
        }
        if (idInput) {
          idInput.value = item.id;
          idInput.readOnly = true; // Don't let users mutate primary key / slug directly
        }
        if (titleInput) titleInput.value = item.title;
        if (descriptionInput) descriptionInput.value = item.description || '';
        if (visibilityInput) visibilityInput.value = item.access?.visibility || 'public';
        if (bodyInput) {
          bodyInput.value = item.longFormText ? item.longFormText.join('\n') : '';
        }
        if (affiliateInput) affiliateInput.value = item.affiliateAdCode || '';

        // If GrapesJS editor mode is toggled, sync it
        const toggle = document.getElementById('cms-editor-type-toggle');
        if (toggle) {
          if (item.editorType === 'grapesjs') {
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));
          } else {
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));
          }
        }

        // Load splitting rules for the edited asset cleanly
        try {
          const splits = await getAssetSplits(item.id);
          // Only render splits details if not the default admin split to keep UI uncluttered, or load explicitly
          if (splits !== DEFAULT_ADMIN_SPLIT) {
            await loadSplitsIntoCmsForm(splits);
          } else {
            const rowsContainer = document.getElementById('cms-splits-rows-container');
            if (rowsContainer) rowsContainer.innerHTML = '';
            validateCmsSplitsTotal();
          }
        } catch (splitErr) {
          console.warn('[CMS Splits]: Failed to load asset splits:', splitErr);
        }

        // Change Publish button to update
        const submitBtn = document.getElementById('cms-form')?.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.textContent = 'Update Content Entry';
        }

        // Scroll back to the top of the form cleanly
        document.getElementById('cms-form')?.scrollIntoView({ behavior: 'smooth' });
        toast.info(`Loaded "${item.title}" into the editor workspace.`);
      });
    });

    tbody.querySelectorAll('.btn-cms-duplicate').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const item = items.find(x => x.id === id);
        if (!item) return;

        const clonedId = `${item.id}-copy-${Math.random().toString(36).substring(2, 5)}`;
        const clonedTitle = `${item.title} (Copy)`;

        const cloned = {
          ...item,
          id: clonedId,
          title: clonedTitle,
          updatedAt: new Date().toISOString()
        };

        if (item.type === 'page') {
          cloned.slug = clonedId;
          await contentDB.saveCustomPage(cloned);
        } else {
          await contentDB.saveContent(cloned);
        }

        toast.success(`Duplicated "${item.title}" successfully!`);
        renderContentManager(container);
      });
    });

    tbody.querySelectorAll('.btn-cms-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const item = items.find(x => x.id === id);
        if (!item) return;

        if (confirm(`Are you sure you want to permanently delete the content item "${item.title}"?`)) {
          await contentDB.deleteContent(id);
          toast.success(`Deleted "${item.title}" successfully.`);
          renderContentManager(container);
        }
      });
    });

  } catch (err) {
    console.error('[CMS Content Manager]: Failed to render library list', err);
    container.innerHTML = `<p style="color: var(--theme-color-danger, #e53e3e);">Failed to render Content Manager library.</p>`;
  }
}

/**
 * Render the Admin-Editable Public Site & Page Manager (Directive 4)
 * Allows Admins to customize hero, layouts, agenda/flyer, and category tags per route
 * @param {HTMLElement} container
 */
export async function renderHeroConfigurator(container) {
  const routes = [
    { id: '/home', label: 'Home Page' },
    { id: '/about', label: 'About Page' },
    { id: '/events', label: 'Events Page' },
    { id: '/contact', label: 'Contact Page' },
    { id: '/education', label: 'Education Page' },
    { id: '/podcast', label: 'Podcast Page' },
    { id: '/shop', label: 'Shop Page' }
  ];

  container.innerHTML = `
    <h3 style="margin-top: 0; font-size: 1.15rem; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
      <span>✨</span> Unified Public Site & Page Manager
    </h3>
    <p style="margin: 0 0 1.25rem 0; color: var(--theme-color-text-secondary, #718096); font-size: 0.85rem;">
      Configure Hero sections, Page layout toggles, Event Agendas/Flyers/Lineups, Tag labels, and Product details for every page. Saves to Firestore `/pages` and LocalStoragefallback instantly.
    </p>

    <form id="hero-configurator-form" style="display: flex; flex-direction: column; gap: 1rem;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
        <div>
          <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Select Page Route:</label>
          <select id="hero-config-route" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px); font-weight: bold;">
            ${routes.map(r => `<option value="${r.id}">${r.label} (${r.id})</option>`).join('')}
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; margin-top: 1.25rem;">
          <input type="checkbox" id="hero-config-enabled" checked style="cursor: pointer;" />
          <span style="font-size: 0.85rem; font-weight: bold; color: var(--theme-color-text-primary);">Enable Hero Section</span>
        </div>
      </div>

      <!-- Hero Section configuration -->
      <div style="border: 1px solid var(--theme-color-border, #e2e8f0); padding: 1rem; border-radius: 6px;">
        <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; font-weight: bold; color: var(--theme-color-primary);">Hero Config</h4>
        <div style="display:grid; grid-template-columns: 1fr; gap:1rem; margin-bottom: 1rem;">
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Hero Section Title:</label>
            <input type="text" id="hero-config-title" required style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Hero Subtitle / Description Copy:</label>
            <textarea id="hero-config-subtitle" required style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px); min-height: 50px;"></textarea>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom: 1rem;">
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Primary CTA Button Text:</label>
            <input type="text" id="hero-config-primary-cta-text" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Primary CTA Destination Link:</label>
            <input type="text" id="hero-config-primary-cta-url" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom: 1rem;">
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Secondary CTA Button Text:</label>
            <input type="text" id="hero-config-secondary-cta-text" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Secondary CTA Destination Link:</label>
            <input type="text" id="hero-config-secondary-cta-url" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Background Gradient (linear-gradient):</label>
            <input type="text" id="hero-config-bg-gradient" placeholder="linear-gradient(135deg, #1a202c 0%, #2b6cb0 100%)" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Hero Right Image URL (Optional):</label>
            <input type="url" id="hero-config-image-url" placeholder="https://images.unsplash.com/... or blank" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
        </div>
      </div>

      <!-- Layout toggles section -->
      <div style="border: 1px solid var(--theme-color-border, #e2e8f0); padding: 1rem; border-radius: 6px;">
        <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; font-weight: bold; color: var(--theme-color-primary);">Page Layout Toggles</h4>
        <div style="display:flex; gap:1.5rem; flex-wrap:wrap;">
          <label style="display: flex; align-items: center; gap: 6px; font-weight: bold; font-size: 0.85rem; cursor:pointer;">
            <input type="checkbox" id="layout-toggle-spotlight" checked /> Show Featured Spotlight
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-weight: bold; font-size: 0.85rem; cursor:pointer;">
            <input type="checkbox" id="layout-toggle-grid" checked /> Show Grid List
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-weight: bold; font-size: 0.85rem; cursor:pointer;">
            <input type="checkbox" id="layout-toggle-faq" checked /> Show FAQ Section
          </label>
        </div>
      </div>

      <!-- Route-specific details section -->
      <div id="route-specific-cms-details" style="border: 1px solid var(--theme-color-border, #e2e8f0); padding: 1rem; border-radius: 6px;">
        <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; font-weight: bold; color: var(--theme-color-primary);">Route-Specific Rich Content Settings</h4>

        <!-- Category tags input (All routes) -->
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Category Filter Tags / Taxonomy Labels (comma-separated):</label>
          <input type="text" id="route-specific-tags" placeholder="Zero-Build, Sovereignty, AI-Tools" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
        </div>

        <!-- Event specific sub-attributes -->
        <div id="event-only-cms-attributes" style="display:none; flex-direction:column; gap:1rem;">
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Event Flyer Image URL:</label>
            <input type="url" id="event-flyer-url" placeholder="/assets/images/summit-flyer.jpg" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Event Lineup (JSON Object):</label>
            <textarea id="event-lineup-json" placeholder='{ "hosts": ["EarlAlex"], "headliners": ["Speaker 1"], "castAndAct": ["Mentor 1"], "openersAndPerformers": ["Live DJ Set"] }' style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px); font-family:monospace; font-size:0.8rem; min-height:80px;"></textarea>
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Event Agenda Timeline (JSON Array of Objects):</label>
            <textarea id="event-agenda-json" placeholder='[ { "time": "09:00 AM", "title": "Keynote Address", "description": "Opening vision", "speaker": "EarlAlex" } ]' style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px); font-family:monospace; font-size:0.8rem; min-height:100px;"></textarea>
          </div>
        </div>

        <!-- Shop specific sub-attributes -->
        <div id="shop-only-cms-attributes" style="display:none; flex-direction:column; gap:1rem;">
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Product Price & Currency Metadata (JSON):</label>
            <textarea id="product-meta-json" placeholder='{ "price": 4500, "currency": "USD", "isLowStock": true }' style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px); font-family:monospace; font-size:0.8rem; min-height:60px;"></textarea>
          </div>
        </div>

        <!-- About specific sub-attributes (Directive 3 CMS) -->
        <div id="about-only-cms-attributes" style="display:none; flex-direction:column; gap:1rem;">
          <h4 style="margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; font-weight: bold; color: var(--theme-color-primary);">About Page Executive Hero Details</h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Author Full Name:</label>
              <input type="text" id="about-hero-name" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px;" />
            </div>
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Official Title:</label>
              <input type="text" id="about-hero-role" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px;" />
            </div>
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Bio Summary Description:</label>
            <textarea id="about-hero-bio" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; min-height: 50px;"></textarea>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Profile Headshot Avatar URL:</label>
              <input type="url" id="about-hero-avatar" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px;" />
            </div>
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Social Proof Links (GitHub, LinkedIn, Twitter/X - Comma separated):</label>
              <input type="text" id="about-hero-socials" placeholder="https://github.com, https://linkedin.com, https://x.com" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px;" />
            </div>
          </div>

          <h4 style="margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; font-weight: bold; color: var(--theme-color-primary);">About Page Mission & Bento Core Values Descriptions</h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Zero-Build Engineering description:</label>
              <textarea id="about-val-zero-build" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; min-height: 40px;"></textarea>
            </div>
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Data Sovereignty description:</label>
              <textarea id="about-val-data-sovereignty" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; min-height: 40px;"></textarea>
            </div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">AI Automation description:</label>
              <textarea id="about-val-ai-automation" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; min-height: 40px;"></textarea>
            </div>
            <div>
              <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Modular Architecture description:</label>
              <textarea id="about-val-modular-architecture" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; min-height: 40px;"></textarea>
            </div>
          </div>

          <h4 style="margin: 0.5rem 0 0.25rem 0; font-size: 0.9rem; font-weight: bold; color: var(--theme-color-primary);">About Page Interactive Milestone Timeline (JSON Array)</h4>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.25rem;">Timeline Milestones (JSON Array of Objects: date, title, description):</label>
            <textarea id="about-timeline-json" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; font-family: monospace; font-size: 0.8rem; min-height: 80px;"></textarea>
          </div>
        </div>
      </div>

      <button type="submit" id="btn-save-hero-config" class="btn-primary" style="padding: 10px 18px; font-weight: bold; align-self: flex-start; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: var(--theme-layout-border-radius, 4px); cursor: pointer; transition: background 0.2s;">
        Save Site Manager Settings
      </button>
    </form>
  `;

  const routeSelect = document.getElementById('hero-config-route');

  // Local function to pull dynamic custom page details and populate inputs
  const loadRouteHeroConfig = async (route) => {
    const slug = route.replace(/^\//, '') || 'home';

    // Show/hide sub-attribute elements based on route value
    const eventAttrs = document.getElementById('event-only-cms-attributes');
    const shopAttrs = document.getElementById('shop-only-cms-attributes');
    const aboutAttrs = document.getElementById('about-only-cms-attributes');
    if (eventAttrs) eventAttrs.style.display = route === '/events' ? 'flex' : 'none';
    if (shopAttrs) shopAttrs.style.display = route === '/shop' ? 'flex' : 'none';
    if (aboutAttrs) aboutAttrs.style.display = route === '/about' ? 'flex' : 'none';

    try {
      const page = await contentDB.getCustomPageBySlug(slug);
      const hero = page?.hero || {
        enabled: true,
        title: `Welcome to ${route.substring(1).toUpperCase() || 'Foundation'}`,
        subtitle: "A zero-build, modular web platform running natively in the browser.",
        primaryCtaText: "Explore Courses",
        primaryCtaUrl: "/education",
        secondaryCtaText: "Upcoming Events",
        secondaryCtaUrl: "/events",
        backgroundGradient: "linear-gradient(135deg, #1a202c 0%, #2b6cb0 100%)",
        heroImageUrl: ""
      };

      document.getElementById('hero-config-enabled').checked = hero.enabled !== false;
      document.getElementById('hero-config-title').value = hero.title || '';
      document.getElementById('hero-config-subtitle').value = hero.subtitle || '';
      document.getElementById('hero-config-primary-cta-text').value = hero.primaryCtaText || '';
      document.getElementById('hero-config-primary-cta-url').value = hero.primaryCtaUrl || '';
      document.getElementById('hero-config-secondary-cta-text').value = hero.secondaryCtaText || '';
      document.getElementById('hero-config-secondary-cta-url').value = hero.secondaryCtaUrl || '';
      document.getElementById('hero-config-bg-gradient').value = hero.backgroundGradient || 'linear-gradient(135deg, #1a202c 0%, #2b6cb0 100%)';
      document.getElementById('hero-config-image-url').value = hero.heroImageUrl || '';

      // Populate layout settings
      const layout = page?.layout || { showSpotlight: true, showGrid: true, showFaq: true };
      document.getElementById('layout-toggle-spotlight').checked = layout.showSpotlight !== false;
      document.getElementById('layout-toggle-grid').checked = layout.showGrid !== false;
      document.getElementById('layout-toggle-faq').checked = layout.showFaq !== false;

      // Populate route-specific attributes
      document.getElementById('route-specific-tags').value = (page?.categoryTags || []).join(', ');

      if (route === '/events') {
        const details = page?.eventDetails || {};
        document.getElementById('event-flyer-url').value = details.flyerUrl || '/assets/images/summit-flyer.jpg';

        const lineupObj = details.lineup || {
          hosts: ["EarlAlex"],
          headliners: ["Keynote Guest Speaker"],
          castAndAct: ["Mastermind Mentors"],
          openersAndPerformers: ["Live DJ Set / Musical Guest"]
        };
        document.getElementById('event-lineup-json').value = JSON.stringify(lineupObj, null, 2);

        const agendaArr = details.agenda || [
          { time: "09:00 AM", title: "Keynote Address", description: "Opening remarks & vision", speaker: "EarlAlex" },
          { time: "11:30 AM", title: "Zero-Build Panel", description: "Building without bundlers", speaker: "Tech Panel" }
        ];
        document.getElementById('event-agenda-json').value = JSON.stringify(agendaArr, null, 2);
      }

      if (route === '/shop') {
        const details = page?.productDetails || { price: 4500, currency: 'USD', isLowStock: true };
        document.getElementById('product-meta-json').value = JSON.stringify(details, null, 2);
      }

      if (route === '/about') {
        const heroData = page?.aboutHero || {
          name: 'Jane Doe',
          role: 'Lead Systems Architect',
          bio: 'Pioneering zero-build serverless solutions with native browser execution.',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
          socials: { github: 'https://github.com', linkedin: 'https://linkedin.com', twitter: 'https://x.com' }
        };
        document.getElementById('about-hero-name').value = heroData.name || '';
        document.getElementById('about-hero-role').value = heroData.role || '';
        document.getElementById('about-hero-bio').value = heroData.bio || '';
        document.getElementById('about-hero-avatar').value = heroData.avatarUrl || '';
        document.getElementById('about-hero-socials').value = [heroData.socials?.github, heroData.socials?.linkedin, heroData.socials?.twitter || heroData.socials?.x].filter(Boolean).join(', ') || '';

        const pillars = page?.aboutPillars || {
          zeroBuild: 'Running natively in the browser with ES Modules. No complex bundlers, transpilers, or build steps required. Clean, standard code.',
          dataSovereignty: 'Ensuring complete control and encryption over user identity, files, and corporate credentials, utilizing localized encrypted datastores.',
          aiAutomation: 'Empowering administrative teams with continuous background audits, automated workflows, and AI assistants.',
          modularArchitecture: 'Developing extensible, zero-dependency visual page builders, customizable global navigation elements, and reusable components.'
        };
        document.getElementById('about-val-zero-build').value = pillars.zeroBuild || '';
        document.getElementById('about-val-data-sovereignty').value = pillars.dataSovereignty || '';
        document.getElementById('about-val-ai-automation').value = pillars.aiAutomation || '';
        document.getElementById('about-val-modular-architecture').value = pillars.modularArchitecture || '';

        const timeline = page?.aboutTimeline || [
          { date: 'July 2024', title: 'Beta Concept Launch', description: 'Initial framework prototype deployed with native ES route splitting.' },
          { date: 'March 2025', title: 'Production Ready', description: 'Enterprise-ready billing, HIPAA security, and custom SPA routing finalized.' },
          { date: 'August 2026', title: 'Modular Upgrades', description: 'Unified Site Manager, GrapesJS integrations, and secure RBAC access completed.' }
        ];
        document.getElementById('about-timeline-json').value = JSON.stringify(timeline, null, 2);
      }

    } catch (e) {
      console.warn('[Page Configurator]: Load error:', e);
    }
  };

  if (routeSelect) {
    routeSelect.onchange = () => loadRouteHeroConfig(routeSelect.value);
    loadRouteHeroConfig(routeSelect.value); // Initial load on render
  }

  // Handle save configurator submit
  const form = document.getElementById('hero-configurator-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const route = document.getElementById('hero-config-route').value;
    const slug = route.replace(/^\//, '') || 'home';

    const saveBtn = document.getElementById('btn-save-hero-config');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving to Database...";
    }

    try {
      let page = await contentDB.getCustomPageBySlug(slug);
      if (!page) {
        page = {
          id: slug,
          slug: slug,
          title: route.charAt(1).toUpperCase() + route.slice(2) + ' Page',
          access: { visibility: 'public' }
        };
      }

      // Gather Hero section config
      page.hero = {
        enabled: document.getElementById('hero-config-enabled').checked,
        title: document.getElementById('hero-config-title').value,
        subtitle: document.getElementById('hero-config-subtitle').value,
        primaryCtaText: document.getElementById('hero-config-primary-cta-text').value,
        primaryCtaUrl: document.getElementById('hero-config-primary-cta-url').value,
        secondaryCtaText: document.getElementById('hero-config-secondary-cta-text').value,
        secondaryCtaUrl: document.getElementById('hero-config-secondary-cta-url').value,
        backgroundGradient: document.getElementById('hero-config-bg-gradient').value,
        heroImageUrl: document.getElementById('hero-config-image-url').value
      };

      // Gather Layout config
      page.layout = {
        showSpotlight: document.getElementById('layout-toggle-spotlight').checked,
        showGrid: document.getElementById('layout-toggle-grid').checked,
        showFaq: document.getElementById('layout-toggle-faq').checked
      };

      // Gather tag filters
      const rawTags = document.getElementById('route-specific-tags').value || '';
      page.categoryTags = rawTags.split(',').map(t => t.trim()).filter(Boolean);

      // Gather specific page configs
      if (route === '/events') {
        let lineup = {};
        let agenda = [];
        try {
          lineup = JSON.parse(document.getElementById('event-lineup-json').value);
          agenda = JSON.parse(document.getElementById('event-agenda-json').value);
        } catch (jsonErr) {
          throw new Error('Invalid JSON format in lineup or agenda timeline fields.');
        }

        page.eventDetails = {
          flyerUrl: document.getElementById('event-flyer-url').value,
          lineup,
          agenda
        };

        // Also update the seeded live event sample-summit in database so changes reflect instantly! (Directive 4)
        const event = await contentDB.getContentById('sample-summit');
        if (event) {
          event.flyerImageUrl = page.eventDetails.flyerUrl;
          event.lineup = lineup;
          event.agenda = agenda;
          await contentDB.saveEvent(event);
        }
      }

      if (route === '/shop') {
        let details = {};
        try {
          details = JSON.parse(document.getElementById('product-meta-json').value);
        } catch (jsonErr) {
          throw new Error('Invalid JSON format in product details field.');
        }
        page.productDetails = details;
      }

      if (route === '/about') {
        const rawSocials = document.getElementById('about-hero-socials').value.split(',').map(s => s.trim()).filter(Boolean);
        const socials = {
          github: rawSocials.find(s => s.includes('github')) || '',
          linkedin: rawSocials.find(s => s.includes('linkedin')) || '',
          twitter: rawSocials.find(s => s.includes('twitter') || s.includes('x.com')) || ''
        };

        page.aboutHero = {
          name: document.getElementById('about-hero-name').value,
          role: document.getElementById('about-hero-role').value,
          bio: document.getElementById('about-hero-bio').value,
          avatarUrl: document.getElementById('about-hero-avatar').value,
          socials
        };

        page.aboutPillars = {
          zeroBuild: document.getElementById('about-val-zero-build').value,
          dataSovereignty: document.getElementById('about-val-data-sovereignty').value,
          aiAutomation: document.getElementById('about-val-ai-automation').value,
          modularArchitecture: document.getElementById('about-val-modular-architecture').value
        };

        try {
          page.aboutTimeline = JSON.parse(document.getElementById('about-timeline-json').value);
        } catch (jsonErr) {
          throw new Error('Invalid JSON format in milestone timeline array.');
        }
      }

      await contentDB.saveCustomPage(page);
      toast.success(`Public Site & Page layout overridden for "${route}" instantly!`);
    } catch (err) {
      toast.error(`Save Failed: ${err.message}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Site Manager Settings";
      }
    }
  });
}
