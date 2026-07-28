// pages/admin/admin-finances.js - Business Finances & Payroll management tab
import { contentDB } from '../../core/db.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { invoiceTracker } from '../../core/invoice-tracker.js';
import { toast } from '../../utils/toast.js';

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
  const subtabs = ['expenses', 'payroll', 'budget'];

  subtabs.forEach(tab => {
    const btn = document.getElementById(`btn-subtab-${tab}`);
    if (btn) {
      btn.addEventListener('click', () => {
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
        btn.style.background = 'var(--theme-color-primary, #2b6cb0)';
        btn.style.color = 'white';
        btn.style.border = 'none';

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
          // Make sure receipts are uploaded as private document
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

        await contentDB.saveExpense(expenseData);
        toast.success(`Expense "${title}" saved successfully!`);
        expenseForm.reset();

        // Reload list and update cashflow/budgets
        await loadExpensesList();
        initBudgetAndCashflow();
      } catch (err) {
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
    const expenses = await contentDB.getExpenses({ category: categoryFilter });

    if (expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem;">No expenses found matching the criteria.</td></tr>';
      if (totalBadge) totalBadge.textContent = '$0.00';
      return;
    }

    // Calculate current month's expenses
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

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
    console.error('[ExpensesTracker] Load List Error:', err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-danger, #e53e3e); padding: 1.5rem;">Failed to load expenses list.</td></tr>';
  }
}

async function exportExpensesToCsv() {
  try {
    const filterSelect = document.getElementById('expense-filter-select');
    const categoryFilter = filterSelect ? filterSelect.value : 'all';
    const expenses = await contentDB.getExpenses({ category: categoryFilter });

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
    toast.error(`Export failed: ${err.message}`);
  }
}

/**
 * SECTION 2: SIMPLE PAYROLL MANAGER
 */
function initPayrollManager() {
  const employeeForm = document.getElementById('payroll-employee-form');
  const payrunForm = document.getElementById('payroll-log-form');
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
        await contentDB.saveEmployee(employeeData);
        toast.success(`Successfully added ${name} to team directory!`);
        employeeForm.reset();

        await loadEmployeeDirectory();
      } catch (err) {
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

        await contentDB.savePayrollRecord(payRunRecord);
        toast.success(`Successfully logged pay run for ${emp.name}!`);
        payrunForm.reset();

        await loadPayRunsList();
        initBudgetAndCashflow();
      } catch (err) {
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

  let targets = { totalExpensesBudget: 5000, payrollBudget: 10000 };
  try {
    targets = await contentDB.getBudgets();
  } catch (err) {
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
        toast.error(`Failed to sync budget targets: ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  // Retrieve current stats
  try {
    const expenses = await contentDB.getExpenses();
    const payruns = await contentDB.getPayrollRecords();
    const invoices = await invoiceTracker.getAllInvoices();

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. Calculate Monthly Expenses
    let currentMonthExpenses = 0;
    let totalAllTimeExpenses = 0;
    expenses.forEach(item => {
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

    // Dynamic coloring based on budget threshold alerts
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

    // 4. Invoiced/Paid sales from Stripe
    let totalPaidInvoicedSales = 0;
    invoices.forEach(inv => {
      // Sum up amount paid from successful payments
      if (inv.status === 'paid') {
        totalPaidInvoicedSales += (inv.amount || 0);
      } else if (inv.status === 'partial') {
        totalPaidInvoicedSales += (inv.amountPaid || 0);
      }
    });

    // Display total cashflow metrics
    if (salesText) salesText.textContent = `$${totalPaidInvoicedSales.toFixed(2)}`;
    if (expText) expText.textContent = `$${totalAllTimeExpenses.toFixed(2)}`;
    if (payText) payText.textContent = `$${totalAllTimePayroll.toFixed(2)}`;

    // Net Profit calculation
    const netProfit = totalPaidInvoicedSales - (totalAllTimeExpenses + totalAllTimePayroll);
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
    console.error('[BudgetAndCashflow] Init Dashboard Error:', err);
  }
}
