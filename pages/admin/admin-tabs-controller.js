// pages/admin/admin-tabs-controller.js - Tab navigation and routing logic
import { store } from '../../core/store.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';

export function initTabController() {
  const tabButtons = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');

  // Load and display the current logged in email and notification count in top header
  const headerEmailEl = document.getElementById('admin-header-email');
  const headerNotifsEl = document.getElementById('admin-header-notifs');
  const activeAdminEmail = store.state.user?.email || configManager.current.adminEmails?.[0] || 'admin@example.com';
  
  if (headerEmailEl) {
    headerEmailEl.textContent = activeAdminEmail;
  }

  // Dynamically estimate notification alert count
  if (headerNotifsEl) {
    let alertCount = 0;
    if (!configManager.current.thirdParty?.ga4PropertyId || !configManager.current.thirdParty?.lookerStudioEmbedUrl) {
      alertCount++;
    }
    if (!configManager.current.virustotal?.apiKey) {
      alertCount++;
    }
    headerNotifsEl.textContent = `${alertCount} Alert${alertCount !== 1 ? 's' : ''}`;
    headerNotifsEl.style.background = alertCount > 0 ? 'var(--theme-color-danger, #e53e3e)' : 'var(--theme-color-success, #38a169)';
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.style.borderLeft = '';
        b.style.paddingLeft = '';
        b.style.color = 'var(--theme-color-text-secondary, #4a5568)';
      });
      btn.classList.add('active');
      btn.style.color = 'var(--theme-color-primary, #2b6cb0)';

      panels.forEach((p) => {
        p.style.display = p.id === `tab-${targetTab}` ? 'block' : 'none';
      });

      // Dispatch custom event for tab-specific initialization
      window.dispatchEvent(new CustomEvent('adminTabChanged', { detail: { tab: targetTab } }));
    });
  });
}
