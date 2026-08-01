// core/navbar.js
export function initNavbar() {
  const headerContainer = document.getElementById('global-header');
  if (headerContainer) {
    headerContainer.innerHTML = '<app-navbar></app-navbar>';
  }
}
