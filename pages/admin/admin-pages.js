// pages/admin/admin-pages.js - Visual Page Creator & GrapesJS Web Builder Controller
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { store } from '../../core/store.js';
import { configManager } from '../../core/config.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { AdminSetupWizards } from './components/AdminSetupWizards.js';

let editorInstance = null;
let editingPageId = null; // Track if we are editing an existing page

// Dynamically load GrapesJS core libraries and styles from unpkg CDNs
function loadGrapesJS() {
  return new Promise((resolve, reject) => {
    if (window.grapesjs) {
      resolve(window.grapesjs);
      return;
    }

    // Add grapesjs stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css';
    document.head.appendChild(link);

    // Add webpage preset stylesheet
    const linkPreset = document.createElement('link');
    linkPreset.rel = 'stylesheet';
    linkPreset.href = 'https://unpkg.com/grapesjs-preset-webpage/dist/grapesjs-preset-webpage.min.css';
    document.head.appendChild(linkPreset);

    // Add GrapesJS core script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/grapesjs';
    script.onload = () => {
      // Add webpage preset script
      const scriptPreset = document.createElement('script');
      scriptPreset.src = 'https://unpkg.com/grapesjs-preset-webpage';
      scriptPreset.onload = () => {
        resolve(window.grapesjs);
      };
      scriptPreset.onerror = () => reject(new Error('Failed to load GrapesJS Webpage Preset'));
      document.head.appendChild(scriptPreset);
    };
    script.onerror = () => reject(new Error('Failed to load GrapesJS Core Library'));
    document.head.appendChild(script);
  });
}

export function initPagesTab() {
  const form = document.getElementById('page-creator-form');
  const canvasElement = document.getElementById('grapesjs-page-builder-canvas');
  const existingPagesTbody = document.getElementById('existing-pages-tbody');

  if (!form || !canvasElement || !existingPagesTbody) {
    console.warn('[Page Creator]: Form elements or GrapesJS canvas wrapper is missing in DOM.');
    return;
  }

  // Defer Loading third party bundles (GrapesJS) until action-triggered "Edit Page in GrapesJS" or "Visual Page Creator" is initiated
  // We can load it when the pages tab is selected or load on demand. Let's do action-triggered load here.

  // Load existing custom pages
  async function loadExistingPages() {
    try {
      const pages = await contentDB.getCustomPages();
      if (!pages || pages.length === 0) {
        existingPagesTbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1rem;">No custom pages built yet.</td>
          </tr>
        `;
        return;
      }

      existingPagesTbody.innerHTML = pages.map(p => `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
          <td style="padding: 12px; font-weight: bold; color: var(--theme-color-text-primary, #2d3748);">${p.title}</td>
          <td style="padding: 12px;">
            <code style="background: var(--theme-color-background, #edf2f7); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: var(--theme-color-primary, #2b6cb0);">/pages/${p.id}</code>
          </td>
          <td style="padding: 12px; font-weight: 600; text-transform: capitalize;">${p.access?.visibility || 'public'}</td>
          <td style="padding: 12px; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn-edit-page" data-slug="${p.id}" style="padding: 4px 8px; background: var(--theme-color-primary, #2b6cb0); color: white; border-radius: 4px; font-size: 0.75rem; border: none; cursor: pointer; font-weight: bold;">Edit</button>
            <a href="/pages/${p.id}" target="_blank" style="padding: 4px 8px; background: #319795; color: white; border-radius: 4px; font-size: 0.75rem; text-decoration: none; font-weight: bold;">View</a>
            <button class="btn-delete-page" data-slug="${p.id}" style="padding: 4px 8px; background: #e53e3e; color: white; border-radius: 4px; font-size: 0.75rem; border: none; cursor: pointer; font-weight: bold;">Delete</button>
          </td>
        </tr>
      `).join('');

      // Attach edit click listeners
      existingPagesTbody.querySelectorAll('.btn-edit-page').forEach(btn => {
        btn.addEventListener('click', async () => {
          const slug = btn.dataset.slug;
          try {
            const pageData = await contentDB.getCustomPageBySlug(slug);
            if (pageData) {
              document.getElementById('page-title').value = pageData.title || '';
              document.getElementById('page-slug').value = pageData.id || '';
              document.getElementById('page-meta-desc').value = pageData.description || '';
              document.getElementById('page-access').value = pageData.access?.visibility || 'public';
              editingPageId = pageData.id;

              const submitBtn = document.getElementById('btn-submit-page-creator');
              if (submitBtn) submitBtn.textContent = 'Update & Publish Custom Page';

              if (editorInstance && pageData.projectData) {
                editorInstance.loadProjectData(pageData.projectData);
              } else if (editorInstance) {
                // fallback to setting html content if no project data exists
                editorInstance.setComponents(pageData.compiledHtml || '');
                editorInstance.setStyle(pageData.compiledCss || '');
              }
              toast.info(`Editing custom page: "${pageData.title}"`);
              form.scrollIntoView({ behavior: 'smooth' });
            }
          } catch (err) {
            toast.error('Failed to load page for editing.');
          }
        });
      });

      // Attach delete click listeners
      existingPagesTbody.querySelectorAll('.btn-delete-page').forEach(btn => {
        btn.addEventListener('click', async () => {
          const slug = btn.dataset.slug;
          if (confirm(`Are you sure you want to permanently delete custom route /pages/${slug}?`)) {
            try {
              await contentDB.deleteContent(slug);
              toast.success('Page deleted successfully.');
              loadExistingPages();
              if (editingPageId === slug) {
                form.reset();
                editingPageId = null;
                const submitBtn = document.getElementById('btn-submit-page-creator');
                if (submitBtn) submitBtn.textContent = 'Publish Custom Route Page';
                if (editorInstance) editorInstance.DomComponents.clear();
              }
            } catch (err) {
              toast.error('Failed to delete custom page.');
            }
          }
        });
      });

    } catch (err) {
      console.error('Error loading pages list:', err);
    }
  }

  // Action-Triggered: Load and Initialize GrapesJS only when GrapesJS Page Builder is requested
  const loadAndInitGrapesBuilder = () => {
    if (editorInstance) return Promise.resolve(editorInstance);
    return loadGrapesJS().then((grapesjs) => {
      if (editorInstance) {
        return editorInstance;
      }

      editorInstance = grapesjs.init({
        container: '#grapesjs-page-builder-canvas',
        fromElement: true,
        height: '600px',
        width: 'auto',
        storageManager: false, // Manually persist to Firebase
        plugins: ['gjs-preset-webpage'],
        pluginsOpts: {
          'gjs-preset-webpage': {
            modalImportTitle: 'Import HTML Template',
            modalImportLabel: 'Paste your HTML/CSS code here',
            categorySections: 'Sections'
          }
        },
      });

      // Bind web components & premium layouts
      const bm = editorInstance.BlockManager;

      // Register Reusable Global Web Components exposed to GrapesJS
      bm.add('author-card-component', {
        label: 'Author Card Component',
        category: 'Foundation Global Components',
        content: '<author-card layout="compact"></author-card>'
      });

      bm.add('content-card-component', {
        label: 'Content Card Component',
        category: 'Foundation Global Components',
        content: '<content-card title="Strategic Growth" date="July 2026" description="Learn strategic operations models." author="Jane Doe"></content-card>'
      });

      bm.add('chat-widget-component', {
        label: 'Chat Widget Component',
        category: 'Foundation Global Components',
        content: '<chat-widget></chat-widget>'
      });

      bm.add('hero-banner-component', {
        label: 'Hero Banner Component',
        category: 'Foundation Global Components',
        content: '<hero-banner title="Elevate Operations" subtitle="A zero-build modular web experience."></hero-banner>'
      });

      bm.add('feature-grid-component', {
        label: 'Feature Grid Component',
        category: 'Foundation Global Components',
        content: '<feature-grid title-1="Automations" desc-1="Run marketing workflows natively." title-2="Security Scans" desc-2="Verify file signature integrity on the edge."></feature-grid>'
      });

      bm.add('pricing-table-component', {
        label: 'Pricing Table Component',
        category: 'Foundation Global Components',
        content: '<pricing-table title="Core Membership" price="$29" period="/month"></pricing-table>'
      });

      bm.add('testimonial-slider-component', {
        label: 'Testimonial Slider Component',
        category: 'Foundation Global Components',
        content: '<testimonial-slider author="Alex R."></testimonial-slider>'
      });

      bm.add('hero-section', {
        label: 'Hero Section',
        category: 'Premium Sections',
        content: `
          <section class="hero-section" style="padding: 5rem 2rem; text-align: center; background: linear-gradient(135deg, #ebf8ff 0%, #ffffff 100%); font-family: system-ui, sans-serif; border-bottom: 1px solid #edf2f7;">
            <h1 style="font-size: 3rem; font-weight: 800; margin-bottom: 1rem; color: #2b6cb0; line-height: 1.2;">Welcome to Our Academy</h1>
            <p style="font-size: 1.25rem; color: #4a5568; max-width: 650px; margin: 0 auto 2rem; line-height: 1.6;">Ascension Avenue Academy is the premium workspace designed to cultivate operational excellence and strategic leadership.</p>
            <a href="#" class="btn-primary" style="padding: 12px 28px; background: #2b6cb0; color: white; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(43, 108, 176, 0.25);">Explore Workspace</a>
          </section>
        `
      });

      bm.add('flex-grid', {
        label: '2/3 Column Flex Grid',
        category: 'Premium Sections',
        content: `
          <div style="display: flex; gap: 2rem; flex-wrap: wrap; padding: 3rem 1.5rem; background: #ffffff; font-family: system-ui, sans-serif;">
            <div style="flex: 1; min-width: 250px; background: #f7fafc; padding: 2rem; border-radius: 8px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              <h3 style="color: #2b6cb0; font-size: 1.25rem; margin-top: 0;">Strategy Pillar</h3>
              <p style="color: #4a5568; line-height: 1.6;">Our framework delivers end-to-end operational visibility with secure localized data caches.</p>
            </div>
            <div style="flex: 1; min-width: 250px; background: #f7fafc; padding: 2rem; border-radius: 8px; border: 1px solid #edf2f7; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              <h3 style="color: #2b6cb0; font-size: 1.25rem; margin-top: 0;">Execution Pillar</h3>
              <p style="color: #4a5568; line-height: 1.6;">Automate and scale workflows instantly, decoupled from browser SDK limits.</p>
            </div>
          </div>
        `
      });

      bm.add('cta-cards', {
        label: 'CTA Cards',
        category: 'Components',
        content: `
          <div style="background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 12px; padding: 2.5rem; text-align: center; margin: 2rem 0; font-family: system-ui, sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #2b6cb0; margin-top: 0; font-size: 1.75rem; font-weight: 800;">Elevate Your Operations</h2>
            <p style="color: #2c5282; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.5;">Tap into customized, secure legal binders, automated task boards, and advanced threat monitors.</p>
            <button style="padding: 12px 30px; background: #3182ce; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1rem; box-shadow: 0 4px 6px rgba(49, 130, 206, 0.2);">Upgrade Membership</button>
          </div>
        `
      });

      bm.add('feature-matrix', {
        label: 'Feature Matrix',
        category: 'Premium Sections',
        content: `
          <section style="padding: 4rem 1.5rem; background: #ffffff; font-family: system-ui, sans-serif;">
            <h2 style="text-align: center; font-size: 2rem; margin-bottom: 3rem; color: #2d3748;">High-Fidelity Operations Features</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2rem;">
              <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 1rem;">🛡️</div>
                <h4 style="font-size: 1.15rem; margin-top: 0; margin-bottom: 0.5rem; color: #2d3748;">Vulnerability Scans</h4>
                <p style="color: #718096; font-size: 0.9rem; line-height: 1.5;">Integrated OWASP ZAP API proxy and file scanner safeguards.</p>
              </div>
              <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 1rem;">💰</div>
                <h4 style="font-size: 1.15rem; margin-top: 0; margin-bottom: 0.5rem; color: #2d3748;">Stripe Direct Debit</h4>
                <p style="color: #718096; font-size: 0.9rem; line-height: 1.5;">Perform ACH payments natively with automatic application fees.</p>
              </div>
              <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 1rem;">👥</div>
                <h4 style="font-size: 1.15rem; margin-top: 0; margin-bottom: 0.5rem; color: #2d3748;">VA Hiring Hub</h4>
                <p style="color: #718096; font-size: 0.9rem; line-height: 1.5;">Contractor onboarding with secure credential bridging.</p>
              </div>
            </div>
          </section>
        `
      });

      bm.add('navbar', {
        label: 'Navbar Block',
        category: 'Components',
        content: `
          <nav style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; background: #2d3748; color: white; font-family: system-ui, sans-serif;">
            <div style="font-weight: bold; font-size: 1.25rem;">Ascension Academy</div>
            <div style="display: flex; gap: 1.5rem; font-size: 0.95rem;">
              <a href="#" style="color: white; text-decoration: none;">Home</a>
              <a href="#" style="color: white; text-decoration: none;">Services</a>
              <a href="#" style="color: white; text-decoration: none;">Pricing</a>
            </div>
          </nav>
        `
      });

      bm.add('footer', {
        label: 'Footer Block',
        category: 'Components',
        content: `
          <footer style="background: #1a202c; color: #a0aec0; padding: 3rem 2rem; text-align: center; font-family: system-ui, sans-serif; font-size: 0.9rem; border-top: 1px solid #2d3748;">
            <p style="margin-bottom: 1rem; color: white; font-weight: bold;">Ascension Avenue Academy</p>
            <p style="margin-bottom: 1.5rem;">© ${new Date().getFullYear()} Ascension Avenue Academy. All rights reserved.</p>
            <div style="display: flex; justify-content: center; gap: 1.5rem;">
              <a href="#" style="color: #a0aec0; text-decoration: none;">Privacy Policy</a>
              <a href="#" style="color: #a0aec0; text-decoration: none;">Terms of Service</a>
            </div>
          </footer>
        `
      });

      bm.add('image-gallery', {
        label: 'Image Gallery',
        category: 'Components',
        content: `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; padding: 2rem 1.5rem;">
            <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80" style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;" />
            <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80" style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;" />
            <img src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80" style="width: 100%; border-radius: 6px; aspect-ratio: 16/9; object-fit: cover;" />
          </div>
        `
      });

      bm.add('form-container', {
        label: 'Form Container',
        category: 'Components',
        content: `
          <div style="max-width: 450px; margin: 2rem auto; padding: 2rem; background: #ffffff; border: 1px solid #edf2f7; border-radius: 8px; font-family: system-ui, sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h3 style="margin-top: 0; color: #2d3748; margin-bottom: 1rem;">Contact Us</h3>
            <form style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">Name</label>
                <input type="text" placeholder="John Doe" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">Email</label>
                <input type="email" placeholder="john@example.com" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
              </div>
              <button type="button" style="padding: 10px; background: #2b6cb0; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Submit Request</button>
            </form>
          </div>
        `
      });

      bm.add('video-modal', {
        label: 'Video Embed',
        category: 'Components',
        content: `
          <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 2rem 0; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
          </div>
        `
      });

      // Trigger page_builder_init hook when GrapesJS Studio initializes
      import('../../core/hooks.js').then(({ doAction }) => {
        doAction('page_builder_init', editorInstance);
      }).catch(err => {
        console.error('[Page Builder Hook]: page_builder_init trigger failed.', err);
      });

      loadExistingPages();

      return editorInstance;
    }).catch((err) => {
      console.error('Failed to initialize GrapesJS Editor:', err);
      canvasElement.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--theme-color-danger, #e53e3e);">
          <h3>Failed to load GrapesJS Builder</h3>
          <p>${err.message}</p>
        </div>
      `;
    });
  };

  // Add click handler to GrapesJS canvas wrapper or button to initialize on demand
  canvasElement.addEventListener('click', () => {
    loadAndInitGrapesBuilder();
  }, { once: true });

  // Submit / Publish Page
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('page-title').value.trim();
    const slug = document.getElementById('page-slug').value.trim();
    const desc = document.getElementById('page-meta-desc').value.trim();
    const access = document.getElementById('page-access').value;

    if (!title || !slug) {
      toast.error('Page Title and Route Slug are strictly required.');
      return;
    }

    if (!editorInstance) {
      toast.error('GrapesJS Editor is still loading. Please wait.');
      return;
    }

    // Retrieve visual payload parameters
    const projectData = editorInstance.getProjectData();
    const compiledHtml = editorInstance.getHtml();
    const compiledCss = editorInstance.getCss();

    const { applyFilters, doAction } = await import('../../core/hooks.js');

    try {
      let payload = {
        type: 'page',
        id: slug,
        slug: slug,
        title: title,
        description: desc || 'Custom dynamic page',
        editorType: 'grapesjs',
        projectData: projectData,
        compiledHtml: compiledHtml,
        compiledCss: compiledCss,
        access: { visibility: access },
        author: store.state.user?.displayName || 'Editor',
        date: new Date().toISOString().split('T')[0]
      };

      // Filter pipeline mutates payload before saving
      payload = applyFilters('content_before_save', payload);

      const success = await contentDB.saveCustomPage(payload);
      if (success) {
        await doAction('content_after_save', payload);
        toast.success(`Custom page /pages/${slug} published successfully!`);
        form.reset();
        editingPageId = null;

        const submitBtn = document.getElementById('btn-submit-page-creator');
        if (submitBtn) submitBtn.textContent = 'Publish Custom Route Page';

        // Clear canvas
        editorInstance.DomComponents.clear();
        loadExistingPages();
      } else {
        toast.error('Failed to save page schema. Please verify connection.');
      }
    } catch (err) {
      toast.error(`Publishing Failed: ${err.message}`);
    }
  });

  // Default Pages Configurator Wizards trigger bindings
  document.getElementById('btn-wizard-home')?.addEventListener('click', () => {
    AdminSetupWizards.launchPageWizard('home', () => {
      loadExistingPages();
    });
  });

  document.getElementById('btn-wizard-about')?.addEventListener('click', () => {
    AdminSetupWizards.launchPageWizard('about', () => {
      loadExistingPages();
    });
  });

  document.getElementById('btn-wizard-events')?.addEventListener('click', () => {
    AdminSetupWizards.launchPageWizard('events', () => {
      loadExistingPages();
    });
  });

  document.getElementById('btn-wizard-contact')?.addEventListener('click', () => {
    AdminSetupWizards.launchPageWizard('contact', () => {
      loadExistingPages();
    });
  });

  // Initial load
  loadExistingPages();
}
