// utils/universalRenderer.js
import { store } from '../core/store.js';

/**
 * Evaluates visibility permissions and renders either full unlocked content or a locked paywall gate.
 */
export function renderContent(contentData) {
  if (!contentData) {
    return `<div style="text-align: center; padding: 3rem; color: #718096;">Content record unavailable.</div>`;
  }

  const user = store.state.user;
  const visibility = contentData.access?.visibility || 'public';

  // 1. User Tier Rights Check
  const simulatedTier = store.state.simulatedUserTier;
  const userRole = simulatedTier || user?.role || 'subscriber';
  const isPaidMember = userRole === 'member' || userRole === 'affiliate' || userRole === 'admin' || (user?.isAdmin && !simulatedTier);
  const hasUserSession = simulatedTier ? (simulatedTier !== 'prospect') : !!user;

  let hasPermission = false;
  if (visibility === 'public') {
    hasPermission = true;
  } else if (visibility === 'authenticated' && hasUserSession) {
    hasPermission = true;
  } else if (visibility === 'paid' && isPaidMember) {
    hasPermission = true;
  }

  // 2. Render Teaser Preview Block
  const previewText = contentData.preview?.teaserText || contentData.description || '';
  const featuredImage = contentData.preview?.featuredImage?.src || null;

  const previewHTML = `
    <div class="preview-card" style="padding: 1.25rem; background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: var(--theme-layout-border-radius, 8px); margin-bottom: 1.5rem;">
      ${featuredImage ? `<img src="${featuredImage}" alt="${contentData.title}" style="width: 100%; max-height: 380px; object-fit: cover; border-radius: 6px; margin-bottom: 1rem;" />` : ''}
      <p style="color: var(--theme-color-text-secondary, #4a5568); font-size: 1.05rem; line-height: 1.6; margin: 0;">${previewText}</p>
    </div>
  `;

  // 3. Render Locked Paywall Gate if Access Denied
  if (!hasPermission) {
    return `
      <article class="content-teaser" style="max-width: 800px; margin: 2rem auto; font-family: system-ui, sans-serif;">
        <h1 style="font-size: 2.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin-bottom: 1rem;">${contentData.title}</h1>
        ${previewHTML}
        
        <div class="paywall-banner" style="padding: 2.5rem 1.5rem; background: #1a202c; color: #ffffff; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
          <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem;">
            ${visibility === 'paid' ? 'Paid Membership Required' : 'Member Sign-In Required'}
          </h2>
          <p style="color: #a0aec0; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto; font-size: 0.95rem; line-height: 1.5;">
            ${visibility === 'paid' 
              ? 'This publication is reserved exclusively for active paid Members and Affiliate Members ($29/mo).' 
              : 'Please log in to your account to unlock full access.'}
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            ${visibility === 'paid' ? `
              <button id="btn-paywall-subscribe" class="btn-primary" style="padding: 12px 24px; font-size: 1rem; background: #38a169; color: #ffffff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
                Upgrade Membership ($29/mo)
              </button>
            ` : ''}
            <button id="btn-paywall-login" class="btn-primary" style="padding: 12px 24px; font-size: 1rem; background: #3182ce; color: #ffffff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
              Sign In to Account
            </button>
          </div>
        </div>
      </article>
    `;
  }

  // 4. Render Full Content Body for Authorized Users
  const paragraphs = contentData.longFormText || [contentData.description];

  return `
    <article class="content-full" style="max-width: 800px; margin: 2rem auto; font-family: system-ui, sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <span style="text-transform: uppercase; font-size: 0.75rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); letter-spacing: 0.05em; background: #ebf8ff; padding: 4px 10px; border-radius: 12px;">
          ${contentData.type || 'Publication'}
        </span>
        <span style="color: #718096; font-size: 0.85rem;">Published ${contentData.date || 'Today'}</span>
      </div>

      <h1 style="font-size: 2.5rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin-bottom: 0.5rem; line-height: 1.2;">
        ${contentData.title}
      </h1>
      <p style="color: #718096; font-size: 0.9rem; margin-bottom: 2rem;">By <strong>${contentData.author || 'Foundation Team'}</strong></p>

      ${featuredImage ? `<img src="${featuredImage}" alt="${contentData.title}" style="width: 100%; max-height: 420px; object-fit: cover; border-radius: 8px; margin-bottom: 2rem;" />` : ''}

      ${contentData.type === 'event' && contentData.meetUrl ? `
        <div style="background: #ebf8ff; border: 1px solid #bee3f8; padding: 1.25rem; border-radius: 8px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="display: block; color: #2b6cb0; font-size: 1.05rem;">Live Event Google Meet Session</strong>
            <span style="font-size: 0.85rem; color: #2c5282;">Date: ${contentData.date} (${contentData.startTime || '14:00'} - ${contentData.endTime || '15:00'})</span>
          </div>
          <a href="${contentData.meetUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 10px 18px; background: #2b6cb0; color: white; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Join Google Meet
          </a>
        </div>
      ` : ''}

      <div class="body-paragraphs" style="line-height: 1.85; font-size: 1.1rem; color: var(--theme-color-text-primary, #2d3748);">
        ${paragraphs.map(p => `<p style="margin-bottom: 1.5rem;">${p}</p>`).join('')}
      </div>

      ${contentData.worksheets && contentData.worksheets.length > 0 ? `
        <div style="margin-top: 2.5rem; padding: 1.5rem; background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px;">
          <h3 style="margin-top: 0; font-size: 1.1rem; color: var(--theme-color-text-primary, #1a202c);">Attached Course Worksheets</h3>
          <ul style="margin: 0; padding-left: 1.25rem;">
            ${contentData.worksheets.map(w => `<li style="margin-bottom: 0.5rem;"><a href="${w.pdfUrl}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: 600;">${w.title}</a></li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div style="margin-top: 3rem; border-top: 1px solid var(--theme-color-border, #e2e8f0); padding-top: 2rem;">
        <author-card layout="full"></author-card>
      </div>
    </article>
  `;
}

// Global delegated event listener for fail-safe paywall gate login triggers
if (typeof document !== 'undefined') {
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('#btn-paywall-login');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const { authManager } = await import('../core/auth.js');
        await authManager.loginWithGoogle();
      } catch (err) {
        console.error('[Delegated Paywall Login]: Login failed:', err);
      }
    }
  });
}
