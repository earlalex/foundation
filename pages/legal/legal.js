// pages/legal/legal.js - Dynamic Page Controller for Legal & Compliance Policies
import { contentDB } from '../../core/db.js';

export async function initLegalPage(path) {
  const container = document.getElementById('legal-page-content');
  if (!container) {
    console.warn('[initLegalPage] Container #legal-page-content not found in DOM.');
    return;
  }

  // Derive slug ('privacy', 'terms', 'cookies')
  const slug = path.replace(/^\//, '');

  try {
    const pageData = await contentDB.getCustomPageBySlug(slug);
    if (pageData) {
      if (pageData.editorType === 'grapesjs') {
        container.innerHTML = `
          <nav style="margin-bottom: 2rem;">
            <a href="/home" data-link style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 0.5rem;" aria-label="Go back to the homepage">
              &larr; Back to Home
            </a>
          </nav>
          <style>${pageData.compiledCss || ''}</style>
          <div class="grapesjs-page-content" style="background: #ffffff; border-radius: 8px; overflow: hidden; color: #1a202c; font-family: system-ui, sans-serif;">
            ${pageData.compiledHtml || ''}
          </div>
        `;
      } else if (pageData.compiledHtml) {
        container.innerHTML = `
          <nav style="margin-bottom: 2rem;">
            <a href="/home" data-link style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 0.5rem;" aria-label="Go back to the homepage">
              &larr; Back to Home
            </a>
          </nav>
          ${pageData.compiledHtml}
        `;
      } else if (pageData.blocks) {
        // Fallback to block list rendering
        const blocks = pageData.blocks || [];
        const blocksHtml = blocks.map(b => {
          if (b.type === 'heading') {
            return `<h2 style="font-size: 1.75rem; color: var(--theme-color-primary, #2b6cb0); margin-top: 2rem; margin-bottom: 0.75rem; font-weight: 800; border-bottom: 1px solid var(--theme-color-border, #edf2f7); padding-bottom: 0.5rem;">${b.value}</h2>`;
          } else if (b.type === 'paragraph') {
            return `<p style="line-height: 1.75; font-size: 1.05rem; color: var(--theme-color-text-secondary, #2d3748); margin-bottom: 1.25rem;">${b.value}</p>`;
          } else if (b.type === 'image') {
            return `<div style="text-align: center; margin: 2rem 0;"><img src="${b.value}" alt="${pageData.title}" style="max-width: 100%; border-radius: 8px;" /></div>`;
          } else if (b.type === 'cta') {
            return `
              <div style="background: var(--theme-color-background, #ebf8ff); border: 1px solid var(--theme-color-border, #bee3f8); border-radius: var(--theme-layout-border-radius, 8px); padding: 2rem; text-align: center; margin: 2.5rem 0;">
                <h3 style="font-size: 1.35rem; color: var(--theme-color-primary, #2b6cb0); margin-top: 0; margin-bottom: 0.75rem;">Premium Resource</h3>
                <button onclick="window.router.navigateTo('/account')" class="btn-primary" style="padding: 10px 24px; font-weight: bold; border-radius: 6px;">${b.value || 'Get Access'}</button>
              </div>
            `;
          }
          return '';
        }).join('');

        container.innerHTML = `
          <nav style="margin-bottom: 2rem;">
            <a href="/home" data-link style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 0.5rem;" aria-label="Go back to the homepage">
              &larr; Back to Home
            </a>
          </nav>
          <article style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: var(--theme-layout-border-radius, 8px); padding: 2rem; box-shadow: var(--theme-layout-box-shadow, 0 1px 3px rgba(0,0,0,0.08));">
            <header style="border-bottom: 2px solid var(--theme-color-border, #edf2f7); padding-bottom: 1.5rem; margin-bottom: 2rem;">
              <h1 style="font-size: 2.5rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin: 0 0 0.5rem 0; line-height: 1.25;">${pageData.title}</h1>
              <p style="font-size: 0.85rem; color: var(--theme-color-text-secondary, #718096);">Last Updated: ${pageData.date || 'August 1, 2026'}</p>
            </header>
            <div>
              ${blocksHtml}
            </div>
          </article>
        `;
      }
    }
  } catch (err) {
    console.warn(`[initLegalPage] Error applying custom page data for slug: ${slug}`, err);
  }
}
