// pages/admin/admin-preview.js - Admin Experience Preview Engine
import { store } from '../../core/store.js';
import { toast } from '../../utils/toast.js';

export function initAdminPreview() {
  const roleSelect = document.getElementById('preview-role-select');
  const launchBtn = document.getElementById('btn-launch-preview');
  const resetBtn = document.getElementById('btn-reset-preview');

  if (!roleSelect || !launchBtn || !resetBtn) {
    console.warn('[Admin Preview]: Elements not found. Skipping init.');
    return;
  }

  // Set initial selected value from current store simulated tier if any
  const currentSimulated = store.state.simulatedUserTier;
  if (currentSimulated) {
    roleSelect.value = currentSimulated;
  }

  launchBtn.addEventListener('click', () => {
    const chosenRole = roleSelect.value;
    try {
      store.dispatch('SET_SIMULATED_USER_TIER', chosenRole);
      toast.success(`Active Preview: Simulation Mode for [${chosenRole.toUpperCase()}] started!`);
      // Redirect to /home to verify what user tier sees
      setTimeout(() => {
        window.router.navigateTo('/home');
      }, 500);
    } catch (e) {
      toast.error(`Simulation failed: ${e.message}`);
    }
  });

  resetBtn.addEventListener('click', () => {
    try {
      store.dispatch('SET_SIMULATED_USER_TIER', null);
      roleSelect.value = 'prospect';
      toast.success('Simulation Mode reset to Admin original views.');
    } catch (e) {
      toast.error(`Reset failed: ${e.message}`);
    }
  });
}
