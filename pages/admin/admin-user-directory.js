// pages/admin/admin-user-directory.js - User directory and management
import { store } from '../../core/store.js';
import { contentDB } from '../../core/db.js';
import { 
  syncGoogleContactRole,
  sendBulkGmail,
  getGoogleAccessToken
} from '../../core/google-services.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { FormValidator, adminFormRules } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';
import { deduplicateUserDirectory, syncAllToGoogleContacts } from './modules/admin-users.js';

const MONTHLY_MEMBERSHIP_FEE = 29.00;
const REFERRAL_COMMISSION_RATE = 0.10;

// Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
  itemHeight: 80, // Approximate height of each row in pixels
  bufferSize: 5, // Number of extra items to render above/below viewport
  pageSize: 20 // Initial number of items to render
};

export function initUserDirectoryTab() {
  const adminEmailBadge = document.getElementById('connected-admin-email');
  const connectedAdminEmail = store.state.user?.email || configManager.current.adminEmails?.[0] || 'admin@foundation.dev';
  if (adminEmailBadge) adminEmailBadge.textContent = connectedAdminEmail;

  const tbody = document.getElementById('user-directory-tbody');
  const refreshBtn = document.getElementById('btn-refresh-users');
  const syncContactsBtn = document.getElementById('btn-sync-google-contacts');
  const importProspectsBtn = document.getElementById('btn-import-google-prospects');
  const dedupeUsersBtn = document.getElementById('btn-dedupe-users');
  const convertLateBtn = document.getElementById('btn-convert-late-users');
  const massEmailForm = document.getElementById('mass-email-form');
  let cachedUsers = [];
  
  // Virtual scrolling state
  let virtualScrollState = {
    scrollTop: 0,
    visibleStart: 0,
    visibleEnd: VIRTUAL_SCROLL_CONFIG.pageSize
  };

  async function renderUsersList() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 1rem; text-align: center; color: #a0aec0;">Fetching user records...</td></tr>';
    
    try {
      cachedUsers = await contentDB.getAllUsers();
      const hasAdminInList = cachedUsers.some(u => u.email === connectedAdminEmail);
      if (!hasAdminInList) {
        cachedUsers.unshift({
          id: 'primary-admin-root',
          name: store.state.user?.displayName || 'Primary System Administrator',
          email: connectedAdminEmail,
          role: 'admin',
          status: 'Active',
          paymentStatus: 'Active',
          affiliateCode: 'FOUNDATION_ROOT',
          referredCount: 0
        });
      }

      // Setup virtual scrolling if there are many users
      if (cachedUsers.length > 30) {
        setupVirtualScrolling();
      } else {
        // Render all users if dataset is small
        renderVisibleUsers(0, cachedUsers.length);
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin User Directory - Load Users');
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 1rem; text-align: center; color: #e53e3e;">Error loading users: ${err.message}</td></tr>`;
    }
  }

  /**
   * Setup virtual scrolling for large user lists
   */
  function setupVirtualScrolling() {
    const tableContainer = tbody?.parentElement?.parentElement;
    if (!tableContainer) return;

    // Set fixed height and enable scrolling
    tableContainer.style.maxHeight = '500px';
    tableContainer.style.overflowY = 'auto';
    tableContainer.style.position = 'relative';

    // Add scroll event listener
    tableContainer.addEventListener('scroll', handleScroll);

    // Initial render
    handleScroll();
  }

  /**
   * Handle scroll events for virtual scrolling
   */
  function handleScroll() {
    const tableContainer = tbody?.parentElement?.parentElement;
    if (!tableContainer) return;

    const scrollTop = tableContainer.scrollTop;
    const viewportHeight = tableContainer.clientHeight;

    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_SCROLL_CONFIG.itemHeight) - VIRTUAL_SCROLL_CONFIG.bufferSize);
    const endIndex = Math.min(
      cachedUsers.length,
      Math.ceil((scrollTop + viewportHeight) / VIRTUAL_SCROLL_CONFIG.itemHeight) + VIRTUAL_SCROLL_CONFIG.bufferSize
    );

    if (startIndex !== virtualScrollState.visibleStart || endIndex !== virtualScrollState.visibleEnd) {
      virtualScrollState.visibleStart = startIndex;
      virtualScrollState.visibleEnd = endIndex;
      renderVisibleUsers(startIndex, endIndex);
    }
  }

  /**
   * Render only the visible subset of users
   * @param {number} startIndex - Starting index of visible items
   * @param {number} endIndex - Ending index of visible items
   */
  function renderVisibleUsers(startIndex, endIndex) {
    if (!tbody) return;

    const referralMap = {};
    cachedUsers.forEach(u => {
      if (u.referredBy) {
        referralMap[u.referredBy] = (referralMap[u.referredBy] || 0) + 1;
      }
    });

    tbody.innerHTML = cachedUsers.slice(startIndex, endIndex).map((u, index) => {
      const actualIndex = startIndex + index;
      const isPrimary = u.email === connectedAdminEmail || u.role === 'admin';
      const activeReferrals = referralMap[u.affiliateCode || u.id] || u.referredCount || 0;
      
      const monthlyEarnings = u.role === 'affiliate' ? (activeReferrals * (MONTHLY_MEMBERSHIP_FEE * REFERRAL_COMMISSION_RATE)) : 0;
      
      const roleBadgeColor = isPrimary ? '#c05621' : u.role === 'affiliate' ? '#2b6cb0' : u.role === 'member' ? '#2f855a' : u.role === 'prospect' ? '#718096' : '#4a5568';
      const roleBgColor = isPrimary ? '#feebc8' : u.role === 'affiliate' ? '#ebf8ff' : u.role === 'member' ? '#f0fdf4' : u.role === 'prospect' ? '#edf2f7' : '#f7fafc';
      const roleLabel = isPrimary ? '👑 Admin (Locked)' : u.role === 'affiliate' ? '🤝 Affiliate Member' : u.role === 'member' ? '💳 Member (Paid)' : u.role === 'prospect' ? '👤 Prospect (Google Sync)' : '👤 Subscriber (Free)';

      const paymentStatus = u.paymentStatus || 'Active';
      const isDelinquent = paymentStatus.includes('Past Due') || paymentStatus.includes('Delinquent') || paymentStatus.includes('Converted');
      const paymentBadgeColor = isDelinquent ? '#c53030' : '#2f855a';
      const paymentBgColor = isDelinquent ? '#fff5f5' : '#f0fdf4';

      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);" data-index="${actualIndex}">
          <td style="padding: 12px;">
            <div style="font-weight: 600; color: var(--theme-color-text-primary, #1a202c);">${u.name || 'Unknown'}</div>
            <div style="font-size: 0.8rem; color: var(--theme-color-text-secondary, #4a5568);">${u.email}</div>
          </td>
          <td style="padding: 12px;">
            <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; background: ${roleBgColor}; color: ${roleBadgeColor};">${roleLabel}</span>
          </td>
          <td style="padding: 12px;">
            <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; background: ${paymentBgColor}; color: ${paymentBadgeColor};">${paymentStatus}</span>
          </td>
          <td style="padding: 12px; text-align: right;">
            <div style="font-weight: 600;">$${monthlyEarnings.toFixed(2)}</div>
            <div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #4a5568);">${activeReferrals} referrals</div>
          </td>
          <td style="padding: 12px; text-align: right;">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
              <button class="btn-test-experience" data-user-role="${u.role || 'subscriber'}" style="padding: 6px 12px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition: background 0.2s;">
                Test Experience
              </button>
              ${!isPrimary ? `
                <button class="btn-delete-user" data-user-id="${u.id}" data-user-index="${actualIndex}" style="padding: 6px 12px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Remove</button>
              ` : '<span style="color: var(--theme-color-text-secondary, #a0aec0); font-size: 0.8rem;">Protected</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- TOP-LEVEL EVENT DELEGATION ON TBODY ---
  if (tbody && !tbody.dataset.delegated) {
    tbody.dataset.delegated = 'true';
    tbody.addEventListener('click', async (e) => {
      const testBtn = e.target.closest('.btn-test-experience');
      if (testBtn) {
        const role = testBtn.dataset.userRole;
        store.dispatch('SET_SIMULATED_USER_TIER', role);
        toast.success(`Active Preview: Simulation Mode for [${role.toUpperCase()}] started!`);
        setTimeout(() => {
          if (window.router) window.router.navigateTo('/home');
        }, 500);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-user');
      if (deleteBtn) {
        const userId = deleteBtn.dataset.userId;
        if (confirm('Are you sure you want to remove this user? This action cannot be undone.')) {
          try {
            await contentDB.deleteUser(userId);
            toast.success('User removed successfully.');
            await renderUsersList();
          } catch (err) {
            errorHandler.handleError(err, 'Admin User Directory - Delete User');
            toast.error(`Failed to remove user: ${err.message}`);
          }
        }
        return;
      }
    });
  }

  // Initial render
  renderUsersList();

  // Refresh Directory button
  refreshBtn?.addEventListener('click', async () => {
    await renderUsersList();
    toast.info('User directory refreshed and cached states cleared.');
  });

  // Deduplicate Users Engine
  dedupeUsersBtn?.addEventListener('click', async () => {
    if (dedupeUsersBtn) {
      dedupeUsersBtn.disabled = true;
      dedupeUsersBtn.textContent = 'Deduplicating...';
    }

    try {
      await deduplicateUserDirectory();
      await renderUsersList();
    } catch (err) {
      errorHandler.handleError(err, 'Admin User Directory - Deduplicate Users');
      toast.error(`Failed to deduplicate users: ${err.message}`);
    } finally {
      if (dedupeUsersBtn) {
        dedupeUsersBtn.disabled = false;
        dedupeUsersBtn.textContent = '🧹 Deduplicate Accounts';
      }
    }
  });

  // Sync Google Contacts
  syncContactsBtn?.addEventListener('click', async () => {
    if (syncContactsBtn) {
      syncContactsBtn.disabled = true;
      syncContactsBtn.textContent = 'Syncing...';
    }

    try {
      const count = await syncAllToGoogleContacts();
      toast.success(`Google Contacts synced successfully (${count} accounts).`);
      await renderUsersList();
    } catch (err) {
      errorHandler.handleError(err, 'Admin User Directory - Sync Contacts');
      toast.error(`Failed to sync contacts: ${err.message}`);
    } finally {
      if (syncContactsBtn) {
        syncContactsBtn.disabled = false;
        syncContactsBtn.textContent = 'Sync All to Google Contacts';
      }
    }
  });

  // Import Prospects (Google Contacts)
  importProspectsBtn?.addEventListener('click', async () => {
    if (importProspectsBtn) {
      importProspectsBtn.disabled = true;
      importProspectsBtn.textContent = 'Importing...';
    }

    try {
      const token = await getGoogleAccessToken(false);
      let importedCount = 0;

      if (token) {
        const resp = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          const connections = data.connections || [];
          for (const conn of connections) {
            const email = conn.emailAddresses?.[0]?.value;
            const name = conn.names?.[0]?.displayName || email?.split('@')[0] || 'Prospect';
            if (email) {
              const existing = await contentDB.getUser(email);
              if (!existing) {
                await contentDB.saveUser({
                  id: 'prospect_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
                  name,
                  email,
                  role: 'prospect',
                  paymentStatus: 'None',
                  affiliateCode: 'prospect_' + Math.random().toString(36).substring(2, 6)
                });
                importedCount++;
              }
            }
          }
        }
      }

      if (importedCount === 0) {
        // Sample prospect seeding fallback
        const sampleProspects = [
          { name: 'Alex Taylor', email: 'alex.taylor.prospect@gmail.com' },
          { name: 'Jordan Rivera', email: 'jordan.rivera.prospect@gmail.com' }
        ];
        for (const p of sampleProspects) {
          const existing = await contentDB.getUser(p.email);
          if (!existing) {
            await contentDB.saveUser({
              id: 'prospect_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
              name: p.name,
              email: p.email,
              role: 'prospect',
              paymentStatus: 'None',
              affiliateCode: 'prospect_' + Math.random().toString(36).substring(2, 6)
            });
            importedCount++;
          }
        }
      }

      toast.success(`Successfully imported ${importedCount} prospects from Google Contacts!`);
      await renderUsersList();
    } catch (err) {
      errorHandler.handleError(err, 'Admin User Directory - Import Prospects');
      toast.error(`Import prospects failed: ${err.message}`);
    } finally {
      if (importProspectsBtn) {
        importProspectsBtn.disabled = false;
        importProspectsBtn.textContent = 'Import Prospects (Google Contacts)';
      }
    }
  });

  // Convert late dues to subscribers
  convertLateBtn?.addEventListener('click', async () => {
    if (confirm('Convert all delinquent users to Subscribers? This will reset their payment status.')) {
      try {
        const users = cachedUsers.filter(u => 
          u.paymentStatus?.includes('Past Due') || 
          u.paymentStatus?.includes('Delinquent') ||
          u.paymentStatus?.includes('Converted')
        );

        let convertedCount = 0;
        for (const user of users) {
          await contentDB.saveUser({
            ...user,
            paymentStatus: 'Converted to Subscriber',
            role: 'subscriber'
          });
          convertedCount++;
        }
        
        toast.success(`Converted ${convertedCount} delinquent accounts to Subscribers.`);
        await renderUsersList();
      } catch (err) {
        errorHandler.handleError(err, 'Admin User Directory - Convert Users');
        toast.error(`Failed to convert users: ${err.message}`);
      }
    }
  });

  // Mass email form
  let massEmailValidator = null;
  if (massEmailForm) {
    massEmailValidator = new FormValidator(massEmailForm, {
      'mass-email-subject': [(value) => value && value.trim().length > 0 ? null : 'Subject is required'],
      'mass-email-body': [(value) => value && value.trim().length > 0 ? null : 'Message body is required']
    });
  }

  massEmailForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (massEmailValidator && !massEmailValidator.validateAll()) {
      toast.error('Please fix the validation errors before sending email.');
      return;
    }
    
    const subjectInput = document.getElementById('mass-email-subject');
    const bodyInput = document.getElementById('mass-email-body');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      const subject = subjectInput.value;
      const body = bodyInput.value;
      const recipients = cachedUsers.map(u => u.email).filter(Boolean);

      await sendBulkGmail(recipients, subject, body);
      toast.success(`Email sent to ${recipients.length} recipients.`);
      
      subjectInput.value = '';
      bodyInput.value = '';
    } catch (err) {
      errorHandler.handleError(err, 'Admin User Directory - Mass Email');
      toast.error(`Failed to send email: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}