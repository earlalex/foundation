// components/global/RadioStreamPlayer.js
import { store } from '../../core/store.js';
import { configManager } from '../../core/config.js';
import { radioCoordinator } from '../../core/radio.js';
import { i18n } from '../../core/i18n.js';

export class RadioStreamPlayer extends HTMLElement {
  constructor() {
    super();
    this.audio = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.nowPlaying = {
      title: 'Foundation Live Broadcaster',
      artist: 'Sovereign Radio Network',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200'
    };
    this.playlist = [];
    this.activeTrackIndex = -1; // -1 means playing the live feed stream
    this.onLangChange = () => {
      this.render();
      this.updateUI();
    };
  }

  async connectedCallback() {
    if (configManager.current.features?.webRadioPlayer === false) {
      this.style.display = 'none';
      this.remove();
      return;
    }
    document.body.classList.add('has-sticky-player');

    window.addEventListener('language-changed', this.onLangChange);
    window.addEventListener('languageChanged', this.onLangChange);

    this.playlist = await radioCoordinator.getRadioPlaylist();
    this.render();
    this.setupAudio();

    // Subscribe to store to react to role changes (and remove paywall immediately if they subscribe)
    this.unsubscribe = store.subscribe(() => {
      this.checkAccessAndHidePaywall();
    });
  }

  disconnectedCallback() {
    document.body.classList.remove('has-sticky-player');
    window.removeEventListener('language-changed', this.onLangChange);
    window.removeEventListener('languageChanged', this.onLangChange);

    if (this.unsubscribe) this.unsubscribe();
    this.clearTeaserTimer();
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  clearTeaserTimer() {}

  getCurrentUserRole() {
    const user = store.state.user;
    const simulatedTier = store.state.simulatedUserTier;
    return simulatedTier || user?.role || 'prospect';
  }

  isMemberOrAdmin() {
    const role = this.getCurrentUserRole();
    if (role === 'prospect' || role === 'subscriber') {
      return false;
    }
    const isAdmin = store.state.user?.isAdmin || window.__FOUNDATION_DEV_BYPASS__;
    return role === 'member' || role === 'affiliate' || role === 'admin' || isAdmin;
  }

  checkAccessAndHidePaywall() {
    if (this.isMemberOrAdmin()) {
      const paywall = this.querySelector('#radio-paywall-gate');
      if (paywall) paywall.style.display = 'none';
    }
  }

  setupAudio() {
    if (this.audio) {
      this.audio.pause();
    }

    const streamUrl = this.activeTrackIndex === -1
      ? radioCoordinator.getLiveStreamUrl()
      : this.playlist[this.activeTrackIndex].src;

    this.audio = new Audio(streamUrl);
    this.audio.crossOrigin = 'anonymous';

    // Set now playing info
    if (this.activeTrackIndex === -1) {
      this.nowPlaying = {
        title: 'Foundation Live Broadcaster',
        artist: 'Sovereign Radio Network',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200'
      };
    } else {
      const track = this.playlist[this.activeTrackIndex];
      this.nowPlaying = {
        title: track.title,
        artist: track.artist,
        cover: track.cover
      };
    }

    this.updateUI();

    // Attach listeners
    this.audio.addEventListener('timeupdate', () => {
      const isPremium = this.isMemberOrAdmin();
      const teaserLimit = radioCoordinator.getTeaserDuration();

      if (!isPremium && this.audio.currentTime >= teaserLimit) {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();

        // Show paywall gate
        const paywall = this.querySelector('#radio-paywall-gate');
        if (paywall) paywall.style.display = 'flex';
      }
    });

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayButton();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayButton();
    });
  }

  render() {
    this.innerHTML = `
      <style>
        .radio-sticky-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--theme-color-surface, #1a202c);
          border-top: 1px solid var(--theme-color-border, #2d3748);
          padding: 0.75rem 1.5rem;
          color: white;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          box-shadow: 0 -4px 10px rgba(0,0,0,0.15);
          font-family: system-ui, sans-serif;
        }
        .radio-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 250px;
        }
        .radio-cover {
          width: 44px;
          height: 44px;
          border-radius: 6px;
          object-fit: cover;
          background: #333;
        }
        .radio-metadata {
          min-width: 0;
        }
        .radio-title {
          font-size: 0.9rem;
          font-weight: bold;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .radio-artist {
          font-size: 0.75rem;
          color: #a0aec0;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .radio-center {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        .radio-btn {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1.25rem;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .radio-play-btn {
          width: 38px;
          height: 38px;
          background: var(--theme-color-primary, #2b6cb0);
          border-radius: 50%;
          font-size: 1.1rem;
        }
        .radio-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .volume-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .volume-slider {
          width: 80px;
          accent-color: var(--theme-color-primary, #2b6cb0);
          cursor: pointer;
        }
        .live-indicator-badge {
          background: #48bb78;
          color: white;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }
        .live-indicator-badge.offline {
          background: #718096;
        }

        /* Embedded Paywall mini prompt */
        .radio-paywall-gate {
          display: none;
          position: absolute;
          top: -100%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.95);
          color: white;
          padding: 0.5rem 1.5rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: bold;
          align-items: center;
          gap: 0.75rem;
          border: 1px solid var(--theme-color-primary, #2b6cb0);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.35);
          white-space: nowrap;
          z-index: 1000;
        }
        .radio-paywall-upgrade-btn {
          background: var(--theme-color-primary, #2b6cb0);
          border: none;
          color: white;
          font-size: 0.75rem;
          font-weight: bold;
          padding: 4px 10px;
          border-radius: 12px;
          cursor: pointer;
        }

        /* Playlist Selector Dropdown */
        .playlist-dropdown {
          background: #2d3748;
          color: white;
          border: 1px solid #4a5568;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          cursor: pointer;
          outline: none;
        }

        /* Push main content up to avoid being overlapped by sticky bar */
        body {
          padding-bottom: 70px !important;
        }
      </style>

      <div class="radio-sticky-bar">
        <!-- Paywall trigger overlay inside the player bar -->
        <div class="radio-paywall-gate" id="radio-paywall-gate">
          <span>📻 Teaser Limit Reached. Subscribe to unlock 24/7 Live Radio!</span>
          <button class="radio-paywall-upgrade-btn" id="btn-radio-upgrade">Upgrade ($29/mo)</button>
        </div>

        <div class="radio-left">
          <img class="radio-cover" id="radio-cover-img" src="${this.nowPlaying.cover}" alt="Cover Art" />
          <div class="radio-metadata">
            <h5 class="radio-title" id="radio-track-title">${this.nowPlaying.title}</h5>
            <p class="radio-artist" id="radio-track-artist">${this.nowPlaying.artist}</p>
          </div>
        </div>

        <div class="radio-center">
          <button class="radio-btn" id="btn-radio-prev" title="Previous Track">⏮️</button>
          <button class="radio-btn radio-play-btn" id="btn-radio-play-pause" title="Play / Pause">▶️</button>
          <button class="radio-btn" id="btn-radio-next" title="Next Track">⏭️</button>
          <span class="live-indicator-badge" id="live-badge">Live Stream</span>
        </div>

        <div class="radio-right">
          <!-- Playlist selection queue -->
          <label for="radio-playlist-selector" class="sr-only">Select Radio Channel</label>
          <select class="playlist-dropdown" id="radio-playlist-selector" aria-label="Select Radio Channel">
            <option value="-1">📡 Play Live Web Radio Stream</option>
            ${this.playlist.map((track, idx) => `
              <option value="${idx}">🎵 ${track.title}</option>
            `).join('')}
          </select>

          <div class="volume-container">
            <button class="radio-btn" id="btn-radio-mute" style="font-size: 1rem;">🔊</button>
            <label for="radio-volume" class="sr-only">Radio Stream Volume</label>
            <input type="range" id="radio-volume" class="volume-slider" aria-label="Radio Stream Volume" min="0" max="100" step="5" value="80" />
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateUI();
  }

  bindEvents() {
    const playPauseBtn = this.querySelector('#btn-radio-play-pause');
    const muteBtn = this.querySelector('#btn-radio-mute');
    const volumeSlider = this.querySelector('#radio-volume');
    const prevBtn = this.querySelector('#btn-radio-prev');
    const nextBtn = this.querySelector('#btn-radio-next');
    const playlistSelector = this.querySelector('#radio-playlist-selector');
    const upgradeBtn = this.querySelector('#btn-radio-upgrade');

    if (upgradeBtn) {
      upgradeBtn.onclick = (e) => {
        e.stopPropagation();
        window.router?.navigateTo('/account');
      };
    }

    if (playPauseBtn) {
      playPauseBtn.onclick = () => {
        if (!this.audio) return;
        if (this.isPlaying) {
          this.audio.pause();
        } else {
          this.audio.play();
        }
      };
    }

    if (muteBtn) {
      muteBtn.onclick = () => {
        if (!this.audio) return;
        this.isMuted = !this.isMuted;
        this.audio.muted = this.isMuted;
        muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
      };
    }

    if (volumeSlider) {
      volumeSlider.oninput = (e) => {
        if (!this.audio) return;
        this.audio.volume = e.target.value / 100;
      };
    }

    if (playlistSelector) {
      playlistSelector.value = this.activeTrackIndex.toString();
      playlistSelector.onchange = (e) => {
        this.activeTrackIndex = parseInt(e.target.value, 10);
        this.setupAudio();
        this.audio.play();
      };
    }

    const selectNext = () => {
      if (this.playlist.length === 0) return;
      this.activeTrackIndex = (this.activeTrackIndex + 1 + 1) % (this.playlist.length + 1) - 1;
      if (playlistSelector) playlistSelector.value = this.activeTrackIndex.toString();
      this.setupAudio();
      this.audio.play();
    };

    const selectPrev = () => {
      if (this.playlist.length === 0) return;
      this.activeTrackIndex = (this.activeTrackIndex - 1 + this.playlist.length + 1) % (this.playlist.length + 1) - 1;
      if (playlistSelector) playlistSelector.value = this.activeTrackIndex.toString();
      this.setupAudio();
      this.audio.play();
    };

    if (nextBtn) nextBtn.onclick = selectNext;
    if (prevBtn) prevBtn.onclick = selectPrev;
  }

  updateUI() {
    const titleEl = this.querySelector('#radio-track-title');
    const artistEl = this.querySelector('#radio-track-artist');
    const coverEl = this.querySelector('#radio-cover-img');
    const badge = this.querySelector('#live-badge');

    if (titleEl) titleEl.textContent = this.nowPlaying.title;
    if (artistEl) artistEl.textContent = this.nowPlaying.artist;
    if (coverEl) coverEl.src = this.nowPlaying.cover;

    if (badge) {
      if (this.activeTrackIndex === -1) {
        badge.textContent = 'Live Stream';
        badge.classList.remove('offline');
      } else {
        badge.textContent = 'VOD Audio';
        badge.classList.add('offline');
      }
    }
  }

  updatePlayButton() {
    const playPauseBtn = this.querySelector('#btn-radio-play-pause');
    if (playPauseBtn) {
      playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
    }
  }
}

if (!customElements.get('radio-stream-player')) {
  customElements.define('radio-stream-player', RadioStreamPlayer);
}
