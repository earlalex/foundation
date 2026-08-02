// tests/spark.test.js - Gemini Spark COO Agent Test Suite
import { configManager } from '../core/config.js';
import {
  createSparkTask,
  approveSparkTask,
  rejectSparkTask,
  runSparkAuditCycle,
  getAllSparkTasks,
  PERMISSION_TIERS,
  AGENT_ID
} from '../utils/ai-spark.js';
import { encryptPHI, decryptPHI, getLocalHipaaLogs } from '../utils/hipaa-audit.js';
import { getInventoryCounts, updateInventoryCount } from '../utils/inventory.js';
import { getEmployees, saveEmployee } from '../core/db-finances.js';

export async function runSparkTests() {
  console.group('%c⚡ Gemini Spark COO Agent Tests', 'color: #805ad5; font-weight: bold;');

  try {
    // Test 1: AES-GCM 256-bit HIPAA compliant Encryption & Decryption
    const sensitivePHI = "Patient Jane Doe, DOB: 1980-01-01, Diagnosis: Chronic systems optimization.";
    const key = "MySecretHIPAAKey2026!!!!";
    const encrypted = await encryptPHI(sensitivePHI, key);

    if (!encrypted) throw new Error("Encryption failed: returned empty string");
    if (encrypted === sensitivePHI) throw new Error("Encryption failed: cipher matches plain text");

    const decrypted = await decryptPHI(encrypted, key);
    if (decrypted !== sensitivePHI) throw new Error("Decryption failed: plain text mismatch");

    console.log('%c  PASS: AES-GCM 256-bit HIPAA compliance encryption & decryption works', 'color: #38a169; font-weight: bold;');

    // Test 2: Spark Task State Engine & Permission Level Constraints
    // Clear spark tasks locally
    localStorage.removeItem('foundation_local_spark_tasks');

    // LEVEL 1: Read & Audit should execute & complete autonomously
    const t1 = await createSparkTask("Daily HIPAA Logs Check", "hipaa_audit", PERMISSION_TIERS.LEVEL_1);
    if (t1.status !== 'COMPLETED') throw new Error(`LEVEL 1 Task status should be COMPLETED, got ${t1.status}`);

    // LEVEL 3: Capital disbursement should require Admin approval (waiting status)
    const t3 = await createSparkTask("Disburse Payouts to 3 VAs", "payroll_disbursement", PERMISSION_TIERS.LEVEL_3, {
      payrollDetails: [{ id: 'emp_va_1', name: 'John Doe VA', amount: 500 }]
    });
    if (t3.status !== 'WAITING FOR ADMIN APPROVAL') {
      throw new Error(`LEVEL 3 Task status should be WAITING FOR ADMIN APPROVAL, got ${t3.status}`);
    }

    console.log('%c  PASS: Spark task creation enforces explicit permission tier status', 'color: #38a169; font-weight: bold;');

    // Test 3: Approve LEVEL 3 Task
    // Seed employee to test payroll save on approval
    await saveEmployee({ id: 'emp_va_1', name: 'John Doe VA', salary: 500 });

    const approved = await approveSparkTask(t3.id);
    if (approved.status !== 'COMPLETED') throw new Error(`Approved task status should be COMPLETED, got ${approved.status}`);
    if (!approved.approvedAt) throw new Error("Approved task should have approvedAt timestamp");

    // Verify HIPAA log was created
    const hipaaLogs = getLocalHipaaLogs();
    const executeLog = hipaaLogs.find(l => l.action === 'EXECUTE_DISBURSE' && l.agentId === AGENT_ID);
    if (!executeLog) throw new Error("Approval action was not logged in HIPAA compliance logs under agentId: " + AGENT_ID);

    console.log('%c  PASS: 1-Click Executive approval dispatches capital & logs to HIPAA with AGENT_ID', 'color: #38a169; font-weight: bold;');

    // Test 4: Reject LEVEL 3 Task
    const t3_reject = await createSparkTask("Delete Firestore collection", "db_alteration", PERMISSION_TIERS.LEVEL_3);
    const rejected = await rejectSparkTask(t3_reject.id);
    if (rejected.status !== 'REJECTED') throw new Error(`Rejected task status should be REJECTED, got ${rejected.status}`);
    if (!rejected.rejectedAt) throw new Error("Rejected task should have rejectedAt timestamp");

    console.log('%c  PASS: Executive task rejection works & persists state cleanly', 'color: #38a169; font-weight: bold;');

    // Test 5: Full Autonomous Shift Audit Cycle
    // Enforce configurations
    configManager.current.geminiSpark = {
      apiKey: "test_spark_key",
      frequency: "Hourly",
      autonomyMode: "Strict Approval Mode",
      permissions: {
        draftWisePayrolls: true,
        monitorInventory: true,
        reviewHipaaLogs: true,
        autoApproveNonFinancial: false
      }
    };

    // Update inventory to trigger a drafted purchase order task
    updateInventoryCount("Handmade Wooden Coaster", 2); // Stock is 2 (<= 5 low stock trigger)

    const shiftTerminalLogs = await runSparkAuditCycle();

    // Check if tasks were created
    const activeTasks = await getAllSparkTasks();
    const taskValues = Object.values(activeTasks);

    const draftedPO = taskValues.find(t => t.type === 'purchase_order');
    if (!draftedPO) throw new Error("Shift cycle failed to draft purchase order for low-stock handmade item");

    const draftedCompliance = taskValues.find(t => t.type === 'compliance_notice');
    if (!draftedCompliance) throw new Error("Shift cycle failed to draft state compliance filing deadlines notice");

    const draftedPayroll = taskValues.find(t => t.type === 'payroll_disbursement' && t.status === 'WAITING FOR ADMIN APPROVAL');
    if (!draftedPayroll) throw new Error("Shift cycle failed to draft payroll disbursement for active VAs");

    console.log('%c  PASS: Autonomous shift audit monitors metrics & drafts low-stock POs and VA payrolls', 'color: #38a169; font-weight: bold;');

    console.log('%c  Spark Test Summary: All Tests Passed ✅', 'font-size: 13px; font-weight: bold; color: #38a169;');

  } catch (err) {
    console.error('%c  FAIL: Spark COO test suite failed:', 'color: #e53e3e; font-weight: bold;', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}
