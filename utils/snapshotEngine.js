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

    // Save locally
    const existingSnapshots = JSON.parse(localStorage.getItem('foundation_snapshots') || '[]');
    existingSnapshots.unshift(snapshot);
    localStorage.setItem('foundation_snapshots', JSON.stringify(existingSnapshots));

    // Upload to Google Drive
    try {
      const { getGoogleAccessToken } = await import('../core/google-services.js');
      const token = await getGoogleAccessToken(false);
      if (token) {
        const siteName = configManager.current?.siteTitle || configManager.current?.site?.siteName || 'Foundation';
        const formattedDate = new Date().toISOString().split('T')[0];
        const fileName = `${formattedDate}_snapshot.json`;
        const { uploadBackupToDrive } = await import('./backend-google.js');
        await uploadBackupToDrive(token, siteName, fileName, payloadStr);
        console.log(`[SnapshotEngine]: Securely archived JSON backup to Google Drive folder: [Site Name] / Backups / ${fileName}`);
      }
    } catch (driveErr) {
      console.warn('[SnapshotEngine]: Google Drive upload deferred or offline:', driveErr.message);
    }

    console.log(`[SnapshotEngine]: Snapshot "${label}" created successfully (${snapshot.size}).`);
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

    // 2. Restore configManager
    if (config) {
      await configManager.saveToFirebase(config);
    }

    // 3. Restore Custom Pages
    if (Array.isArray(pages)) {
      for (const page of pages) {
        await contentDB.saveCustomPage(page);
      }
    }

    // 4. Restore Content Entries
    if (Array.isArray(content)) {
      for (const c of content) {
        await contentDB.saveContent(c);
      }
    }

    // 5. Restore Royalty Splits
    if (splits) {
      for (const [assetId, splitObj] of Object.entries(splits)) {
        if (splitObj && splitObj.splits) {
          await saveAssetSplits(assetId, splitObj.assetType || 'article', splitObj.splits);
        }
      }
    }

    // 6. Restore Employee Ledgers
    if (Array.isArray(employees)) {
      for (const emp of employees) {
        await contentDB.saveEmployee(emp);
      }
    }
    if (Array.isArray(payroll)) {
      for (const pr of payroll) {
        await contentDB.savePayrollRecord(pr);
      }
    }
    if (Array.isArray(expenses)) {
      for (const exp of expenses) {
        await contentDB.saveExpense(exp);
      }
    }
    if (budgets) {
      await contentDB.saveBudgetTargets(budgets);
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

    if (Number(today) === Number(daySetting)) {
      // Check if a backup for the current month is already made
      const snapshots = JSON.parse(localStorage.getItem('foundation_snapshots') || '[]');
      const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

      const hasBackupThisMonth = snapshots.some(snap =>
        snap.timestamp && snap.timestamp.startsWith(currentYearMonth) && snap.label === 'Automated Monthly Backup'
      );

      if (!hasBackupThisMonth) {
        console.log('[SnapshotEngine]: Automated monthly backup day matched and current month snapshot is missing. Creating silent background backup...');
        await createSiteSnapshot('Automated Monthly Backup');
      } else {
        console.log('[SnapshotEngine]: Automated monthly backup already exists for current month. Skipping.');
      }
    }
  } catch (err) {
    console.warn('[SnapshotEngine]: Failed checking automated monthly backup:', err.message);
  }
}
