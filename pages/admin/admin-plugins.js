// pages/admin/admin-plugins.js
import { pluginManager } from '../../core/plugins.js';
import { toast } from '../../utils/toast.js';

export function initPluginsTab() {
  const container = document.getElementById('plugins-list-tbody');
  if (!container) return;

  function renderPlugins() {
    const list = pluginManager.getPlugins();
    if (list.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1rem;">No plugins registered.</td>
        </tr>
      `;
      return;
    }

    container.innerHTML = list.map(p => `
      <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
        <td style="padding: 12px; font-weight: bold; color: var(--theme-color-text-primary, #2d3748);">${p.name}</td>
        <td style="padding: 12px; font-size: 0.85rem; color: var(--theme-color-text-secondary, #718096);">${p.description}</td>
        <td style="padding: 12px; font-size: 0.85rem; font-family: monospace;">v${p.version}</td>
        <td style="padding: 12px; text-align: right;">
          <button class="btn-toggle-plugin" data-id="${p.id}" data-enabled="${p.enabled}" style="padding: 6px 12px; border: none; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer; color: white; background-color: ${p.enabled ? '#e53e3e' : '#38a169'};">
            ${p.enabled ? 'Pause' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');

    container.querySelectorAll('.btn-toggle-plugin').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const currentEnabled = btn.dataset.enabled === 'true';
        const nextEnabled = !currentEnabled;

        pluginManager.togglePlugin(id, nextEnabled);
        toast.success(`Plugin "${id}" ${nextEnabled ? 'activated' : 'paused'} cleanly!`);
        renderPlugins();
      });
    });
  }

  renderPlugins();
}
