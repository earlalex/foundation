// utils/snapshotEngine.js
import { configManager } from '../core/config.js';
import { contentDB } from '../core/db.js';
import { saveAssetSplits } from '../core/royalties.js';
import { errorHandler } from '../core/error-handler.js';
import { store } from '../core/store.js';

/**
 * Captures the complete current state of the platform as a snapshot
 * @param {string} label - Snapshot label (e.g. 'Manual Backup', 'Automated Monthly Backup')
 * @returns {Promise<Object>} The generated snapshot object
 */
export async function createSiteSnapshot(label = 'Manual Backup') {
  console.log(`[SnapshotEngine]: Starting site state snapshot creation for: "${label}"...`);
  try {
    // 1. Capture Config
    const config = { ...configManager.current };

    // 2. Capture Pages & Content
    const pages = await contentDB.getAllCustomPages();
    const content = await contentDB.getAllContent();

    // 3. Capture Splits (Local + Firestore)
    const splits = {};
    try {
      const { getFirestoreDB, collection, getDocs } = await import('../core/db-shared.js');
      const db = getFirestoreDB();
      if (db) {
        const querySnapshot = await getDocs(collection(db, 'splits'));
        querySnapshot.forEach(docSnap => {
          splits[docSnap.id] = docSnap.data();
        });
      }
    } catch (e) {
      console.warn('[SnapshotEngine]: Firestore splits snapshot query bypassed.', e.message);
    }
    const localSplits = JSON.parse(localStorage.getItem('foundation_local_splits') || '{}');
    Object.entries(localSplits).forEach(([k, v]) => {
      if (!splits[k]) splits[k] = v;
    });

    // 4. Capture Employee Ledgers & Finances
    const employees = await contentDB.getEmployees();
    const payroll = await contentDB.getPayrollRecords();
    const expenses = await contentDB.getExpenses();
    const budgets = await contentDB.getBudgets();

    // 5. Capture Theme & Custom Brand Tokens
    const theme = JSON.parse(localStorage.getItem('foundation_theme_config') || '{}');
    const customTheme = JSON.parse(localStorage.getItem('foundation_theme_custom') || '{}');
    const highContrast = localStorage.getItem('foundation_high_contrast') || 'false';

    const stateData = {
      config,
      pages,
      content,
      splits,
      employees,
      payroll,
      expenses,
      budgets,
      theme,
      customTheme,
      highContrast
    };

    const payloadStr = JSON.stringify(stateData);
    const sizeBytes = new Blob([payloadStr]).size;

    const snapshot = {
      id: `snap_${Date.now()}`,
      timestamp: new Date().toISOString(),
      label,
      author: store.state.user?.email || 'admin@earlalex.com',
      size: formatBytes(sizeBytes),
      data: stateData
    };

    // Upload to Google Drive
    let archivedToDrive = false;
    try {
      const { getGoogleAccessToken } = await import('../core/google-services.js');
      const token = await getGoogleAccessToken(false);
      if (token) {
        const siteName = configManager.current?.siteTitle || configManager.current?.site?.siteName || 'Foundation';
        const formattedDate = new Date().toISOString().split('T')[0];
        const fileName = `${formattedDate}_snapshot.json`;
        const { uploadBackupToDrive } = await import('./backend-google.js');
        const driveRes = await uploadBackupToDrive(token, siteName, fileName, payloadStr);
        if (driveRes && driveRes.id) {
          archivedToDrive = true;
          console.log(`[SnapshotEngine]: Securely archived JSON backup to Google Drive folder: [Site Name] / Backups / ${fileName}`);
        }
      }
    } catch (driveErr) {
      console.warn('[SnapshotEngine]: Google Drive upload deferred or offline:', driveErr.message);
    }

    snapshot.archivedToDrive = archivedToDrive;

    // Save locally
    const existingSnapshots = JSON.parse(localStorage.getItem('foundation_snapshots') || '[]');
    existingSnapshots.unshift(snapshot);
    localStorage.setItem('foundation_snapshots', JSON.stringify(existingSnapshots));

    console.log(`[SnapshotEngine]: Snapshot "${label}" created successfully (${snapshot.size}). Drive archived: ${archivedToDrive}`);
    return snapshot;
  } catch (err) {
    errorHandler.handleError(err, 'Create Snapshot');
    throw err;
  }
}

/**
 * Restores the complete configuration and database state to a specific snapshot version
 * @param {Object} snapshot - Snapshot object to restore
 * @returns {Promise<boolean>} Success confirmation
 */
export async function restoreSiteSnapshot(snapshot) {
  if (!snapshot || !snapshot.data) {
    throw new Error('[SnapshotEngine]: Invalid snapshot object provided.');
  }

  console.log(`[SnapshotEngine]: Restoring snapshot "${snapshot.label}" created on ${snapshot.timestamp}...`);

  try {
    // 1. Non-Destructive Rollback Check: Auto-generate Pre-Rollback Backup snapshot first
    console.log('[SnapshotEngine]: Creating temporary Pre-Rollback Backup safeguard snapshot...');
    await createSiteSnapshot('Pre-Rollback Backup');

    const { config, pages, content, splits, employees, payroll, expenses, budgets, theme, customTheme, highContrast } = snapshot.data;

    const { getFirestoreDB, collection, getDocs, doc, deleteDoc } = await import('../core/db-shared.js');
    const db = getFirestoreDB();

    // Step A: Restore all snapshot records FIRST to guarantee data integrity before deleting any obsolete records
    // 2. Restore Custom Pages
    if (Array.isArray(pages)) {
      for (const page of pages) {
        await contentDB.saveCustomPage(page);
      }
    }

    // 3. Restore Content Entries
    if (Array.isArray(content)) {
      for (const c of content) {
        await contentDB.saveContent(c);
      }
    }

    // 4. Restore Royalty Splits
    if (splits) {
      for (const [assetId, splitObj] of Object.entries(splits)) {
        if (splitObj && splitObj.splits) {
          await saveAssetSplits(assetId, splitObj.assetType || 'article', splitObj.splits);
        }
      }
    }

    // 5. Restore Employee Ledgers
    if (Array.isArray(employees)) {
      for (const emp of employees) {
        await contentDB.saveEmployee(emp);
      }
    }

    // 6. Restore Payroll Records
    if (Array.isArray(payroll)) {
      for (const pr of payroll) {
        await contentDB.savePayrollRecord(pr);
      }
    }

    // 7. Restore Expense Records
    if (Array.isArray(expenses)) {
      for (const exp of expenses) {
        await contentDB.saveExpense(exp);
      }
    }

    if (budgets) {
      await contentDB.saveBudgetTargets(budgets);
    }

    // 8. Restore configManager
    if (config) {
      await configManager.saveToFirebase(config);
    }

    // Step B: ONLY after all snapshot restorations succeed, purge post-snapshot records created after snapshot
    const snapshotPageIds = new Set((pages || []).map(p => p.id || p.slug));
    try {
      const currentPages = await contentDB.getAllCustomPages();
      for (const p of currentPages) {
        if (!snapshotPageIds.has(p.id) && !snapshotPageIds.has(p.slug)) {
          if (db) {
            try { await deleteDoc(doc(db, 'pages', p.id || p.slug)); } catch (e) {}
          }
        }
      }
      const localPages = JSON.parse(localStorage.getItem('foundation_local_pages') || '{}');
      Object.keys(localPages).forEach(k => {
        if (!snapshotPageIds.has(k)) delete localPages[k];
      });
      localStorage.setItem('foundation_local_pages', JSON.stringify(localPages));
    } catch (e) {
      console.warn('[SnapshotEngine]: Pages purge warning:', e.message);
    }

    const snapshotContentIds = new Set((content || []).map(c => c.id));
    try {
      const currentContent = await contentDB.getAllContent();
      for (const c of currentContent) {
        if (c.id && !snapshotContentIds.has(c.id)) {
          await contentDB.deleteContent(c.id);
        }
      }
    } catch (e) {
      console.warn('[SnapshotEngine]: Content purge warning:', e.message);
    }

    const snapshotSplitKeys = new Set(Object.keys(splits || {}));
    try {
      const localSplits = JSON.parse(localStorage.getItem('foundation_local_splits') || '{}');
      Object.keys(localSplits).forEach(k => {
        if (!snapshotSplitKeys.has(k)) delete localSplits[k];
      });
      localStorage.setItem('foundation_local_splits', JSON.stringify(localSplits));

      if (db) {
        const querySnapshot = await getDocs(collection(db, 'splits'));
        for (const docSnap of querySnapshot.docs) {
          if (!snapshotSplitKeys.has(docSnap.id)) {
            try { await deleteDoc(doc(db, 'splits', docSnap.id)); } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.warn('[SnapshotEngine]: Splits purge warning:', e.message);
    }

    const snapshotEmpIds = new Set((employees || []).map(e => e.id));
    try {
      const currentEmployees = await contentDB.getEmployees();
      for (const emp of currentEmployees) {
        if (emp.id && !snapshotEmpIds.has(emp.id)) {
          await contentDB.deleteEmployee(emp.id);
        }
      }
    } catch (e) {
      console.warn('[SnapshotEngine]: Employee purge warning:', e.message);
    }

    const snapshotPayrollIds = new Set((payroll || []).map(p => p.id));
    try {
      const localPayroll = JSON.parse(localStorage.getItem('foundation_local_payroll') || '{}');
      Object.keys(localPayroll).forEach(k => {
        if (!snapshotPayrollIds.has(k)) delete localPayroll[k];
      });
      localStorage.setItem('foundation_local_payroll', JSON.stringify(localPayroll));

      if (db) {
        const querySnapshot = await getDocs(collection(db, 'finances_payroll'));
        for (const docSnap of querySnapshot.docs) {
          if (!snapshotPayrollIds.has(docSnap.id)) {
            try { await deleteDoc(doc(db, 'finances_payroll', docSnap.id)); } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.warn('[SnapshotEngine]: Payroll purge warning:', e.message);
    }

    const snapshotExpenseIds = new Set((expenses || []).map(e => e.id));
    try {
      const localExpenses = JSON.parse(localStorage.getItem('foundation_local_expenses') || '{}');
      Object.keys(localExpenses).forEach(k => {
        if (!snapshotExpenseIds.has(k)) delete localExpenses[k];
      });
      localStorage.setItem('foundation_local_expenses', JSON.stringify(localExpenses));

      if (db) {
        const querySnapshot = await getDocs(collection(db, 'finances_expenses'));
        for (const docSnap of querySnapshot.docs) {
          if (!snapshotExpenseIds.has(docSnap.id)) {
            try { await deleteDoc(doc(db, 'finances_expenses', docSnap.id)); } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.warn('[SnapshotEngine]: Expense purge warning:', e.message);
    }

    // 7. Restore Theme settings & Custom Tokens
    if (theme && Object.keys(theme).length > 0) {
      localStorage.setItem('foundation_theme_config', JSON.stringify(theme));
    }
    if (customTheme && Object.keys(customTheme).length > 0) {
      localStorage.setItem('foundation_theme_custom', JSON.stringify(customTheme));
    }
    if (highContrast !== undefined) {
      localStorage.setItem('foundation_high_contrast', String(highContrast));
    }

    console.log('[SnapshotEngine]: Site state fully restored to chosen snapshot.');
    return true;
  } catch (err) {
    errorHandler.handleError(err, 'Restore Snapshot');
    throw err;
  }
}

/**
 * Format bytes helper
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Checks if the current day matches the configured automated snapshot day
 * and triggers a silent monthly backup in the background if missing.
 */
export async function checkAndTriggerMonthlySnapshot() {
  try {
    const isInstalled = configManager.current?.isInstalled === true;
    if (!isInstalled) return;

    const daySetting = configManager.current?.monthlySnapshotDay || 1;
    const today = new Date().getDate();

    if (Number(today) >= Number(daySetting)) {
      // Check if a backup for the current month is already made
      const snapshots = JSON.parse(localStorage.getItem('foundation_snapshots') || '[]');
      const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

      const hasBackupThisMonth = snapshots.some(snap =>
        snap.timestamp && snap.timestamp.startsWith(currentYearMonth) && snap.label === 'Automated Monthly Backup'
      );

      if (!hasBackupThisMonth) {
        console.log('[SnapshotEngine]: Automated monthly backup day reached or overdue and current month snapshot is missing. Creating silent background backup...');
        await createSiteSnapshot('Automated Monthly Backup');
      } else {
        console.log('[SnapshotEngine]: Automated monthly backup already exists for current month. Skipping.');
      }
    }
  } catch (err) {
    console.warn('[SnapshotEngine]: Failed checking automated monthly backup:', err.message);
  }
}
