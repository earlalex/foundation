// core/navbar.js
// Simplified Native Initialization Delegation to Web Component AppNavbar

export function initNavbar() {
  const headerContainer = document.getElementById('global-header');
  if (!headerContainer) return;

  headerContainer.innerHTML = '<app-navbar></app-navbar>';
}
