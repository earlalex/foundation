// utils/toast.js - User-friendly toast notification system
export class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    const colors = {
      success: { bg: '#38a169', border: '#2f855a' },
      error: { bg: '#e53e3e', border: '#c53030' },
      warning: { bg: '#d69e2e', border: '#b7791f' },
      info: { bg: '#3182ce', border: '#2b6cb0' }
    };
    const color = colors[type] || colors.info;

    toast.style.cssText = `
      pointer-events: auto;
      min-width: 300px;
      max-width: 450px;
      padding: 16px;
      background: ${color.bg};
      color: white;
      border-left: 4px solid ${color.border};
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.9rem;
      line-height: 1.4;
      animation: slideIn 0.3s ease-out;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    `;

    const icon = this.getIcon(type);
    toast.innerHTML = `
      <span style="font-size: 1.25rem; flex-shrink: 0;">${icon}</span>
      <span style="flex: 1;">${message}</span>
      <button style="background: none; border: none; color: white; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; opacity: 0.8;">&times;</button>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.onclick = () => this.dismiss(toast);

    this.container.appendChild(toast);

    setTimeout(() => this.dismiss(toast), duration);
    return toast;
  }

  dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }

  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

export const toast = new ToastManager();
