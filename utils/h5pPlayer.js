// utils/h5pPlayer.js - Client-Side H5P Player integration with pure ES Module CDN loading

/**
 * Dynamically loads and renders H5P interactive content using h5p-standalone.
 *
 * @param {HTMLElement} containerEl - The container element to mount the player
 * @param {string} h5pFolderPath - Dynamic path/URL to the unpacked H5P directory (containing h5p.json)
 * @param {function} onProgressUpdate - Callback triggered on progress or completion with score/percentage
 */
export async function renderH5PContent(containerEl, h5pFolderPath, onProgressUpdate) {
  containerEl.innerHTML = '<div id="h5p-container" style="width: 100%; min-height: 450px;"></div>';
  const el = document.getElementById('h5p-container');

  // Defer preloading or prefetching CSS stylesheets for H5P standalone dynamic triggers
  if (!document.querySelector('link[href*="h5p.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/h5p-standalone@latest/dist/styles/h5p.css';
    document.head.appendChild(link);
  }

  try {
    // Dynamic import of H5P standalone to satisfy zero-build Native ES module standards
    const module = await import('https://cdn.jsdelivr.net/npm/h5p-standalone@latest/dist/main.bundle.js');
    const H5PClass = module.H5P || window.H5P;

    if (!H5PClass) {
      throw new Error('H5P standalone library failed to initialize from CDN.');
    }

    const options = {
      h5pJsonPath: h5pFolderPath,
      frameJs: 'https://cdn.jsdelivr.net/npm/h5p-standalone@latest/dist/frame.bundle.js',
      frameCss: 'https://cdn.jsdelivr.net/npm/h5p-standalone@latest/dist/styles/h5p.css'
    };

    const player = await new H5PClass(el, options);

    // Hook into global H5P xAPI external dispatcher for automated score & progress tracking
    if (window.H5P && window.H5P.externalDispatcher) {
      window.H5P.externalDispatcher.on('xAPI', (event) => {
        const verb = event.getVerb();
        if (verb === 'completed' || verb === 'answered') {
          const score = event.getScore();
          const maxScore = event.getMaxScore();
          const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;

          if (typeof onProgressUpdate === 'function') {
            onProgressUpdate({
              completed: true,
              score: score,
              maxScore: maxScore,
              percentage: percentage,
              timestamp: new Date().toISOString()
            });
          }
        }
      });
    }

    return player;
  } catch (err) {
    console.error('[H5P Player]: Load failure. Simulating player fallback.', err);

    // Graceful simulation fallback for local or offline test environments
    el.innerHTML = `
      <div style="padding: 2rem; border: 2px dashed var(--theme-color-border, #cbd5e0); border-radius: 8px; text-align: center; background: var(--theme-color-surface, #ffffff);">
        <h4 style="margin: 0 0 0.5rem 0; color: var(--theme-color-primary, #2b6cb0);">[Simulated H5P Interactive Content]</h4>
        <p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem; margin-bottom: 1.5rem;">Path: <code>${h5pFolderPath}</code></p>
        <div style="background: var(--theme-color-background, #f7fafc); padding: 1rem; border-radius: 6px; border: 1px solid var(--theme-color-border, #e2e8f0); display: inline-block; margin-bottom: 1.5rem;">
          <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.5rem;">Simulate Score:</label>
          <input type="number" id="sim-h5p-score" value="8" min="0" max="10" style="width: 60px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #cbd5e0; margin-right: 0.5rem;" />
          <span>out of</span>
          <input type="number" id="sim-h5p-max" value="10" min="1" max="100" style="width: 60px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid #cbd5e0; margin-left: 0.5rem;" />
        </div>
        <div>
          <button id="btn-submit-sim-h5p" class="btn-primary" style="padding: 8px 20px; font-weight: bold; border-radius: 6px; font-size: 0.85rem;">
            Submit Answers (Simulate xAPI)
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-submit-sim-h5p')?.addEventListener('click', () => {
      const score = parseInt(document.getElementById('sim-h5p-score').value) || 0;
      const maxScore = parseInt(document.getElementById('sim-h5p-max').value) || 10;
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;

      if (typeof onProgressUpdate === 'function') {
        onProgressUpdate({
          completed: true,
          score: score,
          maxScore: maxScore,
          percentage: percentage,
          timestamp: new Date().toISOString()
        });
      }
    });

    return null;
  }
}
