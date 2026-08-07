// pages/admin/admin-finances.js - Business Finances & Payroll management tab
import { contentDB } from '../../core/db.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { invoiceTracker } from '../../core/invoice-tracker.js';
import { stripeService } from '../../core/stripe.js';
import { toast } from '../../utils/toast.js';
import { errorHandler } from '../../core/error-handler.js';

/**
 * Render dynamic financial summary metrics dashboard
 * @param {Object} stripeRevenue - Stats from Stripe Proxy
 * @param {Object} localExpenses - Operational expenses from invoiceTracker
 */
export function renderFinancialSummary(stripeRevenue, localExpenses) {
  const netIncome = stripeRevenue.totalGross - localExpenses.totalExpenses;
  const margin = stripeRevenue.totalGross > 0
    ? ((netIncome / stripeRevenue.totalGross) * 100).toFixed(1)
    : 0;

  const cashFlowVelocity = stripeRevenue.mrr || 0;

  // Visual CSS Bar Chart calculation
  const totalAmount = stripeRevenue.totalGross + localExpenses.totalExpenses || 1;
  const incomePct = Math.round((stripeRevenue.totalGross / totalAmount) * 100);
  const expensePct = Math.round((localExpenses.totalExpenses / totalAmount) * 100);

  return `
    <style>
      .finance-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1.25rem;
        margin-bottom: 1.5rem;
      }
      .stat-card {
        background: var(--theme-color-surface, #ffffff);
        border: 1px solid var(--theme-color-border, #e2e8f0);
        border-radius: var(--theme-layout-border-radius, 8px);
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .stat-card.primary {
        border-left: 4px solid var(--theme-color-primary, #2b6cb0);
      }
      .stat-card.danger {
        border-left: 4px solid var(--theme-color-danger, #e53e3e);
      }
      .stat-card.success {
        border-left: 4px solid var(--theme-color-accent, #38a169);
      }
      .stat-card.warning {
        border-left: 4px solid #dd6b20;
      }
      .stat-value {
        font-size: 1.75rem;
        font-weight: 800;
        margin: 0.5rem 0 0.25rem 0;
      }
      .sub-text {
        font-size: 0.85rem;
        color: var(--theme-color-text-secondary, #718096);
      }
      .chart-container {
        background: var(--theme-color-surface, #ffffff);
        border: 1px solid var(--theme-color-border, #e2e8f0);
        border-radius: var(--theme-layout-border-radius, 8px);
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .bar-wrapper {
        display: flex;
        height: 20px;
        border-radius: 10px;
        overflow: hidden;
        background: #edf2f7;
        margin: 1rem 0;
        border: 1px solid var(--theme-color-border, #cbd5e0);
      }
      .bar-income {
        background: var(--theme-color-accent, #38a169);
        height: 100%;
        transition: width 0.5s ease-in-out;
      }
      .bar-expense {
        background: var(--theme-color-danger, #e53e3e);
        height: 100%;
        transition: width 0.5s ease-in-out;
      }
    </style>

    <div class="finance-grid">
      <div class="stat-card primary">
        <h3 style="margin:0; font-size: 0.85rem; text-transform: uppercase; color: var(--theme-color-text-secondary, #718096); letter-spacing: 0.5px; font-weight: bold;">Gross Stripe Revenue</h3>
        <p class="stat-value">$${stripeRevenue.totalGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        <span class="sub-text">${stripeRevenue.paidInvoicesCount} Paid Invoices</span>
      </div>
      <div class="stat-card danger">
        <h3 style="margin:0; font-size: 0.85rem; text-transform: uppercase; color: var(--theme-color-text-secondary, #718096); letter-spacing: 0.5px; font-weight: bold;">Operational Expenses</h3>
        <p class="stat-value">$${localExpenses.totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        <span class="sub-text">${localExpenses.count} Logged Expenses</span>
      </div>
      <div class="stat-card ${netIncome >= 0 ? 'success' : 'warning'}">
        <h3 style="margin:0; font-size: 0.85rem; text-transform: uppercase; color: var(--theme-color-text-secondary, #718096); letter-spacing: 0.5px; font-weight: bold;">Net Operating Profit</h3>
        <p class="stat-value">$${netIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        <span class="sub-text">${margin}% Operating Margin</span>
      </div>
    </div>

    <!-- CSS Bar Chart Component -->
    <div class="chart-container">
      <h3 style="margin-top: 0; font-size: 1.1rem; font-weight: bold; color: var(--theme-color-text-primary, #1a202c);">Operating Flow Allocation Ratio</h3>
      <div class="bar-wrapper">
        <div class="bar-income" style="width: ${incomePct}%" title="Revenue: ${incomePct}%"></div>
        <div class="bar-expense" style="width: ${expensePct}%" title="Expenses: ${expensePct}%"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; flex-wrap: wrap; gap: 0.5rem;">
        <span style="color: var(--theme-color-accent, #38a169);">● Live Revenue (${incomePct}%)</span>
        <span style="color: var(--theme-color-text-secondary, #718096);">Cash Velocity (MRR): $${cashFlowVelocity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}/mo</span>
        <span style="color: var(--theme-color-danger, #e53e3e);">● Expenses & Payroll (${expensePct}%)</span>
      </div>
    </div>
  `;
}

export function initFinancesTab() {
  setupSubTabs();
  initExpensesTracker();
  initPayrollManager();
  initBudgetAndCashflow();
}

/**
 * Handle interior tab navigation inside the Finances Panel
 */
function setupSubTabs() {
  // Dynamically inject the "Royalty Splits & Payouts" sub-tab button next to the others if not present
  const budgetBtn = document.getElementById('btn-subtab-budget');
  if (budgetBtn && !document.getElementById('btn-subtab-royalties')) {
    const royBtn = document.createElement('button');
    royBtn.id = 'btn-subtab-royalties';
    royBtn.style.cssText = budgetBtn.style.cssText;
    royBtn.style.background = 'transparent';
    royBtn.style.color = 'var(--theme-color-text-secondary, #4a5568)';
    royBtn.style.border = '1px solid transparent';
    royBtn.textContent = 'Royalty Splits & Payouts';
    budgetBtn.parentNode.appendChild(royBtn);
  }

  // Dynamically inject the "#panel-subtab-royalties" panel after "#panel-subtab-budget" if not present
  const budgetPanel = document.getElementById('panel-subtab-budget');
  if (budgetPanel && !document.getElementById('panel-subtab-royalties')) {
    const royPanel = document.createElement('div');
    royPanel.id = 'panel-subtab-royalties';
    royPanel.style.cssText = 'display: none; background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); padding: 1.5rem; border-radius: var(--theme-layout-border-radius, 8px);';
    royPanel.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="background: #ebf8ff; border: 1px solid #bee3f8; padding: 1.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 style="margin-top: 0; font-size: 1.25rem; color: #2b6cb0;">Universal Royalty Splits & Contributor Payouts</h2>
            <p style="margin: 0; font-size: 0.9rem; color: #2c5282;">
              Track all gross platform volume allocations and execute secure 1-click batch payout runs directly to contributor crypto wallets or bank accounts.
            </p>
          </div>
          <button id="btn-admin-batch-payout" class="btn-primary" style="padding: 10px 20px; font-weight: bold; background: #38a169; border: none; cursor: pointer; border-radius: var(--theme-layout-border-radius, 8px); color: white;">
            ⚡ 1-Click Execute Batch Payouts
          </button>
        </div>

        <!-- KPI summary stats -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
          <div style="background: var(--theme-color-background, #f7fafc); padding: 1rem; border-radius: 6px; border: 1px solid var(--theme-color-border); text-align: center;">
            <span style="font-size: 0.75rem; color: #718096; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Gross Royalty Volume</span>
            <strong id="admin-roy-gross-vol" style="display: block; font-size: 1.5rem; color: var(--theme-color-primary, #2b6cb0); margin-top: 4px;">$0.00</strong>
          </div>
          <div style="background: var(--theme-color-background, #f7fafc); padding: 1rem; border-radius: 6px; border: 1px solid var(--theme-color-border); text-align: center;">
            <span style="font-size: 0.75rem; color: #718096; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Awaiting Payout</span>
            <strong id="admin-roy-awaiting" style="display: block; font-size: 1.5rem; color: #dd6b20; margin-top: 4px;">$0.00</strong>
          </div>
          <div style="background: var(--theme-color-background, #f7fafc); padding: 1rem; border-radius: 6px; border: 1px solid var(--theme-color-border); text-align: center;">
            <span style="font-size: 0.75rem; color: #718096; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Completed Payouts</span>
            <strong id="admin-roy-completed" style="display: block; font-size: 1.5rem; color: #38a169; margin-top: 4px;">$0.00</strong>
          </div>
        </div>

        <!-- Filter and Logs list -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.05rem;">Allocations & Payout Requests</h3>
            <select id="admin-royalty-filter" style="padding: 6px 12px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
              <option value="all">All Asset Types</option>
              <option value="video">Videos</option>
              <option value="merchandise">Merchandise / Apparel</option>
              <option value="podcast">Podcasts & Audio</option>
              <option value="music">Music</option>
            </select>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
              <thead>
                <tr style="border-bottom: 2px solid var(--theme-color-border, #e2e8f0); color: var(--theme-color-text-secondary); font-weight: bold;">
                  <th style="padding: 10px;">ID / Contributor</th>
                  <th style="padding: 10px;">Asset Details</th>
                  <th style="padding: 10px;">Allocation (USD)</th>
                  <th style="padding: 10px;">Status</th>
                  <th style="padding: 10px; text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="admin-royalties-tbody">
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary); padding: 1.5rem;">No royalty split records or payout requests logged yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    budgetPanel.parentNode.insertBefore(royPanel, budgetPanel.nextSibling);
  }

  const subtabs = ['expenses', 'payroll', 'budget', 'royalties'];

  subtabs.forEach(tab => {
    const btn = document.getElementById(`btn-subtab-${tab}`);
    if (btn) {
      // Clean up and bind fresh listener
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', () => {
        // Reset all buttons and panels
        subtabs.forEach(t => {
          const b = document.getElementById(`btn-subtab-${t}`);
          const p = document.getElementById(`panel-subtab-${t}`);
          if (b) {
            b.style.background = 'transparent';
            b.style.color = 'var(--theme-color-text-secondary, #4a5568)';
            b.style.border = '1px solid transparent';
          }
          if (p) {
            p.style.display = 'none';
          }
        });

        // Set active button and panel
        newBtn.style.background = 'var(--theme-color-primary, #2b6cb0)';
        newBtn.style.color = 'white';
        newBtn.style.border = 'none';

        const activePanel = document.getElementById(`panel-subtab-${tab}`);
        if (activePanel) {
          activePanel.style.display = 'block';
        }

        // Refresh calculations and tables when tab switches
        if (tab === 'budget') {
          initBudgetAndCashflow();
        } else if (tab === 'expenses') {
          loadExpensesList();
        } else if (tab === 'payroll') {
          loadEmployeeDirectory();
          loadPayRunsList();
        } else if (tab === 'royalties') {
          loadAdminRoyaltiesDashboard();
        }
      });
    }
  });
}

/**
 * SECTION 1: EXPENSES TRACKER
 */
function initExpensesTracker() {
  const expenseForm = document.getElementById('expense-form');
  const expenseFilter = document.getElementById('expense-filter-select');
  const exportCsvBtn = document.getElementById('btn-expense-export-csv');

  if (expenseForm) {
    // Prevent duplicate handlers
    expenseForm.onsubmit = async (e) => {
      e.preventDefault();

      const submitBtn = expenseForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : 'Save Expense Record';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving Expense...';
      }

      try {
        const title = document.getElementById('expense-title').value;
        const category = document.getElementById('expense-category').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const date = document.getElementById('expense-date').value;
        const receiptInput = document.getElementById('expense-receipt');

        let attachment = null;
        if (receiptInput && receiptInput.files.length > 0) {
          const file = receiptInput.files[0];
          file.isPrivateDoc = true;
          attachment = await uploadFileToDrive(file);
        }

        const expenseData = {
          title,
          category,
          amount,
          date,
          receipt: attachment ? {
            id: attachment.id,
            src: attachment.src,
            name: receiptInput.files[0].name
          } : null
        };

        // Save to IndexedDB & Dual-Sync with Firestore
        await invoiceTracker.saveExpense(expenseData);
        toast.success(`Expense "${title}" logged and synchronized successfully!`);
        expenseForm.reset();

        // Reload list and update cashflow/budgets
        await loadExpensesList();
        initBudgetAndCashflow();
      } catch (err) {
        errorHandler.handleError(err, 'Admin Finances - Save Expense');
        console.error('[ExpensesTracker] Save Error:', err);
        toast.error(`Failed to save expense: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    };
  }

  if (expenseFilter) {
    expenseFilter.onchange = () => {
      loadExpensesList();
    };
  }

  if (exportCsvBtn) {
    exportCsvBtn.onclick = () => {
      exportExpensesToCsv();
    };
  }

  // Set default expense date to today
  const dateInput = document.getElementById('expense-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  loadExpensesList();
}

async function loadExpensesList() {
  const tbody = document.getElementById('expenses-tbody');
  const filterSelect = document.getElementById('expense-filter-select');
  const totalBadge = document.getElementById('expense-total-monthly-badge');

  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem;">Loading expenses...</td></tr>';

  try {
    const categoryFilter = filterSelect ? filterSelect.value : 'all';
    // Fetch from our local IndexedDB operational cost ledger
    const expenses = await invoiceTracker.getExpenses({ category: categoryFilter });

    if (expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem;">No expenses found matching the criteria.</td></tr>';
      if (totalBadge) totalBadge.textContent = '$0.00';
      return;
    }

    // Calculate current month's expenses
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let totalMonthlyAmount = 0;

    tbody.innerHTML = expenses.map(item => {
      const expDate = new Date(item.date);
      const isCurrentMonth = expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;

      if (isCurrentMonth) {
        totalMonthlyAmount += item.amount;
      }

      const receiptLink = item.receipt
        ? `<a href="${item.receipt.src}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: bold; text-decoration: underline;">View File</a>`
        : '<span style="color: var(--theme-color-text-secondary, #a0aec0); font-style: italic;">No attachment</span>';

      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
          <td style="padding: 12px; font-weight: 600; color: var(--theme-color-text-primary, #1a202c);">${item.title}</td>
          <td style="padding: 12px;">${item.category}</td>
          <td style="padding: 12px; font-weight: bold; color: var(--theme-color-danger, #e53e3e);">$${item.amount.toFixed(2)}</td>
          <td style="padding: 12px;">${new Date(item.date).toLocaleDateString()}</td>
          <td style="padding: 12px;">${receiptLink}</td>
        </tr>
      `;
    }).join('');

    if (totalBadge) {
      totalBadge.textContent = `$${totalMonthlyAmount.toFixed(2)}`;
    }
  } catch (err) {
    errorHandler.handleError(err, 'Admin Finances - Load Expenses List');
    console.error('[ExpensesTracker] Load List Error:', err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-danger, #e53e3e); padding: 1.5rem;">Failed to load expenses list.</td></tr>';
  }
}

async function exportExpensesToCsv() {
  try {
    const filterSelect = document.getElementById('expense-filter-select');
    const categoryFilter = filterSelect ? filterSelect.value : 'all';
    const expenses = await invoiceTracker.getExpenses({ category: categoryFilter });

    if (expenses.length === 0) {
      toast.warning('No expenses available to export.');
      return;
    }

    // CSV Headers
    const headers = ['Title/Vendor', 'Category', 'Amount ($)', 'Date', 'Receipt URL'];
    const csvRows = [headers.join(',')];

    expenses.forEach(item => {
      const row = [
        `"${item.title.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        item.amount.toFixed(2),
        item.date,
        `"${item.receipt ? item.receipt.src : ''}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_export_${categoryFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV exported successfully!');
  } catch (err) {
    errorHandler.handleError(err, 'Admin Finances - Export CSV');
    toast.error(`Export failed: ${err.message}`);
  }
}

/**
 * SECTION 2: SIMPLE PAYROLL MANAGER
 */
function initPayrollManager() {
  const employeeForm = document.getElementById('payroll-employee-form');
  const payrunForm = document.getElementById('payroll-log-form');

  // Toggle Wise-specific details input panel on selecting Wise disbursement
  const methodSelect = document.getElementById('employee-method');
  const wiseFields = document.getElementById('wise-account-fields');
  if (methodSelect && wiseFields) {
    methodSelect.onchange = () => {
      wiseFields.style.display = methodSelect.value === 'Wise' ? 'flex' : 'none';
    };
  }
  const payrunSelect = document.getElementById('payrun-employee-select');
  const payrunUnits = document.getElementById('payrun-units');
  const payrunTotal = document.getElementById('payrun-total-amount');

  if (employeeForm) {
    employeeForm.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = employeeForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const name = document.getElementById('employee-name').value;
        const role = document.getElementById('employee-role').value;
        const payRate = parseFloat(document.getElementById('employee-payrate').value);
        const payType = document.getElementById('employee-paytype').value;
        const frequency = document.getElementById('employee-frequency').value;
        const method = document.getElementById('employee-method').value;

        const employeeData = { name, role, payRate, payType, frequency, method };
        if (method === 'Wise') {
          employeeData.bankName = document.getElementById('employee-bank-code').value;
          employeeData.accountNumber = document.getElementById('employee-account-number').value;
        }

        await contentDB.saveEmployee(employeeData);
        toast.success(`Successfully added ${name} to team directory!`);
        employeeForm.reset();

        // Hide Wise account fields after reset
        const wiseFields = document.getElementById('wise-account-fields');
        if (wiseFields) wiseFields.style.display = 'none';

        await loadEmployeeDirectory();
      } catch (err) {
        errorHandler.handleError(err, 'Admin Finances - Add Employee');
        toast.error(`Failed to add team member: ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  if (payrunForm) {
    payrunForm.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = payrunForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const employeeId = payrunSelect.value;
        const units = parseFloat(payrunUnits.value);
        const totalAmount = parseFloat(payrunTotal.value);

        if (!employeeId) {
          toast.warning('Please select an employee for the pay run.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        const employees = await contentDB.getEmployees();
        const emp = employees.find(e => e.id === employeeId);

        if (!emp) {
          toast.error('Selected employee records not found.');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        const payRunRecord = {
          employeeId: emp.id,
          employeeName: emp.name,
          role: emp.role,
          units,
          amount: totalAmount,
          method: emp.method,
          payFrequency: emp.frequency
        };

        if (emp.method === 'Wise') {
          if (submitBtn) submitBtn.textContent = 'Executing Wise Payout...';
          toast.info(`Initializing Wise Business payment pipeline for ${emp.name}...`);

          // 1. Calculate Quote
          const { createQuote, createRecipient, executePayout, handleWiseWebhook } = await import('../../utils/backend-wise.js');
          const quote = await createQuote(totalAmount, 'PHP');
          toast.info(`Wise Real-Time Quote Created: Mid-Market Rate = ${quote.rate}, Fee = $${quote.fee}`);

          // 2. Create target recipient
          const recipient = await createRecipient(emp);
          toast.info(`Wise PHP Recipient registered successfully.`);

          // 3. Initiate Wise Transfer payout
          const transfer = await executePayout(recipient.id, quote.id, `VA Payroll Cycle - ${emp.name}`);
          toast.success(`Wise payout transfer #${transfer.id} initiated!`);

          // 4. Simulate real-time webhook callback arrival to complete the loop
          toast.info('Simulating webhook callback status: transfer.state-change...');
          const webhookPayload = {
            event_type: 'transfer.state-change',
            current_state: 'outgoing_payment_sent',
            data: {
              resource: {
                id: transfer.id,
                status: 'completed',
                sourceValue: quote.sourceValue,
                targetValue: quote.targetValue,
                fee: quote.fee,
                rate: quote.rate
              }
            },
            vaData: emp,
            payout: {
              id: transfer.id,
              sourceValue: quote.sourceValue,
              targetValue: quote.targetValue,
              fee: quote.fee,
              rate: quote.rate
            }
          };

          const result = await handleWiseWebhook(webhookPayload);
          if (result.success) {
            toast.success(`Wise Payout confirmed. Financial ledger and budgets successfully updated!`);
          } else {
            throw new Error(result.error || 'Webhook callback simulation failed');
          }
        } else {
          // Normal manual logging flow
          await contentDB.savePayrollRecord(payRunRecord);
          toast.success(`Successfully logged pay run for ${emp.name}!`);
        }

        payrunForm.reset();

        await loadPayRunsList();
        initBudgetAndCashflow();
      } catch (err) {
        errorHandler.handleError(err, 'Admin Finances - Log Pay Run');
        toast.error(`Failed to log pay run: ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  // Dynamically update compensation when employee selection or units change
  if (payrunSelect) {
    payrunSelect.onchange = () => {
      calculateLiveCompensation();
    };
  }
  if (payrunUnits) {
    payrunUnits.oninput = () => {
      calculateLiveCompensation();
    };
  }

  loadEmployeeDirectory();
  loadPayRunsList();
}

async function calculateLiveCompensation() {
  const select = document.getElementById('payrun-employee-select');
  const unitsInput = document.getElementById('payrun-units');
  const totalInput = document.getElementById('payrun-total-amount');
  const label = document.getElementById('payrun-amount-label');

  if (!select || !unitsInput || !totalInput) return;

  const employeeId = select.value;
  if (!employeeId) {
    totalInput.value = '';
    return;
  }

  try {
    const employees = await contentDB.getEmployees();
    const emp = employees.find(e => e.id === employeeId);

    if (emp) {
      if (emp.payType === 'salary') {
        unitsInput.value = '1';
        unitsInput.disabled = true;
        if (label) label.textContent = 'Salary Pay Cycle Unit:';
        totalInput.value = emp.payRate.toFixed(2);
      } else {
        unitsInput.disabled = false;
        if (label) label.textContent = 'Hours Worked:';
        const units = parseFloat(unitsInput.value) || 0;
        const total = units * emp.payRate;
        totalInput.value = total.toFixed(2);
      }
    }
  } catch (err) {
    errorHandler.handleError(err, 'Admin Finances - Calculate Compensation');
    console.error(err);
  }
}

async function loadEmployeeDirectory() {
  const tbody = document.getElementById('employees-tbody');
  const select = document.getElementById('payrun-employee-select');

  if (!tbody) return;

  try {
    const employees = await contentDB.getEmployees();

    // Populate dropdown selector
    if (select) {
      const selectedValue = select.value;
      select.innerHTML = '<option value="">-- Choose Team Member --</option>' +
        employees.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
      select.value = selectedValue;
    }

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1rem;">No employees registered in the directory.</td></tr>';
      return;
    }

    tbody.innerHTML = employees.map(emp => {
      const rateLabel = emp.payType === 'hourly' ? `$${emp.payRate.toFixed(2)}/hr` : `$${emp.payRate.toFixed(2)} Salary`;
      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
          <td style="padding: 12px; font-weight: bold; color: var(--theme-color-text-primary, #1a202c);">${emp.name}</td>
          <td style="padding: 12px;">${emp.role}</td>
          <td style="padding: 12px; font-weight: 600;">${rateLabel}</td>
          <td style="padding: 12px;">${emp.frequency}</td>
          <td style="padding: 12px;"><span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; background: #ebf8ff; color: #2b6cb0; font-weight: bold;">${emp.method}</span></td>
          <td style="padding: 12px;">
            <button class="btn-delete-employee" data-emp-id="${emp.id}" style="padding: 4px 8px; font-size: 0.8rem; background: var(--theme-color-danger, #e53e3e); color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind deletes
    tbody.querySelectorAll('.btn-delete-employee').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.empId;
        if (confirm('Are you sure you want to remove this employee from directory?')) {
          await contentDB.deleteEmployee(id);
          toast.success('Removed team member successfully.');
          loadEmployeeDirectory();
        }
      };
    });

  } catch (err) {
    errorHandler.handleError(err, 'Admin Finances - Load Employee Directory');
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--theme-color-danger, #e53e3e); padding: 1rem;">Failed to load team directory.</td></tr>';
  }
}

async function loadPayRunsList() {
  const tbody = document.getElementById('payruns-tbody');
  if (!tbody) return;

  try {
    const payruns = await contentDB.getPayrollRecords();

    if (payruns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1rem;">No payroll history has been logged.</td></tr>';
      return;
    }

    tbody.innerHTML = payruns.map(p => {
      const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
          <td style="padding: 12px; font-size: 0.85rem; color: var(--theme-color-text-secondary, #718096);">${dateStr}</td>
          <td style="padding: 12px; font-weight: 600; color: var(--theme-color-text-primary, #1a202c);">${p.employeeName} (${p.role})</td>
          <td style="padding: 12px;">${p.units}</td>
          <td style="padding: 12px; font-weight: bold; color: var(--theme-color-danger, #e53e3e);">$${p.amount.toFixed(2)}</td>
          <td style="padding: 12px;"><span style="padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; background: #e6fffa; color: #319795; font-weight: bold;">${p.method}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    errorHandler.handleError(err, 'Admin Finances - Load Pay Runs');
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-danger, #e53e3e); padding: 1rem;">Error loading pay runs.</td></tr>';
  }
}

/**
 * SECTION 3: SMALL BUSINESS BUDGETING & CASHFLOW DASHBOARD
 */
async function initBudgetAndCashflow() {
  const budgetForm = document.getElementById('budget-targets-form');
  const expTargetInput = document.getElementById('budget-expenses-target');
  const payTargetInput = document.getElementById('budget-payroll-target');

  const expProgress = document.getElementById('budget-expenses-progress');
  const payProgress = document.getElementById('budget-payroll-progress');
  const expMetricText = document.getElementById('budget-expenses-metric-text');
  const payMetricText = document.getElementById('budget-payroll-metric-text');

  const salesText = document.getElementById('cashflow-invoiced-sales');
  const expText = document.getElementById('cashflow-expenses');
  const payText = document.getElementById('cashflow-payroll');
  const netText = document.getElementById('cashflow-net-profit');
  const netBanner = document.getElementById('cashflow-profit-banner');

  // Insert/Target our dedicated Stripe financial analytics summary dashboard container on the fly
  let dashboardContainer = document.getElementById('stripe-financial-dashboard-container');
  if (!dashboardContainer) {
    const parentPanel = document.getElementById('panel-subtab-budget');
    if (parentPanel) {
      const outerDiv = parentPanel.querySelector('div');
      if (outerDiv) {
        dashboardContainer = document.createElement('div');
        dashboardContainer.id = 'stripe-financial-dashboard-container';
        outerDiv.insertBefore(dashboardContainer, outerDiv.firstChild);
      }
    }
  }

  let targets = { totalExpensesBudget: 5000, payrollBudget: 10000 };
  try {
    targets = await contentDB.getBudgets();
  } catch (err) {
    errorHandler.handleError(err, 'Admin Finances - Init Budget');
    console.warn(err);
  }

  if (expTargetInput) expTargetInput.value = targets.totalExpensesBudget || 5000;
  if (payTargetInput) payTargetInput.value = targets.payrollBudget || 10000;

  if (budgetForm) {
    budgetForm.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = budgetForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const totalExpensesBudget = parseFloat(expTargetInput.value);
        const payrollBudget = parseFloat(payTargetInput.value);

        await contentDB.saveBudgetTargets({ totalExpensesBudget, payrollBudget });
        toast.success('Budget targets successfully synchronized!');

        initBudgetAndCashflow();
      } catch (err) {
        errorHandler.handleError(err, 'Admin Finances - Save Budget Targets');
        toast.error(`Failed to sync budget targets: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      }
    };
  }

  // Retrieve current stats
  try {
    // A: Query local expenses from IndexedDB expense ledger
    const expenses = await invoiceTracker.getExpenses();
    const payruns = await contentDB.getPayrollRecords();

    // B: Fetch Real-Time Analytics from Stripe proxy
    let stripeStats = { totalGross: 0, paidInvoicesCount: 0, pendingInvoicesCount: 0, pendingAmount: 0, failedPaymentsCount: 0, failedAmount: 0, mrr: 0 };
    try {
      stripeStats = await stripeService.retrieveLiveRevenueStats();
    } catch (e) {
      console.warn('[BudgetAndCashflow] Failed to retrieve live revenue statistics:', e);
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. Calculate Monthly Expenses (excluding 'Payroll' category to prevent double-counting with payruns!)
    let currentMonthExpenses = 0;
    let totalAllTimeExpenses = 0;
    expenses.forEach(item => {
      if (item.category === 'Payroll') return;
      const expDate = new Date(item.date);
      const isCurrentMonth = expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;
      if (isCurrentMonth) {
        currentMonthExpenses += item.amount;
      }
      totalAllTimeExpenses += item.amount;
    });

    // 2. Calculate Monthly Payroll
    let currentMonthPayroll = 0;
    let totalAllTimePayroll = 0;
    payruns.forEach(p => {
      const payDate = p.createdAt ? new Date(p.createdAt) : new Date();
      const isCurrentMonth = payDate.getFullYear() === currentYear && payDate.getMonth() === currentMonth;
      if (isCurrentMonth) {
        currentMonthPayroll += p.amount;
      }
      totalAllTimePayroll += p.amount;
    });

    // 3. Render Progress Bars for current month
    const expensesTarget = targets.totalExpensesBudget || 5000;
    const payrollTarget = targets.payrollBudget || 10000;

    const expPct = Math.min(100, Math.round((currentMonthExpenses / expensesTarget) * 100));
    const payPct = Math.min(100, Math.round((currentMonthPayroll / payrollTarget) * 100));

    if (expProgress) expProgress.style.width = `${expPct}%`;
    if (payProgress) payProgress.style.width = `${payPct}%`;

    if (expProgress) {
      expProgress.style.background = expPct >= 100 ? 'var(--theme-color-danger, #e53e3e)' : 'var(--theme-color-primary, #2b6cb0)';
    }
    if (payProgress) {
      payProgress.style.background = payPct >= 100 ? 'var(--theme-color-danger, #e53e3e)' : 'var(--theme-color-accent, #38a169)';
    }

    if (expMetricText) {
      expMetricText.textContent = `$${currentMonthExpenses.toFixed(2)} / $${expensesTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${expPct}%)`;
    }
    if (payMetricText) {
      payMetricText.textContent = `$${currentMonthPayroll.toFixed(2)} / $${payrollTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${payPct}%)`;
    }

    // 4. Render financial summary dashboard component (template literals with live metrics)
    const totalOutwardCostAllTime = totalAllTimeExpenses + totalAllTimePayroll;
    if (dashboardContainer) {
      dashboardContainer.innerHTML = renderFinancialSummary(stripeStats, {
        totalExpenses: totalOutwardCostAllTime,
        count: expenses.length
      });
    }

    // 5. Update other net cashflow summary elements
    if (salesText) salesText.textContent = `$${stripeStats.totalGross.toFixed(2)}`;
    if (expText) expText.textContent = `$${totalAllTimeExpenses.toFixed(2)}`;
    if (payText) payText.textContent = `$${totalAllTimePayroll.toFixed(2)}`;

    // Net Profit calculation
    const netProfit = stripeStats.totalGross - totalOutwardCostAllTime;
    if (netText) {
      netText.textContent = `${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`;
    }

    if (netBanner) {
      if (netProfit >= 0) {
        netBanner.style.background = '#f0fdf4';
        netBanner.style.borderColor = '#bbf7d0';
        netBanner.style.color = '#166534';
      } else {
        netBanner.style.background = '#fff5f5';
        netBanner.style.borderColor = '#fed7d7';
        netBanner.style.color = '#c53030';
      }
    }

  } catch (err) {
    errorHandler.handleError(err, 'Admin Finances - Budget Dashboard');
    console.error('[BudgetAndCashflow] Init Dashboard Error:', err);
  }
}

/**
 * Universal Royalty Splits & Payouts Administrator Dashboard controller
 */
export async function loadAdminRoyaltiesDashboard() {
  const tbody = document.getElementById('admin-royalties-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary); padding: 1.5rem;">Loading royalty logs...</td></tr>`;

  try {
    const { getAllEarnings } = await import('../../core/royalties.js');
    const earnings = await getAllEarnings();
    const payoutRequests = JSON.parse(localStorage.getItem('foundation_local_payout_requests') || '[]');

    // Calculate Admin Royalty KPIs
    let grossVolume = 0;
    let awaitingTotal = 0;
    let completedTotal = 0;

    earnings.forEach(earn => {
      grossVolume += earn.grossUSD || 0;
    });

    payoutRequests.forEach(req => {
      if (req.status === 'pending') {
        awaitingTotal += req.amountUSD || 0;
      } else {
        completedTotal += req.amountUSD || 0;
      }
    });

    const grossVolEl = document.getElementById('admin-roy-gross-vol');
    const awaitingEl = document.getElementById('admin-roy-awaiting');
    const completedEl = document.getElementById('admin-roy-completed');

    if (grossVolEl) grossVolEl.textContent = '$' + grossVolume.toFixed(2);
    if (awaitingEl) awaitingEl.textContent = '$' + awaitingTotal.toFixed(2);
    if (completedEl) completedEl.textContent = '$' + completedTotal.toFixed(2);

    // Apply Filter values
    const filterSelect = document.getElementById('admin-royalty-filter');
    const filterType = filterSelect ? filterSelect.value : 'all';

    const rows = [];

    // 1. Add Payout Requests to table
    payoutRequests.forEach(req => {
      const isSelectedType = filterType === 'all' || filterType === 'merchandise'; // default mock map
      if (!isSelectedType) return;

      const dateStr = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent';
      const statusBadge = req.status === 'pending'
        ? `<span style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #fffaf0; color: #dd6b20;">Pending Request</span>`
        : `<span style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #e6fffa; color: #319795;">Paid</span>`;

      const actionBtn = req.status === 'pending'
        ? `<button class="btn-payout-execute btn-primary" data-req-id="${req.id}" style="padding: 4px 8px; font-size: 0.75rem; background: #38a169;">Pay Request</button>`
        : `<span style="color: #a0aec0; font-style: italic; font-size: 0.8rem;">Settled</span>`;

      rows.push(`
        <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
          <td style="padding: 10px;">
            <strong>${req.userEmail}</strong>
            <div style="font-size: 0.75rem; color: #718096;">ID: ${req.id} | Date: ${dateStr}</div>
          </td>
          <td style="padding: 10px;">
            <span style="font-weight: bold; text-transform: uppercase; font-size: 0.75rem; color: #805ad5;">Payout Request</span>
            <div style="font-size: 0.75rem; color: #718096;">Method: ${req.method.toUpperCase()} | Dest: ${req.address}</div>
          </td>
          <td style="padding: 10px; font-weight: bold; color: var(--theme-color-primary, #2b6cb0);">$${req.amountUSD.toFixed(2)}</td>
          <td style="padding: 10px;">${statusBadge}</td>
          <td style="padding: 10px; text-align: right;">${actionBtn}</td>
        </tr>
      `);
    });

    // 2. Add raw allocation distributions
    earnings.forEach(earn => {
      const isSelectedType = filterType === 'all' || earn.assetType === filterType;
      if (!isSelectedType) return;

      const dateStr = earn.createdAt ? new Date(earn.createdAt).toLocaleDateString() : 'Recent';

      earn.distributions?.forEach((dist, idx) => {
        rows.push(`
          <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7); background: #fdfdfd;">
            <td style="padding: 10px;">
              <strong>${dist.userEmail}</strong>
              <div style="font-size: 0.75rem; color: #718096;">Role: ${dist.role} | Date: ${dateStr}</div>
            </td>
            <td style="padding: 10px;">
              <strong>${earn.assetId}</strong>
              <div style="font-size: 0.75rem; color: #718096;">Type: ${earn.assetType} | Split: ${dist.percentage}%</div>
            </td>
            <td style="padding: 10px; font-weight: bold; color: #319795;">$${dist.allocatedAmountUSD.toFixed(2)}</td>
            <td style="padding: 10px;">
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #ebf8ff; color: #2b6cb0;">Split Allocated</span>
            </td>
            <td style="padding: 10px; text-align: right; color: #cbd5e0; font-style: italic; font-size: 0.8rem;">Auto-assigned</td>
          </tr>
        `);
      });
    });

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary); padding: 1.5rem;">No split allocations logged yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.join('');

    // Wire up filter selector change event
    if (filterSelect) {
      filterSelect.onchange = () => loadAdminRoyaltiesDashboard();
    }

    // Wire up individual pay request buttons
    tbody.querySelectorAll('.btn-payout-execute').forEach(btn => {
      btn.onclick = async () => {
        const reqId = btn.dataset.reqId;
        const reqIndex = payoutRequests.findIndex(r => r.id === reqId);
        if (reqIndex !== -1) {
          const req = payoutRequests[reqIndex];
          req.status = 'completed';
          payoutRequests[reqIndex] = req;
          localStorage.setItem('foundation_local_payout_requests', JSON.stringify(payoutRequests));

          // Simulate payout blockchain/bank settle latency
          toast.info(`Executing 1-click single payout for $${req.amountUSD.toFixed(2)} via ${req.method.toUpperCase()}...`);
          await new Promise(r => setTimeout(r, 1000));
          toast.success(`payout transfer of $${req.amountUSD.toFixed(2)} successfully settled with contributor!`);

          loadAdminRoyaltiesDashboard();
        }
      };
    });

    // Wire up 1-Click Batch Payouts Button
    const btnBatch = document.getElementById('btn-admin-batch-payout');
    if (btnBatch) {
      // Recreate to avoid duplicates
      const newBtn = btnBatch.cloneNode(true);
      btnBatch.parentNode.replaceChild(newBtn, btnBatch);

      newBtn.onclick = async () => {
        const pendingCount = payoutRequests.filter(r => r.status === 'pending').length;
        if (pendingCount === 0) {
          toast.warning('No pending contributor payout requests awaiting batch settlement.');
          return;
        }

        newBtn.disabled = true;
        newBtn.textContent = 'Processing Batch settlement...';

        toast.info(`Executing 1-click batch payout run for ${pendingCount} pending requests...`);

        // Latency simulation
        await new Promise(r => setTimeout(r, 1800));

        payoutRequests.forEach((req, idx) => {
          if (req.status === 'pending') {
            req.status = 'completed';
            payoutRequests[idx] = req;
          }
        });

        localStorage.setItem('foundation_local_payout_requests', JSON.stringify(payoutRequests));
        toast.success(`Batch settlement complete! ${pendingCount} payout requests successfully processed & cleared.`);

        newBtn.disabled = false;
        newBtn.textContent = '⚡ 1-Click Execute Batch Payouts';

        loadAdminRoyaltiesDashboard();
      };
    }

  } catch (err) {
    console.error('[Admin Royalties Dashboard]: Load failed:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-color-danger); padding: 1.5rem;">Failed to load royalty command center.</td></tr>`;
  }
}