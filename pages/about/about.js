// pages/about/about.js
import { configManager } from '../../core/config.js';
import { contentDB } from '../../core/db.js';

export async function initAboutPage() {
  // 1. Persistent Page Overrides Check
  try {
    const override = await contentDB.getCustomPageBySlug('about');
    if (override && override.compiledHtml) {
      const appContainer = document.getElementById('app');
      if (appContainer) {
        appContainer.innerHTML = override.compiledHtml + (override.compiledCss ? `<style>${override.compiledCss}</style>` : '');
        return;
      }
    }
  } catch (err) {
    console.warn('[Page Override]: Custom page override check failed for "about"', err);
  }

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
