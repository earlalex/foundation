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
      { type: 'blog', title: '📰 Latest Blog Posts', icon: '📝' },
      { type: 'event', title: '📅 Upcoming Events & Live Meets', icon: '📹' },
      { type: 'podcast', title: '🎙️ Podcast Episodes', icon: '🎧' },
      { type: 'education', title: '🎓 Educational Courses & Worksheets', icon: '📚' },
      { type: 'book', title: '📖 Publications & Books', icon: '📗' },
      { type: 'howto', title: '💡 How-To Guides', icon: '🛠️' },
      { type: 'portfolio', title: '🚀 Portfolio Case Studies', icon: '💼' },
      { type: 'announcement', title: '📢 Sitewide Announcements', icon: '📌' }
    ];

    const grouped = {};
    allItems.forEach(item => {
      const t = item.type || 'blog';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(item);
    });

    // 3. Render distinct sections for types that have content
    let htmlOutput = '';
    let renderedCount = 0;

    sectionConfigs.forEach(config => {
      const typeItems = grouped[config.type] || [];
      if (typeItems.length === 0) return;

      renderedCount++;
      const previewItems = typeItems.slice(0, 3); // Limit to top 3 previews per section

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
            ${previewItems.map(item => renderContentCard(item)).join('')}
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
 * Helper to render individual content preview cards
 */
function renderContentCard(item) {
  const isEvent = item.type === 'event';
  const imageSrc = item.preview?.featuredImage?.src;

  return `
    <article style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: transform 0.2s ease, box-shadow 0.2s ease;">
      <div>
        ${imageSrc ? `
          <img src="${imageSrc}" alt="${item.title}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 1rem; display: block;" />
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="color: #a0aec0; font-size: 0.8rem;">${item.date || ''}</span>
          ${item.location ? `
            <span style="font-size: 0.75rem; color: #4a5568; background: #f7fafc; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
              📍 ${item.location}
            </span>
          ` : ''}
        </div>

        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #1a202c; font-weight: 700; line-height: 1.35;">
          ${item.title}
        </h3>

        <p style="color: #718096; font-size: 0.825rem; margin: 0 0 0.75rem 0;">
          By ${item.author || 'Foundation Team'}
        </p>

        <p style="margin: 0 0 1rem 0; color: #4a5568; font-size: 0.875rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
          ${item.preview?.teaserText || item.description || ''}
        </p>
      </div>

      ${isEvent && item.meetUrl ? `
        <a href="${item.meetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; text-align: center; background: #2b6cb0; color: #ffffff; padding: 8px 12px; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 600; margin-top: auto;">
          📹 Join Google Meet
        </a>
      ` : ''}
    </article>
  `;
}