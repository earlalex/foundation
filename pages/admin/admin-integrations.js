// pages/admin/admin-integrations.js - API keys and third-party integrations
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { FormValidator, adminFormRules } from '../../utils/validation.js';

/**
 * Mask API key for security - show only last 4 characters
 */
function maskApiKey(key) {
  if (!key || key.length < 8) return '••••';
  return '•'.repeat(key.length - 4) + key.slice(-4);
}

/**
 * Unmask API key when user focuses on the field
 */
function setupApiKeyMasking(inputElement) {
  if (!inputElement) return;
  
  const originalValue = inputElement.value;
  if (originalValue && originalValue.length > 8) {
    inputElement.value = maskApiKey(originalValue);
    inputElement.dataset.originalValue = originalValue;
  }

  inputElement.addEventListener('focus', () => {
    if (inputElement.dataset.originalValue) {
      inputElement.value = inputElement.dataset.originalValue;
    }
  });

  inputElement.addEventListener('blur', () => {
    if (inputElement.value && inputElement.value.length > 8) {
      inputElement.dataset.originalValue = inputElement.value;
      inputElement.value = maskApiKey(inputElement.value);
    }
  });
}

export function initIntegrationsTab() {
  const currentCfg = configManager.current || {};
  
  // Firebase & Google config elements
  const cfgFbKey = document.getElementById('cfg-fb-key');
  const cfgFbProject = document.getElementById('cfg-fb-project');
  const cfgGoogleClientId = document.getElementById('cfg-google-client-id');
  const cfgGoogleClientSecret = document.getElementById('cfg-google-client-secret');
  const cfgFbAdmins = document.getElementById('cfg-fb-admins');

  // AI Centralized Config Elements
  const cfgGeminiKey = document.getElementById('cfg-gemini-key');
  const cfgOpenaiKey = document.getElementById('cfg-openai-key');
  const cfgAiProvider = document.getElementById('cfg-ai-provider');

  // Stripe & Cloudflare config elements
  const cfgStripeKey = document.getElementById('cfg-stripe-key');
  const cfgStripePriceId = document.getElementById('cfg-stripe-price-id');
  const cfgGa4Property = document.getElementById('cfg-ga4-property');
  const cfgVtApiKey = document.getElementById('cfg-vt-apikey');
  const cfgCfWorkflowUrl = document.getElementById('cfg-cf-workflow-url');
  const cfgCfVtUrl = document.getElementById('cfg-cf-vt-url');

  // Load existing values
  if (cfgFbKey) cfgFbKey.value = currentCfg.firebase?.apiKey || '';
  if (cfgFbProject) cfgFbProject.value = currentCfg.firebase?.projectId || '';
  if (cfgGoogleClientId) cfgGoogleClientId.value = currentCfg.google?.clientId || '';
  if (cfgGoogleClientSecret) cfgGoogleClientSecret.value = currentCfg.google?.clientSecret || '';
  if (cfgFbAdmins) cfgFbAdmins.value = (currentCfg.adminEmails || []).join(', ');

  // Load AI config values
  if (cfgGeminiKey) cfgGeminiKey.value = currentCfg.aiConfig?.geminiApiKey || '';
  if (cfgOpenaiKey) cfgOpenaiKey.value = currentCfg.aiConfig?.openaiApiKey || '';
  if (cfgAiProvider) cfgAiProvider.value = currentCfg.aiConfig?.preferredProvider || 'gemini';

  if (cfgStripeKey) cfgStripeKey.value = currentCfg.stripe?.secretKey || '';
  if (cfgStripePriceId) cfgStripePriceId.value = currentCfg.stripe?.priceId || '';
  if (cfgGa4Property) cfgGa4Property.value = currentCfg.thirdParty?.ga4PropertyId || '';
  if (cfgVtApiKey) cfgVtApiKey.value = currentCfg.virustotal?.apiKey || '';
  if (cfgCfWorkflowUrl) cfgCfWorkflowUrl.value = currentCfg.cloudflare?.workflowUrl || '/api/workflow-trigger';
  if (cfgCfVtUrl) cfgCfVtUrl.value = currentCfg.cloudflare?.vtUrl || '/api/virustotal-scan';

  // Setup API key masking for sensitive fields
  [cfgFbKey, cfgGoogleClientSecret, cfgGeminiKey, cfgOpenaiKey, cfgStripeKey, cfgVtApiKey].forEach(setupApiKeyMasking);

  // Initialize form validator
  const firebaseConfigForm = document.getElementById('firebase-config-form');
  let firebaseConfigValidator = null;
  if (firebaseConfigForm) {
    firebaseConfigValidator = new FormValidator(firebaseConfigForm, adminFormRules.integrations);
  }

  // Firebase & Google config form
  document.getElementById('firebase-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (firebaseConfigValidator && !firebaseConfigValidator.validateAll()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const adminList = cfgFbAdmins.value.split(',').map(a => a.trim()).filter(Boolean);
      
      // Get actual values from masked fields
      const fbKeyValue = cfgFbKey.dataset.originalValue || cfgFbKey.value;
      const googleSecretValue = cfgGoogleClientSecret.dataset.originalValue || cfgGoogleClientSecret.value;
      const geminiKeyValue = cfgGeminiKey.dataset.originalValue || cfgGeminiKey.value;
      const openaiKeyValue = cfgOpenaiKey.dataset.originalValue || cfgOpenaiKey.value;

      const updated = {
        ...configManager.current,
        firebase: {
          ...configManager.current.firebase,
          apiKey: fbKeyValue,
          projectId: cfgFbProject.value
        },
        google: {
          ...(configManager.current.google || {}),
          clientId: cfgGoogleClientId.value,
          clientSecret: googleSecretValue
        },
        aiConfig: {
          geminiApiKey: geminiKeyValue,
          openaiApiKey: openaiKeyValue,
          preferredProvider: cfgAiProvider?.value || 'gemini'
        },
        adminEmails: adminList
      };
      const success = await configManager.saveToFirebase(updated);
      if (success) {
        toast.success('API, Identity, and AI Credentials successfully synced!');
      } else {
        toast.error('Failed to save credentials. Please try again.');
      }
    } catch (err) {
      toast.error(`Error saving credentials: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  // Stripe & Cloudflare config form
  document.getElementById('stripe-cloudflare-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      // Get actual values from masked fields
      const stripeKeyValue = cfgStripeKey.dataset.originalValue || cfgStripeKey.value;
      const vtKeyValue = cfgVtApiKey.dataset.originalValue || cfgVtApiKey.value;

      const updated = {
        ...configManager.current,
        stripe: {
          secretKey: stripeKeyValue,
          priceId: cfgStripePriceId.value
        },
        thirdParty: {
          ...(configManager.current.thirdParty || {}),
          ga4PropertyId: cfgGa4Property.value
        },
        virustotal: {
          apiKey: vtKeyValue
        },
        cloudflare: {
          workflowUrl: cfgCfWorkflowUrl.value,
          vtUrl: cfgCfVtUrl.value
        }
      };
      const success = await configManager.saveToFirebase(updated);
      if (success) {
        toast.success('Stripe & Cloudflare Platform Keys successfully updated!');
      } else {
        toast.error('Failed to save platform keys. Please try again.');
      }
    } catch (err) {
      toast.error(`Error saving platform keys: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}
