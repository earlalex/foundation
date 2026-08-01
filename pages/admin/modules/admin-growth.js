// pages/admin/modules/admin-growth.js
import { initKanbanTab } from '../admin-kanban.js';
import { initMarketingTab } from '../admin-marketing.js';
import { configManager } from '../../../core/config.js';
import { FRAMEWORK_AFFILIATES } from '../../../core/affiliates.js';
import { store } from '../../../core/store.js';
import { contentDB } from '../../../core/db.js';
import { toast } from '../../../utils/toast.js';
import { FormValidator, validationRules } from '../../../utils/validation.js';
import { errorHandler } from '../../../core/error-handler.js';

export function initAdminGrowth() {
  initKanbanTab();
  initMarketingTab();
}

export async function loadChatbotAndVoiceTab() {
  const chatEnabledSel = document.getElementById('chat-enabled');
  const chatNameInput = document.getElementById('chat-name');
  const chatWelcomeInput = document.getElementById('chat-welcome');
  const chatSystemPromptInput = document.getElementById('chat-system-prompt');
  const chatVoiceWelcomeInput = document.getElementById('chat-voice-welcome');

  const chatOpenaiKeyInput = document.getElementById('chat-openai-key');
  const chatTelnyxKeyInput = document.getElementById('chat-telnyx-key');
  const chatTwilioSidInput = document.getElementById('chat-twilio-sid');
  const chatTwilioTokenInput = document.getElementById('chat-twilio-token');
  const chatTelnyxNumInput = document.getElementById('chat-telnyx-num');
  const chatTwilioNumInput = document.getElementById('chat-twilio-num');

  const chatbotCfg = configManager.current.chatbot || {};

  if (chatEnabledSel) chatEnabledSel.value = chatbotCfg.enabled !== false ? "true" : "false";
  if (chatNameInput) chatNameInput.value = chatbotCfg.name || "Foundation Assistant";
  if (chatWelcomeInput) chatWelcomeInput.value = chatbotCfg.welcomeMessage || "Hello! How can I help you today?";
  if (chatSystemPromptInput) chatSystemPromptInput.value = chatbotCfg.systemPrompt || "You are a helpful customer support agent.";
  if (chatVoiceWelcomeInput) chatVoiceWelcomeInput.value = chatbotCfg.voiceWelcomeMessage || "Thank you for calling Foundation support. How can I help you today?";

  if (chatOpenaiKeyInput) chatOpenaiKeyInput.value = chatbotCfg.openaiApiKey || "";
  if (chatTelnyxKeyInput) chatTelnyxKeyInput.value = chatbotCfg.telnyxApiKey || "";
  if (chatTwilioSidInput) chatTwilioSidInput.value = chatbotCfg.twilioAccountSid || "";
  if (chatTwilioTokenInput) chatTwilioTokenInput.value = chatbotCfg.twilioAuthToken || "";
  if (chatTelnyxNumInput) chatTelnyxNumInput.value = chatbotCfg.telnyxPhoneNumber || "";
  if (chatTwilioNumInput) chatTwilioNumInput.value = chatbotCfg.twilioPhoneNumber || "";

  // Initialize chatbot form validator
  const chatbotForm = document.getElementById('chatbot-settings-form');
  let chatbotValidator = null;
  if (chatbotForm) {
    chatbotValidator = new FormValidator(chatbotForm, {
      'chat-name': [validationRules.required],
      'chat-welcome': [validationRules.required]
    });

    // Display a beautiful telephony affiliate banner right above the form
    let ctaBanner = document.getElementById('chat-telephony-affiliate-cta');
    if (!ctaBanner) {
      ctaBanner = document.createElement('div');
      ctaBanner.id = 'chat-telephony-affiliate-cta';
      ctaBanner.style.cssText = `
        background: #f0fff4;
        border: 1px solid #c6f6d5;
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
        color: #22543d;
        font-size: 0.85rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      `;
      ctaBanner.innerHTML = `
        <div>
          <strong style="font-size: 0.95rem;">📞 Need Telephony, VoIP & SMS Integration?</strong>
          <p style="margin: 4px 0 0 0; color: #2f855a;">${FRAMEWORK_AFFILIATES.telnyx.description}</p>
        </div>
        <a href="${FRAMEWORK_AFFILIATES.telnyx.url}" target="_blank" rel="noopener noreferrer" style="
          background: #38a169;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          text-decoration: none;
          font-weight: bold;
          font-size: 0.8rem;
          white-space: nowrap;
        ">Get Telnyx Account</a>
      `;
      chatbotForm.parentNode.insertBefore(ctaBanner, chatbotForm);
    }
  }

  document.getElementById('chatbot-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate form before submission
    if (chatbotValidator && !chatbotValidator.validateAll()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    try {
      const updatedChatbotConfig = {
        ...configManager.current,
        chatbot: {
          enabled: chatEnabledSel.value === "true",
          name: chatNameInput.value,
          welcomeMessage: chatWelcomeInput.value,
          systemPrompt: chatSystemPromptInput.value,
          voiceWelcomeMessage: chatVoiceWelcomeInput.value,
          openaiApiKey: chatOpenaiKeyInput.value,
          telnyxApiKey: chatTelnyxKeyInput.value,
          twilioAccountSid: chatTwilioSidInput.value,
          twilioAuthToken: chatTwilioTokenInput.value,
          telnyxPhoneNumber: chatTelnyxNumInput.value,
          twilioPhoneNumber: chatTwilioNumInput.value
        }
      };

      const success = await configManager.saveToFirebase(updatedChatbotConfig);
      if (success) {
        toast.success('AI Chatbot & Voice settings saved to Firestore!');
      } else {
        toast.error('Failed to save chatbot settings. Please try again.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin - Chatbot Settings Form');
      toast.error(`Failed to save chatbot settings: ${err.message}`);
    }
  });

  // Logging Monitor Render Helper
  const tbody = document.getElementById('chat-logs-tbody');
  const refreshBtn = document.getElementById('btn-refresh-chat-logs');

  async function renderChatLogs() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #a0aec0; padding: 1rem;">Fetching interaction logs...</td></tr>';

    try {
      const logs = await contentDB.getChatLogs(50);
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #a0aec0; padding: 1rem;">No chatbot interactions logged yet.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(log => {
        const localTime = new Date(log.timestamp).toLocaleString();
        const typeBadgeColor = log.type === 'sms' ? '#2b6cb0' : log.type === 'voice' ? '#dd6b20' : '#319795';
        const typeBgColor = log.type === 'sms' ? '#ebf8ff' : log.type === 'voice' ? '#fffaf0' : '#e6fffa';

        return `
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 8px; font-size: 0.8rem; color: #718096; white-space: nowrap;">${localTime}</td>
            <td style="padding: 8px;"><strong>${log.sender}</strong></td>
            <td style="padding: 8px;">
              <span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; background: ${typeBgColor}; color: ${typeBadgeColor}; text-transform: uppercase;">
                ${log.type}
              </span>
            </td>
            <td style="padding: 8px; color: #2d3748; max-width: 300px; word-break: break-all;">${log.message}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      errorHandler.handleError(err, 'Admin - Chat Logs');
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #e53e3e; padding: 1rem;">Failed to load chat logs.</td></tr>';
    }
  }

  if (refreshBtn) refreshBtn.onclick = renderChatLogs;
  renderChatLogs();
}
