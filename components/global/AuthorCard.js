// components/global/AuthorCard.js
import { configManager } from '../../core/config.js';

export class AuthorCard extends HTMLElement {
  connectedCallback() {
    const profile = configManager.current.authorProfile || {};
    const layout = this.getAttribute('layout') || 'compact'; // 'compact' | 'full'

    const escapeHTML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const sanitizeUrl = (url) => {
      if (!url) return '';
      const clean = url.trim();
      if (clean.toLowerCase().startsWith('javascript:')) {
        return '';
      }
      return clean;
    };

    const name = profile.name || 'Admin Author';
    const role = profile.role || 'Lead Architect';
    const tagline = profile.tagline || 'Building the zero-build web.';
    const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%232b6cb0'/><text x='50%' y='60%' font-size='40' text-anchor='middle' fill='%23ffffff'>👤</text></svg>";
    const avatar = profile.avatarUrl || defaultAvatar;
    
    const bio = layout === 'full' 
      ? (profile.fullBio || profile.shortBio || tagline || 'Welcome to Foundation framework.') 
      : (profile.shortBio || tagline || 'Building the zero-build web.');
      
    const socials = profile.socials || {};

    const sanitizedName = escapeHTML(name);
    const sanitizedRole = escapeHTML(role);
    const sanitizedBio = escapeHTML(bio);
    const sanitizedAvatar = escapeHTML(sanitizeUrl(avatar));

    const github = socials.github ? escapeHTML(sanitizeUrl(socials.github)) : '';
    const twitter = socials.twitter ? escapeHTML(sanitizeUrl(socials.twitter)) : '';
    const linkedin = socials.linkedin ? escapeHTML(sanitizeUrl(socials.linkedin)) : '';
    const website = socials.website ? escapeHTML(sanitizeUrl(socials.website)) : '';

    const hasSocials = github || twitter || linkedin || website;

    this.innerHTML = `
      <article class="author-card" style="border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: var(--theme-layout-border-radius, 8px); padding: 1.25rem; background: var(--theme-color-surface, #ffffff); display: flex; gap: 1.25rem; align-items: ${layout === 'full' ? 'flex-start' : 'center'};">
        <img src="${sanitizedAvatar}" alt="${sanitizedName}" width="${layout === 'full' ? '80' : '56'}" height="${layout === 'full' ? '80' : '56'}" loading="lazy" style="width: ${layout === 'full' ? '80px' : '56px'}; height: ${layout === 'full' ? '80px' : '56px'}; border-radius: 50%; object-fit: cover; border: 2px solid var(--theme-color-primary, #2b6cb0);" />
        <div style="flex: 1;">
          <h3 style="margin: 0 0 0.25rem 0; font-size: 1.15rem; color: var(--theme-color-text-primary, #1a202c); font-weight: 700;">${sanitizedName}</h3>
          <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; font-weight: 600; color: var(--theme-color-primary, #2b6cb0);">${sanitizedRole}</p>
          <p style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5;">${sanitizedBio}</p>
          ${
            hasSocials ? `
              <div style="display: flex; gap: 0.75rem; font-size: 0.8rem;">
                ${github ? `<a href="${github}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">GitHub</a>` : ''}
                ${twitter ? `<a href="${twitter}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">Twitter/X</a>` : ''}
                ${linkedin ? `<a href="${linkedin}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">LinkedIn</a>` : ''}
                ${website ? `<a href="${website}" target="_blank" rel="noopener" style="color: var(--theme-color-primary, #2b6cb0); text-decoration: none; font-weight: 600;">Website</a>` : ''}
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
