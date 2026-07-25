// pages/events/events.js
import { contentDB } from '../../core/db.js';

export async function initEventsPage() {
  const grid = document.getElementById('events-grid');
  if (!grid) return;

  const events = await contentDB.getContentByType('event', 20);

  if (!events || events.length === 0) {
    grid.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <p style="margin: 0; color: #718096;">No upcoming scheduled events found at this time.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = events.map(evt => `
    <article class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--theme-color-primary, #2b6cb0); font-weight: 700; margin-bottom: 0.5rem;">
          <span>${evt.date || 'TBD'}</span>
          <span>${evt.startTime || ''} - ${evt.endTime || ''}</span>
        </div>
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">${evt.title}</h3>
        <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5;">
          ${evt.description}
        </p>
      </div>
      ${evt.meetUrl ? `
        <a href="${evt.meetUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="text-align: center;">
          Join Google Meet Video Session
        </a>
      ` : `<span style="font-size: 0.8rem; color: #a0aec0;">Location: ${evt.location || 'In-Person'}</span>`}
    </article>
  `).join('');
}