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

  // 2. Create or ensure the Hero Section Configurator card is present (Directive 4)
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

  // 4. Render Hero Configurator panel (Directive 4)
  renderHeroConfigurator(heroConfigCard);

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

/**
 * Render the Admin-Editable Hero Section Configurator (Directive 4)
 * Allows Admins to customize hero titles, copy, CTAs, and background per route
 * @param {HTMLElement} container
 */
export async function renderHeroConfigurator(container) {
  const routes = [
    { id: '/home', label: 'Home Page' },
    { id: '/about', label: 'About Page' },
    { id: '/events', label: 'Events Page' },
    { id: '/contact', label: 'Contact Page' },
    { id: '/education', label: 'Education Page' },
    { id: '/podcast', label: 'Podcast Page' }
  ];

  container.innerHTML = `
    <h3 style="margin-top: 0; font-size: 1.15rem; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
      <span>✨</span> SPA Pages Hero Section Configurator
    </h3>
    <p style="margin: 0 0 1.25rem 0; color: var(--theme-color-text-secondary, #718096); font-size: 0.85rem;">
      Customize hero banners, headlines, CTAs, linear background gradients, or hero images per page route.
    </p>

    <form id="hero-configurator-form" style="display: flex; flex-direction: column; gap: 1rem;">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
        <div>
          <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Select Page Route:</label>
          <select id="hero-config-route" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px); font-weight: bold;">
            ${routes.map(r => `<option value="${r.id}">${r.label} (${r.id})</option>`).join('')}
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 1.25rem;">
          <input type="checkbox" id="hero-config-enabled" checked style="cursor: pointer;" />
          <span style="font-size: 0.85rem; font-weight: bold; color: var(--theme-color-text-primary);">Enable Hero Section</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap:1rem;">
        <div>
          <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Hero Section Title:</label>
          <input type="text" id="hero-config-title" required style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
        </div>
        <div>
          <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Hero Subtitle / Description Copy:</label>
          <textarea id="hero-config-subtitle" required style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px); min-height: 50px;"></textarea>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
        <div>
          <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Primary CTA Button Text:</label>
          <input type="text" id="hero-config-primary-cta-text" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
        </div>
        <div>
          <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Primary CTA Destination Link:</label>
          <input type="text" id="hero-config-primary-cta-url" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: var(--theme-layout-border-radius, 4px);" />
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
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

      <button type="submit" id="btn-save-hero-config" class="btn-primary" style="padding: 10px 18px; font-weight: bold; align-self: flex-start; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: var(--theme-layout-border-radius, 4px); cursor: pointer; transition: background 0.2s;">
        Save Hero Configuration
      </button>
    </form>
  `;

  const routeSelect = document.getElementById('hero-config-route');

  // Local function to pull dynamic custom page details and populate inputs
  const loadRouteHeroConfig = async (route) => {
    const slug = route.replace(/^\//, '') || 'home';
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
    } catch (e) {
      console.warn('[Hero Configurator]: Load error:', e);
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

      await contentDB.saveCustomPage(page);
      toast.success(`Hero banner override for "${route}" saved and activated successfully!`);
    } catch (err) {
      toast.error(`Save Failed: ${err.message}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Hero Configuration";
      }
    }
  });
}
