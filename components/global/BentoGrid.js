// components/global/BentoGrid.js
export class BentoGrid extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 2rem 0; width: 100%;">
        <slot></slot>
      </section>
    `;
  }
}

if (!customElements.get('bento-grid')) {
  customElements.define('bento-grid', BentoGrid);
}
