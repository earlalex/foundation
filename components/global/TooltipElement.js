// components/global/TooltipElement.js
export class TooltipElement extends HTMLElement {
  connectedCallback() {
    const text = this.getAttribute('text') || '';
    const uniqueId = `tooltip-${Math.random().toString(36).substring(2, 9)}`;

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const sanitizedText = escapeHTML(text);

    this.innerHTML = `
      <span class="tooltip-wrapper" aria-describedby="${uniqueId}">
        <span class="tooltip-icon" aria-hidden="true">?</span>
        <span id="${uniqueId}" role="tooltip" class="tooltip-text">${sanitizedText}</span>
      </span>
    `;
  }
}

if (!customElements.get('tooltip-element')) {
  customElements.define('tooltip-element', TooltipElement);
}
