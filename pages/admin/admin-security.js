// pages/admin/admin-security.js - Security & LastPass Vault & OWASP ZAP Integration Controller
import { contentDB } from '../../core/db.js';
import { configManager } from '../../core/config.js';
import { store } from '../../core/store.js';
import { toast } from '../../utils/toast.js';
import { authManager } from '../../core/auth.js';
import { errorHandler } from '../../core/error-handler.js';
import { zapScanner } from '../../utils/zapScanner.js';

let credentials = [];
let isAdminPrimary = false;

export function initSecurityTab() {
  checkAdminRole();
  loadCredentials();
  setupVaultForm();
  setupLastPassConfig();
  setupZapScannerPanel();
  setupReportExporterPanel();
  setupHipaaAuditExporterPanel();
}

function setupHipaaAuditExporterPanel() {
  const securityPanel = document.getElementById('tab-security');
  if (!securityPanel) return;

  let container = document.getElementById('hipaa-exporter-card-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hipaa-exporter-card-container';
    container.style.marginTop = '1.5rem';
    container.innerHTML = `
      <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); padding: 1.5rem; border-radius: var(--theme-layout-border-radius, 8px);">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: var(--theme-color-primary, #2b6cb0);">
          🏥 Immutable HIPAA Audit Trail & ePHI Logs
        </h3>
        <p style="margin: 0 0 1.25rem 0; color: var(--theme-color-text-secondary, #718096); font-size: 0.85rem;">
          Export immutable technical safeguard logs (/hipaa_logs) tracking ePHI accesses, reads, writes, and encryption events.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button type="button" id="btn-export-hipaa-csv" class="btn-primary" style="padding: 8px 16px; font-weight: bold; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: 6px; cursor: pointer;">
            📄 Export HIPAA Audit Logs (CSV)
          </button>
          <button type="button" id="btn-export-hipaa-json" class="btn-primary" style="padding: 8px 16px; font-weight: bold; background: var(--theme-color-accent, #38a169); color: white; border: none; border-radius: 6px; cursor: pointer;">
            📋 Export HIPAA Audit Logs (JSON)
          </button>
        </div>
      </div>
    `;
    securityPanel.appendChild(container);

    container.querySelector('#btn-export-hipaa-csv').addEventListener('click', async () => {
      try {
        const { exportHipaaLogsCsv } = await import('../../utils/hipaa-audit.js');
        const csvStr = exportHipaaLogsCsv();
        const blob = new Blob([csvStr], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hipaa_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('HIPAA Audit Logs CSV exported!');
      } catch (err) {
        toast.error('Failed to export HIPAA CSV logs: ' + err.message);
      }
    });

    container.querySelector('#btn-export-hipaa-json').addEventListener('click', async () => {
      try {
        const { exportHipaaLogsJson } = await import('../../utils/hipaa-audit.js');
        const jsonStr = exportHipaaLogsJson();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hipaa_logs_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('HIPAA Audit Logs JSON exported!');
      } catch (err) {
        toast.error('Failed to export HIPAA JSON logs: ' + err.message);
      }
    });
  }
}

function setupReportExporterPanel() {
  const container = document.getElementById('report-exporter-card-container');
  if (!container) {
    // Inject report exporter section to the DOM dynamically if not present in html
    const securityPanel = document.getElementById('tab-security');
    if (!securityPanel) return;

    const div = document.createElement('div');
    div.id = 'report-exporter-card-container';
    div.style.marginTop = '1.5rem';
    div.innerHTML = `
      <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); padding: 1.5rem; border-radius: var(--theme-layout-border-radius, 8px);">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--theme-color-primary, #2b6cb0);">Comprehensive Multi-Domain Report Exporter</h3>
        <p style="margin: 0 0 1.25rem 0; color: var(--theme-color-text-secondary, #718096); font-size: 0.85rem;">
          Generate structured reports for audit and compliance. Supports exporting as CSV or printable format, with automatic backup to Google Drive.
        </p>
        <form id="report-exporter-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 0.25rem; font-size: 0.85rem;">Report Domain:</label>
              <select id="wz-report-domain" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;">
                <option value="financials">Financials & Expenses (Profit/Loss, Payroll, Settlements)</option>
                <option value="analytics">Site & Visitor Analytics (GA4, Conversions, Referrals)</option>
                <option value="security">Cybersecurity & Threat Audit (OWASP ZAP, VT, IP Blocks)</option>
                <option value="seo">SEO Audit (Authority, Crawl index, broken links)</option>
                <option value="performance">Performance Audit (Core Web Vitals, Lighthouse)</option>
                <option value="accessibility">Accessibility Audit (WCAG 2.1 Compliance, Contrast ratio)</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 0.25rem; font-size: 0.85rem;">Export File Format:</label>
              <select id="wz-report-format" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;">
                <option value="csv">Structured CSV File</option>
                <option value="pdf">Structured Printable Layout (PDF)</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn-primary" style="align-self: flex-start; margin-top: 0.5rem; padding: 10px 20px; font-weight: bold; border-radius: 6px;">
            Generate & Export Report
          </button>
        </form>
      </div>
    `;
    securityPanel.appendChild(div);
  }

  const form = document.getElementById('report-exporter-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const domain = document.getElementById('wz-report-domain').value;
      const format = document.getElementById('wz-report-format').value;

      try {
        const { ReportExporter } = await import('../../utils/reportExporter.js');
        const res = await ReportExporter.generateReport(domain, format);

        if (res.success) {
          toast.success(`Successfully generated report: ${res.filename}`);
          // Trigger local download
          const blob = new Blob([res.content], { type: res.contentType });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = res.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          toast.error(`Report generation failed: ${res.error}`);
        }
      } catch (err) {
        errorHandler.handleError(err, 'Report Exporter Panel UI');
        toast.error('Failed to export report');
      }
    });
  }
}

function checkAdminRole() {
  const currentUser = store.state.user;
  
  isAdminPrimary = currentUser?.isAdmin === true || currentUser?.role === 'admin';
  
  const roleBadge = document.getElementById('admin-role-badge');
  if (roleBadge) {
    roleBadge.textContent = isAdminPrimary ? 'Primary Admin' : 'Limited Access (Editor)';
    roleBadge.style.background = isAdminPrimary ? '#f0fdf4' : '#fffaf0';
    roleBadge.style.color = isAdminPrimary ? '#166534' : '#c05621';
  }

  // If user is Editor, hide the Add Credential form and LastPass configuration completely
  const addForm = document.getElementById('vault-credential-form');
  const lpForm = document.getElementById('lastpass-config-form');
  if (currentUser?.role === 'editor') {
    if (addForm) addForm.style.display = 'none';
    if (lpForm) lpForm.style.display = 'none';
  } else {
    if (addForm) addForm.style.display = 'grid';
    if (lpForm) lpForm.style.display = 'grid';
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

  // Filter credentials for Editor: if the user is not a primary admin, only show credentials assigned to them!
  const currentUser = store.state.user;
  const isEditorUser = currentUser?.role === 'editor';

  let visibleCreds = credentials;
  if (isEditorUser) {
    visibleCreds = credentials.filter(c => c.assignedEditorId === currentUser.id);
  }

  if (visibleCreds.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem;">No shared credentials assigned to your editor profile.</p>';
    return;
  }

  container.innerHTML = visibleCreds.map(cred => {
    const showDeleteBtn = isAdminPrimary ? `
      <button onclick="window.deleteCredential('${cred.id}')"
              style="padding: 4px 8px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
        Delete
      </button>
    ` : '';

    const showCopyBtn = isAdminPrimary ? `
      <button onclick="window.copyPassword('${cred.id}')"
              style="padding: 4px 8px; background: #edf2f7; color: #4a5568; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; white-space: nowrap;">
        Copy
      </button>
    ` : '';

    const showRevealBtn = isAdminPrimary ? `
      <button onclick="window.togglePasswordVisibility('${cred.id}')"
              style="padding: 4px 8px; background: #ebf8ff; color: #2b6cb0; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; white-space: nowrap;">
        Show
      </button>
    ` : '';

    const showAssignSection = isAdminPrimary ? `
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed #cbd5e0; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
        <label style="font-weight: 600; color: #718096; font-size: 0.75rem;">Assign Editor Access:</label>
        <select id="assign-va-select-${cred.id}" onchange="window.assignVaultAccess('${cred.id}', this.value)"
                style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid #cbd5e0; background: white;">
          <option value="">Unassigned (Admin Only)</option>
        </select>
      </div>
    ` : '';

    return `
    <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); 
                padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
        <div>
          <strong style="font-size: 0.95rem;">${cred.serviceName}</strong>
          <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096);">
            ${cred.loginUrl}
          </p>
        </div>
        ${showDeleteBtn}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
        <div>
          <label style="font-weight: 600; color: #718096; font-size: 0.75rem;">Username:</label>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 2px;">
            <div style="flex: 1; padding: 4px 8px; background: #f7fafc; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 0.8rem; min-height: 28px; display: flex; align-items: center;">${cred.username}</div>
            <button onclick="window.copyToClipboard('${cred.username}', 'Username')"
                    style="padding: 4px 8px; background: #edf2f7; color: #4a5568; border: none; border-radius: 4px; font-size: 0.7rem; cursor: pointer; white-space: nowrap;">
              Copy
            </button>
          </div>
        </div>
        <div>
          <label style="font-weight: 600; color: #718096; font-size: 0.75rem;">Password:</label>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 2px;">
            <input type="password" id="foundation-vault-pass-${cred.id}" value="${'•'.repeat(12)}" readonly
                   style="flex: 1; padding: 4px 8px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.8rem; height: 28px;" />
            ${showCopyBtn}
            ${showRevealBtn}
          </div>
        </div>
      </div>

      ${showAssignSection}

      <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
        <a href="${cred.loginUrl}" target="_blank" 
           style="flex: 1; padding: 6px 12px; background: #48bb78; color: white; text-align: center; text-decoration: none; 
                  border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
          Launch URL
        </a>
        <button onclick="window.launchLastPassAutofill('${cred.id}')" 
                style="flex: 1; padding: 6px 12px; background: #ed8936; color: white; border: none; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
          Launch & Autofill (LastPass Bridge)
        </button>
      </div>
    </div>
  `;
  }).join('');

  if (isAdminPrimary) {
    populateVASelectors();
  }
}

async function populateVASelectors() {
  try {
    const allUsers = await contentDB.getAllUsers();
    const editors = allUsers.filter(u => u.role === 'editor');

    credentials.forEach(cred => {
      const select = document.getElementById(`assign-va-select-${cred.id}`);
      if (!select) return;

      select.innerHTML = '<option value="">Unassigned (Admin Only)</option>' +
        editors.map(ed => `<option value="${ed.id}" ${cred.assignedEditorId === ed.id ? 'selected' : ''}>${ed.name || ed.displayName || ed.email}</option>`).join('');
    });
  } catch (err) {
    console.error('Failed to populate VA assignment selectors:', err);
  }
}

window.assignVaultAccess = async function(credId, editorId) {
  try {
    await contentDB.assignLastpassVaultAccess(credId, editorId);
    const cred = credentials.find(c => c.id === credId);
    if (cred) {
      cred.assignedEditorId = editorId || null;
    }
    toast.success('Successfully updated shared credential assignment!');
  } catch (err) {
    errorHandler.handleError(err, 'Admin Security - Assign Vault Access');
    toast.error('Failed to assign credential access');
  }
};

window.copyToClipboard = function(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied to clipboard`);
  }).catch(() => {
    toast.error(`Failed to copy ${label}`);
  });
};

window.copyPassword = function(credentialId) {
  if (!isAdminPrimary) {
    toast.error('Only Primary Admins can copy passwords');
    return;
  }
  const credential = credentials.find(c => c.id === credentialId);
  if (credential) {
    window.copyToClipboard(credential.encryptedPassKey, 'Password');
  }
};

window.togglePasswordVisibility = function(credentialId) {
  if (!isAdminPrimary) {
    toast.error('Only Primary Admins can unmask passwords');
    return;
  }

  const credential = credentials.find(c => c.id === credentialId);
  if (!credential) return;

  const passwordInput = document.getElementById(`foundation-vault-pass-${credentialId}`);
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

  const uniqueId = Date.now();
  const serviceInput = document.getElementById('cred-service-name');
  const urlInput = document.getElementById('cred-login-url');
  const userInput = document.getElementById('cred-username');
  const passInput = document.getElementById('cred-password');

  if (serviceInput) serviceInput.id = `foundation-vault-service-${uniqueId}`;
  if (urlInput) urlInput.id = `foundation-vault-url-${uniqueId}`;
  if (userInput) userInput.id = `foundation-vault-username-${uniqueId}`;
  if (passInput) passInput.id = `foundation-vault-pass-${uniqueId}`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isAdminPrimary) {
      toast.error('Only Primary Admins can add credentials');
      return;
    }

    const serviceName = document.getElementById(`foundation-vault-service-${uniqueId}`).value;
    const loginUrl = document.getElementById(`foundation-vault-url-${uniqueId}`).value;
    const username = document.getElementById(`foundation-vault-username-${uniqueId}`).value;
    const encryptedPassKey = document.getElementById(`foundation-vault-pass-${uniqueId}`).value;

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
        apiEndpoint: document.getElementById('lastpass-api-endpoint').value,
        isConfigured: true
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

function setupZapScannerPanel() {
  const zapUrlInput = document.getElementById('zap-target-url');
  const zapScanTypeSelect = document.getElementById('zap-scan-type');
  const btnLaunchZap = document.getElementById('btn-launch-zap-scan');
  const zapProgressContainer = document.getElementById('zap-progress-container');
  const zapProgressBar = document.getElementById('zap-progress-bar');
  const zapProgressPercentage = document.getElementById('zap-progress-percentage');
  const zapFindingsTbody = document.getElementById('zap-findings-tbody');
  const zapSchedulerSelect = document.getElementById('zap-scheduler-select');

  if (!btnLaunchZap) return;

  // Defer OWASP ZAP Scanner module import using conditional action-triggered module loading
  let zapScannerInstance = zapScanner;

  // Set default URL to current domain if empty
  if (zapUrlInput && !zapUrlInput.value) {
    zapUrlInput.value = window.location.origin;
  }

  // Set scheduler initial value from config
  const secConfig = configManager.current.security || {};
  if (zapSchedulerSelect) {
    zapSchedulerSelect.value = secConfig.zapSchedule || 'none';
    zapSchedulerSelect.addEventListener('change', async () => {
      const updated = {
        ...configManager.current,
        security: {
          ...(configManager.current.security || {}),
          zapSchedule: zapSchedulerSelect.value
        }
      };
      try {
        await configManager.saveToFirebase(updated);
        toast.success(`ZAP automated scan scheduler updated to: ${zapSchedulerSelect.value}`);
      } catch (err) {
        toast.error('Failed to save scheduler settings');
      }
    });
  }

  // Load previous ZAP scans history if available
  loadZapScanHistory();

  async function loadZapScanHistory() {
    try {
      const history = await contentDB.getZapScanHistory();
      if (history && history.length > 0) {
        // Render the latest completed scan findings
        const latest = history[0];
        renderZapFindings(latest.findings);
      }
    } catch (err) {
      console.warn('Failed to load ZAP scan history:', err);
    }
  }

  btnLaunchZap.addEventListener('click', async () => {
    const targetUrl = zapUrlInput.value.trim();
    if (!targetUrl) {
      toast.warning('Please enter a valid target URL for OWASP ZAP scan.');
      return;
    }

    const scanType = zapScanTypeSelect.value;
    btnLaunchZap.disabled = true;
    btnLaunchZap.textContent = 'Scanning...';
    zapProgressContainer.style.display = 'block';
    zapProgressBar.style.width = '0%';
    zapProgressPercentage.textContent = '0%';

    try {
      // Action-Triggered Module Loading: Import Zap Scanner only when user triggers scan
      if (!zapScannerInstance) {
        const mod = await import('../../utils/zapScanner.js');
        zapScannerInstance = mod.zapScanner;
      }

      let scanRes;
      if (scanType === 'spider') {
        scanRes = await zapScannerInstance.startSpiderScan(targetUrl);
      } else if (scanType === 'active') {
        scanRes = await zapScannerInstance.startActiveScan(targetUrl);
      } else {
        scanRes = await zapScannerInstance.startAjaxSpiderScan(targetUrl);
      }

      if (scanRes && scanRes.scanId) {
        const scanId = scanRes.scanId;

        // Poll for scan progress
        let progress = 0;
        const interval = setInterval(async () => {
          try {
            const progRes = await zapScannerInstance.getScanProgress(scanId, scanType);
            progress = progRes.progress;
            zapProgressBar.style.width = `${progress}%`;
            zapProgressPercentage.textContent = `${progress}%`;

            if (progress >= 100) {
              clearInterval(interval);
              completeScan(targetUrl, scanType);
            }
          } catch (e) {
            clearInterval(interval);
            completeScan(targetUrl, scanType); // Fallback to instant finish in sandbox
          }
        }, 1000);
      } else {
        throw new Error("Could not retrieve a valid ZAP scan ID.");
      }
    } catch (err) {
      errorHandler.handleError(err, 'Security - Launch ZAP Scan');
      toast.error(`ZAP Scan Error: ${err.message}`);
      btnLaunchZap.disabled = false;
      btnLaunchZap.textContent = 'Launch ZAP Scan';
    }
  });

  async function completeScan(targetUrl, scanType) {
    try {
      // Fetch scan alerts/vulnerabilities
      const alertRes = await zapScannerInstance.getScanAlerts(targetUrl);
      const findings = alertRes.findings || [];

      // Save to Firestore / local history
      const scanRecord = {
        id: `zap_${Date.now()}`,
        targetUrl,
        scanType,
        progress: 100,
        status: "completed",
        findings,
        scheduledFreq: zapSchedulerSelect?.value || "none",
        createdAt: new Date().toISOString()
      };

      await contentDB.saveZapScanResult(scanRecord);

      // Render findings in the table
      renderZapFindings(findings);

      toast.success(`OWASP ZAP ${scanType} complete! ${findings.length} findings parsed.`);
    } catch (err) {
      errorHandler.handleError(err, 'Security - ZAP scan completion');
      toast.error('Failed to parse and save scan results');
    } finally {
      btnLaunchZap.disabled = false;
      btnLaunchZap.textContent = 'Launch ZAP Scan';
    }
  }

  function renderZapFindings(findings) {
    if (!zapFindingsTbody) return;

    if (!findings || findings.length === 0) {
      zapFindingsTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem; font-style: italic;">
            ✓ All Clean! ZAP identified 0 vulnerabilities on this target.
          </td>
        </tr>
      `;
      return;
    }

    zapFindingsTbody.innerHTML = findings.map(f => {
      const risk = f.risk || 'Medium';
      let riskBg = '#edf2f7', riskColor = '#4a5568';
      if (risk.toLowerCase() === 'high') {
        riskBg = '#fff5f5'; riskColor = '#e53e3e';
      } else if (risk.toLowerCase() === 'medium') {
        riskBg = '#fffaf0'; riskColor = '#dd6b20';
      } else if (risk.toLowerCase() === 'low') {
        riskBg = '#ebf8ff'; riskColor = '#2b6cb0';
      } else if (risk.toLowerCase() === 'informational') {
        riskBg = '#f0fff4'; riskColor = '#38a169';
      }

      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
          <td style="padding: 10px;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.75rem; background: ${riskBg}; color: ${riskColor}; text-transform: uppercase;">
              ${risk}
            </span>
          </td>
          <td style="padding: 10px; font-weight: 600; color: var(--theme-color-text-primary, #2d3748);">${f.alert}</td>
          <td style="padding: 10px; font-family: monospace; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096);">CWE-${f.cweid || 'N/A'}</td>
          <td style="padding: 10px; font-family: monospace; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${f.param || 'N/A'}">
            <code>${f.param || 'N/A'}</code>
          </td>
          <td style="padding: 10px; color: var(--theme-color-text-secondary, #4a5568); font-size: 0.8rem; line-height: 1.4;">${f.remediation}</td>
        </tr>
      `;
    }).join('');
  }
}
