// components/global/AuthorCard.js
import { configManager } from '../../core/config.js';

export class AuthorCard extends HTMLElement {
  connectedCallback() {
    const profile = configManager.current.authorProfile || {};
    const layout = this.getAttribute('layout') || 'compact'; // 'compact' | 'full'

    const name = profile.name || 'Admin Author';
    const role = profile.role || 'Lead Architect';
    const tagline = profile.tagline || 'Building the zero-build web.';
    const avatar = profile.avatarUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23cbd5e0"/><text x="50%" y="55%" font-size="30" text-anchor="middle" fill="%234a5568">👤</text></svg>';
    const bio = layout === 'full' ? (profile.fullBio || profile.shortBio) : (profile.shortBio || tagline);
    const socials = profile.socials || {};

    this.innerHTML = `
      <article class="author-card" style="border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: var(--theme-layout-border-radius, 8px); padding: 1.25rem; background: var(--theme-color-surface, #ffffff); display: flex; gap: 1rem; align-items: ${layout === 'full' ? 'flex-start' : 'center'};">
        <img src="${avatar}" alt="${name}" style="width: ${layout === 'full' ? '80px' : '56px'}; height: ${layout === 'full' ? '80px' : '56px'}; border-radius: 50%; object-fit: cover; border: 2px solid var(--theme-color-primary, #2b6cb0);" />
        <div style="flex: 1;">
          <h3 style="margin: 0 0 0.25rem 0; font-size: 1.1rem; color: var(--theme-color-text-primary, #1a202c);">${name}</h3>
          <p style="margin: 0 0 0.5rem 0; font-size: 0.825rem; font-weight: 600; color: var(--theme-color-primary, #2b6cb0);">${role}</p>
          <p style="margin: 0 0 0.75rem 0; font-size: 0.875rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.4;">${bio}</p>
          ${
            socials && Object.keys(socials).some(k => socials[k]) ? `
              <div style="display: flex; gap: 0.75rem; font-size: 0.8rem;">
                ${socials.github ? `<a href="${socials.github}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">GitHub</a>` : ''}
                ${socials.twitter ? `<a href="${socials.twitter}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">Twitter/X</a>` : ''}
                ${socials.linkedin ? `<a href="${socials.linkedin}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">LinkedIn</a>` : ''}
                ${socials.website ? `<a href="${socials.website}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">Website</a>` : ''}
              </div>
            ` : ''
          }
        </div>
      </article>
    `;
  }
}

if (!customElements.get('author-card')) {
  customElements.define('author-card', AuthorCard);
}