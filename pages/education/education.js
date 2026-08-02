// pages/education/education.js
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';

export async function initEducationPage() {
  console.log('[Education Page]: Initializing...');

  // 1. Load Customizable Hero Override
  try {
    const pageData = await contentDB.getCustomPageBySlug('education');
    if (pageData && pageData.hero) {
      const hero = pageData.hero;
      const heroSection = document.getElementById('education-hero');
      const titleEl = document.getElementById('edu-hero-title');
      const subtitleEl = document.getElementById('edu-hero-subtitle');
      const primaryCta = document.getElementById('edu-hero-primary-cta');
      const secondaryCta = document.getElementById('edu-hero-secondary-cta');

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
    console.warn('[Education Page]: Hero loader failed.', err);
  }

  // 2. Load and Filter Interactive Course Cards
  const container = document.getElementById('education-courses-container');
  if (!container) return;

  try {
    const courses = await contentDB.getContentByType('education', 10);

    // Make sure we have at least one course
    if (!courses || courses.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #a0aec0;">
          No education courses scheduled yet. Create some inside the backoffice.
        </div>
      `;
      return;
    }

    const renderCourses = (skillFilter = 'all') => {
      const filtered = courses.filter(course => {
        if (skillFilter === 'all') return true;
        const tags = course.tags || [];
        return tags.some(t => t.toLowerCase() === skillFilter.toLowerCase());
      });

      if (filtered.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#a0aec0;">No courses found matching this topic.</p>`;
        return;
      }

      container.innerHTML = filtered.map(course => {
        const id = course.id;
        const title = course.title || 'Interactive Course';
        const description = course.description || '';
        const tags = course.tags || ['Zero-Build'];

        // Progress representation (simulated or real)
        const progressPct = Math.round(Math.random() * 40 + 20); // 20% - 60% progress representation

        const tagsHtml = tags.map(tag => `
          <a href="/tag/${tag}" style="background: #edf2f7; color: #4a5568; font-size: 0.75rem; font-weight: bold; text-decoration: none; padding: 2px 6px; border-radius: 4px;" class="tag-chip">🏷️ ${tag}</a>
        `).join(' ');

        return `
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1.5rem; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.02); height: 100%;">
            <div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                ${tagsHtml}
              </div>
              <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c);">${title}</h3>
              <p style="margin: 0 0 1.25rem 0; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.5; min-height: 3rem;">${description}</p>

              <!-- Progress Indicator -->
              <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--theme-color-text-secondary); font-weight: bold; margin-bottom: 4px;">
                  <span>Course Progress</span>
                  <span>${progressPct}% Complete</span>
                </div>
                <div style="height: 6px; background: #e2e8f0; border-radius: 3px; width: 100%; overflow: hidden;">
                  <div style="height: 100%; background: var(--theme-color-accent, #38a169); width: ${progressPct}%;"></div>
                </div>
              </div>
            </div>

            <button class="btn-primary btn-enroll" data-id="${id}" style="width: 100%; text-align: center; font-weight: bold; padding: 10px; border-radius: 6px; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; cursor: pointer;">
              [ Enroll Now ]
            </button>
          </div>
        `;
      }).join('');

      // Add enroll button listeners
      container.querySelectorAll('.btn-enroll').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const cid = e.target.getAttribute('data-id');
          toast.success(`Successfully enrolled! Lesson dashboard unlocked.`);
          window.router?.navigateTo(`/detail?id=${cid}`);
        });
      });
    };

    renderCourses('all');

    // Wire up dynamic skill category filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'white';
          b.style.color = 'var(--theme-color-text-secondary)';
        });
        e.target.classList.add('active');
        e.target.style.background = 'var(--theme-color-primary, #2b6cb0)';
        e.target.style.color = 'white';

        const filterSkill = e.target.getAttribute('data-skill');
        renderCourses(filterSkill);
      });
    });

  } catch (err) {
    console.error('[Education Page Grid]: Failed to load courses.', err);
    container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#ef4444;">Error loading courses.</p>`;
  }
}
