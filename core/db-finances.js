// core/db-finances.js
import {
  getFirestoreDB, doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, limit,
  queryWith3SecTimeout, INVOICES_COLLECTION
} from './db-shared.js';

export async function saveInvoice(invoice) {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalInvoices();
    local[invoice.id] = invoice;
    saveLocalInvoices(local);
    return invoice;
  }

  try {
    const docRef = doc(db, INVOICES_COLLECTION, invoice.id);
    await setDoc(docRef, invoice, { merge: true });
    return invoice;
  } catch (err) {
    console.warn('[DB]: Firestore invoice save error. Falling back to LocalStorage.', err.message);
    const local = getLocalInvoices();
    local[invoice.id] = invoice;
    saveLocalInvoices(local);
    return invoice;
  }
}

export async function getInvoice(invoiceId) {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalInvoices();
    return local[invoiceId] || null;
  }

  try {
    const docRef = doc(db, INVOICES_COLLECTION, invoiceId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (err) {
    console.warn('[DB]: Firestore invoice get error. Falling back to LocalStorage.', err.message);
    const local = getLocalInvoices();
    return local[invoiceId] || null;
  }
}

export async function getAllInvoices() {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalInvoices();
    return Object.values(local);
  }

  try {
    const collectionRef = collection(db, INVOICES_COLLECTION);
    const querySnapshot = await getDocs(collectionRef);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.warn('[DB]: Firestore invoices get error. Falling back to LocalStorage.', err.message);
    const local = getLocalInvoices();
    return Object.values(local);
  }
}

export async function getInvoicesByCustomer(customerEmail) {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalInvoices();
    return Object.values(local).filter(inv => inv.customerEmail === customerEmail);
  }

  try {
    const collectionRef = collection(db, INVOICES_COLLECTION);
    const q = query(collectionRef, where('customerEmail', '==', customerEmail));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.warn('[DB]: Firestore customer invoices get error. Falling back to LocalStorage.', err.message);
    const local = getLocalInvoices();
    return Object.values(local).filter(inv => inv.customerEmail === customerEmail);
  }
}

export async function getInvoicesByGoogleContact(googleContactId) {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalInvoices();
    return Object.values(local).filter(inv => inv.googleContactId === googleContactId);
  }

  try {
    const collectionRef = collection(db, INVOICES_COLLECTION);
    const q = query(collectionRef, where('googleContactId', '==', googleContactId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.warn('[DB]: Firestore Google Contact invoices get error. Falling back to LocalStorage.', err.message);
    const local = getLocalInvoices();
    return Object.values(local).filter(inv => inv.googleContactId === googleContactId);
  }
}

export async function deleteInvoice(invoiceId) {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalInvoices();
    delete local[invoiceId];
    saveLocalInvoices(local);
    return true;
  }

  try {
    const docRef = doc(db, INVOICES_COLLECTION, invoiceId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore invoice delete error. Falling back to LocalStorage.', err.message);
    const local = getLocalInvoices();
    delete local[invoiceId];
    saveLocalInvoices(local);
    return true;
  }
}

export async function saveExpense(data) {
  const db = getFirestoreDB();
  const id = data.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = { ...data, id, updatedAt: new Date().toISOString() };

  if (!db) {
    const local = getLocalExpenses();
    local[id] = payload;
    saveLocalExpenses(local);
    return payload;
  }

  try {
    const docRef = doc(db, 'finances_expenses', id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore expense save error. Falling back to LocalStorage.', err.message);
    const local = getLocalExpenses();
    local[id] = payload;
    saveLocalExpenses(local);
    return payload;
  }
}

export async function getExpenses(filter = {}) {
  let results = [];
  const db = getFirestoreDB();
  if (db) {
    try {
      const querySnapshot = await getDocs(collection(db, 'finances_expenses'));
      querySnapshot.forEach((docSnap) => {
        results.push(docSnap.data());
      });
    } catch (err) {
      console.warn('[DB]: Could not fetch expenses from Firestore.', err.message);
    }
  }

  if (results.length === 0) {
    results = Object.values(getLocalExpenses());
  }

  if (filter.category && filter.category !== 'all') {
    results = results.filter(item => item.category === filter.category);
  }
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  return results;
}

export async function updateBudgetTargetsOnPayout(amountUSD, feeUSD) {
  try {
    const targets = await getBudgets();
    targets.payrollBudget = (targets.payrollBudget || 10000) + Number(amountUSD);
    targets.totalExpensesBudget = (targets.totalExpensesBudget || 5000) + Number(feeUSD);
    await saveBudgetTargets(targets);
    console.log('[Finances DB]: Budget targets dynamically updated for Wise payout.');
  } catch (err) {
    console.warn('[Finances DB]: Failed to dynamically update budget targets:', err.message);
  }
}

export async function savePayrollRecord(data) {
  const db = getFirestoreDB();
  const id = data.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };

  // Automate monthly budget target tracking on Wise payouts
  if (data.transferFeeUSD || data.wiseTransferId) {
    const amountUSD = Number(data.amountUSD) || 0;
    const feeUSD = Number(data.transferFeeUSD) || 0;
    await updateBudgetTargetsOnPayout(amountUSD, feeUSD);
  }

  if (!db) {
    const local = getLocalPayroll();
    local[id] = payload;
    saveLocalPayroll(local);
    return payload;
  }

  try {
    const docRef = doc(db, 'finances_payroll', id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore payroll save error. Falling back to LocalStorage.', err.message);
    const local = getLocalPayroll();
    local[id] = payload;
    saveLocalPayroll(local);
    return payload;
  }
}

export async function getPayrollRecords() {
  let results = [];
  const db = getFirestoreDB();
  if (db) {
    try {
      const querySnapshot = await queryWith3SecTimeout(getDocs(collection(db, 'finances_payroll')));
      querySnapshot.forEach((docSnap) => {
        results.push(docSnap.data());
      });
    } catch (err) {
      console.warn('[DB]: Could not fetch payroll records from Firestore.', err.message);
    }
  }

  if (results.length === 0) {
    results = Object.values(getLocalPayroll());
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return results;
}

export async function saveBudgetTargets(targets) {
  const db = getFirestoreDB();
  const id = 'monthly_budget_targets';
  const payload = { ...targets, id, updatedAt: new Date().toISOString() };

  if (!db) {
    const local = getLocalBudgets();
    local[id] = payload;
    saveLocalBudgets(local);
    return payload;
  }

  try {
    const docRef = doc(db, 'finances_budgets', id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore budget save error. Falling back to LocalStorage.', err.message);
    const local = getLocalBudgets();
    local[id] = payload;
    saveLocalBudgets(local);
    return payload;
  }
}

export async function getBudgets() {
  const db = getFirestoreDB();
  const id = 'monthly_budget_targets';
  if (db) {
    try {
      const docRef = doc(db, 'finances_budgets', id);
      const docSnap = await queryWith3SecTimeout(getDoc(docRef));
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (err) {
      console.warn('[DB]: Could not fetch budgets from Firestore.', err.message);
    }
  }

  const local = getLocalBudgets();
  return local[id] || { totalExpensesBudget: 5000, payrollBudget: 10000 };
}

export async function saveEmployee(data) {
  const db = getFirestoreDB();
  const id = data.id || `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = { ...data, id, updatedAt: new Date().toISOString() };

  if (!db) {
    const local = getLocalEmployees();
    local[id] = payload;
    saveLocalEmployees(local);
    return payload;
  }

  try {
    const docRef = doc(db, 'finances_employees', id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore employee save error. Falling back to LocalStorage.', err.message);
    const local = getLocalEmployees();
    local[id] = payload;
    saveLocalEmployees(local);
    return payload;
  }
}

export async function getEmployees() {
  let results = [];
  const db = getFirestoreDB();
  if (db) {
    try {
      const querySnapshot = await getDocs(collection(db, 'finances_employees'));
      querySnapshot.forEach((docSnap) => {
        results.push(docSnap.data());
      });
    } catch (err) {
      console.warn('[DB]: Could not fetch employees from Firestore.', err.message);
    }
  }

  if (results.length === 0) {
    results = Object.values(getLocalEmployees());
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

export async function deleteEmployee(id) {
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalEmployees();
    delete local[id];
    saveLocalEmployees(local);
    return true;
  }

  try {
    const docRef = doc(db, 'finances_employees', id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore employee delete error. Falling back to LocalStorage.', err.message);
    const local = getLocalEmployees();
    delete local[id];
    saveLocalEmployees(local);
    return true;
  }
}

// Helpers
export async function saveStateCompliance(data) {
  const db = getFirestoreDB();
  const payload = {
    annualReportDueDate: data.annualReportDueDate || '2026-06-01',
    franchiseTaxDueDate: data.franchiseTaxDueDate || '2026-05-15',
    stateFilingStatus: data.stateFilingStatus || 'Good Standing',
    updatedAt: new Date().toISOString()
  };

  if (!db) {
    localStorage.setItem('foundation_local_state_compliance', JSON.stringify(payload));
    return payload;
  }

  try {
    const docRef = doc(db, 'settings', 'compliance');
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore compliance save error. Falling back to LocalStorage.', err.message);
    localStorage.setItem('foundation_local_state_compliance', JSON.stringify(payload));
    return payload;
  }
}

export async function getStateCompliance() {
  const db = getFirestoreDB();
  if (!db) {
    const local = localStorage.getItem('foundation_local_state_compliance');
    return local ? JSON.parse(local) : { annualReportDueDate: '2026-06-01', franchiseTaxDueDate: '2026-05-15', stateFilingStatus: 'Good Standing' };
  }

  try {
    const docRef = doc(db, 'settings', 'compliance');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (err) {
    console.warn('[DB]: Firestore compliance read error. Falling back to LocalStorage.', err.message);
  }

  const local = localStorage.getItem('foundation_local_state_compliance');
  return local ? JSON.parse(local) : { annualReportDueDate: '2026-06-01', franchiseTaxDueDate: '2026-05-15', stateFilingStatus: 'Good Standing' };
}

function getLocalInvoices() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_invoices') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalInvoices(invoices) {
  localStorage.setItem('foundation_local_invoices', JSON.stringify(invoices));
}

function getLocalExpenses() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_expenses') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalExpenses(expenses) {
  localStorage.setItem('foundation_local_expenses', JSON.stringify(expenses));
}

function getLocalPayroll() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_payroll') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalPayroll(payroll) {
  localStorage.setItem('foundation_local_payroll', JSON.stringify(payroll));
}

function getLocalBudgets() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_budgets') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalBudgets(budgets) {
  localStorage.setItem('foundation_local_budgets', JSON.stringify(budgets));
}

function getLocalEmployees() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_employees') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalEmployees(employees) {
  localStorage.setItem('foundation_local_employees', JSON.stringify(employees));
}

export async function getFinanceTelemetry() {
  const invoices = await getAllInvoices();
  const paidInvoices = invoices.filter(i => i.status === 'paid' || i.status === 'Paid');
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (Number(i.amountUSD || i.amount || 0)), 0);

  const expenses = await getExpenses();
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount || 0)), 0);

  return {
    totalRevenue,
    totalExpenses,
    balanceUSD: Math.max(0, totalRevenue - totalExpenses),
    invoiceCount: invoices.length,
    paidCount: paidInvoices.length
  };
}
