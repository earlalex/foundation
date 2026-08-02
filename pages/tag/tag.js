// pages/tag/tag.js
import { contentDB } from '../../core/db.js';
import { initScrollReveal } from '../../utils/observer.js';

export async function initTagPage() {
  console.log('[Tag Page]: Initializing tag archive...');

  // Get current tag from pathname /tag/TagName
  const path = window.location.pathname;
  const match = path.match(/\/tag\/([^/]+)/);
  const tagName = match ? decodeURIComponent(match[1]) : '';

  const titleEl = document.getElementById('tag-archive-title');
  if (titleEl) {
    titleEl.textContent = `Tag Archive: #${tagName || 'All'}`;
  }

  const grid = document.getElementById('tag-archive-grid');
  if (!grid) return;

  if (!tagName) {
    grid.innerHTML = `<p style="grid-column: 1 / -1; color: #a0aec0; text-align: center;">No tag specified.</p>`;
    return;
  }

  try {
    const allContent = await contentDB.getAllContent();
    const taggedItems = allContent.filter(item => {
      const itemTags = item.tags || [];
      return itemTags.some(t => t.toLowerCase() === tagName.toLowerCase());
    });

    if (taggedItems.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--theme-color-surface, #ffffff); border-radius: 8px; border: 1px dashed var(--theme-color-border, #cbd5e0);">
          <p style="color: #718096; margin: 0; font-size: 1.05rem; font-weight: 600;">No matching publications found for #${tagName}.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = taggedItems.map(item => {
      const id = escapeHTML(item.id || '');
      const title = escapeHTML(item.title || '');
      const date = escapeHTML(item.date || '');
      const description = escapeHTML(item.preview?.teaserText || item.description || '');
      const author = escapeHTML(item.author || 'Foundation Team');
      const tagsStr = (item.tags || []).join(', ');

      return `
        <div class="reveal-on-scroll" style="display: flex; flex-direction: column; gap: 0.5rem; background: white; border-radius: 8px; overflow: hidden;">
          <content-card
            id="${id}"
            title="${title}"
            date="${date}"
            author="${author}"
            description="${description}"
            tags="${tagsStr}">
          </content-card>
        </div>
      `;
    }).join('');

    // Re-run scroll-reveal on new elements
    initScrollReveal();

  } catch (err) {
    console.error('[Tag Page Error]:', err);
    grid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--theme-color-danger, #e53e3e); text-align: center;">Error loading tagged content.</p>`;
  }
}

function escapeHTML(str) {
  return String(str).replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
  );
}
