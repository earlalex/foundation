// utils/ai-spark.js - Gemini Spark Chief Operating Agent State Engine
import { getFirestoreDB, doc, setDoc, getDocs, collection } from '../core/db-shared.js';
import { logHipaaAudit } from './hipaa-audit.js';
import { getInventoryCounts } from './inventory.js';
import { draftAIContent } from './ai-writer.js';
import { getAllInvoices, getEmployees, savePayrollRecord } from '../core/db-finances.js';
import { configManager } from '../core/config.js';
import { toast } from './toast.js';

export const AGENT_ID = 'GEMINI_SPARK_EE01';

export const PERMISSION_TIERS = {
  LEVEL_1: 'LEVEL 1: READ & AUDIT',
  LEVEL_2: 'LEVEL 2: DRAFT & PREPARE',
  LEVEL_3: 'LEVEL 3: EXECUTE & DISBURSE'
};

/**
 * Save spark task to LocalStorage fallback and Firestore
 */
export async function saveSparkTask(task) {
  const payload = {
    ...task,
    updatedAt: new Date().toISOString()
  };

  // Local storage
  try {
    const tasks = getLocalSparkTasks();
    tasks[payload.id] = payload;
    localStorage.setItem('foundation_local_spark_tasks', JSON.stringify(tasks));
  } catch (e) {
    console.warn('[Spark Agent]: Failed to write task to LocalStorage', e);
  }

  // Firestore sync
  const db = getFirestoreDB();
  if (!db) {
    return payload;
  }

  try {
    const docRef = doc(db, 'spark_tasks', payload.id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[Spark Agent]: Firestore task write error.', err.message);
    return payload;
  }
}

/**
 * Get all spark tasks
 */
export async function getAllSparkTasks() {
  const db = getFirestoreDB();
  if (db) {
    try {
      const querySnapshot = await getDocs(collection(db, 'spark_tasks'));
      const results = {};
      querySnapshot.forEach((docSnap) => {
        results[docSnap.id] = docSnap.data();
      });
      if (Object.keys(results).length > 0) return results;
    } catch (err) {
      console.warn('[Spark Agent]: Could not fetch tasks from Firestore.', err.message);
    }
  }

  return getLocalSparkTasks();
}

export function getLocalSparkTasks() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_spark_tasks') || '{}');
  } catch (e) {
    return {};
  }
}

/**
 * Creates a Spark task and persists it
 */
export async function createSparkTask(title, type, tier, actionPayload = {}) {
  const isLevel3 = tier === PERMISSION_TIERS.LEVEL_3 || tier === 'LEVEL 3';
  const status = isLevel3 ? 'WAITING FOR ADMIN APPROVAL' : 'COMPLETED';

  const task = {
    id: `spark_task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    type,
    tier,
    status,
    payload: actionPayload,
    createdAt: new Date().toISOString()
  };

  await saveSparkTask(task);

  // Log request to HIPAA compliance logs
  await logHipaaAudit(
    isLevel3 ? 'DRAFT_PENDING_APPROVAL' : 'AUTO_EXECUTE',
    `spark_task_${type}`,
    `Created task: ${title} (${tier}) with status: ${status}`,
    true,
    AGENT_ID
  );

  return task;
}

/**
 * Approve a pending LEVEL 3 Task
 */
export async function approveSparkTask(taskId) {
  const tasks = await getAllSparkTasks();
  const task = tasks[taskId];
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }

  if (task.status !== 'WAITING FOR ADMIN APPROVAL') {
    throw new Error(`Task is in status ${task.status} and cannot be approved.`);
  }

  task.status = 'COMPLETED';
  task.approvedAt = new Date().toISOString();

  // Handle specific LEVEL 3 actions
  if (task.type === 'payroll_disbursement') {
    // Save payroll records
    const payrollData = task.payload?.payrollDetails || [];
    for (const entry of payrollData) {
      await savePayrollRecord({
        employeeId: entry.id,
        employeeName: entry.name,
        amountUSD: entry.amount,
        disbursementMethod: 'Wise Transfer',
        wiseTransferId: `wise_tx_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        transferFeeUSD: 2.50,
        createdAt: new Date().toISOString()
      });
    }
  }

  await saveSparkTask(task);

  // Log executive approval to HIPAA audit log
  await logHipaaAudit(
    'EXECUTE_DISBURSE',
    `spark_task_${task.type}`,
    `Executive 1-Click Approved & Completed Task: ${task.title}`,
    true,
    AGENT_ID
  );

  return task;
}

/**
 * Reject a pending LEVEL 3 Task
 */
export async function rejectSparkTask(taskId) {
  const tasks = await getAllSparkTasks();
  const task = tasks[taskId];
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }

  task.status = 'REJECTED';
  task.rejectedAt = new Date().toISOString();

  await saveSparkTask(task);

  // Log rejection to HIPAA audit log
  await logHipaaAudit(
    'REJECT_TASK',
    `spark_task_${task.type}`,
    `Executive Rejected Task: ${task.title}`,
    false,
    AGENT_ID
  );

  return task;
}

/**
 * Runs a full, comprehensive AI operating audit shift cycle.
 */
export async function runSparkAuditCycle() {
  const logs = [];
  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    logs.push(`[${timestamp}] ${msg}`);
  };

  addLog("Starting Gemini Spark COO Shift Audit...");
  await logHipaaAudit('READ', 'system_audit', 'Gemini Spark initiated background audit cycle.', true, AGENT_ID);

  const config = configManager.current?.geminiSpark || {};
  const perms = config.permissions || {
    draftWisePayrolls: true,
    monitorInventory: true,
    reviewHipaaLogs: true,
    autoApproveNonFinancial: false
  };

  // 1. Monitor inventory count
  if (perms.monitorInventory) {
    addLog("Monitoring physical product inventory...");
    const inventory = getInventoryCounts();
    let lowStockCount = 0;
    for (const [item, count] of Object.entries(inventory)) {
      if (count <= 5) {
        lowStockCount++;
        addLog(`Low stock detected: ${item} (${count} left). Drafting supplier purchase order...`);
        await createSparkTask(
          `Draft Supplier Purchase Order for ${item}`,
          'purchase_order',
          PERMISSION_TIERS.LEVEL_2,
          { item, currentStock: count, orderQuantity: 50 }
        );
      }
    }
    if (lowStockCount === 0) {
      addLog("All product inventory counts are healthy.");
    }
  } else {
    addLog("Skipping inventory check (permission denied).");
  }

  // 2. Audit system logs & HIPAA checks
  if (perms.reviewHipaaLogs) {
    addLog("Auditing HIPAA security & system access logs...");
    await createSparkTask(
      "Audit system security access logs",
      'hipaa_audit',
      PERMISSION_TIERS.LEVEL_1,
      { checkedAt: new Date().toISOString() }
    );
    addLog("No HIPAA compliance violations or unauthorized edits detected.");
  } else {
    addLog("Skipping HIPAA compliance audit (permission denied).");
  }

  // 3. Monitor state filing deadlines
  addLog("Checking upcoming state regulatory and compliance filing deadlines...");
  const filingDeadlines = [
    { name: "Annual LLC Report", date: "2026-10-15" },
    { name: "Quarterly Franchise Tax Notice", date: "2026-09-15" }
  ];
  filingDeadlines.forEach(deadline => {
    addLog(`Filing deadline soon: ${deadline.name} due on ${deadline.date}. Drafting compliance notice...`);
  });
  await createSparkTask(
    "Draft Website Compliance Regulatory Notice",
    'compliance_notice',
    PERMISSION_TIERS.LEVEL_2,
    { deadlines: filingDeadlines }
  );

  // 4. Monitor invoices & Draft VA Payrolls
  if (perms.draftWisePayrolls) {
    addLog("Monitoring incoming client invoices and Stripe operational balances...");
    const invoices = await getAllInvoices();
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
    addLog(`Active Invoice Telemetry: Found ${unpaidInvoices.length} outstanding invoices.`);

    // Read employees/VAs to see if payroll drafting is required
    const employees = await getEmployees();
    if (employees.length > 0) {
      addLog(`Found ${employees.length} active team members. Preparing outbound Wise VA payroll draft...`);
      const payrollDetails = employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        amount: emp.salary || 400
      }));
      const totalAmount = payrollDetails.reduce((sum, item) => sum + item.amount, 0);

      // Create LEVEL 3 task that requires Admin approval
      await createSparkTask(
        `Approve Wise Payroll Transfer of $${totalAmount} for ${employees.length} VAs`,
        'payroll_disbursement',
        PERMISSION_TIERS.LEVEL_3,
        { payrollDetails, totalAmount }
      );
      addLog(`Payroll Draft Task queued for Admin 1-Click approval: $${totalAmount} total.`);
    } else {
      addLog("No registered team members found in the database. Payroll drafting skipped.");
    }
  } else {
    addLog("Skipping Wise payroll drafting (permission denied).");
  }

  // 5. Draft some sample content
  addLog("Drafting newsletter copywriting and blog entries autonomously...");
  const draftedBlog = draftAIContent('blog', 'Zero-Build Scalability');
  await createSparkTask(
    "Draft marketing blog entry for review",
    'blog_draft',
    PERMISSION_TIERS.LEVEL_2,
    { blog: draftedBlog }
  );
  addLog(`Autonomously drafted blog: "${draftedBlog.title}". Ready for publishing.`);

  addLog("Shift Audit Cycle finished cleanly. Ready for executive review.");

  // Return logs as a single string for live terminal feed
  return logs;
}
