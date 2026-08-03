// components/global/ContentCard.js
export class ContentCard extends HTMLElement {
  connectedCallback() {
    const id = this.getAttribute('id') || '';
    const title = this.getAttribute('title') || '';
    const date = this.getAttribute('date') || '';
    const description = this.getAttribute('description') || '';
    const author = this.getAttribute('author') || '';
    const tagsAttr = this.getAttribute('tags') || '';
    const tags = tagsAttr ? tagsAttr.split(',').map(t => t.trim()).filter(Boolean) : [];

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const sanitizedId = escapeHTML(id);
    const sanitizedTitle = escapeHTML(title);
    const sanitizedDate = escapeHTML(date);
    const sanitizedDescription = escapeHTML(description);
    const sanitizedAuthor = escapeHTML(author);

    const tagsHtml = tags.map(tag => {
      const escapedTag = escapeHTML(tag);
      return `
        <a href="/tag/${escapedTag}" style="display: inline-block; background: var(--theme-color-surface-alt, #f8fafc); border: 1px solid var(--theme-color-border, #cbd5e1); color: var(--theme-color-primary, #2b6cb0); font-weight: bold; font-size: 0.75rem; text-decoration: none; padding: 2px 8px; border-radius: 4px; transition: all 0.2s;" class="tag-chip">🏷️ ${escapedTag}</a>
      `;
    }).join(' ');

    this.innerHTML = `
      <article class="card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.04); height: 100%;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="color: #a0aec0; font-size: 0.8rem;">${sanitizedDate}</span>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #1a202c; font-weight: 700; line-height: 1.35;">
            ${sanitizedId ? `<a href="/detail?id=${sanitizedId}" style="color: inherit; text-decoration: none; border-bottom: 1px dashed transparent; transition: border-color 0.2s;">${sanitizedTitle}</a>` : sanitizedTitle}
          </h3>
          ${sanitizedAuthor ? `<p style="color: #718096; font-size: 0.825rem; margin: 0 0 0.75rem 0;">By ${sanitizedAuthor}</p>` : ''}
          <p style="margin: 0 0 1rem 0; color: #4a5568; font-size: 0.875rem; line-height: 1.5; text-align: left !important;">
            ${sanitizedDescription}
          </p>
          ${tags.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
              ${tagsHtml}
            </div>
          ` : ''}
        </div>
      </article>
    `;

    // Make sure we intercept clicks on tag chips inside the card for dynamic SPA router transitions!
    this.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const href = chip.getAttribute('href');
        window.router?.navigateTo(href);
      });
    });
  }
}

if (!customElements.get('content-card')) {
  customElements.define('content-card', ContentCard);
}
