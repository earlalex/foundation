// pages/admin/admin-security.js - Security & LastPass Vault Integration Controller
import { contentDB } from '../../core/db.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { authManager } from '../../core/auth.js';
import { errorHandler } from '../../core/error-handler.js';

let credentials = [];
let isAdminPrimary = false;

export function initSecurityTab() {
  checkAdminRole();
  loadCredentials();
  setupVaultForm();
  setupLastPassConfig();
}

function checkAdminRole() {
  const currentUser = authManager.currentUser;
  const adminEmails = configManager.current.adminEmails || [];
  
  isAdminPrimary = adminEmails.includes(currentUser?.email);
  
  const roleBadge = document.getElementById('admin-role-badge');
  if (roleBadge) {
    roleBadge.textContent = isAdminPrimary ? 'Primary Admin' : 'Limited Access';
    roleBadge.style.background = isAdminPrimary ? '#f0fdf4' : '#fffaf0';
    roleBadge.style.color = isAdminPrimary ? '#166534' : '#c05621';
  }
}

async function loadCredentials() {
  try {
    credentials = await contentDB.getVaultCredentials();
    renderCredentialsList();
  } catch (err) {
    errorHandler.handleError(err, 'Admin Security - Load Credentials');
    console.error('Failed to load credentials:', err);
  }
}

function renderCredentialsList() {
  const container = document.getElementById('vault-credentials-list');
  if (!container) return;

  if (credentials.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem;">No credentials stored in vault.</p>';
    return;
  }

  container.innerHTML = credentials.map(cred => `
    <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); 
                padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
        <div>
          <strong style="font-size: 0.95rem;">${cred.serviceName}</strong>
          <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096);">
            ${cred.loginUrl}
          </p>
        </div>
        <button onclick="window.deleteCredential('${cred.id}')" 
                style="padding: 4px 8px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
          Delete
        </button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
        <div>
          <label style="font-weight: 600; color: #718096; font-size: 0.75rem;">Username:</label>
          <div style="padding: 4px 8px; background: #f7fafc; border-radius: 4px; margin-top: 2px;">${cred.username}</div>
        </div>
        <div>
          <label style="font-weight: 600; color: #718096; font-size: 0.75rem;">Password:</label>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 2px;">
            <input type="password" id="password-${cred.id}" value="${'•'.repeat(12)}" readonly
                   style="flex: 1; padding: 4px 8px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.8rem;" />
            ${isAdminPrimary ? `
              <button onclick="window.togglePasswordVisibility('${cred.id}')" 
                      style="padding: 4px 8px; background: #ebf8ff; color: #2b6cb0; border: none; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">
                Show
              </button>
            ` : ''}
          </div>
        </div>
      </div>
      <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
        <a href="${cred.loginUrl}" target="_blank" 
           style="flex: 1; padding: 6px 12px; background: #48bb78; color: white; text-align: center; text-decoration: none; 
                  border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
          Open Login Page
        </a>
        <button onclick="window.launchLastPassAutofill('${cred.id}')" 
                style="flex: 1; padding: 6px 12px; background: #ed8936; color: white; border: none; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
          Log In via LastPass
        </button>
      </div>
    </div>
  `).join('');
}

window.togglePasswordVisibility = function(credentialId) {
  if (!isAdminPrimary) {
    toast.error('Only Primary Admins can unmask passwords');
    return;
  }

  const credential = credentials.find(c => c.id === credentialId);
  if (!credential) return;

  const passwordInput = document.getElementById(`password-${credentialId}`);
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    passwordInput.value = credential.encryptedPassKey;
    setTimeout(() => {
      passwordInput.type = 'password';
      passwordInput.value = '•'.repeat(12);
    }, 5000);
  } else {
    passwordInput.type = 'password';
    passwordInput.value = '•'.repeat(12);
  }
};

window.launchLastPassAutofill = function(credentialId) {
  const credential = credentials.find(c => c.id === credentialId);
  if (!credential) return;

  const lastPassConfig = configManager.current.lastpass || {};
  
  if (!lastPassConfig.provisioningHash || !lastPassConfig.companyId) {
    toast.warning('LastPass integration not configured. Please add your API credentials in the settings below.');
    return;
  }

  try {
    window.open(credential.loginUrl, '_blank');
    
    if (typeof window.lastpass !== 'undefined' && window.lastpass.fill) {
      window.lastpass.fill({
        username: credential.username,
        password: credential.encryptedPassKey,
        url: credential.loginUrl
      });
      toast.success('LastPass autofill triggered');
    } else {
      toast.info('LastPass browser extension not detected. Please ensure it is installed.');
    }
  } catch (err) {
    errorHandler.handleError(err, 'Admin Security - LastPass Autofill');
    console.error('LastPass autofill error:', err);
    toast.warning('Could not trigger LastPass autofill. Manual entry required.');
  }
};

window.deleteCredential = async function(credentialId) {
  if (!isAdminPrimary) {
    toast.error('Only Primary Admins can delete credentials');
    return;
  }

  if (!confirm('Are you sure you want to delete this credential?')) return;
  
  try {
    await contentDB.deleteVaultCredential(credentialId);
    credentials = credentials.filter(c => c.id !== credentialId);
    renderCredentialsList();
    toast.success('Credential deleted successfully');
  } catch (err) {
    errorHandler.handleError(err, 'Admin Security - Delete Credential');
    toast.error('Failed to delete credential');
  }
};

function setupVaultForm() {
  const form = document.getElementById('vault-credential-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isAdminPrimary) {
      toast.error('Only Primary Admins can add credentials');
      return;
    }

    const serviceName = document.getElementById('cred-service-name').value;
    const loginUrl = document.getElementById('cred-login-url').value;
    const username = document.getElementById('cred-username').value;
    const encryptedPassKey = document.getElementById('cred-password').value;

    const newCredential = {
      id: `cred_${Date.now()}`,
      serviceName,
      loginUrl,
      username,
      encryptedPassKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await contentDB.saveVaultCredential(newCredential);
      credentials.push(newCredential);
      renderCredentialsList();
      form.reset();
      toast.success('Credential added to vault successfully');
    } catch (err) {
      errorHandler.handleError(err, 'Admin Security - Add Credential');
      toast.error('Failed to add credential');
    }
  });
}

function setupLastPassConfig() {
  const form = document.getElementById('lastpass-config-form');
  if (!form) return;

  const lastPassConfig = configManager.current.lastpass || {};
  
  document.getElementById('lastpass-provisioning-hash').value = lastPassConfig.provisioningHash || '';
  document.getElementById('lastpass-company-id').value = lastPassConfig.companyId || '';
  document.getElementById('lastpass-api-endpoint').value = lastPassConfig.apiEndpoint || 'https://lastpass.com/enterprise/api.php';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isAdminPrimary) {
      toast.error('Only Primary Admins can configure LastPass');
      return;
    }

    const updatedConfig = {
      ...configManager.current,
      lastpass: {
        provisioningHash: document.getElementById('lastpass-provisioning-hash').value,
        companyId: document.getElementById('lastpass-company-id').value,
        apiEndpoint: document.getElementById('lastpass-api-endpoint').value
      }
    };

    try {
      const success = await configManager.saveToFirebase(updatedConfig);
      if (success) {
        toast.success('LastPass configuration saved successfully');
      } else {
        toast.error('Failed to save LastPass configuration');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin Security - Save LastPass Config');
      toast.error('Failed to save LastPass configuration');
    }
  });
}
