// pages/home/home.js
import { contentDB } from '../../core/db.js';
import { errorHandler } from '../../core/error-handler.js';

export async function initHomePage() {
  // 1. Persistent Page Overrides Check
  try {
    const override = await contentDB.getCustomPageBySlug('home');
    if (override && override.compiledHtml) {
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = override.compiledHtml + (override.compiledCss ? `<style>${override.compiledCss}</style>` : '');
        return;
      }
    }
  } catch (err) {
    console.warn('[Page Override]: Custom page override check failed for "home"', err);
  }

  const container = document.getElementById('home-sections-container');
  if (!container) return;

  try {
    // Fetch all published items across schemas
    const allItems = await contentDB.getContentByType('all', 50);
    if (!allItems || allItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1.5rem; background: var(--theme-color-surface, #ffffff); border-radius: 8px; border: 1px dashed var(--theme-color-border, #cbd5e0); margin: 3rem auto; max-width: var(--theme-layout-container-max-width, 1200px);">
          <p style="color: var(--theme-color-text-secondary); margin: 0; font-size: 1.1rem; font-weight: bold;">No public publications found yet.</p>
        </div>
      `;
      return;
    }

    // Group content by schema type
    const sectionConfigs = [
      { type: 'blog', title: 'Latest Blog Posts' },
      { type: 'event', title: 'Upcoming Events & Live Meets' },
      { type: 'podcast', title: 'Podcast Episodes' },
      { type: 'education', title: 'Educational Courses & Worksheets' },
      { type: 'book', title: 'Publications & Books' },
      { type: 'howto', title: 'How-To Guides' },
      { type: 'portfolio', title: 'Portfolio Case Studies' },
      { type: 'announcement', title: 'Sitewide Announcements' }
    ];

    const grouped = {};
    allItems.forEach((item) => {
      const t = item.type || 'blog';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(item);
    });

    // Render distinct sections for types that have content
    let htmlOutput = '';
    let renderedCount = 0;

    sectionConfigs.forEach((config) => {
      const typeItems = grouped[config.type] || [];
      if (typeItems.length === 0) return;

      renderedCount++;
      const previewItems = typeItems.slice(0, 3); // Top 3 previews per section

      htmlOutput += `
        <section class="alternating-section" style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
          <div style="max-width: var(--theme-layout-container-max-width, 1200px); margin: 0 auto; padding: 0 var(--spacing-16);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <h2 style="font-size: 1.45rem; color: var(--theme-color-text-primary, #1a202c); font-weight: 800; margin: 0; letter-spacing: -0.02em;">
                ${config.title}
              </h2>
              <span style="font-size: 0.85rem; color: var(--theme-color-text-secondary); font-weight: 700; background: var(--theme-color-background, #edf2f7); padding: 4px 12px; border-radius: 12px; border: 1px solid var(--theme-color-border, #e2e8f0);">
                ${typeItems.length} ${typeItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
              ${previewItems.map((item) => renderContentCard(item)).join('')}
            </div>
          </div>
        </section>
      `;
    });

    if (renderedCount === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1.5rem; color: var(--theme-color-text-secondary);">
          No items match configured content sections.
        </div>
      `;
      return;
    }

    container.innerHTML = htmlOutput;
  } catch (err) {
    errorHandler.handleError(err, 'Home Page - Content Loading');
    console.error('Error rendering multi-section homepage:', err);
    container.innerHTML = `
      <div style="text-align: center; color: var(--theme-color-danger); padding: 4rem 1.5rem;">
        Failed to load content sections.
      </div>
    `;
  }
}

function renderContentCard(item) {
  const isEvent = item.type === 'event';
  const id = escapeHTML(item.id || '');
  const title = escapeHTML(item.title || '');
  const date = escapeHTML(item.date || '');
  const description = escapeHTML(item.preview?.teaserText || item.description || '');
  const author = escapeHTML(item.author || 'Foundation Team');

  return `
    <div class="card reveal-on-scroll" style="display: flex; flex-direction: column; gap: 0.5rem; background: var(--theme-color-surface, #ffffff); padding: 1.25rem; border-radius: var(--theme-layout-border-radius, 8px); box-shadow: var(--theme-layout-box-shadow); border: 1px solid rgba(0,0,0,0.03); transition: all 0.2s ease;">
      <content-card 
        id="${id}"
        title="${title}" 
        date="${date}" 
        author="${author}"
        description="${description}">
      </content-card>
      ${
        isEvent && item.meetUrl
          ? `
        <a href="${item.meetUrl}" target="_blank" rel="noopener noreferrer" 
            style="display: inline-block; text-align: center; background: var(--theme-color-primary, #2b6cb0); color: #ffffff; padding: 10px 14px; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 700; margin-top: auto; border: none; cursor: pointer; transition: all 0.15s ease;">
            Join Google Meet
        </a>
      `
          : ''
      }
    </div>
  `;
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
