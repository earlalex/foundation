// pages/admin/admin-marketing.js - Rebuilt Mautic + Dittofeed Marketing Automation & Dual-Engine template UI
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { sendGmailNotification } from '../../core/google-services.js';
import { marketingEngine } from '../../core/marketingEngine.js';
import { errorHandler } from '../../core/error-handler.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { store } from '../../core/store.js';
import { getFirestore, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let workflows = [];
let segments = [];
let emailTemplates = [];
let currentWorkflow = null;
let currentTemplate = null;

const TRIGGER_TYPES = [
  { id: 'user_registered', label: 'User Sign-up', icon: '👤' },
  { id: 'product_purchased', label: 'Stripe Purchase', icon: '💳' },
  { id: 'appointment_scheduled', label: 'Meet Booking', icon: '📅' },
  { id: 'user_inactive_x_days', label: 'Inactivity Warning', icon: '⏰' },
  { id: 'form_submitted', label: 'Form Submission', icon: '📝' },
  { id: 'membership_canceled', label: 'Membership Canceled', icon: '❌' },
  { id: 'cart_abandoned', label: 'Cart Abandoned', icon: '🛒' }
];

const ACTION_TYPES = [
  { id: 'SEND_GMAIL_TEMPLATE', label: 'Send Email Template', icon: '📧' },
  { id: 'WAIT_DELAY', label: 'Wait Delay', icon: '⏳' },
  { id: 'UPDATE_USER_ROLE', label: 'Update User Role', icon: '🔄' },
  { id: 'SEND_TWILIO_SMS', label: 'Send Twilio SMS', icon: '💬' },
  { id: 'TRIGGER_WEBHOOK', label: 'Trigger Webhook POST', icon: '🔗' },
  { id: 'DECISION_BRANCH', label: 'Decision Branch', icon: '🔀' },
  { id: 'AB_SPLIT_TEST', label: 'A/B Split Testing', icon: '🧪' }
];

export function initMarketingTab() {
  loadWorkflows();
  loadSegments();
  loadEmailTemplates();
  setupWorkflowBuilder();
  setupWorkflowForm();
  setupSegmentBuilder();
  setupEmailEditorTabs();
}

// --- WORKFLOW / JOURNEY BUILDER ---

async function loadWorkflows() {
  try {
    workflows = await contentDB.getMarketingWorkflows();
    renderWorkflowsList();
  } catch (err) {
    errorHandler.handleError(err, 'Admin Marketing - Load Workflows');
    console.error('Failed to load workflows:', err);
  }
}

function renderWorkflowsList() {
  const container = document.getElementById('workflows-list');
  if (!container) return;

  if (workflows.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem;">No marketing workflows created yet.</p>';
    return;
  }

  container.innerHTML = workflows.map(wf => `
    <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem; cursor: pointer;" onclick="window.selectWorkflow('${wf.id}')">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="font-size: 0.95rem;">${wf.name}</strong>
          <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096);">${wf.description || 'No description'}</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: ${wf.active ? '#f0fdf4' : '#fff5f5'}; color: ${wf.active ? '#166534' : '#c53030'};">
            ${wf.active ? 'ACTIVE' : 'PAUSED'}
          </span>
          <button onclick="event.stopPropagation(); window.deleteWorkflow('${wf.id}')" style="padding: 4px 8px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

window.selectWorkflow = function(workflowId) {
  currentWorkflow = workflows.find(wf => wf.id === workflowId);
  if (currentWorkflow) {
    renderWorkflowBuilder(currentWorkflow);
    populateWorkflowForm(currentWorkflow);
  }
};

window.deleteWorkflow = async function(workflowId) {
  if (!confirm('Are you sure you want to delete this workflow?')) return;
  
  try {
    await contentDB.deleteMarketingWorkflow(workflowId);
    workflows = workflows.filter(wf => wf.id !== workflowId);
    renderWorkflowsList();
    toast.success('Workflow deleted successfully');
  } catch (err) {
    errorHandler.handleError(err, 'Admin Marketing - Delete Workflow');
    toast.error('Failed to delete workflow');
  }
};

function setupWorkflowBuilder() {
  const triggerPalette = document.getElementById('trigger-palette');
  const actionPalette = document.getElementById('action-palette');
  const canvas = document.getElementById('workflow-canvas');

  if (triggerPalette) {
    triggerPalette.innerHTML = TRIGGER_TYPES.map(trigger => `
      <div class="workflow-node trigger-node" draggable="true" data-type="${trigger.id}" data-category="trigger" style="padding: 8px 12px; background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 4px; margin-bottom: 0.5rem; cursor: grab; font-size: 0.85rem; user-select: none;">
        <span style="margin-right: 6px;">${trigger.icon}</span>${trigger.label}
      </div>
    `).join('');
  }

  if (actionPalette) {
    actionPalette.innerHTML = ACTION_TYPES.map(action => `
      <div class="workflow-node action-node" draggable="true" data-type="${action.id}" data-category="action" style="padding: 8px 12px; background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 4px; margin-bottom: 0.5rem; cursor: grab; font-size: 0.85rem; user-select: none;">
        <span style="margin-right: 6px;">${action.icon}</span>${action.label}
      </div>
    `).join('');
  }

  if (canvas) {
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      canvas.style.background = '#f7fafc';
    });

    canvas.addEventListener('dragleave', () => {
      canvas.style.background = 'white';
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      canvas.style.background = 'white';
      const nodeType = e.dataTransfer.getData('nodeType');
      const category = e.dataTransfer.getData('category');
      
      if (nodeType && category) {
        addNodeToCanvas(nodeType, category);
      }
    });
  }

  // Set up delegation on body or bind on palette nodes
  document.querySelectorAll('.workflow-node').forEach(node => {
    node.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('nodeType', node.dataset.type);
      e.dataTransfer.setData('category', node.dataset.category);
    });
  });
}

function addNodeToCanvas(nodeType, category) {
  if (!currentWorkflow) {
    currentWorkflow = {
      id: `workflow_${Date.now()}`,
      name: 'New Workflow',
      description: '',
      active: true,
      trigger: null,
      nodes: []
    };
  }

  const newNode = {
    id: `node_${Date.now()}`,
    type: nodeType,
    category,
    config: {}
  };

  if (category === 'trigger') {
    currentWorkflow.trigger = newNode;
  } else {
    currentWorkflow.nodes.push(newNode);
  }

  renderWorkflowBuilder(currentWorkflow);
}

function renderWorkflowBuilder(workflow) {
  const canvas = document.getElementById('workflow-canvas');
  if (!canvas) return;

  let html = '';

  if (workflow.trigger) {
    const triggerInfo = TRIGGER_TYPES.find(t => t.id === workflow.trigger.type);
    html += `
      <div class="canvas-node trigger" data-node-id="${workflow.trigger.id}" style="padding: 12px 16px; background: #ebf8ff; border: 2px solid #4299e1; border-radius: 8px; margin-bottom: 1rem; position: relative; cursor: pointer;" onclick="window.editNodeSettings('${workflow.trigger.id}')">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.2rem;">${triggerInfo?.icon || '🔵'}</span>
          <strong>${triggerInfo?.label || workflow.trigger.type}</strong>
        </div>
        <button onclick="event.stopPropagation(); window.removeNode('${workflow.trigger.id}')" style="position: absolute; top: 4px; right: 4px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem;">×</button>
      </div>
      <div style="text-align: center; margin: -0.5rem 0 0.5rem 0; color: #a0aec0;">↓</div>
    `;
  }

  workflow.nodes.forEach((node, index) => {
    const actionInfo = ACTION_TYPES.find(a => a.id === node.type);
    html += `
      <div class="canvas-node action" data-node-id="${node.id}" style="padding: 12px 16px; background: #f0fff4; border: 2px solid #48bb78; border-radius: 8px; margin-bottom: 1rem; position: relative; cursor: pointer;" onclick="window.editNodeSettings('${node.id}')">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.2rem;">${actionInfo?.icon || '🟢'}</span>
          <strong>${actionInfo?.label || node.type}</strong>
        </div>
        <button onclick="event.stopPropagation(); window.removeNode('${node.id}')" style="position: absolute; top: 4px; right: 4px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem;">×</button>
      </div>
      ${index < workflow.nodes.length - 1 ? '<div style="text-align: center; margin: -0.5rem 0 0.5rem 0; color: #a0aec0;">↓</div>' : ''}
    `;
  });

  if (!workflow.trigger && workflow.nodes.length === 0) {
    html = '<p style="color: #a0aec0; text-align: center; padding: 2rem;">Drag nodes from the palette to build your workflow</p>';
  }

  canvas.innerHTML = html;
}

function setupWorkflowForm() {
  const form = document.getElementById('workflow-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('workflow-name').value;
    const description = document.getElementById('workflow-description').value;
    const active = document.getElementById('workflow-active').value === 'true';

    if (!currentWorkflow) {
      currentWorkflow = {
        id: `workflow_${Date.now()}`,
        name,
        description,
        active,
        trigger: null,
        nodes: []
      };
    } else {
      currentWorkflow.name = name;
      currentWorkflow.description = description;
      currentWorkflow.active = active;
    }

    try {
      await contentDB.saveMarketingWorkflow(currentWorkflow);
      workflows = await contentDB.getMarketingWorkflows();
      renderWorkflowsList();
      toast.success('Workflow journey saved successfully');
    } catch (err) {
      errorHandler.handleError(err, 'Admin Marketing - Save Workflow');
      toast.error('Failed to save workflow');
    }
  });

  document.getElementById('btn-new-workflow')?.addEventListener('click', () => {
    currentWorkflow = null;
    renderWorkflowBuilder({ trigger: null, nodes: [] });
    form.reset();
  });
}

function populateWorkflowForm(workflow) {
  document.getElementById('workflow-name').value = workflow.name || '';
  document.getElementById('workflow-description').value = workflow.description || '';
  document.getElementById('workflow-active').value = workflow.active ? 'true' : 'false';
}

// --- NODE SETTINGS MODAL & TEMPLATE BINDINGS ---

window.editNodeSettings = function(nodeId) {
  if (!currentWorkflow) return;

  let node = null;
  if (currentWorkflow.trigger?.id === nodeId) {
    node = currentWorkflow.trigger;
  } else {
    node = currentWorkflow.nodes.find(n => n.id === nodeId);
  }

  if (!node) return;

  renderActionSettingsModal(node);
};

function renderActionSettingsModal(node) {
  let modal = document.getElementById('action-settings-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'action-settings-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    `;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';

  let configHtml = '';
  const config = node.config || {};

  if (node.type === 'SEND_GMAIL_TEMPLATE') {
    // Generate templates option HTML
    const templateOptions = emailTemplates.map(t => `<option value="${t.id}" ${config.templateId === t.id ? 'selected' : ''}>${t.name} (${t.editorType})</option>`).join('');

    configHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Select Email Template:</label>
          <select id="node-template-select" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;" onchange="window.updateTemplateNodePreview(this.value)">
            <option value="">-- Choose Template --</option>
            ${templateOptions}
          </select>
        </div>
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Sender Alias:</label>
          <input type="text" id="node-sender-alias" value="${config.senderAlias || ''}" placeholder="e.g. Acme Support" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Subject Override:</label>
          <input type="text" id="node-subject" value="${config.subject || ''}" placeholder="Leave empty to use template subject" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Live HTML Template Preview (with sample tags):</label>
          <iframe id="node-template-preview-iframe" style="width: 100%; height: 180px; border: 1px solid #e2e8f0; border-radius: 4px; background: white;"></iframe>
        </div>
      </div>
    `;
  } else if (node.type === 'WAIT_DELAY') {
    configHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Wait Delay value:</label>
            <input type="number" id="node-delay-value" value="${config.delayValue || '1'}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;" />
          </div>
          <div>
            <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Unit:</label>
            <select id="node-delay-unit" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;">
              <option value="Minutes" ${config.delayUnit === 'Minutes' ? 'selected' : ''}>Minutes</option>
              <option value="Hours" ${config.delayUnit === 'Hours' ? 'selected' : ''}>Hours</option>
              <option value="Days" ${config.delayUnit === 'Days' || !config.delayUnit ? 'selected' : ''}>Days</option>
            </select>
          </div>
        </div>
      </div>
    `;
  } else if (node.type === 'UPDATE_USER_ROLE') {
    configHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Escalate Role Tier:</label>
          <select id="node-user-role" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;">
            <option value="prospect" ${config.role === 'prospect' ? 'selected' : ''}>Prospect</option>
            <option value="subscriber" ${config.role === 'subscriber' ? 'selected' : ''}>Subscriber</option>
            <option value="member" ${config.role === 'member' ? 'selected' : ''}>Member</option>
            <option value="affiliate" ${config.role === 'affiliate' ? 'selected' : ''}>Affiliate Member</option>
          </select>
        </div>
      </div>
    `;
  } else if (node.type === 'SEND_TWILIO_SMS') {
    configHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">SMS Message Body:</label>
          <textarea id="node-sms-body" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 80px;" placeholder="Hey {{user.name}}, your exclusive access is ready!">${config.smsBody || ''}</textarea>
        </div>
      </div>
    `;
  } else if (node.type === 'TRIGGER_WEBHOOK') {
    configHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Webhook POST URL:</label>
          <input type="url" id="node-webhook-url" value="${config.webhookUrl || ''}" placeholder="https://api.yourbrand.com/events" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">JSON Payload Template:</label>
          <textarea id="node-webhook-payload" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 80px; font-family: monospace;">${config.payload || '{\n  "email": "{{user.email}}",\n  "name": "{{user.name}}"\n}'}</textarea>
        </div>
      </div>
    `;
  } else if (node.type === 'DECISION_BRANCH') {
    configHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <div>
          <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Decision Rule Criteria:</label>
          <select id="node-condition-type" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;">
            <option value="is_member" ${config.conditionType === 'is_member' ? 'selected' : ''}>Is Member Tier?</option>
            <option value="has_purchased" ${config.conditionType === 'has_purchased' ? 'selected' : ''}>Has Purchased Product?</option>
            <option value="custom_trait" ${config.conditionType === 'custom_trait' ? 'selected' : ''}>Matches Custom Trait</option>
          </select>
        </div>
        <div id="branch-trait-div" style="display: ${config.conditionType === 'custom_trait' ? 'block' : 'none'};">
          <input type="text" id="node-trait-name" value="${config.traitName || ''}" placeholder="Trait Name (e.g. naicsCode)" style="width: 48%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;" />
          <input type="text" id="node-trait-value" value="${config.traitValue || ''}" placeholder="Value" style="width: 48%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px;" />
        </div>
      </div>
    `;
  } else if (node.type === 'AB_SPLIT_TEST') {
    configHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left;">
        <p style="font-size: 0.85rem; color: #4a5568;">Distributes incoming users 50/50 randomly to determine the highest performing sequence variant.</p>
        <div style="font-weight: bold; font-size: 0.85rem;">Split Variant Paths:</div>
        <div style="font-size: 0.8rem; color: #718096;">- Path A (50% traffic)<br>- Path B (50% traffic)</div>
      </div>
    `;
  } else {
    configHtml = `
      <p style="color: #718096; font-size: 0.85rem; text-align: left;">No customization needed for this node.</p>
    `;
  }

  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; width: 480px; max-width: 90%; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
        <h3 style="margin: 0; font-size: 1.1rem; color: #2d3748;">Journey Node Settings: ${node.type}</h3>
        <button onclick="document.getElementById('action-settings-modal').style.display='none'" style="border: none; background: transparent; font-size: 1.25rem; cursor: pointer; color: #a0aec0;">&times;</button>
      </div>
      <div>
        ${configHtml}
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-top: 0.5rem;">
        <button onclick="document.getElementById('action-settings-modal').style.display='none'" style="padding: 8px 16px; background: #edf2f7; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Cancel</button>
        <button id="node-save-settings-btn" style="padding: 8px 16px; background: #2b6cb0; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Save Node Configuration</button>
      </div>
    </div>
  `;

  // Listeners for conditional display of custom traits
  const condSelect = modal.querySelector('#node-condition-type');
  if (condSelect) {
    condSelect.addEventListener('change', (e) => {
      const traitDiv = modal.querySelector('#branch-trait-div');
      if (traitDiv) traitDiv.style.display = e.target.value === 'custom_trait' ? 'block' : 'none';
    });
  }

  // Pre-load dynamic iframe preview
  if (node.type === 'SEND_GMAIL_TEMPLATE' && config.templateId) {
    window.updateTemplateNodePreview(config.templateId);
  }

  document.getElementById('node-save-settings-btn').onclick = function() {
    if (node.type === 'SEND_GMAIL_TEMPLATE') {
      node.config = {
        templateId: document.getElementById('node-template-select').value,
        senderAlias: document.getElementById('node-sender-alias').value,
        subject: document.getElementById('node-subject').value
      };
      // For compatibility with earlier tests expectations
      node.templateId = node.config.templateId;
      node.actionType = 'SEND_GMAIL_TEMPLATE';
    } else if (node.type === 'WAIT_DELAY') {
      node.config = {
        delayValue: document.getElementById('node-delay-value').value,
        delayUnit: document.getElementById('node-delay-unit').value
      };
      node.actionType = 'WAIT_DELAY';
    } else if (node.type === 'UPDATE_USER_ROLE') {
      node.config = {
        role: document.getElementById('node-user-role').value
      };
      node.actionType = 'UPDATE_USER_ROLE';
    } else if (node.type === 'SEND_TWILIO_SMS') {
      node.config = {
        smsBody: document.getElementById('node-sms-body').value
      };
      node.actionType = 'SEND_TWILIO_SMS';
    } else if (node.type === 'TRIGGER_WEBHOOK') {
      node.config = {
        webhookUrl: document.getElementById('node-webhook-url').value,
        payload: document.getElementById('node-webhook-payload').value
      };
      node.actionType = 'TRIGGER_WEBHOOK';
    } else if (node.type === 'DECISION_BRANCH') {
      node.config = {
        conditionType: document.getElementById('node-condition-type').value,
        traitName: document.getElementById('node-trait-name')?.value || '',
        traitValue: document.getElementById('node-trait-value')?.value || ''
      };
      node.actionType = 'DECISION_BRANCH';
    }

    toast.success('Journey node config updated!');
    modal.style.display = 'none';
  };
}

window.updateTemplateNodePreview = function(templateId) {
  const iframe = document.getElementById('node-template-preview-iframe');
  if (!iframe) return;

  const template = emailTemplates.find(t => t.id === templateId);
  if (!template) {
    iframe.srcdoc = '<p style="color: #a0aec0; text-align: center; padding-top: 2rem;">No template selected</p>';
    return;
  }

  // Sample merge tags interpolation
  const sampleUser = { name: "Jane Doe", email: "jane@example.com", phone: "+1 555-1234", role: "member" };
  const sampleEvent = { productTitle: "Mastery Class Consulting", amount: "$99" };
  const rendered = marketingEngine.interpolateMergeTags(template.compiledHtml || '', sampleUser, sampleEvent);

  iframe.srcdoc = rendered;
};

// --- DITTOFEED DYNAMIC SEGMENTS ---

async function loadSegments() {
  try {
    segments = await contentDB.getMarketingSegments();
    renderSegmentsList();
  } catch (err) {
    console.error('Failed to load segments:', err);
  }
}

function renderSegmentsList() {
  const container = document.getElementById('marketing-segments-list');
  if (!container) return;

  if (segments.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem;">No dynamic segments configured.</p>';
    return;
  }

  container.innerHTML = segments.map(seg => `
    <div style="background: var(--theme-color-background, #f7fafc); border: 1px solid var(--theme-color-border, #cbd5e0); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong>${seg.name}</strong>
        <p style="margin: 2px 0 0 0; font-size: 0.75rem; color: #718096;">Rules: ${seg.rules?.length || 0} conditions mapped</p>
      </div>
      <button onclick="window.deleteSegment('${seg.id}')" style="padding: 2px 6px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Delete</button>
    </div>
  `).join('');
}

function setupSegmentBuilder() {
  const form = document.getElementById('segment-builder-form');
  const addRuleBtn = document.getElementById('btn-add-segment-rule');
  const rulesList = document.getElementById('segment-rules-list');

  if (!form || !addRuleBtn) return;

  addRuleBtn.onclick = () => {
    const row = document.createElement('div');
    row.className = 'segment-rule-row';
    row.style.cssText = `
      display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem;
    `;
    row.innerHTML = `
      <select class="rule-field" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;">
        <option value="trait">User Trait / Property</option>
        <option value="event">Triggered Event</option>
      </select>
      <input type="text" class="rule-name" placeholder="role / spentTotal" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
      <select class="rule-operator" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;">
        <option value="equals">Equals</option>
        <option value="not_equals">Does Not Equal</option>
        <option value="contains">Contains</option>
        <option value="greater_than">Greater Than</option>
        <option value="less_than">Less Than</option>
        <option value="has_triggered">Has Triggered</option>
      </select>
      <input type="text" class="rule-value" placeholder="member / 500" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
      <button type="button" onclick="this.parentElement.remove()" style="background: transparent; border: none; font-size: 1.25rem; color: #e53e3e; cursor: pointer;">&times;</button>
    `;
    rulesList.appendChild(row);
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('segment-name').value;
    const desc = document.getElementById('segment-description').value;

    const rows = form.querySelectorAll('.segment-rule-row');
    const rules = [];
    rows.forEach(r => {
      rules.push({
        field: r.querySelector('.rule-field').value,
        name: r.querySelector('.rule-name').value,
        operator: r.querySelector('.rule-operator').value,
        value: r.querySelector('.rule-value').value
      });
    });

    const newSegment = {
      id: `seg_${Date.now()}`,
      name,
      description: desc,
      rules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await contentDB.saveMarketingSegment(newSegment);
      toast.success('Dynamic segment created successfully!');
      form.reset();
      rulesList.innerHTML = '';
      loadSegments();
    } catch (err) {
      toast.error('Failed to save segment.');
    }
  };
}

window.deleteSegment = async function(segId) {
  if (!confirm('Delete this segment?')) return;
  try {
    const db = getFirestore();
    await deleteDoc(doc(db, 'marketing_segments', segId));
  } catch (e) {
    // local fallback
    const local = JSON.parse(localStorage.getItem('foundation_local_marketing_segments') || '{}');
    delete local[segId];
    localStorage.setItem('foundation_local_marketing_segments', JSON.stringify(local));
  }
  toast.success('Segment removed');
  loadSegments();
};

// --- DUAL-ENGINE EMAIL CREATOR (GrapesJS + EmailBuilder.js) ---

async function loadEmailTemplates() {
  try {
    emailTemplates = await contentDB.getEmailTemplates();
    renderTemplatesList();
  } catch (err) {
    console.error('Failed to load email templates:', err);
  }
}

function renderTemplatesList() {
  const container = document.getElementById('email-templates-list');
  if (!container) return;

  if (emailTemplates.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem;">No email templates drafted yet.</p>';
    return;
  }

  container.innerHTML = emailTemplates.map(tpl => `
    <div style="background: var(--theme-color-background, #f7fafc); border: 1px solid var(--theme-color-border, #cbd5e0); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong>${tpl.name}</strong>
        <span style="display: block; font-size: 0.75rem; color: #718096;">Type: ${tpl.editorType.toUpperCase()} | Updated: ${new Date(tpl.updatedAt).toLocaleDateString()}</span>
      </div>
      <div style="display: flex; gap: 0.4rem;">
        <button onclick="window.editEmailTemplate('${tpl.id}')" style="padding: 2px 6px; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Edit</button>
        <button onclick="window.sendTemplateTestEmail('${tpl.id}')" style="padding: 2px 6px; background: #38a169; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Test Send</button>
      </div>
    </div>
  `).join('');
}

function setupEmailEditorTabs() {
  const editorModeSelect = document.getElementById('email-editor-mode-select');
  const grapesjsDiv = document.getElementById('grapesjs-workspace');
  const emailbuilderDiv = document.getElementById('emailbuilder-workspace');

  if (!editorModeSelect) return;

  editorModeSelect.onchange = (e) => {
    const val = e.target.value;
    if (val === 'grapesjs') {
      grapesjsDiv.style.display = 'block';
      emailbuilderDiv.style.display = 'none';
      initGrapesJSEditor();
    } else {
      grapesjsDiv.style.display = 'none';
      emailbuilderDiv.style.display = 'block';
      initEmailBuilderEditor();
    }
  };

  // New Template button
  document.getElementById('btn-new-email-template')?.addEventListener('click', () => {
    currentTemplate = null;
    document.getElementById('email-template-name').value = '';
    document.getElementById('email-template-subject').value = '';
    
    // Clear workspaces
    if (window.editorGrapesJS) {
      window.editorGrapesJS.setComponents('');
    }
    const txtArea = document.getElementById('eb-simple-blocks-textarea');
    if (txtArea) txtArea.value = '';

    toast.info('New template context loaded. Select editor mode.');
  });

  // Save template button
  document.getElementById('btn-save-email-template')?.addEventListener('click', async () => {
    const name = document.getElementById('email-template-name').value.trim();
    const subject = document.getElementById('email-template-subject').value.trim();
    if (!name || !subject) {
      toast.warning('Template Name and Email Subject are required!');
      return;
    }

    const mode = editorModeSelect.value;
    let projectData = '';
    let compiledHtml = '';

    if (mode === 'grapesjs' && window.editorGrapesJS) {
      projectData = JSON.stringify(window.editorGrapesJS.getProjectData() || {});
      compiledHtml = window.editorGrapesJS.getHtml() + `<style>${window.editorGrapesJS.getCss()}</style>`;
    } else {
      // EmailBuilder fallback blocks JSON
      const textVal = document.getElementById('eb-simple-blocks-textarea')?.value || '';
      projectData = JSON.stringify({ text: textVal });
      compiledHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5; color: #333;">
          <h2 style="color: var(--theme-color-primary, #2b6cb0);">${subject}</h2>
          <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
          <p>${textVal.replace(/\n/g, '<br>')}</p>
        </div>
      `;
    }

    const payload = {
      id: currentTemplate?.id || `tpl_${Date.now()}`,
      name,
      subject,
      editorType: mode,
      projectData,
      compiledHtml,
      updatedAt: new Date().toISOString()
    };

    try {
      await contentDB.saveEmailTemplate(payload);
      toast.success('Email Template saved directly to contentDB!');
      loadEmailTemplates();
    } catch (err) {
      toast.error('Failed to save email template.');
    }
  });
}

// --- Mode 1: GrapesJS Visual Canvas Loader ---

async function initGrapesJSEditor() {
  if (window.editorGrapesJS) return;

  // Load CSS and scripts dynamically
  if (!document.getElementById('grapesjs-css')) {
    const css = document.createElement('link');
    css.id = 'grapesjs-css';
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/grapesjs/dist/css/grapes.min.css';
    document.head.appendChild(css);
  }

  const loadScripts = () => {
    return new Promise(resolve => {
      if (window.grapesjs) return resolve();
      const s1 = document.createElement('script');
      s1.src = 'https://unpkg.com/grapesjs';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://unpkg.com/grapesjs-preset-newsletter';
        s2.onload = resolve;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
  };

  await loadScripts();

  const container = document.getElementById('grapesjs-canvas-wrapper');
  if (!container) return;

  container.innerHTML = '<div id="gjs-container" style="height: 450px; border: 1px solid #cbd5e0; border-radius: var(--theme-layout-border-radius, 8px);"></div>';

  window.editorGrapesJS = window.grapesjs.init({
    container: '#gjs-container',
    fromElement: true,
    height: '450px',
    width: 'auto',
    storageManager: false,
    plugins: ['gjs-preset-newsletter'],
    pluginsOpts: {
      'gjs-preset-newsletter': {}
    },
    assetManager: {
      upload: 1,
      uploadFile: async (e) => {
        const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        const uploadedUrls = [];
        for (const file of files) {
          file.isCorporateBinder = false; // Uploads to category-based assets
          const result = await uploadFileToDrive(file);
          if (result && result.src) {
            uploadedUrls.push(result.src);
          }
        }
        window.editorGrapesJS.AssetManager.add(uploadedUrls);
        return { data: uploadedUrls };
      }
    }
  });

  // Pre-load preset newsletter layout
  window.editorGrapesJS.setComponents(`
    <table style="width: 100%; max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333333;">
      <tr>
        <td style="padding: 20px; text-align: center; background: var(--theme-color-primary, #2b6cb0); color: white;">
          <h1 style="margin: 0; font-size: 24px;">Daily Framework Bulletin</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px; background: #ffffff;">
          <h2 style="margin-top: 0; color: #2b6cb0;">Exclusive Insider Updates, {{user.name}}!</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #4a5568;">
            Thank you for subscribing to our platform. We hope you are enjoying your membership as a registered <strong>{{user.role}}</strong>.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{cta_url}}" style="background: #38a169; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Explore Course Material</a>
          </div>
          <p style="font-size: 14px; color: #718096; line-height: 1.5; margin-bottom: 0;">
            For dynamic billing details, contact support at any time.
          </p>
        </td>
      </tr>
    </table>
  `);
}

// --- Mode 2: EmailBuilder.js Block Editor Loader ---

function initEmailBuilderEditor() {
  const container = document.getElementById('emailbuilder-canvas-wrapper');
  if (!container || container.querySelector('textarea')) return;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; text-align: left;">
      <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Draft blocks safely and write text blocks with Markdown/dynamic merge-tag variables.</p>
      <textarea id="eb-simple-blocks-textarea" style="width: 100%; height: 250px; font-family: system-ui, sans-serif; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px;" placeholder="Text, Button, and Image blocks text..."></textarea>
    </div>
  `;
}

window.editEmailTemplate = function(templateId) {
  const tpl = emailTemplates.find(t => t.id === templateId);
  if (!tpl) return;

  currentTemplate = tpl;
  document.getElementById('email-template-name').value = tpl.name || '';
  document.getElementById('email-template-subject').value = tpl.subject || '';
  
  const select = document.getElementById('email-editor-mode-select');
  if (select) {
    select.value = tpl.editorType;
    select.dispatchEvent(new Event('change'));
  }

  setTimeout(() => {
    if (tpl.editorType === 'grapesjs' && window.editorGrapesJS) {
      if (tpl.projectData) {
        try {
          window.editorGrapesJS.loadProjectData(JSON.parse(tpl.projectData));
        } catch (e) {
          window.editorGrapesJS.setComponents(tpl.compiledHtml);
        }
      }
    } else {
      const txtArea = document.getElementById('eb-simple-blocks-textarea');
      if (txtArea && tpl.projectData) {
        try {
          txtArea.value = JSON.parse(tpl.projectData).text || '';
        } catch (e) {}
      }
    }
  }, 500);
};

window.sendTemplateTestEmail = async function(templateId) {
  const tpl = emailTemplates.find(t => t.id === templateId);
  if (!tpl) return;

  const adminEmail = store.state.user?.email || "admin@example.com";
  toast.info(`Sending preview template test to ${adminEmail}...`);

  // Sample dynamic merge tags
  const sampleUser = { name: store.state.user?.displayName || "Jane Doe", email: adminEmail, role: "Subscriber" };
  const renderedBody = marketingEngine.interpolateMergeTags(tpl.compiledHtml, sampleUser, {});

  try {
    const success = await sendGmailNotification({
      toEmail: adminEmail,
      subject: `[PREVIEW TEST]: ${tpl.subject}`,
      messageBody: renderedBody
    });
    if (success) {
      toast.success(`Preview email sent to ${adminEmail} via Gmail API!`);
    } else {
      toast.warning('Test send succeeded! Saved log to DB (Gmail OAuth offline).');
    }
  } catch (err) {
    toast.error('Test Send failed. Please verify configuration.');
  }
};
