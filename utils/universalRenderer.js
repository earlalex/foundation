// utils/universalRenderer.js
import { store } from '../index.js';

export function renderContent(contentData) {
  const user = store.state.user;
  const visibility = contentData.access?.visibility || 'public';

  // 1. Calculate Access Rights
  const isUserLoggedIn = !!user;
  const isPaidMember = user?.isPaid || false;

  let hasPermission = false;

  if (visibility === 'public') {
    hasPermission = true;
  } else if (visibility === 'authenticated' && isUserLoggedIn) {
    hasPermission = true;
  } else if (visibility === 'paid' && isPaidMember) {
    hasPermission = true;
  }

  // 2. ALWAYS Render Public Previews (Hero Video, Audio Sample, Teaser Text)
  const previewHTML = renderPreviewBlock(contentData.preview);

  // 3. Render Paywall/Login Guard if access is denied
  if (!hasPermission) {
    return `
      <article class="content-teaser">
        <h1>${contentData.title}</h1>
        ${previewHTML}
        
        <div class="access-gate-banner" style="padding: 2rem; background: #2d3748; color: white; border-radius: 8px; text-align: center;">
          <h2>🔒 ${visibility === 'authenticated' ? 'Members Only' : 'Premium Content'}</h2>
          <p>Please ${isUserLoggedIn ? 'upgrade your account' : 'sign in'} to access the full material, interactive worksheets, and downloads.</p>
          <a href="/auth" class="btn-primary">${isUserLoggedIn ? 'Upgrade Membership' : 'Log In / Sign Up'}</a>
        </div>
      </article>
    `;
  }

  // 4. Render Full Unlocked Content when authorized
  return renderFullBody(contentData, previewHTML);
}