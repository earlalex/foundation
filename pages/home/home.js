// pages/home/home.js - High-Converting Multi-Section Product Showcase Layout
import { contentDB } from '../../core/db.js';
import { errorHandler } from '../../core/error-handler.js';
import { toast } from '../../utils/toast.js';
import { initScrollReveal } from '../../utils/observer.js';

export async function initHomePage() {
  console.log('[Home Page]: Initializing product marketing showcase...');

  // 1. Customize / Populate Hero Banner dynamically if configured via Admin CMS Configurator
  try {
    const pageData = await contentDB.getCustomPageBySlug('home');
    if (pageData && pageData.hero) {
      const hero = pageData.hero;
      const heroSection = document.getElementById('homepage-hero-section');
      const titleEl = document.getElementById('hero-title');
      const subtitleEl = document.getElementById('hero-subtitle');
      const primaryCta = document.getElementById('hero-primary-cta');
      const secondaryCta = document.getElementById('hero-secondary-cta');

      if (heroSection) {
        if (hero.enabled === false) {
          heroSection.style.display = 'none';
        } else {
          heroSection.style.display = 'block';
          if (hero.backgroundGradient) {
            heroSection.style.background = hero.backgroundGradient;
          }
          if (hero.heroImageUrl) {
            heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${hero.heroImageUrl}')`;
            heroSection.style.backgroundSize = 'cover';
            heroSection.style.backgroundPosition = 'center';
          }
        }
      }

      if (titleEl && hero.title) titleEl.textContent = hero.title;
      if (subtitleEl && hero.subtitle) subtitleEl.textContent = hero.subtitle;

      if (primaryCta) {
        if (hero.primaryCtaText) primaryCta.textContent = hero.primaryCtaText;
        if (hero.primaryCtaUrl) primaryCta.setAttribute('href', hero.primaryCtaUrl);
      }
      if (secondaryCta) {
        if (hero.secondaryCtaText) secondaryCta.textContent = hero.secondaryCtaText;
        if (hero.secondaryCtaUrl) secondaryCta.setAttribute('href', hero.secondaryCtaUrl);
      }
    }
  } catch (err) {
    console.warn('[Home Page]: Custom hero loader failed, using default markup.', err);
  }

  // 2. Setup Lead Magnet Subscription Form Handler
  const leadMagnetForm = document.getElementById('lead-magnet-form');
  const leadEmailInput = document.getElementById('lead-magnet-email');
  const leadSubmitBtn = document.getElementById('btn-lead-magnet-submit');

  if (leadMagnetForm && leadEmailInput && leadSubmitBtn) {
    leadMagnetForm.onsubmit = async (e) => {
      e.preventDefault();
      const email = leadEmailInput.value.trim();
      if (!email) return;

      leadSubmitBtn.disabled = true;
      leadSubmitBtn.textContent = 'Submitting...';

      try {
        await contentDB.saveUser({
          email,
          role: 'subscriber',
          name: email.split('@')[0],
          leadMagnetAcquired: true,
          consentDate: new Date().toISOString()
        });

        // Trigger contact sync
        try {
          const { createGoogleContact } = await import('../../core/google-services.js');
          await createGoogleContact({
            name: email.split('@')[0],
            email,
            role: 'Subscriber'
          });
        } catch (contactErr) {
          console.warn('[Lead Magnet]: Contacts sync deferred.', contactErr.message);
        }

        toast.success('Congratulations! The Zero-Build Handbook was sent to your email.');
        leadMagnetForm.reset();
      } catch (err) {
        console.error('[Lead Magnet Error]:', err);
        toast.error('Failed to submit, please try again.');
      } finally {
        leadSubmitBtn.disabled = false;
        leadSubmitBtn.textContent = 'Get Free Resource';
      }
    };
  }

  // 3. Trigger Smooth Scroll Reveal intersection animations
  try {
    initScrollReveal();
  } catch (err) {
    console.warn('[Home Page]: Scroll reveal observer deferred.', err);
  }

  // 4. Fetch and render published multi-section updates previews
  const container = document.getElementById('home-sections-container');
  if (!container) return;

  try {
    const allItems = await contentDB.getContentByType('all', 50);
    if (!allItems || allItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; background: var(--theme-color-surface-alt, #f8fafc); border-radius: 8px; border: 1px dashed var(--theme-color-border, #cbd5e0);">
          <p style="color: #718096; margin: 0; font-size: 0.9rem;">No framework publications or updates found.</p>
        </div>
      `;
      return;
    }

    const sectionConfigs = [
      { type: 'blog', title: 'Community Blogs' },
      { type: 'event', title: 'Live Events & Meets' },
      { type: 'podcast', title: 'Platform Podcasts' },
      { type: 'education', title: 'Premium Courses' }
    ];

    const grouped = {};
    allItems.forEach((item) => {
      const t = item.type || 'blog';
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(item);
    });

    let htmlOutput = '';
    let renderedCount = 0;

    sectionConfigs.forEach((config) => {
      const typeItems = grouped[config.type] || [];
      if (typeItems.length === 0) return;

      renderedCount++;
      const previewItems = typeItems.slice(0, 3); // Previews of the top 3 items

      htmlOutput += `
        <div class="reveal-on-scroll" style="margin-bottom: 2rem; border-bottom: 1px solid var(--theme-color-border, #edf2f7); padding-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.15rem; color: var(--theme-color-text-primary, #1a202c); font-weight: bold; margin: 0;">
              ${config.title}
            </h3>
            <span style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); font-weight: bold; background: var(--theme-color-background, #edf2f7); padding: 2px 8px; border-radius: 12px;">
              ${typeItems.length} ${typeItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
            ${previewItems.map((item) => renderContentCard(item)).join('')}
          </div>
        </div>
      `;
    });

    if (renderedCount === 0) {
      container.innerHTML = `<p style="color: #a0aec0; font-size: 0.9rem;">No matching sections found.</p>`;
      return;
    }

    container.innerHTML = htmlOutput;
    // Re-run scroll-reveal on new elements
    initScrollReveal();
  } catch (err) {
    errorHandler.handleError(err, 'Home Page - Previews Loader');
    container.innerHTML = `<p style="color: #e53e3e;">Error loading dynamic updates.</p>`;
  }
}

function renderContentCard(item) {
  const isEvent = item.type === 'event';
  const id = escapeHTML(item.id || '');
  const title = escapeHTML(item.title || '');
  const date = escapeHTML(item.date || '');
  const description = escapeHTML(item.preview?.teaserText || item.description || '');
  const author = escapeHTML(item.author || 'Foundation Team');

  return `
    <div class="reveal-on-scroll" style="display: flex; flex-direction: column; gap: 0.5rem; background: white; border-radius: 8px; overflow: hidden;">
      <content-card 
        id="${id}"
        title="${title}" 
        date="${date}" 
        author="${author}"
        description="${description}">
      </content-card>
      ${
        isEvent && item.meetUrl
          ? `
        <a href="${item.meetUrl}" target="_blank" rel="noopener noreferrer" 
            style="display: inline-block; text-align: center; background: var(--theme-color-primary, #2b6cb0); color: #ffffff; padding: 8px 12px; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 600;">
            Join Google Meet
        </a>
      `
          : ''
      }
    </div>
  `;
}

function escapeHTML(str) {
  return String(str).replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
  );
}
