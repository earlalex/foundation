// utils/toast.js - User-friendly role & mode aware toast notification system
import { store } from '../core/store.js';

export class ToastManager {
  constructor() {
    this.container = null;
    this.lastToastTimes = new Map();
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  }

  saveToNotificationHistory(message, type) {
    try {
      if (typeof localStorage === 'undefined') return;
      const history = JSON.parse(localStorage.getItem('foundation_notification_history') || '[]');

      // Categorize cleanly by System Alerts, Orders & Payments, Audit Logs
      let category = 'Audit Logs';
      const lowercaseMsg = String(message || '').toLowerCase();
      if (type === 'error' || type === 'warning' || lowercaseMsg.includes('fail') || lowercaseMsg.includes('error')) {
        category = 'System Alerts';
      } else if (type === 'success' || lowercaseMsg.includes('order') || lowercaseMsg.includes('payment') || lowercaseMsg.includes('purchas') || lowercaseMsg.includes('payout') || lowercaseMsg.includes('wise') || lowercaseMsg.includes('checkout') || lowercaseMsg.includes('subscribe')) {
        category = 'Orders & Payments';
      }

      const newNotif = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        message: String(message || ''),
        type, // 'success', 'error', 'warning', 'info'
        category,
        timestamp: new Date().toISOString(),
        isRead: false
      };

      history.unshift(newNotif);

      // Limit to 100 entries max to prevent local storage bloatedness
      localStorage.setItem('foundation_notification_history', JSON.stringify(history.slice(0, 100)));

      // Dispatch real-time custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-received', { detail: newNotif }));
      }
    } catch (err) {
      console.warn('[Toast History Error]:', err);
    }
  }

  isInternalFrameworkError(message) {
    if (!message) return false;
    const lower = String(message).toLowerCase();
    const internalKeywords = [
      'firestore', 'outbox', 'timeout', 'fallback', 'csp',
      'background', 'postponed', 'sync', 'audio block',
      'unhandled', 'rejection', 'quota', 'permission-denied',
      'service worker', 'sw', 'loader', 'network error',
      'failed to fetch', 'indexeddb', 'quotaexceedederror',
      'telemetry', 'application error', 'unhandled promise rejection'
    ];
    return internalKeywords.some(kw => lower.includes(kw));
  }

  isUserActionableMessage(message) {
    if (!message) return false;
    const lower = String(message).toLowerCase();
    const actionableKeywords = [
      'invalid login credentials', 'please fill required fields',
      'checkout failed', 'password too short', 'email is required',
      'please fix', 'please select', 'payment failed', 'incorrect password',
      'saved', 'welcome back', 'item added to cart', 'user removed',
      'created', 'updated', 'copied', 'submitted', 'registered',
      'converted', 'deduplicated', 'synced', 'exported', 'failed to send email',
      'failed to remove user', 'failed to convert', 'failed to deduplicate'
    ];
    return actionableKeywords.some(kw => lower.includes(kw));
  }

  show(message, type = 'info', duration = 4000, options = {}) {
    if (!this.container) {
      this.init();
    }

    if (!this.lastToastTimes) {
      this.lastToastTimes = new Map();
    }

    const msgStr = String(message || '');
    const now = Date.now();
    const lastTime = this.lastToastTimes.get(msgStr) || 0;

    // Direct all toasts (both screen-suppressed and shown) to the local notification center history
    this.saveToNotificationHistory(msgStr, type);

    // Apply 5-second silence window for repeated identical on-screen toasts
    if (now - lastTime < 5000) {
      console.log(`[Toast quiet mode]: Redirected duplicate notification to notification feed: "${msgStr}"`);
      return null;
    }
    this.lastToastTimes.set(msgStr, now);

    // Context / Role / Mode evaluation for on-screen popups
    const state = store?.state || {};
    const user = state.user || null;
    const currentRole = state.simulatedUserTier || user?.role || 'prospect';
    const isDevConsoleBypass = typeof window !== 'undefined' && window.__FOUNDATION_DEV_BYPASS__ === true;
    const isDevMode = state.isDevMode === true || state.devMode === true || (typeof localStorage !== 'undefined' && localStorage.getItem('foundation_dev_mode') === 'true');
    const isAdminOrEditor = Boolean(
      isDevConsoleBypass ||
      user?.isAdmin ||
      currentRole === 'admin' ||
      currentRole === 'editor' ||
      user?.provider === 'google.com'
    );

    const isInternal = this.isInternalFrameworkError(msgStr);
    const isActionable = options.isActionable || this.isUserActionableMessage(msgStr) || type === 'success';

    // 1. NON-ADMIN / NON-EDITOR USERS:
    // Completely suppress all internal framework error toasts on-screen.
    // Only display critical, user-actionable messages.
    if (!isAdminOrEditor) {
      if ((type === 'error' || type === 'warning') && isInternal && !isActionable) {
        console.log(`[Toast Suppression - Non-Admin]: Suppressed internal framework toast on-screen: "${msgStr}"`);
        return null;
      }
    }

    // 2. PRODUCTION MODE (isDevMode === false):
    // Silence non-actionable internal errors (Firestore timeouts, outbox postponements, CSP warnings, etc.)
    if (!isDevMode && isInternal && !isActionable) {
      console.log(`[Toast Suppression - Production Mode]: Suppressed non-actionable internal error toast: "${msgStr}"`);
      return null;
    }

    // 3. DEVELOPER MODE (isDevMode === true) / Actionable / Admin: Render on-screen toast
    if (!this.container) return null;

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
      <span style="flex: 1;">${this.escapeHTML(msgStr)}</span>
      <button style="background: none; border: none; color: white; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; opacity: 0.8;">&times;</button>
    `;

    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
      closeBtn.onclick = () => this.dismiss(toast);
    }

    this.container.appendChild(toast);

    setTimeout(() => this.dismiss(toast), duration);
    return toast;
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  success(message, duration, options) {
    return this.show(message, 'success', duration, options);
  }

  error(message, duration, options) {
    return this.show(message, 'error', duration, options);
  }

  warning(message, duration, options) {
    return this.show(message, 'warning', duration, options);
  }

  info(message, duration, options) {
    return this.show(message, 'info', duration, options);
  }
}

// Add animation styles
if (typeof document !== 'undefined') {
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
}

export const toast = new ToastManager();
