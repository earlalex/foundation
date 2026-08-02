// pages/admin/modules/admin-spark.js - Gemini Spark COO Tab Controller & UI Dashboard
import { configManager } from '../../../core/config.js';
import { toast } from '../../../utils/toast.js';
import {
  getAllSparkTasks,
  approveSparkTask,
  rejectSparkTask,
  runSparkAuditCycle,
  PERMISSION_TIERS
} from '../../../utils/ai-spark.js';

export async function initAdminSpark() {
  console.log('[Admin Spark Module]: Initializing...');
  const panel = document.getElementById('tab-spark');
  if (!panel) {
    console.warn('[Admin Spark]: tab-spark panel container not found in document.');
    return;
  }

  // Load and render UI
  await renderSparkDashboard(panel);
}

/**
 * Main render function
 */
async function renderSparkDashboard(container) {
  const cfg = configManager.current?.geminiSpark || {
    apiKey: '',
    frequency: 'Daily Audit',
    autonomyMode: 'Strict Approval Mode',
    permissions: {
      draftWisePayrolls: true,
      monitorInventory: true,
      reviewHipaaLogs: true,
      autoApproveNonFinancial: false
    }
  };

  const tasks = await getAllSparkTasks();
  const taskList = Object.values(tasks).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const pendingApprovals = taskList.filter(t => t.status === 'WAITING FOR ADMIN APPROVAL');
  const completedTasks = taskList.filter(t => t.status !== 'WAITING FOR ADMIN APPROVAL');

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: system-ui, sans-serif; color: #1a202c; padding: 1.5rem;">

      <!-- Header Banner Card -->
      <div style="background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%); color: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem;">
            <span style="font-size: 2rem;">⚡</span>
            <h2 style="margin: 0; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.025em; color: #fff;">Gemini Spark (COO)</h2>
            <span style="background: #38a169; color: white; font-size: 0.75rem; padding: 2px 8px; border-radius: 20px; font-weight: bold;">Active Employee #1</span>
          </div>
          <p style="margin: 0; color: #cbd5e0; font-size: 0.95rem; max-width: 600px;">
            Your autonomous 24/7 Chief Operating Officer. Monitors physical product inventory, drafts Wise international contractor payrolls, audits HIPAA compliant security logs, and prepares marketing copy drafts.
          </p>
        </div>
        <div style="text-align: right;">
          <button id="btn-spark-run-shift" class="btn-primary" style="background: #3182ce; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: background 0.2s;">
            ⚙️ Trigger Background Shift Run
          </button>
        </div>
      </div>

      <!-- Main Layout Columns -->
      <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;" class="spark-main-grid">

        <!-- Left: Active Shift Log Feed Terminal -->
        <div style="background: #0f172a; border-radius: 8px; border: 1px solid #1e293b; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #38bdf8; font-family: monospace; font-size: 1.1rem; display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite;"></span>
              Live Shift Activity Terminal
            </h3>
            <span style="font-size: 0.75rem; color: #64748b; font-family: monospace;">Gemini-1.5-Flash Pro Engine</span>
          </div>
          <div id="spark-terminal-feed" style="background: #020617; border: 1px solid #1e293b; border-radius: 6px; padding: 1rem; height: 250px; overflow-y: auto; color: #38bdf8; font-family: monospace; font-size: 0.85rem; line-height: 1.6; text-align: left; scroll-behavior: smooth;">
            <p style="color: #64748b;">[00:00:01] System boot complete. Spark COO loaded in standby mode...</p>
            <p style="color: #64748b;">[00:00:02] Autonomy Level: ${cfg.autonomyMode || 'Strict Approval Mode'}</p>
            <p style="color: #64748b;">[00:00:03] Pending task queue length: ${pendingApprovals.length}</p>
            <p style="color: #22c55e;">[Ready] Click "Trigger Background Shift Run" to run active audits...</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1.25fr; gap: 1.5rem;" class="spark-sub-grid">

          <!-- Column 1: Pending Approvals Queue -->
          <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: bold; color: #2d3748; display: flex; align-items: center; gap: 8px;">
              ⚠️ Pending Executive Approvals Queue
              <span style="background: #e53e3e; color: white; font-size: 0.75rem; padding: 2px 6px; border-radius: 10px; font-weight: bold;">
                ${pendingApprovals.length}
              </span>
            </h3>
            <p style="font-size: 0.825rem; color: #718096; margin: 0;">
              High-contrast queue containing actions that require the Admin's explicit, 1-Click signature to disburse capital or permanently delete records.
            </p>

            <div id="spark-approvals-container" style="display: flex; flex-direction: column; gap: 1rem; max-height: 380px; overflow-y: auto; padding-right: 4px;">
              ${pendingApprovals.length === 0 ? `
                <div style="text-align: center; padding: 2rem; color: #a0aec0; border: 2px dashed #edf2f7; border-radius: 8px;">
                  <div style="font-size: 2rem; margin-bottom: 0.5rem;">☕</div>
                  <strong style="font-size: 0.9rem; display: block; color: #718096;">All Clean & Secure</strong>
                  <span style="font-size: 0.8rem;">No transactions are currently awaiting executive sign-off.</span>
                </div>
              ` : pendingApprovals.map(task => `
                <div class="card" style="background: #fffaf0; border: 1px solid #fbd38d; padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; gap: 0.75rem; text-align: left; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                  <div>
                    <span style="font-size: 0.75rem; background: #dd6b20; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">
                      ${task.tier}
                    </span>
                    <strong style="display: block; font-size: 0.95rem; color: #2d3748; margin-top: 0.5rem;">
                      ${task.title}
                    </strong>
                    <span style="font-size: 0.75rem; color: #a0aec0; display: block; margin-top: 2px;">
                      Triggered: ${new Date(task.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.25rem;">
                    <button class="btn-spark-reject" data-id="${task.id}" style="padding: 6px 12px; background: #fff; border: 1px solid #fc8181; color: #c53030; font-weight: bold; border-radius: 4px; font-size: 0.8rem; cursor: pointer; transition: background 0.1s;">
                      ❌ Reject
                    </button>
                    <button class="btn-spark-approve" data-id="${task.id}" style="padding: 6px 14px; background: #2f855a; color: white; border: none; font-weight: bold; border-radius: 4px; font-size: 0.8rem; cursor: pointer; transition: background 0.1s;">
                      ✅ Approve & Disburse
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Column 2: Autonomy Settings & Recent Tasks Feed -->
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">

            <!-- Agent Info & Autonomy card -->
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 1.5rem; text-align: left; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: bold; color: #2d3748;">⚡ Agent Profile & Permissions</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.85rem; margin-bottom: 1rem;">
                <div>
                  <strong style="color: #718096; display: block;">Shifts Frequency:</strong>
                  <span style="font-weight: bold; color: #2d3748;">${cfg.frequency || 'Daily Audit'}</span>
                </div>
                <div>
                  <strong style="color: #718096; display: block;">Autonomy Mode:</strong>
                  <span style="font-weight: bold; color: #2d3748;">${cfg.autonomyMode || 'Strict Approval Mode'}</span>
                </div>
              </div>

              <strong style="font-size: 0.8rem; text-transform: uppercase; color: #718096; display: block; margin-bottom: 0.5rem; letter-spacing: 0.5px;">Active Permissions:</strong>
              <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.825rem; color: #4a5568;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="color: ${cfg.permissions?.draftWisePayrolls ? '#38a169' : '#a0aec0'}; font-weight: bold;">✔</span>
                  <span>Draft International Wise Contractor Payrolls</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="color: ${cfg.permissions?.monitorInventory ? '#38a169' : '#a0aec0'}; font-weight: bold;">✔</span>
                  <span>Monitor Handmade Product Stock</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="color: ${cfg.permissions?.reviewHipaaLogs ? '#38a169' : '#a0aec0'}; font-weight: bold;">✔</span>
                  <span>Daily Audit of HIPAA access logs</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="color: ${cfg.permissions?.autoApproveNonFinancial ? '#38a169' : '#a0aec0'}; font-weight: bold;">✔</span>
                  <span>Auto-Approve Non-Financial Actions</span>
                </div>
              </div>
            </div>

            <!-- Recent Background Activities list -->
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 1.5rem; text-align: left; box-shadow: 0 4px 6px rgba(0,0,0,0.05); flex: 1;">
              <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: bold; color: #2d3748;">Recent Tasks Log</h3>
              <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto; padding-right: 4px;">
                ${completedTasks.length === 0 ? `
                  <span style="font-size: 0.85rem; color: #cbd5e0;">No previous background activities executed yet.</span>
                ` : completedTasks.map(task => `
                  <div style="padding: 0.75rem; border-radius: 6px; background: #f8fafc; border: 1px solid #edf2f7; display: flex; justify-content: space-between; align-items: center; font-size: 0.825rem; gap: 1rem;">
                    <div>
                      <strong style="display: block; color: #4a5568;">${task.title}</strong>
                      <span style="font-size: 0.75rem; color: #a0aec0;">Completed: ${new Date(task.createdAt).toLocaleString()}</span>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: bold; color: ${task.status === 'REJECTED' ? '#e53e3e' : '#38a169'}; background: ${task.status === 'REJECTED' ? '#fff5f5' : '#f0fdf4'}; padding: 2px 8px; border-radius: 4px; border: 1px solid ${task.status === 'REJECTED' ? '#fed7d7' : '#bbf7d0'}; text-transform: uppercase;">
                      ${task.status}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>

    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: .5; transform: scale(0.9); }
      }
      @media (max-width: 900px) {
        .spark-sub-grid { grid-template-columns: 1fr !important; }
      }
    </style>
  `;

  // Bind Run background cycle button
  const runBtn = container.querySelector('#btn-spark-run-shift');
  if (runBtn) {
    runBtn.onclick = async () => {
      runBtn.disabled = true;
      runBtn.textContent = '⚙️ Executing Shift Audit...';
      const term = container.querySelector('#spark-terminal-feed');
      if (term) {
        term.innerHTML = '<p style="color: #64748b;">[Shift Run] Triggering Gemini Spark COO Shift Audit...</p>';
      }

      try {
        const terminalLogs = await runSparkAuditCycle();
        toast.success('Gemini Spark shift audit finished cleanly!');

        // Re-render UI to pull in drafted tasks
        await renderSparkDashboard(container);

        // Populate and highlight terminal logs
        const updatedTerm = container.querySelector('#spark-terminal-feed');
        if (updatedTerm) {
          updatedTerm.innerHTML = terminalLogs.map(log => {
            let color = '#38bdf8';
            if (log.includes('Low stock detected') || log.includes('Filing deadline soon')) {
              color = '#f59e0b';
            } else if (log.includes('violat') || log.includes('error') || log.includes('failed')) {
              color = '#ef4444';
            } else if (log.includes('complete') || log.includes('finished') || log.includes('Auto-execute')) {
              color = '#10b981';
            }
            return `<p style="color: ${color}; margin: 2px 0;">${log}</p>`;
          }).join('');
          updatedTerm.scrollTop = updatedTerm.scrollHeight;
        }
      } catch (err) {
        toast.error('Background shift failed: ' + err.message);
        await renderSparkDashboard(container);
      }
    };
  }

  // Bind Approve Buttons
  container.querySelectorAll('.btn-spark-approve').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.textContent = 'Disbursing...';
      try {
        await approveSparkTask(id);
        toast.success('Disbursement transaction executed safely!');
        await renderSparkDashboard(container);
      } catch (e) {
        toast.error('Failed to approve disbursement: ' + e.message);
        btn.disabled = false;
        btn.textContent = '✅ Approve & Disburse';
      }
    };
  });

  // Bind Reject Buttons
  container.querySelectorAll('.btn-spark-reject').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.textContent = 'Rejecting...';
      try {
        await rejectSparkTask(id);
        toast.info('Capital transfer task rejected successfully.');
        await renderSparkDashboard(container);
      } catch (e) {
        toast.error('Failed to reject task: ' + e.message);
        btn.disabled = false;
        btn.textContent = '❌ Reject';
      }
    };
  });
}
