// pages/podcast/podcast.js
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';

export async function initPodcastPage() {
  console.log('[Podcast Page]: Initializing...');

  // 1. Load Customizable Hero Override
  try {
    const pageData = await contentDB.getCustomPageBySlug('podcast');
    if (pageData && pageData.hero) {
      const hero = pageData.hero;
      const heroSection = document.getElementById('podcast-hero');
      const titleEl = document.getElementById('pod-hero-title');
      const subtitleEl = document.getElementById('pod-hero-subtitle');
      const primaryCta = document.getElementById('pod-hero-primary-cta');
      const secondaryCta = document.getElementById('pod-hero-secondary-cta');

      if (heroSection) {
        if (hero.enabled === false) {
          heroSection.style.display = 'none';
        } else {
          heroSection.style.display = 'block';
          if (hero.backgroundGradient) {
            heroSection.style.background = hero.backgroundGradient;
          }
          if (hero.heroImageUrl) {
            heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url('${hero.heroImageUrl}')`;
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
    console.warn('[Podcast Page]: Hero loader failed.', err);
  }

  // 2. Setup Interactive Mock Audio Player Controls
  const playBtn = document.getElementById('btn-podcast-play');
  const progressBar = document.getElementById('podcast-progress-bar');
  const currentTimeLabel = document.getElementById('podcast-current-time');
  let isPlaying = false;
  let playInterval = null;

  if (playBtn && progressBar && currentTimeLabel) {
    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        playBtn.textContent = '⏸';
        toast.info('Streaming podcast episode audio stream...');

        let seconds = 252; // starts at 4:12 (252 seconds)
        playInterval = setInterval(() => {
          seconds++;
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          currentTimeLabel.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

          // Progress bar percentage increment
          const totalDurationSecs = 765; // 12:45 total
          const pct = (seconds / totalDurationSecs) * 100;
          progressBar.style.width = `${Math.min(100, pct)}%`;

          if (seconds >= totalDurationSecs) {
            clearInterval(playInterval);
            isPlaying = false;
            playBtn.textContent = '▶';
          }
        }, 1000);
      } else {
        playBtn.textContent = '▶';
        if (playInterval) clearInterval(playInterval);
      }
    });
  }

  // 3. Load Episodes in Carousel
  const carousel = document.getElementById('podcast-episodes-carousel');
  if (!carousel) return;

  try {
    const episodes = await contentDB.getContentByType('podcast', 10);

    if (!episodes || episodes.length === 0) {
      carousel.innerHTML = `<p style="text-align:center;color:#a0aec0;width:100%;">No podcast episodes scheduled yet.</p>`;
      return;
    }

    carousel.innerHTML = episodes.map(episode => {
      const id = episode.id;
      const title = episode.title || 'Sovereign Podcast';
      const description = episode.description || '';
      const date = episode.date || '';
      const tags = episode.tags || ['Sovereignty'];
      const tagsHtml = tags.map(t => `<span style="background:#f3e8ff;color:#7c3aed;font-size:0.7rem;font-weight:bold;padding:1px 6px;border-radius:4px;display:inline-block;margin-right:4px;">#${t}</span>`).join('');

      return `
        <div class="card" style="flex: 0 0 300px; scroll-snap-align: start; background: white; border: 1px solid var(--theme-color-border); border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
          <div>
            <div style="font-size: 0.75rem; color: #a0aec0; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
              <span>📅 ${date}</span>
              <div>${tagsHtml}</div>
            </div>
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 800; color: #1e1b4b; line-height: 1.4;">${title}</h4>
            <p style="margin: 0; font-size: 0.85rem; color: var(--theme-color-text-secondary); line-height: 1.5; min-height: 4.5rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${description}</p>
          </div>
          <button class="btn-primary btn-load-episode" data-id="${id}" data-title="${title}" style="background: #7c3aed; color: white; padding: 8px 12px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; border: none; cursor: pointer; margin-top: 1rem;">
            🎧 Load Episode
          </button>
        </div>
      `;
    }).join('');

    // Wire up load episode selectors to play in Hero Player
    carousel.querySelectorAll('.btn-load-episode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const title = e.target.getAttribute('data-title');

        // Reset player state
        if (playInterval) clearInterval(playInterval);
        isPlaying = false;
        if (playBtn) playBtn.textContent = '▶';
        if (currentTimeLabel) currentTimeLabel.textContent = '00:00';
        if (progressBar) progressBar.style.width = '0%';

        // Set Hero title
        const currentTitleEl = document.getElementById('current-podcast-title');
        if (currentTitleEl) {
          currentTitleEl.textContent = title;
        }

        toast.success(`Episode loaded: "${title}". Click Play above to listen!`);
      });
    });

  } catch (err) {
    console.error('[Podcast Episode Load Error]:', err);
    carousel.innerHTML = `<p style="text-align:center;color:#ef4444;width:100%;">Error loading episodes list.</p>`;
  }
}
