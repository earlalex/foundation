// components/ContentCard.js
export class ContentCard extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || '';
    const date = this.getAttribute('date') || '';
    const description = this.getAttribute('description') || '';

    this.innerHTML = `
      <article class="card" style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px;">
        <span style="font-size: 0.8rem; color: #718096;">${date}</span>
        <h3 style="margin: 0.5rem 0;">${title}</h3>
        <p style="color: #4a5568; font-size: 0.9rem;">${description}</p>
      </article>
    `;
  }
}

customElements.define('content-card', ContentCard);