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

    // Subscribe to store updates to dynamically adjust persona when auth / dev bypass state changes
    store.subscribe((state) => {
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
  }

  render(cfg) {
    const primaryColor = 'var(--theme-color-primary, #2b6cb0)';
    const surfaceColor = 'var(--theme-color-surface, #ffffff)';
    const textColor = 'var(--theme-color-text-primary, #1a202c)';
    const textSecColor = 'var(--theme-color-text-secondary, #4a5568)';
    const borderColor = 'var(--theme-color-border, #e2e8f0)';

    this.innerHTML = `
      <style>
        .chat-widget-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 10000;
          font-family: system-ui, -apple-system, sans-serif;
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
        <!-- Floating Toggle Button -->
        <button id="chat-toggle-btn" aria-label="Toggle AI Assistant" style="width: 56px; height: 56px; border-radius: 50%; background: ${primaryColor}; color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; transition: transform 0.2s;">
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
                <span id="chat-header-title">${cfg.name || "Foundation Assistant"}</span>
              </div>
              <button id="chat-close-window-btn" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 1.25rem; line-height: 1; display: flex; align-items: center;">&times;</button>
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
              ${cfg.welcomeMessage || "Hello! How can I help you explore our services today?"}
            </div>
          </div>

          <!-- Loading Indicator -->
          <div id="chat-loading" style="display: none; padding: 10px 15px; font-size: 0.8rem; color: ${textSecColor}; align-self: flex-start;">
            Assistant is typing...
          </div>

          <!-- Message Input Form -->
          <form id="chat-form" style="display: flex; border-top: 1px solid ${borderColor}; padding: 10px; background: ${surfaceColor}; gap: 8px; margin: 0;">
            <input type="text" id="chat-input" placeholder="Type a message..." required autocomplete="off" style="flex: 1; border: 1px solid ${borderColor}; padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; background: var(--theme-color-background, #f7fafc); color: ${textColor}; outline: none;" />
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
    const chatWindow = this.querySelector('#chat-window');
    const iconOpen = this.querySelector('#chat-icon-open');
    const iconClose = this.querySelector('#chat-icon-close');
    const form = this.querySelector('#chat-form');
    const input = this.querySelector('#chat-input');

    const toggleChat = () => {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        chatWindow.style.display = 'flex';
        iconOpen.style.display = 'none';
        iconClose.style.display = 'block';
        input.focus();
      } else {
        chatWindow.style.display = 'none';
        iconOpen.style.display = 'block';
        iconClose.style.display = 'none';
      }
    };

    toggleBtn?.addEventListener('click', toggleChat);
    closeWindowBtn?.addEventListener('click', toggleChat);

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

  appendMessage(sender, text) {
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
