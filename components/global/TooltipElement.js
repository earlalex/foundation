// components/global/TooltipElement.js
export class TooltipElement extends HTMLElement {
  connectedCallback() {
    const text = this.getAttribute('text') || '';
    const uniqueId = `tooltip-${Math.random().toString(36).substring(2, 9)}`;

    this.innerHTML = `
      <span class="tooltip-wrapper" aria-describedby="${uniqueId}">
        <span class="tooltip-icon" aria-hidden="true">?</span>
        <span id="${uniqueId}" role="tooltip" class="tooltip-text">${text}</span>
      </span>
    `;
  }
}

if (!customElements.get('tooltip-element')) {
  customElements.define('tooltip-element', TooltipElement);
}
