// components/global/ContentCard.js
export class ContentCard extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || '';
    const date = this.getAttribute('date') || '';
    const description = this.getAttribute('description') || '';
    const author = this.getAttribute('author') || '';

    this.innerHTML = `
      <article class="card" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="color: #a0aec0; font-size: 0.8rem;">${date}</span>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #1a202c; font-weight: 700; line-height: 1.35;">
            ${title}
          </h3>
          ${author ? `<p style="color: #718096; font-size: 0.825rem; margin: 0 0 0.75rem 0;">By ${author}</p>` : ''}
          <p style="margin: 0 0 1rem 0; color: #4a5568; font-size: 0.875rem; line-height: 1.5;">
            ${description}
          </p>
        </div>
      </article>
    `;
  }
}

if (!customElements.get('content-card')) {
  customElements.define('content-card', ContentCard);
}