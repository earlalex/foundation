// components/global/NotificationCenter.js - Reusable Notification Bell Dropdown Web Component
export class NotificationCenter extends HTMLElement {
  constructor() {
    super();
    this.isOpen = false;
    this.activeTab = 'System Alerts'; // Default active tab in dropdown
    this.notifications = [];
  }

  connectedCallback() {
    this.loadNotifications();
    this.render();
    this.setupEventListeners();

    // Ensure persistent presence in document body if not present
    this.ensurePersistentMount();

    // Listen for real-time notification received events
    this.onNotificationReceived = (e) => {
      if (!e || !e.detail || typeof e.detail !== 'object') {
        return; // Suppress invalid or null event details
      }
      console.log('[NotificationCenter]: Real-time alert received:', e.detail);
      this.loadNotifications();
      this.render();
      this.setupEventListeners();
    };
    window.addEventListener('notification-received', this.onNotificationReceived);

    // Global click listener for triggers and click-outside dismissal
    this.onDocumentClick = (e) => {
      const bellTrigger = e.target.closest('#utility-notification-bell, #notif-bell-trigger, [data-toggle="notif-drawer"]');
      if (bellTrigger) {
        e.preventDefault();
        e.stopPropagation();
        this.isOpen = !this.isOpen;
        this.updateDropdownVisibility();
        return;
      }

      if (this.isOpen) {
        const dropdown = this.querySelector('#notif-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
          this.isOpen = false;
          this.updateDropdownVisibility();
        }
      }
    };
    document.addEventListener('click', this.onDocumentClick);

    // Global keydown listener for Escape key dismissal
    this.onDocumentKeyDown = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.isOpen = false;
        this.updateDropdownVisibility();
        const trigger = this.querySelector('#utility-notification-bell') || this.querySelector('#notif-bell-trigger') || this.querySelector('[data-toggle="notif-drawer"]');
        if (trigger) trigger.focus();
      }
    };
    document.addEventListener('keydown', this.onDocumentKeyDown);
  }

  disconnectedCallback() {
    window.removeEventListener('notification-received', this.onNotificationReceived);
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onDocumentKeyDown);
  }

  ensurePersistentMount() {
    // If not already inside document body or navbar, ensure a root instance exists
    if (!document.body.contains(this) && !document.querySelector('notification-center')) {
      document.body.appendChild(this);
    }
  }

  loadNotifications() {
    try {
      this.notifications = JSON.parse(localStorage.getItem('foundation_notification_history') || '[]');
    } catch (err) {
      console.warn('[NotificationCenter]: Failed to parse history:', err.message);
      this.notifications = [];
    }
  }

  saveNotifications() {
    try {
      localStorage.setItem('foundation_notification_history', JSON.stringify(this.notifications));
    } catch (err) {
      console.warn('[NotificationCenter]: Failed to save history:', err.message);
    }
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.isRead).length;
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.isRead = true);
    this.saveNotifications();
    this.render();
    this.setupEventListeners();
  }

  clearAll() {
    this.notifications = [];
    this.saveNotifications();
    this.render();
    this.setupEventListeners();
  }

  markAsRead(id) {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.isRead = true;
      this.saveNotifications();
      this.render();
      this.setupEventListeners();
    }
  }

  updateDropdownVisibility() {
    const dropdown = this.querySelector('#notif-dropdown');
    const trigger = this.querySelector('#utility-notification-bell') || this.querySelector('#notif-bell-trigger') || this.querySelector('[data-toggle="notif-drawer"]');
    if (trigger) {
      trigger.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
    }
    if (!dropdown) return;

    if (this.isOpen) {
      const targetTrigger = trigger || this;
      const rect = targetTrigger.getBoundingClientRect();

      dropdown.style.position = 'fixed';
      dropdown.style.top = `${rect.bottom > 0 ? rect.bottom + 6 : 42}px`;
      dropdown.style.right = `${rect.right > 0 ? Math.max(12, window.innerWidth - rect.right) : 20}px`;
      dropdown.style.zIndex = '100020';
      dropdown.style.display = 'flex';
    } else {
      dropdown.style.display = 'none';
    }
  }

  render() {
    const unreadCount = this.getUnreadCount();
    const primaryColor = 'var(--theme-color-primary, #2b6cb0)';
    const textColor = 'var(--theme-color-text-primary, #1a202c)';
    const textMuted = 'var(--theme-color-text-secondary, #718096)';
    const border = 'var(--theme-color-border, #e2e8f0)';

    // Filter notifications by active tab/category
    const tabNotifications = this.notifications.filter(n => n.category === this.activeTab);

    this.innerHTML = `
      <style>
        notification-center {
          position: relative;
          display: inline-block;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .notif-bell-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 1.15rem;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          color: var(--theme-color-text-secondary, #4a5568);
          border-radius: 4px;
          transition: background 0.15s;
        }
        .notif-bell-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }
        .notif-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: var(--theme-color-danger, #e53e3e);
          color: white;
          font-size: 0.7rem;
          font-weight: bold;
          border-radius: 50%;
          min-width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          box-shadow: 0 0 0 2px var(--theme-color-surface-alt, #f8fafc);
        }
        .notif-dropdown {
          position: fixed;
          top: 42px;
          right: 20px;
          width: 360px;
          max-height: 480px;
          background: var(--theme-color-surface, #ffffff);
          border: 1px solid ${border};
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          display: none;
          flex-direction: column;
          z-index: 100020;
          overflow: hidden;
        }
        .notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid ${border};
          background: var(--theme-color-surface-alt, #f8fafc);
        }
        .notif-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-bottom: 1px solid ${border};
          background: var(--theme-color-surface-alt, #f8fafc);
        }
        .notif-tab-btn {
          border: none;
          background: transparent;
          padding: 8px 4px;
          font-size: 0.78rem;
          font-weight: bold;
          cursor: pointer;
          color: ${textMuted};
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
          text-align: center;
          white-space: nowrap;
        }
        .notif-tab-btn.active {
          color: ${primaryColor};
          border-bottom-color: ${primaryColor};
        }
        .notif-list {
          flex: 1;
          overflow-y: auto;
          max-height: 320px;
          display: flex;
          flex-direction: column;
        }
        .notif-item {
          padding: 10px 12px;
          border-bottom: 1px solid var(--theme-color-border, #edf2f7);
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          transition: background 0.15s;
          font-size: 0.82rem;
          line-height: 1.4;
          color: ${textColor};
          text-align: left;
        }
        .notif-item:hover {
          background: #f7fafc;
        }
        .notif-item.unread {
          background: #ebf8ff;
        }
        .notif-item.unread:hover {
          background: #e6f6ff;
        }
        .notif-empty {
          padding: 24px;
          text-align: center;
          color: ${textMuted};
          font-size: 0.85rem;
        }
        .notif-dot {
          width: 8px;
          height: 8px;
          background: ${primaryColor};
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }
      </style>

      <button id="utility-notification-bell" class="notif-bell-btn" aria-label="Notifications Dropdown" aria-controls="notif-dropdown" aria-expanded="${this.isOpen ? 'true' : 'false'}">
        <span>🔔</span>
        ${unreadCount > 0 ? `<span class="notif-badge">${unreadCount}</span>` : ''}
      </button>

      <div id="notif-dropdown" class="notif-dropdown">
        <!-- Header -->
        <div class="notif-header">
          <span style="font-weight: bold; color: ${textColor};">Notifications</span>
          <div style="display: flex; gap: 8px; font-size: 0.75rem;">
            <button id="btn-notif-read-all" style="background: none; border: none; color: ${primaryColor}; cursor: pointer; font-weight: bold;">Mark Read</button>
            <span style="color: ${border};">|</span>
            <button id="btn-notif-clear" style="background: none; border: none; color: var(--theme-color-danger, #e53e3e); cursor: pointer; font-weight: bold;">Clear</button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="notif-tabs">
          <button class="notif-tab-btn ${this.activeTab === 'System Alerts' ? 'active' : ''}" data-tab="System Alerts">Alerts</button>
          <button class="notif-tab-btn ${this.activeTab === 'Orders & Payments' ? 'active' : ''}" data-tab="Orders & Payments">Orders</button>
          <button class="notif-tab-btn ${this.activeTab === 'Audit Logs' ? 'active' : ''}" data-tab="Audit Logs">Audit Logs</button>
        </div>

        <!-- List -->
        <div class="notif-list">
          ${tabNotifications.length === 0 ? `
            <div class="notif-empty">
              No recent notifications in this category.
            </div>
          ` : tabNotifications.map(n => `
            <div class="notif-item ${!n.isRead ? 'unread' : ''}" data-id="${n.id}">
              ${!n.isRead ? `<span class="notif-dot"></span>` : '<span style="width: 8px; flex-shrink: 0;"></span>'}
              <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                <div>${this.escapeHTML(n.message)}</div>
                <span style="font-size: 0.7rem; color: ${textMuted};">${this.formatTimestamp(n.timestamp)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Retain dropdown state
    this.updateDropdownVisibility();
  }

  setupEventListeners() {
    const readAll = this.querySelector('#btn-notif-read-all');
    const clear = this.querySelector('#btn-notif-clear');

    readAll?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.markAllAsRead();
    });

    clear?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearAll();
    });

    // Tab buttons
    this.querySelectorAll('.notif-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeTab = e.target.dataset.tab;
        this.render();
        this.setupEventListeners();
      });
    });

    // Notification items
    this.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        this.markAsRead(id);
      });
    });
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

  formatTimestamp(isoStr) {
    try {
      const date = new Date(isoStr);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;

      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }
}

if (!customElements.get('notification-center')) {
  customElements.define('notification-center', NotificationCenter);
}
