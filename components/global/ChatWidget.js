// components/global/ChatWidget.js
import { configManager } from '../../core/config.js';
import { contentDB } from '../../core/db.js';
import { store } from '../../core/store.js';

export class ChatWidget extends HTMLElement {
  constructor() {
    super();
    this.history = [];
    this.isOpen = false;
    this.isAdmin = false;
    this.isTucked = false;
    this.storageKey = 'foundation_chat_history';
    const uniqueId = Math.random().toString(36).substring(2, 9);
    this.chatFormId = `foundation-chat-form-${uniqueId}`;
    this.chatInputId = `foundation-chat-input-${uniqueId}`;
  }

  connectedCallback() {
    const chatbotCfg = configManager.current.chatbot || {
      enabled: true,
      name: "Foundation Assistant",
      welcomeMessage: "Hello! How can I help you explore our services today?",
      systemPrompt: "You are a helpful customer support agent."
    };

    if (!chatbotCfg.enabled) {
      this.style.display = 'none';
      return;
    }

    // Load tucked state from sessionStorage
    if (sessionStorage.getItem('foundation_chat_tucked') === 'true') {
      this.isTucked = true;
    }

    // Load chat history from localStorage
    this.loadHistoryFromStorage();

    // Subscribe to store updates to dynamically adjust persona when auth / dev bypass state changes
    this.unsubscribe = store.subscribe((state) => {
      const currentlyAdmin = !!(state.user?.isAdmin || state.devMode || window.__FOUNDATION_DEV_BYPASS__);
      if (currentlyAdmin !== this.isAdmin) {
        this.isAdmin = currentlyAdmin;
        this.updatePersona();
      }
    });

    this.isAdmin = !!(store.state.user?.isAdmin || store.state.devMode || window.__FOUNDATION_DEV_BYPASS__);

    this.render(chatbotCfg);
    this.setupEventListeners();
    this.updatePersona();
    this.renderHistory();

    // Setup MutationObserver to watch for modal or cart sidebar open
    this.observer = new MutationObserver(() => {
      const cartSidebar = document.getElementById('cart-sidebar');
      const isCartOpen = cartSidebar && (cartSidebar.style.right === '0px' || cartSidebar.style.right === '0');

      const bookingModal = document.getElementById('booking-modal');
      const isBookingModalOpen = bookingModal && bookingModal.style.display && bookingModal.style.display !== 'none';

      const hasModalClass = document.body.classList.contains('modal-open');
      const hasDrawerClass = document.body.classList.contains('cart-drawer-open');

      if (isCartOpen && !hasDrawerClass) {
        document.body.classList.add('cart-drawer-open');
      } else if (!isCartOpen && hasDrawerClass) {
        document.body.classList.remove('cart-drawer-open');
      }

      if (isBookingModalOpen && !hasModalClass) {
        document.body.classList.add('modal-open');
      } else if (!isBookingModalOpen && hasModalClass && !document.querySelector('.modal-overlay')) {
        document.body.classList.remove('modal-open');
      }
    });

    this.observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });
  }

  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  loadHistoryFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.history = JSON.parse(stored);
        // Limit history to 20 messages
        if (this.history.length > 20) {
          this.history = this.history.slice(-20);
        }
      }
    } catch (err) {
      console.warn('[ChatWidget]: Failed to load history from localStorage:', err.message);
      this.history = [];
    }
  }

  saveHistoryToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (err) {
      console.warn('[ChatWidget]: Failed to save history to localStorage:', err.message);
    }
  }

  clearHistory() {
    this.history = [];
    this.saveHistoryToStorage();
    this.renderHistory();
  }

  render(cfg) {
    const primaryColor = 'var(--theme-color-primary, #2b6cb0)';
    const surfaceColor = 'var(--theme-color-surface, #ffffff)';
    const textColor = 'var(--theme-color-text-primary, #1a202c)';
    const textSecColor = 'var(--theme-color-text-secondary, #4a5568)';
    const borderColor = 'var(--theme-color-border, #e2e8f0)';

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const sanitizedName = escapeHTML(cfg.name || "Foundation Assistant");
    const sanitizedWelcomeMessage = escapeHTML(cfg.welcomeMessage || "Hello! How can I help you explore our services today?");

    this.innerHTML = `
      <style>
        .chat-widget-container {
          position: fixed;
          bottom: var(--chat-widget-bottom, 20px);
          right: 20px;
          z-index: 10000;
          font-family: system-ui, -apple-system, sans-serif;
          transition: bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chat-window {
          display: none;
          width: 350px;
          height: 480px;
          background: ${surfaceColor};
          border: 1px solid ${borderColor};
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          position: absolute;
          bottom: 70px;
          right: 0;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s ease-in-out;
        }
        /* Mobile-first drawer styles (viewports < 640px) */
        @media (max-width: 640px) {
          .chat-widget-container {
            bottom: 12px;
            right: 12px;
          }
          .chat-window {
            width: calc(100vw - 24px) !important;
            height: 80vh !important;
            max-height: 90vh !important;
            bottom: 60px !important;
            border-radius: 16px !important;
          }
        }
      </style>
      <div class="chat-widget-container">
        <!-- Docked/Minimized Edge Tab -->
        <div id="chat-docked-tab" style="display: ${this.isTucked ? 'flex' : 'none'}; position: fixed; right: 0; bottom: 150px; width: 30px; height: 110px; background: ${primaryColor}; color: white; border-radius: 6px 0 0 6px; cursor: pointer; align-items: center; justify-content: center; writing-mode: vertical-rl; font-size: 0.8rem; font-weight: bold; letter-spacing: 1px; box-shadow: -2px 4px 10px rgba(0,0,0,0.15); z-index: 10000; padding: 4px; text-orientation: mixed; white-space: nowrap;">
          💬 ASSISTANT
        </div>

        <!-- Floating Toggle Button -->
        <button id="chat-toggle-btn" aria-label="Toggle AI Assistant" style="width: 56px; height: 56px; border-radius: 50%; background: ${primaryColor}; color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: ${this.isTucked ? 'none' : 'flex'}; align-items: center; justify-content: center; transition: transform 0.2s;">
          <svg id="chat-icon-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <svg id="chat-icon-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Chat Message Window -->
        <div id="chat-window" class="chat-window">
          <!-- Window Header -->
          <div style="background: ${primaryColor}; color: white; padding: 12px 15px; display: flex; flex-direction: column; gap: 4px; font-weight: bold;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 8px; height: 8px; background: #48bb78; border-radius: 50%; display: inline-block;"></span>
                <span id="chat-header-title">${sanitizedName}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button id="chat-minimize-window-btn" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 1.25rem; line-height: 1; display: flex; align-items: center; padding: 0 4px;" title="Minimize to side tab">&minus;</button>
                <button id="chat-close-window-btn" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 1.25rem; line-height: 1; display: flex; align-items: center;">&times;</button>
              </div>
            </div>
            <!-- Dynamic Mode Badge -->
            <div id="chat-header-badge" style="display: none; align-self: flex-start; font-size: 0.7rem; background: rgba(255, 255, 255, 0.2); padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Admin Mode Active
            </div>
          </div>

          <!-- Message History Window -->
          <div id="chat-messages" style="flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: var(--theme-color-background, #f7fafc);">
            <!-- Welcome message -->
            <div id="chat-welcome-box" style="align-self: flex-start; max-width: 80%; background: ${surfaceColor}; border: 1px solid ${borderColor}; padding: 10px; border-radius: 8px; font-size: 0.9rem; color: ${textColor}; line-height: 1.4; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              ${sanitizedWelcomeMessage}
            </div>
          </div>

          <!-- Clear History Button -->
          <button id="chat-clear-history" style="display: none; padding: 6px 12px; background: transparent; border: 1px solid ${borderColor}; color: ${textSecColor}; font-size: 0.75rem; cursor: pointer; border-radius: 4px; margin: 0 15px 5px 15px; align-self: flex-start;">
            Clear History
          </button>

          <!-- Loading Indicator -->
          <div id="chat-loading" style="display: none; padding: 10px 15px; font-size: 0.8rem; color: ${textSecColor}; align-self: flex-start;">
            Assistant is typing...
          </div>

          <!-- Message Input Form -->
          <form id="${this.chatFormId}" style="display: flex; border-top: 1px solid ${borderColor}; padding: 10px; background: ${surfaceColor}; gap: 8px; margin: 0;">
            <input type="text" id="${this.chatInputId}" placeholder="Type a message..." required autocomplete="off" style="flex: 1; border: 1px solid ${borderColor}; padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; background: var(--theme-color-background, #f7fafc); color: ${textColor}; outline: none;" />
            <button type="submit" style="background: ${primaryColor}; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    `;
  }

  updatePersona() {
    const headerTitle = this.querySelector('#chat-header-title');
    const headerBadge = this.querySelector('#chat-header-badge');
    const welcomeBox = this.querySelector('#chat-welcome-box');

    const chatbotCfg = configManager.current.chatbot || {};

    if (this.isAdmin) {
      if (headerTitle) headerTitle.textContent = "Foundation AI Admin Assistant";
      if (headerBadge) headerBadge.style.display = 'inline-block';
      if (welcomeBox && this.history.length === 0) {
        welcomeBox.textContent = "Hello Admin! Admin Co-pilot mode is active. How can I assist you with copywriting, coding, strategy, database lookups, or troubleshooting today?";
      }
    } else {
      if (headerTitle) headerTitle.textContent = chatbotCfg.name || "Foundation Assistant";
      if (headerBadge) headerBadge.style.display = 'none';
      if (welcomeBox && this.history.length === 0) {
        welcomeBox.textContent = chatbotCfg.welcomeMessage || "Hello! How can I help you explore our services today?";
      }
    }
  }

  setupEventListeners() {
    const toggleBtn = this.querySelector('#chat-toggle-btn');
    const closeWindowBtn = this.querySelector('#chat-close-window-btn');
    const minimizeBtn = this.querySelector('#chat-minimize-window-btn');
    const dockedTab = this.querySelector('#chat-docked-tab');
    const chatWindow = this.querySelector('#chat-window');
    const iconOpen = this.querySelector('#chat-icon-open');
    const iconClose = this.querySelector('#chat-icon-close');
    const form = this.querySelector('#' + this.chatFormId);
    const input = this.querySelector('#' + this.chatInputId);
    const clearHistoryBtn = this.querySelector('#chat-clear-history');

    const toggleChat = () => {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        chatWindow.style.display = 'flex';
        iconOpen.style.display = 'none';
        iconClose.style.display = 'block';
        input.focus();
        // Show/hide clear history button based on history
        if (clearHistoryBtn) {
          clearHistoryBtn.style.display = this.history.length > 0 ? 'block' : 'none';
        }
      } else {
        chatWindow.style.display = 'none';
        iconOpen.style.display = 'block';
        iconClose.style.display = 'none';
      }
    };

    const tuckChat = () => {
      this.isOpen = false;
      this.isTucked = true;
      if (chatWindow) chatWindow.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = 'none';
      if (dockedTab) dockedTab.style.display = 'flex';
      sessionStorage.setItem('foundation_chat_tucked', 'true');
    };

    const untuckChat = () => {
      this.isTucked = false;
      if (dockedTab) dockedTab.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = 'flex';
      sessionStorage.removeItem('foundation_chat_tucked');
    };

    toggleBtn?.addEventListener('click', toggleChat);
    closeWindowBtn?.addEventListener('click', toggleChat);
    minimizeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      tuckChat();
    });
    dockedTab?.addEventListener('click', (e) => {
      e.stopPropagation();
      untuckChat();
    });

    clearHistoryBtn?.addEventListener('click', () => {
      if (confirm('Clear all chat history? This cannot be undone.')) {
        this.clearHistory();
      }
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageText = input.value.trim();
      if (!messageText) return;

      input.value = '';
      this.appendMessage('user', messageText);

      // Save user audit log entry
      try {
        await contentDB.saveChatLog({
          timestamp: new Date().toISOString(),
          sender: "user",
          message: messageText,
          type: "web"
        });
      } catch (err) {
        console.warn('[ChatWidget]: Local audit log save failed:', err.message);
      }

      this.showLoading(true);

      try {
        // Send centralized custom AI credentials or configuration preferences inside the payload
        const payload = {
          message: messageText,
          history: this.history,
          isAdmin: this.isAdmin,
          aiConfig: configManager.current.aiConfig || {}
        };

        const response = await fetch('/api/chat-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        this.showLoading(false);

        if (!response.ok) {
          throw new Error('API returned error status');
        }

        const data = await response.json();
        const reply = data.reply || "Sorry, I had trouble answering that.";

        this.appendMessage('assistant', reply);

        // Save assistant audit log entry
        try {
          await contentDB.saveChatLog({
            timestamp: new Date().toISOString(),
            sender: "assistant",
            message: reply,
            type: "web"
          });
        } catch (err) {
          console.warn('[ChatWidget]: Local audit log save failed:', err.message);
        }

      } catch (err) {
        this.showLoading(false);
        this.appendMessage('assistant', "Sorry, I am having trouble connecting to my brain right now.");
      }
    });
  }

  renderHistory() {
    const messagesContainer = this.querySelector('#chat-messages');
    const welcomeBox = this.querySelector('#chat-welcome-box');
    const clearHistoryBtn = this.querySelector('#chat-clear-history');
    
    if (!messagesContainer) return;

    // Clear existing messages except welcome
    while (messagesContainer.children.length > 1) {
      messagesContainer.removeChild(messagesContainer.lastChild);
    }

    // Hide welcome if there's history
    if (welcomeBox) {
      welcomeBox.style.display = this.history.length > 0 ? 'none' : 'block';
    }

    // Render history messages
    this.history.forEach(msg => {
      this.appendMessageToDOM(msg.sender, msg.message, false);
    });

    // Show/hide clear history button
    if (clearHistoryBtn) {
      clearHistoryBtn.style.display = this.history.length > 0 ? 'block' : 'none';
    }
  }

  appendMessage(sender, text) {
    this.appendMessageToDOM(sender, text, true);
  }

  appendMessageToDOM(sender, text, saveToStorage) {
    const messagesContainer = this.querySelector('#chat-messages');
    if (!messagesContainer) return;

    const msgEl = document.createElement('div');
    const isUser = sender === 'user';
    const primaryColor = 'var(--theme-color-primary, #2b6cb0)';
    const surfaceColor = 'var(--theme-color-surface, #ffffff)';
    const borderColor = 'var(--theme-color-border, #e2e8f0)';
    const textColor = 'var(--theme-color-text-primary, #1a202c)';

    msgEl.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
    msgEl.style.maxWidth = '80%';
    msgEl.style.background = isUser ? primaryColor : surfaceColor;
    msgEl.style.color = isUser ? 'white' : textColor;
    msgEl.style.border = isUser ? 'none' : `1px solid ${borderColor}`;
    msgEl.style.padding = '10px';
    msgEl.style.borderRadius = '8px';
    msgEl.style.fontSize = '0.9rem';
    msgEl.style.lineHeight = '1.4';
    msgEl.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
    msgEl.textContent = text;

    messagesContainer.appendChild(msgEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Track state history for conversing continuity
    this.history.push({ sender, message: text });
    if (this.history.length > 20) {
      this.history.shift();
    }

    // Save to localStorage if requested
    if (saveToStorage) {
      this.saveHistoryToStorage();
      
      // Update clear history button visibility
      const clearHistoryBtn = this.querySelector('#chat-clear-history');
      if (clearHistoryBtn) {
        clearHistoryBtn.style.display = 'block';
      }
      
      // Hide welcome message on first user message
      const welcomeBox = this.querySelector('#chat-welcome-box');
      if (welcomeBox) {
        welcomeBox.style.display = 'none';
      }
    }
  }

  showLoading(isLoading) {
    const loader = this.querySelector('#chat-loading');
    if (loader) {
      loader.style.display = isLoading ? 'block' : 'none';
      const messagesContainer = this.querySelector('#chat-messages');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  }
}

if (!customElements.get('chat-widget')) {
  customElements.define('chat-widget', ChatWidget);
}
