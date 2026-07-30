/**
 * pages/admin/components/AdminSetupCard.js
 * Standardized UI overlay shown when an admin section is not fully configured.
 */
export class AdminSetupCard {
  /**
   * Render the unconfigured state overlay card inside a target element
   * @param {HTMLElement} targetEl - The tab panel container element to overlay/lock
   * @param {Object} options
   * @param {string} options.title - The section name (e.g. "Finances & ACH")
   * @param {Array<string>} options.missingPrereqs - Array of missing required keys or descriptions
   * @param {Function} options.onLaunchWizard - Callback when "Launch Setup Wizard" is clicked
   */
  static render(targetEl, options) {
    if (!targetEl) return;

    // Save the original operational contents so we can restore them once configured
    if (!targetEl.dataset.originalHtml) {
      targetEl.dataset.originalHtml = targetEl.innerHTML;
    }

    // Hide or clear standard contents, keeping our data-original-html reference
    targetEl.innerHTML = '';

    const cardContainer = document.createElement('div');
    cardContainer.className = 'setup-guard-overlay';
    cardContainer.style.cssText = `
      background: var(--theme-color-surface, #ffffff);
      border: 2px dashed var(--theme-color-border, #cbd5e0);
      border-radius: var(--theme-layout-border-radius, 8px);
      padding: 3rem 2rem;
      text-align: center;
      max-width: 600px;
      margin: 2rem auto;
      box-shadow: var(--theme-layout-box-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
      font-family: system-ui, sans-serif;
    `;

    const prereqsListHtml = options.missingPrereqs
      .map(prereq => `<li style="margin-bottom: 0.5rem;">🔴 Missing: <strong>${prereq}</strong></li>`)
      .join('');

    cardContainer.innerHTML = `
      <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">🛠️</div>
      <h2 style="margin-top: 0; margin-bottom: 0.75rem; color: var(--theme-color-text-primary, #1a202c); font-size: 1.5rem; font-weight: 800;">
        ${options.title} Setup Needed
      </h2>
      <p style="color: var(--theme-color-text-secondary, #4a5568); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
        This administrative module requires initial baseline configuration and API integration parameters before allowing normal feature usage.
      </p>

      <div style="background: var(--theme-color-background, #f7fafc); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 6px; padding: 1.25rem; margin-bottom: 2rem; text-align: left;">
        <h4 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--theme-color-text-secondary, #718096);">
          Missing Prerequisites
        </h4>
        <ul style="margin: 0; padding-left: 0; list-style: none; font-size: 0.9rem; color: var(--theme-color-text-primary, #2d3748);">
          ${prereqsListHtml}
        </ul>
      </div>

      <button class="btn-primary btn-launch-wizard" style="
        background: var(--theme-color-primary, #2b6cb0);
        color: white;
        padding: 12px 28px;
        font-size: 1rem;
        font-weight: bold;
        border: none;
        border-radius: var(--theme-layout-border-radius, 8px);
        cursor: pointer;
        transition: background 0.2s;
        box-shadow: 0 4px 6px rgba(43, 108, 176, 0.2);
      ">
        Launch Setup Wizard
      </button>
    `;

    const button = cardContainer.querySelector('.btn-launch-wizard');
    if (button && options.onLaunchWizard) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        options.onLaunchWizard();
      });
    }

    targetEl.appendChild(cardContainer);
  }

  /**
   * Restore the tab panel's original operational controls
   * @param {HTMLElement} targetEl
   */
  static unlock(targetEl) {
    if (targetEl && targetEl.dataset.originalHtml) {
      targetEl.innerHTML = targetEl.dataset.originalHtml;
    }
  }
}
