// pages/admin/admin-pages.js - Visual Page Creator & Block Editor Tab Controller
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { store } from '../../core/store.js';

export function initPagesTab() {
  const form = document.getElementById('page-creator-form');
  const blocksContainer = document.getElementById('page-blocks-container');
  const btnAddBlock = document.getElementById('btn-add-page-block');
  const previewBox = document.getElementById('page-live-preview-box');
  const existingPagesTbody = document.getElementById('existing-pages-tbody');

  if (!form || !blocksContainer || !btnAddBlock || !previewBox || !existingPagesTbody) {
    console.warn('[Page Creator]: Form elements or workspace is missing in DOM.');
    return;
  }

  let blocks = [];

  // Load existing user custom pages
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
            <a href="/pages/${p.id}" target="_blank" style="padding: 4px 8px; background: #319795; color: white; border-radius: 4px; font-size: 0.75rem; text-decoration: none; font-weight: bold;">View</a>
            <button class="btn-delete-page" data-slug="${p.id}" style="padding: 4px 8px; background: #e53e3e; color: white; border-radius: 4px; font-size: 0.75rem; border: none; cursor: pointer; font-weight: bold;">Delete</button>
          </td>
        </tr>
      `).join('');

      // Attach delete click listeners
      existingPagesTbody.querySelectorAll('.btn-delete-page').forEach(btn => {
        btn.addEventListener('click', async () => {
          const slug = btn.dataset.slug;
          if (confirm(`Are you sure you want to permanently delete custom route /pages/${slug}?`)) {
            try {
              await contentDB.deleteContent(slug);
              toast.success('Page deleted successfully.');
              loadExistingPages();
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

  // Update visual preview box on-the-fly
  function updateLivePreview() {
    const title = document.getElementById('page-title').value || 'My Custom Page';
    const slug = document.getElementById('page-slug').value || 'our-story';
    const desc = document.getElementById('page-meta-desc').value || '';
    const access = document.getElementById('page-access').value || 'public';

    let blocksHtml = blocks.map((b, idx) => {
      if (b.type === 'heading') {
        return `<h2 style="font-size: 1.8rem; color: var(--theme-color-primary, #2b6cb0); margin-top: 1.5rem;">${b.value}</h2>`;
      } else if (b.type === 'paragraph') {
        return `<p style="line-height: 1.6; color: var(--theme-color-text-secondary, #4a5568); margin-bottom: 1rem;">${b.value}</p>`;
      } else if (b.type === 'image') {
        return `<div style="text-align: center; margin: 1.5rem 0;"><img src="${b.value}" alt="Image Block" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" /></div>`;
      } else if (b.type === 'cta') {
        return `
          <div style="background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 1.5rem; text-align: center; margin: 1.5rem 0;">
            <p style="font-weight: bold; font-size: 1.15rem; color: #2b6cb0; margin-bottom: 0.75rem;">Join Foundation Today!</p>
            <button class="btn-primary" style="padding: 10px 20px; font-weight: bold;">${b.value || 'Get Started'}</button>
          </div>
        `;
      } else if (b.type === 'video') {
        return `
          <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5rem 0; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <iframe src="${b.value}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
          </div>
        `;
      } else if (b.type === 'button') {
        return `
          <div style="text-align: center; margin: 1rem 0;">
            <button class="btn-primary" style="padding: 10px 24px; font-weight: bold;">${b.value || 'Click Me'}</button>
          </div>
        `;
      }
      return '';
    }).join('');

    previewBox.innerHTML = `
      <article style="max-width: 100%; padding: 1rem; font-family: system-ui, sans-serif;">
        <header style="border-bottom: 1px solid var(--theme-color-border, #edf2f7); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: bold; background: #e2e8f0; padding: 2px 8px; border-radius: 12px; color: #4a5568;">
            Access: ${access.toUpperCase()}
          </span>
          <h1 style="font-size: 2.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin: 0.5rem 0 0.25rem 0;">${title}</h1>
          <p style="color: var(--theme-color-text-secondary, #718096); font-style: italic; font-size: 0.95rem; margin: 0;">Route Slug: /pages/${slug}</p>
          ${desc ? `<p style="font-size: 0.9rem; color: #a0aec0; margin-top: 4px;">Description: ${desc}</p>` : ''}
        </header>
        <div>
          ${blocksHtml || '<p style="color: #a0aec0; font-style: italic; text-align: center; padding: 2rem;">Workspace is currently empty. Add content blocks above.</p>'}
        </div>
      </article>
    `;
  }

  // Render individual block controllers in the editor builder list
  function renderBlocksEditor() {
    blocksContainer.innerHTML = '';
    blocks.forEach((block, idx) => {
      const blockDiv = document.createElement('div');
      blockDiv.style.cssText = 'background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;';

      blockDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 0.85rem; text-transform: uppercase; color: var(--theme-color-text-secondary, #718096);">
            Block #${idx + 1}: ${block.type}
          </span>
          <div style="display: flex; gap: 0.25rem;">
            <button class="btn-move-up" data-idx="${idx}" style="padding: 2px 6px; font-size: 0.7rem; cursor: pointer; border: 1px solid #cbd5e0; border-radius: 4px; background: transparent;">▲</button>
            <button class="btn-move-down" data-idx="${idx}" style="padding: 2px 6px; font-size: 0.7rem; cursor: pointer; border: 1px solid #cbd5e0; border-radius: 4px; background: transparent;">▼</button>
            <button class="btn-remove-block" data-idx="${idx}" style="padding: 2px 6px; font-size: 0.7rem; cursor: pointer; background: #fed7d7; color: #c53030; border: none; border-radius: 4px;">✖</button>
          </div>
        </div>
        <div>
          <textarea class="block-value-input" data-idx="${idx}" style="width: 100%; padding: 8px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 4px; font-family: sans-serif; font-size: 0.9rem; box-sizing: border-box; min-height: 40px;" placeholder="Enter content block value...">${block.value || ''}</textarea>
        </div>
      `;

      // Event listener for block content edits
      const ta = blockDiv.querySelector('.block-value-input');
      ta.addEventListener('input', (e) => {
        blocks[idx].value = e.target.value;
        updateLivePreview();
      });

      // Move Up
      blockDiv.querySelector('.btn-move-up').addEventListener('click', () => {
        if (idx > 0) {
          const temp = blocks[idx];
          blocks[idx] = blocks[idx - 1];
          blocks[idx - 1] = temp;
          renderBlocksEditor();
          updateLivePreview();
        }
      });

      // Move Down
      blockDiv.querySelector('.btn-move-down').addEventListener('click', () => {
        if (idx < blocks.length - 1) {
          const temp = blocks[idx];
          blocks[idx] = blocks[idx + 1];
          blocks[idx + 1] = temp;
          renderBlocksEditor();
          updateLivePreview();
        }
      });

      // Remove block
      blockDiv.querySelector('.btn-remove-block').addEventListener('click', () => {
        blocks.splice(idx, 1);
        renderBlocksEditor();
        updateLivePreview();
      });

      blocksContainer.appendChild(blockDiv);
    });
  }

  // Bind adding new block types
  btnAddBlock.addEventListener('click', () => {
    const typeSelect = document.getElementById('page-block-type-select');
    if (!typeSelect) return;
    const blockType = typeSelect.value;
    blocks.push({ type: blockType, value: '' });
    renderBlocksEditor();
    updateLivePreview();
  });

  // Bind key identity field inputs to refresh preview
  ['page-title', 'page-slug', 'page-meta-desc', 'page-access'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateLivePreview);
  });

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

    const payload = {
      type: 'page',
      id: slug,
      title: title,
      description: desc || 'Custom dynamic page',
      blocks: blocks,
      access: { visibility: access },
      author: store.state.user?.displayName || 'Editor',
      date: new Date().toISOString().split('T')[0]
    };

    try {
      const success = await contentDB.saveCustomPage(payload);
      if (success) {
        toast.success(`Custom page /pages/${slug} published successfully!`);
        form.reset();
        blocks = [];
        renderBlocksEditor();
        updateLivePreview();
        loadExistingPages();
      } else {
        toast.error('Failed to save page schema. Please verify connection.');
      }
    } catch (err) {
      toast.error(`Publishing Failed: ${err.message}`);
    }
  });

  // Initial tab loading
  loadExistingPages();
  updateLivePreview();
}
