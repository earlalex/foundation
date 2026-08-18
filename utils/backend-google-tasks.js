// utils/backend-google-tasks.js - Google Tasks Kanban Integration Engine
import { errorHandler } from '../core/error-handler.js';

export const KANBAN_COLUMN_TAGS = {
  backlog: '[Backlog]',
  in_progress: '[In Progress]',
  review: '[Review]',
  completed: '[Completed]'
};

export const REVERSE_COLUMN_MAP = {
  '[backlog]': 'backlog',
  '[in progress]': 'in_progress',
  '[review]': 'review',
  '[completed]': 'completed'
};

/**
 * Finds or creates the "Foundation Project Tasks" list in Google Tasks
 * @param {string} token - Google OAuth Token
 * @returns {Promise<string|null>} Task List ID
 */
export async function ensureTasksList(token) {
  if (!token) {
    console.warn('[Google Tasks]: No access token available. Skipping list provision.');
    return null;
  }

  const listTitle = 'Foundation Project Tasks';

  try {
    // 1. Fetch user task lists
    const res = await fetch('https://tasks.googleapis.com/v1/users/@me/lists', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      const existing = (data.items || []).find(l => l.title === listTitle);
      if (existing) {
        console.log('[Google Tasks]: Found existing task list ID:', existing.id);
        return existing.id;
      }
    }

    // 2. Create list if not found
    const createRes = await fetch('https://tasks.googleapis.com/v1/users/@me/lists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: listTitle })
    });

    if (createRes.ok) {
      const created = await createRes.json();
      console.log('[Google Tasks]: Created task list ID:', created.id);
      return created.id;
    } else {
      const errTxt = await createRes.text();
      console.warn('[Google Tasks]: Failed to create task list:', errTxt);
      return null;
    }
  } catch (err) {
    errorHandler.handleError(err, 'Google Tasks List Provisioning');
    return null;
  }
}

/**
 * Fetches all tasks from a Google Task list
 * @param {string} token - Google OAuth Token
 * @param {string} listId - Google Tasks List ID
 * @returns {Promise<Array<Object>>} List of Google Tasks
 */
export async function fetchGoogleTasks(token, listId) {
  if (!token || !listId) return [];

  try {
    const url = `https://tasks.googleapis.com/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      console.warn('[Google Tasks]: Error fetching tasks. Status:', res.status);
      return [];
    }

    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.warn('[Google Tasks]: Fetch error:', err.message);
    return [];
  }
}

/**
 * Maps Foundation Kanban Task status/data into Google Task payload format
 * @param {Object} taskRecord - Foundation task record
 * @returns {Object} Google Task payload
 */
export function formatTaskForGoogle(taskRecord) {
  const status = taskRecord.status || 'backlog';
  const tag = KANBAN_COLUMN_TAGS[status] || '[Backlog]';

  // Strip existing column tag from title if present
  let cleanTitle = taskRecord.title || 'Untitled Task';
  Object.values(KANBAN_COLUMN_TAGS).forEach(t => {
    cleanTitle = cleanTitle.replace(t, '').trim();
  });

  const fullTitle = status === 'completed' ? cleanTitle : `${tag} ${cleanTitle}`;
  const gStatus = status === 'completed' ? 'completed' : 'needsAction';

  // Format notes with description and self-assignee email tag
  let notes = taskRecord.description || '';
  if (taskRecord.assignee?.email || taskRecord.assigneeId) {
    const email = taskRecord.assignee?.email || taskRecord.assigneeId;
    notes = `${notes}\n\nAssignee: ${email}`.trim();
  }

  const payload = {
    title: fullTitle,
    status: gStatus,
    notes: notes
  };

  if (taskRecord.dueDate) {
    try {
      const d = new Date(taskRecord.dueDate);
      payload.due = d.toISOString();
    } catch (e) {}
  }

  return payload;
}

/**
 * Syncs a single Foundation Kanban task card to Google Tasks API
 * @param {string} token - Google OAuth Token
 * @param {string} listId - Google Tasks List ID
 * @param {Object} taskRecord - Foundation task record
 * @returns {Promise<Object|null>} Synced task object with googleTaskId
 */
export async function syncKanbanTaskToGoogleTask(token, listId, taskRecord) {
  if (!token || !listId || !taskRecord) return null;

  const payload = formatTaskForGoogle(taskRecord);
  const googleTaskId = taskRecord.googleTaskId;

  try {
    if (googleTaskId) {
      // Update existing task
      const url = `https://tasks.googleapis.com/v1/lists/${listId}/tasks/${googleTaskId}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        console.log('[Google Tasks]: Updated task in Google Workspace:', updated.id);
        return updated;
      }
    }

    // Create new task if no googleTaskId or update failed
    const createUrl = `https://tasks.googleapis.com/v1/lists/${listId}/tasks`;
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const created = await res.json();
      console.log('[Google Tasks]: Created new task in Google Workspace:', created.id);
      return created;
    } else {
      const errTxt = await res.text();
      console.warn('[Google Tasks]: Sync create failed:', errTxt);
      return null;
    }
  } catch (err) {
    console.warn('[Google Tasks]: Sync error:', err.message);
    return null;
  }
}

/**
 * Deletes a task from Google Tasks
 * @param {string} token - Google OAuth Token
 * @param {string} listId - Tasks List ID
 * @param {string} googleTaskId - Google Task ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteGoogleTask(token, listId, googleTaskId) {
  if (!token || !listId || !googleTaskId) return false;

  try {
    const url = `https://tasks.googleapis.com/v1/lists/${listId}/tasks/${googleTaskId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok;
  } catch (err) {
    console.warn('[Google Tasks]: Delete error:', err.message);
    return false;
  }
}
