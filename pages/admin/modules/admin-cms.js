// pages/admin/modules/admin-cms.js
import { contentDB } from '../../../core/db.js';
import { toast } from '../../../utils/toast.js';

let currentEditingItem = null;

export function initAdminCms() {
  console.log('[CMS Module]: initAdminCms triggered');
  const cmsTab = document.getElementById('tab-cms');
  if (!cmsTab) {
    console.error('[CMS Module]: Could not find #tab-cms container!');
    return;
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

  // 2. Render Categories & Items List
  renderContentManager(managerCard);

  // Hook into form submit of #cms-form to reset editing state and refresh lists
  const cmsForm = document.getElementById('cms-form');
  if (cmsForm) {
    // We add a listener to clear editing state and update button label
    const originalSubmitBtn = cmsForm.querySelector('button[type="submit"]');

    // Check if we already wrapped the submit
    if (cmsForm.dataset.listenerBound !== 'true') {
      cmsForm.dataset.listenerBound = 'true';

      cmsForm.addEventListener('submit', async () => {
        // Wait briefly for standard saveContent to resolve, then refresh
        setTimeout(() => {
          currentEditingItem = null;
          const idInput = document.getElementById('content-id');
          if (idInput) idInput.readOnly = false;
          if (originalSubmitBtn) originalSubmitBtn.textContent = 'Publish Content Entry';
          renderContentManager(managerCard);
        }, 800);
      });
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
            // Wait for GrapesJS instance to initialize, then load project
            setTimeout(() => {
              const canvas = document.getElementById('grapesjs-cms-canvas');
              if (canvas && canvas.children.length > 0) {
                // If GrapesJS initialized, load projectData
                // (Note: editor instance handles loading projectData on load route, but we can load dynamically if we want)
              }
            }, 300);
          } else {
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));
          }
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
