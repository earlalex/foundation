// pages/home/home.js
import { contentDB } from '/core/db.js';

export async function initHomePage() {
  const container = document.getElementById('home-sections-container');
  if (!container) return;

  try {
    // 1. Fetch all published items across schemas
    const allItems = await contentDB.getContentByType('all', 50);
    if (!allItems || allItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; background: #f7fafc; border-radius: 8px; border: 1px dashed #cbd5e0;">
          <p style="color: #718096; margin: 0; font-size: 1.05rem;">No public publications found yet.</p>
        </div>
      `;
      return;
    }

    // 2. Group content by schema type
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

    // 3. Render distinct sections for types that have content
    let htmlOutput = '';
    let renderedCount = 0;

    sectionConfigs.forEach((config) => {
      const typeItems = grouped[config.type] || [];
      if (typeItems.length === 0) return;
      renderedCount++;
      const previewItems = typeItems.slice(0, 3); // Top 3 previews per section

      htmlOutput += `
        <section style="border-bottom: 1px solid #edf2f7; padding-bottom: 2.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h2 style="font-size: 1.35rem; color: #1a202c; font-weight: 700; margin: 0;">
              ${config.title}
            </h2>
            <span style="font-size: 0.85rem; color: #718096; font-weight: 600; background: #edf2f7; padding: 3px 10px; border-radius: 12px;">
              ${typeItems.length} ${typeItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
            ${previewItems.map((item) => renderContentCard(item)).join('')}
          </div>
        </section>
      `;
    });

    if (renderedCount === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #718096;">
          No items match configured content sections.
        </div>
      `;
      return;
    }

    container.innerHTML = htmlOutput;
  } catch (err) {
    console.error('Error rendering multi-section homepage:', err);
    container.innerHTML = `
      <div style="text-align: center; color: #e53e3e; padding: 2rem;">
        Failed to load content sections.
      </div>
    `;
  }
}

/**
 * Helper to render individual content cards using custom <content-card> element
 */
function renderContentCard(item) {
  const isEvent = item.type === 'event';
  const title = escapeHTML(item.title || '');
  const date = escapeHTML(item.date || '');
  const description = escapeHTML(item.preview?.teaserText || item.description || '');
  const author = escapeHTML(item.author || 'Foundation Team');

  return `
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <content-card 
        title="${title}" 
        date="${date}" 
        author="${author}"
        description="${description}">
      </content-card>
      ${
        isEvent && item.meetUrl
          ? `
        <a href="${item.meetUrl}" target="_blank" rel="noopener noreferrer" 
           style="display: inline-block; text-align: center; background: #2b6cb0; color: #ffffff; padding: 8px 12px; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
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