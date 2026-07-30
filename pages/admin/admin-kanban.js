// pages/admin/admin-kanban.js - Kanban Task Board Controller
import { contentDB } from '../../core/db.js';
import { store } from '../../core/store.js';
import { toast } from '../../utils/toast.js';
import { errorHandler } from '../../core/error-handler.js';

let tasks = [];
let users = [];
let draggedTask = null;
let viewMyTasksOnly = false;

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
  // Access Guard check
  const currentUser = store.state.user;
  const isAuthorized = currentUser?.isAdmin === true || currentUser?.role === 'admin' || currentUser?.role === 'editor';

  if (!isAuthorized) {
    const container = document.getElementById('tab-kanban');
    if (container) {
      container.innerHTML = `
        <section style="padding: 3rem 1.5rem; text-align: center; font-family: system-ui, sans-serif;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
          <h2>Access Restricted</h2>
          <p style="color: var(--theme-color-text-secondary, #718096); max-width: 450px; margin: 0 auto 1.5rem auto; line-height: 1.5;">
            The Kanban Project Board is strictly restricted to Administrators and Content Editors.
          </p>
        </section>
      `;
    }
    return;
  }

  // Adjust Task Form Visibility for Editors
  const taskForm = document.getElementById('task-form');
  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin';
  if (taskForm) {
    taskForm.style.display = isAdmin ? 'block' : 'none';
  }

  // Insert "My Tasks Only" toggle filter for Editors
  insertKanbanFilterToggle();

  loadTasks();
  loadUsers();
  setupKanbanBoard();
  setupTaskForm();
}

function insertKanbanFilterToggle() {
  const container = document.querySelector('#tab-kanban h2')?.parentElement;
  if (!container) return;

  // Prevent duplicate insertion
  if (document.getElementById('kanban-filter-wrapper')) return;

  const toggleDiv = document.createElement('div');
  toggleDiv.id = 'kanban-filter-wrapper';
  toggleDiv.style.margin = '1rem 0';
  toggleDiv.style.display = 'flex';
  toggleDiv.style.gap = '1.5rem';
  toggleDiv.style.alignItems = 'center';

  toggleDiv.innerHTML = `
    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; color: var(--theme-color-text-secondary, #4a5568);">
      <input type="checkbox" id="chk-my-tasks-only" style="cursor: pointer;" />
      Show My Assigned Tasks Only
    </label>
  `;

  container.appendChild(toggleDiv);

  const checkbox = document.getElementById('chk-my-tasks-only');
  checkbox?.addEventListener('change', (e) => {
    viewMyTasksOnly = e.target.checked;
    renderKanbanBoard();
  });
}

async function loadTasks() {
  try {
    tasks = await contentDB.getKanbanTasks();
    renderKanbanBoard();
  } catch (err) {
    errorHandler.handleError(err, 'Admin Kanban - Load Tasks');
    console.error('Failed to load tasks:', err);
  }
}

async function loadUsers() {
  try {
    users = await contentDB.getAllUsers();
    populateAssigneeSelect();
  } catch (err) {
    errorHandler.handleError(err, 'Admin Kanban - Load Users');
    console.error('Failed to load users:', err);
  }
}

function populateAssigneeSelect() {
  const select = document.getElementById('task-assignee');
  if (!select) return;

  // Filter so that tasks can only be assigned to staff (Admins or Editors)
  const staff = users.filter(u => u.role === 'editor' || u.role === 'admin' || u.isAdmin);
  select.innerHTML = '<option value="">Unassigned</option>' + 
    staff.map(user => `<option value="${user.id}">${user.name || user.displayName || user.email}</option>`).join('');
}

function setupKanbanBoard() {
  COLUMNS.forEach(columnId => {
    const column = document.getElementById(`column-${columnId}`);
    if (!column) return;

    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      column.style.background = '#edf2f7';
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
  const currentUser = store.state.user;
  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin';

  COLUMNS.forEach(columnId => {
    const column = document.getElementById(`column-${columnId}`);
    if (!column) return;

    let columnTasks = tasks.filter(task => task.status === columnId);
    
    // Apply "My Tasks Only" filter if enabled
    if (viewMyTasksOnly && currentUser) {
      columnTasks = columnTasks.filter(task => task.assigneeId === currentUser.id || task.assigneeId === currentUser.email);
    }

    column.innerHTML = columnTasks.map(task => {
      // Editor cannot delete Admin's tasks or any tasks on the board
      const showDeleteBtn = isAdmin ? `
        <button onclick="window.deleteTask('${task.id}')"
                style="background: none; border: none; color: #cbd5e0; cursor: pointer; font-size: 1.25rem; font-weight: bold; transition: color 0.2s;"
                onmouseover="this.style.color='#e53e3e'" onmouseout="this.style.color='#cbd5e0'">×</button>
      ` : '';

      // Edit Note section inside Completed column
      const isCompleted = task.status === 'completed';
      const showCompletedNotes = isCompleted ? `
        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed #e2e8f0; font-size: 0.75rem;">
          <strong style="color: var(--theme-color-primary, #2b6cb0);">Deliverables note:</strong>
          <p style="margin: 2px 0; color: #4a5568; font-style: italic;">${task.completionNotes || 'No notes attached'}</p>
          <button onclick="window.addCompletionNotesPrompt('${task.id}')"
                  style="background: none; border: none; color: #3182ce; cursor: pointer; font-weight: bold; padding: 0; font-size: 0.7rem; text-decoration: underline;">
            Update Notes / Submission Link
          </button>
        </div>
      ` : '';

      return `
        <div class="kanban-card" draggable="true" data-task-id="${task.id}"
             style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0);
                    border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem; cursor: grab; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;
                         background: ${PRIORITY_COLORS[task.priority] || '#718096'}20; color: ${PRIORITY_COLORS[task.priority] || '#718096'};">
              ${task.priority || 'Medium'}
            </span>
            ${showDeleteBtn}
          </div>
          <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; color: var(--theme-color-text-primary, #1a202c); font-weight: bold;">${task.title}</h4>
          <p style="margin: 0 0 0.75rem 0; font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096);
                    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
            ${task.description || 'No description'}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #718096; flex-wrap: wrap; gap: 0.25rem;">
            <span>👤 ${getAssigneeName(task.assigneeId)}</span>
            <span>📅 ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span>
          </div>
          ${showCompletedNotes}
        </div>
      `;
    }).join('');

    if (columnTasks.length === 0) {
      column.innerHTML = '<p style="color: #cbd5e0; text-align: center; padding: 2rem 1rem; font-size: 0.8rem; font-style: italic;">No tasks</p>';
    }

    column.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedTask = card.dataset.taskId;
        e.dataTransfer.setData('taskId', card.dataset.taskId);
        card.style.opacity = '0.5';
        card.style.cursor = 'grabbing';
      });

      card.addEventListener('dragend', () => {
        draggedTask = null;
        card.style.opacity = '1';
        card.style.cursor = 'grab';
      });
    });
  });
}

function getAssigneeName(assigneeId) {
  if (!assigneeId) return 'Unassigned';
  const user = users.find(u => u.id === assigneeId);
  return user?.name || user?.displayName || user?.email || 'Unknown';
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    const currentUser = store.state.user;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      // Direct drag and drop state update inside database
      await contentDB.updateKanbanTaskStatus(taskId, newStatus, currentUser?.id);
      task.status = newStatus;
      task.updatedBy = currentUser?.id;
      task.updatedAt = new Date().toISOString();
      renderKanbanBoard();
      toast.success(`Task status updated to "${COLUMN_LABELS[newStatus]}"`);
    }
  } catch (err) {
    errorHandler.handleError(err, 'Admin Kanban - Update Task Status');
    toast.error('Failed to update task status');
  }
}

window.addCompletionNotesPrompt = async function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const notes = prompt('Attach completion notes, submission links, or deliverables description:', task.completionNotes || '');
  if (notes === null) return; // cancelled

  try {
    task.completionNotes = notes;
    task.updatedAt = new Date().toISOString();
    await contentDB.saveKanbanTask(task);
    renderKanbanBoard();
    toast.success('Deliverables and progress updated successfully!');
  } catch (err) {
    errorHandler.handleError(err, 'Admin Kanban - Completion Notes');
    toast.error('Failed to save completion notes');
  }
};

window.deleteTask = async function(taskId) {
  const currentUser = store.state.user;
  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin';

  if (!isAdmin) {
    toast.error('Only Administrators are authorized to delete tasks.');
    return;
  }

  if (!confirm('Are you sure you want to delete this task card?')) return;
  
  try {
    await contentDB.deleteKanbanTask(taskId);
    tasks = tasks.filter(t => t.id !== taskId);
    renderKanbanBoard();
    toast.success('Task deleted successfully');
  } catch (err) {
    errorHandler.handleError(err, 'Admin Kanban - Delete Task');
    toast.error('Failed to delete task');
  }
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
    const descriptionEl = document.getElementById('task-description');
    const description = descriptionEl ? descriptionEl.value : '';
    const priority = document.getElementById('task-priority').value || 'Medium';
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
      completionNotes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await contentDB.saveKanbanTask(newTask);
      tasks.push(newTask);
      renderKanbanBoard();
      form.reset();
      toast.success('Kanban Task created successfully!');
    } catch (err) {
      errorHandler.handleError(err, 'Admin Kanban - Create Task');
      toast.error('Failed to create task');
    }
  });
}
