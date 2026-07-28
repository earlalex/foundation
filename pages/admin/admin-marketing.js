// pages/admin/admin-marketing.js - Marketing Automation & Workflows Controller
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { sendGmailNotification } from '../../core/google-services.js';
import { errorHandler } from '../../core/error-handler.js';

let workflows = [];
let currentWorkflow = null;
let draggedNode = null;

const TRIGGER_TYPES = [
  { id: 'user_registered', label: 'User Registration', icon: '👤' },
  { id: 'product_purchased', label: 'Product Purchase', icon: '💳' },
  { id: 'appointment_scheduled', label: 'Appointment Booked', icon: '📅' },
  { id: 'user_inactive_x_days', label: 'User Inactivity', icon: '⏰' }
];

const ACTION_TYPES = [
  { id: 'SEND_GMAIL_TEMPLATE', label: 'Send Gmail Template', icon: '📧' },
  { id: 'WAIT_DELAY', label: 'Wait Delay', icon: '⏳' },
  { id: 'UPDATE_USER_ROLE', label: 'Update User Role', icon: '🔄' },
  { id: 'CREATE_GOOGLE_CONTACT_NOTE', label: 'Create Contact Note', icon: '📝' }
];

export function initMarketingTab() {
  loadWorkflows();
  setupWorkflowBuilder();
  setupWorkflowForm();
}

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
      <div class="workflow-node trigger-node" draggable="true" data-type="${trigger.id}" data-category="trigger" style="padding: 8px 12px; background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 4px; margin-bottom: 0.5rem; cursor: grab; font-size: 0.85rem;">
        <span style="margin-right: 6px;">${trigger.icon}</span>${trigger.label}
      </div>
    `).join('');
  }

  if (actionPalette) {
    actionPalette.innerHTML = ACTION_TYPES.map(action => `
      <div class="workflow-node action-node" draggable="true" data-type="${action.id}" data-category="action" style="padding: 8px 12px; background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 4px; margin-bottom: 0.5rem; cursor: grab; font-size: 0.85rem;">
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
      <div class="canvas-node trigger" data-node-id="${workflow.trigger.id}" style="padding: 12px 16px; background: #ebf8ff; border: 2px solid #4299e1; border-radius: 8px; margin-bottom: 1rem; position: relative;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.2rem;">${triggerInfo?.icon || '🔵'}</span>
          <strong>${triggerInfo?.label || workflow.trigger.type}</strong>
        </div>
        <button onclick="window.removeNode('${workflow.trigger.id}')" style="position: absolute; top: 4px; right: 4px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem;">×</button>
      </div>
      <div style="text-align: center; margin: -0.5rem 0 0.5rem 0; color: #a0aec0;">↓</div>
    `;
  }

  workflow.nodes.forEach((node, index) => {
    const actionInfo = ACTION_TYPES.find(a => a.id === node.type);
    html += `
      <div class="canvas-node action" data-node-id="${node.id}" style="padding: 12px 16px; background: #f0fff4; border: 2px solid #48bb78; border-radius: 8px; margin-bottom: 1rem; position: relative;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.2rem;">${actionInfo?.icon || '🟢'}</span>
          <strong>${actionInfo?.label || node.type}</strong>
        </div>
        <button onclick="window.removeNode('${node.id}')" style="position: absolute; top: 4px; right: 4px; background: #fed7d7; color: #c53030; border: none; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem;">×</button>
      </div>
      ${index < workflow.nodes.length - 1 ? '<div style="text-align: center; margin: -0.5rem 0 0.5rem 0; color: #a0aec0;">↓</div>' : ''}
    `;
  });

  if (!workflow.trigger && workflow.nodes.length === 0) {
    html = '<p style="color: #a0aec0; text-align: center; padding: 2rem;">Drag nodes from the palette to build your workflow</p>';
  }

  canvas.innerHTML = html;
}

window.removeNode = function(nodeId) {
  if (!currentWorkflow) return;

  if (currentWorkflow.trigger?.id === nodeId) {
    currentWorkflow.trigger = null;
  } else {
    currentWorkflow.nodes = currentWorkflow.nodes.filter(n => n.id !== nodeId);
  }

  renderWorkflowBuilder(currentWorkflow);
};

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
      toast.success('Workflow saved successfully');
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

export async function triggerWorkflow(triggerType, userData) {
  const activeWorkflows = workflows.filter(wf => wf.active && wf.trigger?.type === triggerType);
  
  for (const workflow of activeWorkflows) {
    await executeWorkflowNodes(workflow, userData);
  }
}

async function executeWorkflowNodes(workflow, userData) {
  for (const node of workflow.nodes) {
    try {
      switch (node.type) {
        case 'SEND_GMAIL_TEMPLATE':
          await sendGmailNotification({
            to: userData.email,
            subject: node.config.subject || 'Automated Message',
            body: node.config.body || ''
          });
          break;
        case 'WAIT_DELAY':
          const delayMs = (node.config.hours || 0) * 60 * 60 * 1000 + (node.config.days || 0) * 24 * 60 * 60 * 1000;
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          break;
        case 'UPDATE_USER_ROLE':
          if (node.config.role) {
            userData.role = node.config.role;
            await contentDB.saveUser(userData);
          }
          break;
        case 'CREATE_GOOGLE_CONTACT_NOTE':
          // Integration with Google Contacts would go here
          console.log('Creating contact note for:', userData.email);
          break;
      }
    } catch (err) {
      errorHandler.handleError(err, `Admin Marketing - Execute Node ${node.type}`);
      console.error(`Failed to execute workflow node ${node.type}:`, err);
    }
  }
}
