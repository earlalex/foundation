// pages/admin/admin-kanban.js - Kanban Task Board Controller
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';

let tasks = [];
let users = [];
let draggedTask = null;

const COLUMNS = ['backlog', 'in_progress', 'review', 'completed'];
const COLUMN_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review / Testing',
  completed: 'Completed'
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const PRIORITY_COLORS = {
  'Low': '#48bb78',
  'Medium': '#ed8936',
  'High': '#e53e3e',
  'Critical': '#7c3aed'
};

export function initKanbanTab() {
  loadTasks();
  loadUsers();
  setupKanbanBoard();
  setupTaskForm();
}

async function loadTasks() {
  tasks = await contentDB.getKanbanTasks();
  renderKanbanBoard();
}

async function loadUsers() {
  users = await contentDB.getAllUsers();
  populateAssigneeSelect();
}

function populateAssigneeSelect() {
  const select = document.getElementById('task-assignee');
  if (!select) return;

  select.innerHTML = '<option value="">Unassigned</option>' + 
    users.map(user => `<option value="${user.id}">${user.displayName || user.email}</option>`).join('');
}

function setupKanbanBoard() {
  COLUMNS.forEach(columnId => {
    const column = document.getElementById(`column-${columnId}`);
    if (!column) return;

    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      column.style.background = '#f7fafc';
    });

    column.addEventListener('dragleave', () => {
      column.style.background = 'white';
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.style.background = 'white';
      
      if (draggedTask) {
        const taskId = e.dataTransfer.getData('taskId');
        const newStatus = columnId;
        
        await updateTaskStatus(taskId, newStatus);
        draggedTask = null;
      }
    });
  });
}

function renderKanbanBoard() {
  COLUMNS.forEach(columnId => {
    const column = document.getElementById(`column-${columnId}`);
    if (!column) return;

    const columnTasks = tasks.filter(task => task.status === columnId);
    
    column.innerHTML = columnTasks.map(task => `
      <div class="kanban-card" draggable="true" data-task-id="${task.id}" 
           style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); 
                  border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem; cursor: grab; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; 
                       background: ${PRIORITY_COLORS[task.priority] || '#718096'}20; color: ${PRIORITY_COLORS[task.priority] || '#718096'};">
            ${task.priority || 'Medium'}
          </span>
          <button onclick="window.deleteTask('${task.id}')" style="background: none; border: none; color: #a0aec0; cursor: pointer; font-size: 1rem;">×</button>
        </div>
        <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; color: var(--theme-color-text-primary, #1a202c);">${task.title}</h4>
        <p style="margin: 0 0 0.75rem 0; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096); 
                  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${task.description || 'No description'}
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #718096;">
          <span>👤 ${getAssigneeName(task.assigneeId)}</span>
          <span>📅 ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span>
        </div>
      </div>
    `).join('');

    if (columnTasks.length === 0) {
      column.innerHTML = '<p style="color: #a0aec0; text-align: center; padding: 1rem; font-size: 0.8rem;">No tasks</p>';
    }

    column.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedTask = card.dataset.taskId;
        e.dataTransfer.setData('taskId', card.dataset.taskId);
        card.style.opacity = '0.5';
      });

      card.addEventListener('dragend', () => {
        draggedTask = null;
        card.style.opacity = '1';
      });
    });
  });
}

function getAssigneeName(assigneeId) {
  if (!assigneeId) return 'Unassigned';
  const user = users.find(u => u.id === assigneeId);
  return user?.displayName || user?.email || 'Unknown';
}

async function updateTaskStatus(taskId, newStatus) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.status = newStatus;
    task.updatedAt = new Date().toISOString();
    await contentDB.saveKanbanTask(task);
    renderKanbanBoard();
  }
}

window.deleteTask = async function(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  await contentDB.deleteKanbanTask(taskId);
  tasks = tasks.filter(t => t.id !== taskId);
  renderKanbanBoard();
  toast.success('Task deleted successfully');
};

function setupTaskForm() {
  const form = document.getElementById('task-form');
  if (!form) return;

  const prioritySelect = document.getElementById('task-priority');
  if (prioritySelect) {
    prioritySelect.innerHTML = PRIORITIES.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const priority = document.getElementById('task-priority').value;
    const dueDate = document.getElementById('task-due-date').value;
    const assigneeId = document.getElementById('task-assignee').value;

    const newTask = {
      id: `task_${Date.now()}`,
      title,
      description,
      priority,
      dueDate,
      assigneeId,
      status: 'backlog',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await contentDB.saveKanbanTask(newTask);
    tasks.push(newTask);
    renderKanbanBoard();
    form.reset();
    toast.success('Task created successfully');
  });
}
