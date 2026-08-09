// utils/universalRenderer.js
import { store } from '../core/store.js';
import { configManager } from '../core/config.js';

export function cleanTitle(title) {
  if (typeof title !== 'string') return title;
  let cleaned = title
    // Strip raw CMS type prefixes like [EDUCATION_MODULE_UNLOCKED] or similar bracketed prefixes
    .replace(/^\[[A-Z0-9_-]+\]\s*/i, '')
    // Strip prefixes like PUBLICATION_PREVIEW_ or similar uppercase words followed by underscore
    .replace(/^[A-Z0-9_-]+_\s*/, '')
    // Strip verbose suffixes
    .replace(/\s*(?:-\s*Premium\s*Publications|\s*-\s*Premium\s*Publications\s*&\s*Unlocked\s*Materials|\s*-\s*Unlocked|\s*-\s*Preview|\s*\(UNLOCKED\)|\s*\(PREVIEW\))\s*$/i, '')
    .trim();

  // Truncate long article titles to a maximum of 50 characters with an ellipsis (...)
  if (cleaned.length > 50) {
    cleaned = cleaned.substring(0, 50).trim() + '...';
  }
  return cleaned;
}

/**
 * Evaluates visibility permissions and renders either full unlocked content or a locked paywall gate.
 */
export function renderContent(contentData) {
  if (!contentData) {
    return `<div style="text-align: center; padding: 3rem; color: #718096;">Content record unavailable.</div>`;
  }

  // Handle Multi-Lesson Interactive Education Courses specifically
  if (contentData.type === 'education' && contentData.modules && contentData.modules.length > 0) {
    return `
      <article class="content-full" style="max-width: 1000px; margin: 2rem auto; font-family: system-ui, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <span style="text-transform: uppercase; font-size: 0.75rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); letter-spacing: 0.05em; background: #ebf8ff; padding: 4px 10px; border-radius: 12px;">
            Structured Course
          </span>
          <span style="color: #718096; font-size: 0.85rem;">Published ${contentData.date || 'Today'}</span>
        </div>

        <h1 style="font-size: 2.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin-bottom: 0.5rem; line-height: 1.2;">
          ${contentData.title}
        </h1>
        <p style="color: #718096; font-size: 0.9rem; margin-bottom: 1.5rem;">By <strong>${contentData.author || 'Foundation Team'}</strong></p>

        <!-- Dynamic Overall Course Progress stats bar for enrolled users -->
        <div id="course-player-overall-progress" style="background: var(--theme-color-background, #f7fafc); padding: 1rem; border-radius: 8px; border: 1px solid var(--theme-color-border, #e2e8f0); margin-bottom: 1.5rem; display: none;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: var(--theme-color-text-secondary, #4a5568); margin-bottom: 4px;">
            <span>Course Progress Tracker</span>
            <span id="course-progress-percentage-label">0% Complete</span>
          </div>
          <div style="width: 100%; height: 8px; background: #edf2f7; border-radius: 4px; overflow: hidden;">
            <div id="course-progress-bar-indicator" style="width: 0%; height: 100%; background: var(--theme-color-primary, #2b6cb0); transition: width 0.3s ease-in-out;"></div>
          </div>
        </div>

        <div class="course-player-shell" style="display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 1.5rem;">
          <!-- Left Side: Syllabus Navigation -->
          <div class="course-syllabus-nav" style="flex: 1; min-width: 280px; max-width: 320px; background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1rem; height: max-content;">
            <h3 style="margin-top: 0; font-size: 1.1rem; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem; color: var(--theme-color-primary, #2b6cb0);">Course Syllabus</h3>
            <div id="syllabus-modules-list" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
              <!-- Syllabus modules and lessons will render here dynamically -->
            </div>
          </div>

          <!-- Right Side: Active Lesson Panel -->
          <div class="course-lesson-display" style="flex: 2; min-width: 320px; background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; min-height: 480px;">
            <div id="lesson-content-pane">
              <div style="text-align: center; padding: 4rem 1rem; color: var(--theme-color-text-secondary, #a0aec0);">
                <h3>Welcome to ${contentData.title}</h3>
                <p style="font-size: 0.95rem;">Select a lesson from the syllabus index on the left to begin learning.</p>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-top: 3rem; border-top: 1px solid var(--theme-color-border, #e2e8f0); padding-top: 2rem;">
          <author-card layout="full"></author-card>
        </div>
      </article>
    `;
  }

  const user = store.state.user;
  const visibility = contentData.access?.visibility || 'public';

  // 1. User Tier Rights Check
  const simulatedTier = store.state.simulatedUserTier;
  const userRole = simulatedTier || user?.role || 'subscriber';
  const isPaidMember = userRole === 'member' || userRole === 'affiliate' || userRole === 'admin' || (user?.isAdmin && !simulatedTier);
  const hasUserSession = simulatedTier ? (simulatedTier !== 'prospect') : !!user;

  // Google Authenticated users, Editors, and Admins are always authorized
  const isAuthorizedEditor = !simulatedTier && !!(user && (
    user.provider === 'google.com' ||
    user.role === 'admin' ||
    user.role === 'editor' ||
    user.isAdmin
  ));

  let hasPermission = false;
  if (isAuthorizedEditor) {
    hasPermission = true;
  } else if (visibility === 'public') {
    hasPermission = true;
  } else if (visibility === 'authenticated' && hasUserSession) {
    hasPermission = true;
  } else if (visibility === 'paid' && isPaidMember) {
    hasPermission = true;
  }

  // 2. Render Teaser Preview Block
  const previewText = contentData.preview?.teaserText || contentData.description || '';
  let featuredImage = contentData.preview?.featuredImage?.src || null;

  // DIRECTIVE 3: convert Google Drive links to UC direct download/stream link
  if (featuredImage) {
    const isDrive = featuredImage.includes('drive.google.com') || featuredImage.includes('googleusercontent.com');
    if (isDrive) {
      const match = featuredImage.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || featuredImage.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        featuredImage = `https://drive.google.com/uc?export=view&id=${match[1]}`;
      }
    }
  }

  const previewHTML = `
    <div class="preview-card" style="padding: 1.25rem; background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: var(--theme-layout-border-radius, 8px); margin-bottom: 1.5rem;">
      ${featuredImage ? `<img src="${featuredImage}" loading="lazy" alt="${contentData.title}" style="width: 100%; max-height: 380px; object-fit: cover; border-radius: 6px; margin-bottom: 1rem;" />` : ''}
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

  // Retrieve AdSense credentials from configManager
  const config = configManager?.current || {};
  const adsClientId = config.adsense?.publisherId || "";
  const adsSlotId = config.adsense?.slotId || "";
  const enableInFeed = config.adsense?.enableInFeed !== false;

  // DIRECTIVE 3: GrapesJS Visual Web Builder Render Path inside Article Body
  let bodyContentHTML = '';
  if (contentData.editorType === 'grapesjs') {
    bodyContentHTML = `
      <style>${contentData.compiledCss || ''}</style>
      <div class="grapesjs-content" style="background: #ffffff; border-radius: 8px; overflow: hidden;">
        ${contentData.compiledHtml || ''}
      </div>
    `;
  } else {
    bodyContentHTML = paragraphs.map((p, idx) => {
      let adHtml = "";
      const pIdx = idx + 1; // paragraph index starting at 1
      if (enableInFeed && (pIdx === 3 || pIdx === 7)) {
        adHtml = `<adsense-unit client-id="${adsClientId}" slot-id="${adsSlotId}" format="auto" responsive="true"></adsense-unit>`;
      }
      return `<p style="margin-bottom: 1.5rem;">${p}</p>${adHtml}`;
    }).join('');
  }

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

      ${featuredImage && contentData.editorType !== 'grapesjs' ? `<img src="${featuredImage}" loading="lazy" alt="${contentData.title}" style="width: 100%; max-height: 420px; object-fit: cover; border-radius: 8px; margin-bottom: 2rem;" />` : ''}

      ${contentData.meetUrl ? `
        <div style="background: #ebf8ff; border: 1px solid #bee3f8; padding: 1.25rem; border-radius: 8px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="display: block; color: #2b6cb0; font-size: 1.05rem;">Live Event Google Meet Session</strong>
            <span style="font-size: 0.85rem; color: #2c5282;">Date: ${contentData.date || 'Today'} (${contentData.startTime || '14:00'} - ${contentData.endTime || '15:00'})</span>
          </div>
          <a href="${contentData.meetUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 10px 18px; background: #2b6cb0; color: white; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Join Google Meet
          </a>
        </div>
      ` : ''}

      <div class="body-paragraphs" style="line-height: 1.85; font-size: 1.1rem; color: var(--theme-color-text-primary, #2d3748);">
        ${bodyContentHTML}
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

    const backBtn = e.target.closest('#btn-back-to-feed');
    if (backBtn) {
      e.preventDefault();
      const previousRoute = sessionStorage.getItem('foundation_previous_route');

      // If coming from /account or profile, return to /account directly
      if (previousRoute && (previousRoute.includes('/account') || previousRoute.includes('/profile'))) {
        window.router.navigateTo('/account');
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.router.navigateTo('/home');
      }
    }
  });
}
