// pages/about/about.js
import { configManager } from '../../core/config.js';

export function initAboutPage() {
  const bioContainer = document.getElementById('extended-bio-container');
  if (!bioContainer) return;

  const profile = configManager.current.authorProfile || {};
  const fullBio = profile.fullBio || profile.shortBio || 'Welcome to Foundation framework.';

  const paragraphs = fullBio.split('\n').filter(p => p.trim().length > 0);

  bioContainer.innerHTML = paragraphs.map(p => `<p style="margin-bottom: 1.25rem;">${p}</p>`).join('') +
    (profile.signatureUrl ? `
      <div style="margin-top: 2rem; border-top: 1px solid var(--theme-color-border, #e2e8f0); padding-top: 1.5rem;">
        <img src="${profile.signatureUrl}" alt="Author Signature" style="max-height: 60px;" />
      </div>
    ` : '');
}