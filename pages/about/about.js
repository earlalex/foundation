// pages/about/about.js
import { configManager } from '../../core/config.js';
import { contentDB } from '../../core/db.js';

export async function initAboutPage() {
  console.log('[About Page]: initAboutPage triggered');

  let pageData = null;
  try {
    pageData = await contentDB.getCustomPageBySlug('about');
  } catch (err) {
    console.warn('[Page Override]: Custom page check failed for "about"', err);
  }

  // If there's compiledHtml from GrapesJS or page-creator override, use it!
  if (pageData && pageData.compiledHtml && pageData.editorType === 'grapesjs') {
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = pageData.compiledHtml + (pageData.compiledCss ? `<style>${pageData.compiledCss}</style>` : '');
      return;
    }
  }

  // Fallback to reading structured fields from pageData, or from configManager, or from default high-quality fallbacks
  const authorProfile = configManager.current.authorProfile || {};

  // Resolve Author Details
  const authorName = pageData?.aboutHero?.name || authorProfile.name || 'Jane Doe';
  const authorRole = pageData?.aboutHero?.role || authorProfile.role || 'Lead Systems Architect';
  const authorBio = pageData?.aboutHero?.bio || authorProfile.fullBio || authorProfile.shortBio || 'Pioneering zero-build serverless solutions with native browser execution.';
  const avatarUrl = pageData?.aboutHero?.avatarUrl || authorProfile.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80';

  const socialLinks = pageData?.aboutHero?.socials || authorProfile.socials || {
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    twitter: 'https://x.com'
  };

  // Populate Hero Section elements
  const avatarEl = document.getElementById('about-avatar');
  if (avatarEl) avatarEl.src = avatarUrl;

  const nameEl = document.getElementById('about-name');
  if (nameEl) nameEl.textContent = authorName;

  const titleEl = document.getElementById('about-title');
  if (titleEl) titleEl.textContent = authorRole;

  const bioSummaryEl = document.getElementById('about-bio-summary');
  if (bioSummaryEl) bioSummaryEl.textContent = authorBio;

  // Social Proof Badges
  const socialBadgesEl = document.getElementById('about-social-badges');
  if (socialBadgesEl) {
    socialBadgesEl.innerHTML = '';
    const badgeStyle = "display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 20px; font-size: 0.85rem; font-weight: bold; text-decoration: none; color: var(--theme-color-text-primary, #1a202c); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;";

    if (socialLinks.github) {
      socialBadgesEl.innerHTML += `<a href="${socialLinks.github}" target="_blank" rel="noopener" style="${badgeStyle}">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.182-1.304.417-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        GitHub Verified
      </a>`;
    }
    if (socialLinks.linkedin) {
      socialBadgesEl.innerHTML += `<a href="${socialLinks.linkedin}" target="_blank" rel="noopener" style="${badgeStyle}">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
        LinkedIn Verified
      </a>`;
    }
    if (socialLinks.twitter || socialLinks.x) {
      socialBadgesEl.innerHTML += `<a href="${socialLinks.twitter || socialLinks.x}" target="_blank" rel="noopener" style="${badgeStyle}">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
        Twitter/X Verified
      </a>`;
    }
  }

  // Resolve Mission Copy / Bento Card Pillar Descriptions
  const zeroBuildText = pageData?.aboutPillars?.zeroBuild || 'Running natively in the browser with ES Modules. No complex bundlers, transpilers, or build steps required. Clean, standard code.';
  const dataSovereigntyText = pageData?.aboutPillars?.dataSovereignty || 'Ensuring complete control and encryption over user identity, files, and corporate credentials, utilizing localized encrypted datastores.';
  const aiAutomationText = pageData?.aboutPillars?.aiAutomation || 'Empowering administrative teams with continuous background audits, automated workflows, and AI assistants.';
  const modularArchitectureText = pageData?.aboutPillars?.modularArchitecture || 'Developing extensible, zero-dependency visual page builders, customizable global navigation elements, and reusable components.';

  const valZeroBuild = document.getElementById('val-zero-build');
  if (valZeroBuild) valZeroBuild.textContent = zeroBuildText;

  const valDataSovereignty = document.getElementById('val-data-sovereignty');
  if (valDataSovereignty) valDataSovereignty.textContent = dataSovereigntyText;

  const valAiAutomation = document.getElementById('val-ai-automation');
  if (valAiAutomation) valAiAutomation.textContent = aiAutomationText;

  const valModularArchitecture = document.getElementById('val-modular-architecture');
  if (valModularArchitecture) valModularArchitecture.textContent = modularArchitectureText;

  // Resolve Timeline Milestones
  const defaultTimeline = [
    { date: 'July 2024', title: 'Beta Concept Launch', description: 'Initial framework prototype deployed with native ES route splitting.' },
    { date: 'March 2025', title: 'Production Ready', description: 'Enterprise-ready billing, HIPAA security, and custom SPA routing finalized.' },
    { date: 'August 2026', title: 'Modular Upgrades', description: 'Unified Site Manager, GrapesJS integrations, and secure RBAC access completed.' }
  ];
  const timelineData = pageData?.aboutTimeline || defaultTimeline;

  const timelineContainer = document.getElementById('timeline-container');
  if (timelineContainer) {
    timelineContainer.innerHTML = '';
    timelineData.forEach((item, idx) => {
      timelineContainer.innerHTML += `
        <div class="timeline-item" style="position: relative;">
          <!-- Left side status dot -->
          <div style="position: absolute; left: calc(-2rem - 6px); top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--theme-color-primary, #2b6cb0); border: 2px solid var(--theme-color-surface, #ffffff); box-shadow: 0 0 0 4px rgba(43, 108, 176, 0.15);"></div>

          <span style="font-size: 0.85rem; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.25rem;">
            ${item.date}
          </span>
          <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--theme-color-text-primary, #1a202c);">
            ${item.title}
          </h3>
          <p style="font-size: 0.95rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5; margin: 0;">
            ${item.description}
          </p>
        </div>
      `;
    });
  }
}
