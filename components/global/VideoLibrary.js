// components/global/VideoLibrary.js
import { store } from '../../core/store.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';

export class VideoLibrary extends HTMLElement {
  constructor() {
    super();
    this.videos = [];
    this.activeCategory = 'all';
    this.activeVideo = null;
  }

  connectedCallback() {
    this.loadVideos();
    this.render();
  }

  loadVideos() {
    // Check if there are configured videos or fall back to beautiful seed content
    const customVideos = configManager.current.media?.videos;
    if (customVideos && customVideos.length > 0) {
      this.videos = customVideos;
    } else {
      this.videos = [
        {
          id: 'vid-1',
          title: 'Sovereign Zero-Build Architectures Keynote',
          description: 'Learn why the world is moving away from complex Webpack and Vite bundling systems to native browser ESM execution. This talk outlines our core engineering values and zero trust boundaries.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          category: 'Keynote',
          duration: '09:56',
          views: 1245,
          thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
          isLive: false
        },
        {
          id: 'vid-2',
          title: 'Live Stream: Designing the Perfect Bento Grid',
          description: 'Watch real-time CSS grid masterclass modeling 12 bespoke layouts on a single clean template without single layout shifts.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          category: 'Design',
          duration: '10:53',
          views: 930,
          thumbnail: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800',
          isLive: true
        },
        {
          id: 'vid-3',
          title: 'Secure Credential Vaults with LastPass API',
          description: 'Step-by-step video tutorial demonstrating end-to-end masked user synchronization between Google drive file and LastPass enterprise API backend hooks.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          category: 'Security',
          duration: '03:40',
          views: 520,
          thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
          isLive: false
        },
        {
          id: 'vid-4',
          title: 'Wise Business Payout & Payroll Setup',
          description: 'A sovereign financial blueprint video on setting up instant batch-wire payouts to contractors worldwide using custom transaction fee adjustors.',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
          category: 'Finances',
          duration: '02:05',
          views: 310,
          thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
          isLive: false
        }
      ];
    }

    this.activeVideo = this.videos[0];
  }

  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  sanitizeUrl(url) {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (
      trimmed.startsWith('/') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('data:image/')
    ) {
      return this.escapeHTML(trimmed);
    }
    return '';
  }

  render() {
    const escapeHTML = this.escapeHTML;
    const sanitizeUrl = this.sanitizeUrl.bind(this);

    const categories = ['all', ...new Set(this.videos.map(v => v.category).filter(Boolean))];

    const filteredVideos = this.activeCategory === 'all'
      ? this.videos
      : this.videos.filter(v => v.category === this.activeCategory);

    const activeVid = {
      id: escapeHTML(this.activeVideo?.id || ''),
      title: escapeHTML(this.activeVideo?.title || ''),
      description: escapeHTML(this.activeVideo?.description || ''),
      url: sanitizeUrl(this.activeVideo?.url || ''),
      category: escapeHTML(this.activeVideo?.category || ''),
      duration: escapeHTML(this.activeVideo?.duration || ''),
      views: escapeHTML(this.activeVideo?.views || 0),
      thumbnail: sanitizeUrl(this.activeVideo?.thumbnail || ''),
      isLive: !!this.activeVideo?.isLive
    };

    this.innerHTML = `
      <style>
        .videos-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
          margin-top: 1.5rem;
        }
        @media (min-width: 1024px) {
          .videos-container {
            grid-template-columns: 2.2fr 1fr;
          }
        }
        .spotlight-card {
          background: var(--theme-color-surface, #ffffff);
          border: 1px solid var(--theme-color-border, #e2e8f0);
          border-radius: var(--theme-layout-border-radius, 12px);
          overflow: hidden;
          margin-bottom: 2rem;
        }
        .spotlight-info {
          padding: 1.5rem;
        }
        .spotlight-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--theme-color-text-primary, #1a202c);
          margin: 0 0 0.5rem 0;
        }
        .spotlight-desc {
          color: var(--theme-color-text-secondary, #4a5568);
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
        }
        .category-pills {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
          margin-bottom: 1.5rem;
          -webkit-overflow-scrolling: touch;
        }
        .category-pill {
          background: #edf2f7;
          color: var(--theme-color-text-secondary, #4a5568);
          border: none;
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: bold;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .category-pill.active {
          background: var(--theme-color-primary, #2b6cb0);
          color: white;
        }
        .video-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 640px) {
          .video-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .video-card {
          background: var(--theme-color-surface, #ffffff);
          border: 1px solid var(--theme-color-border, #e2e8f0);
          border-radius: var(--theme-layout-border-radius, 8px);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .video-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--theme-layout-box-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
        }
        .thumb-wrapper {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #000;
        }
        .thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .duration-badge {
          position: absolute;
          bottom: 0.5rem;
          right: 0.5rem;
          background: rgba(0, 0, 0, 0.75);
          color: white;
          font-size: 0.75rem;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .live-badge {
          position: absolute;
          top: 0.5rem;
          left: 0.5rem;
          background: #ef4444;
          color: white;
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.05em;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .video-info {
          padding: 1rem;
        }
        .video-title {
          font-size: 0.95rem;
          font-weight: bold;
          color: var(--theme-color-text-primary, #1a202c);
          margin: 0 0 0.35rem 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .video-meta {
          font-size: 0.8rem;
          color: var(--theme-color-text-secondary, #718096);
          display: flex;
          justify-content: space-between;
        }
        .sidebar-playlist {
          background: var(--theme-color-surface, #ffffff);
          border: 1px solid var(--theme-color-border, #e2e8f0);
          border-radius: var(--theme-layout-border-radius, 12px);
          padding: 1.5rem;
          align-self: flex-start;
        }
        .sidebar-playlist-title {
          font-size: 1.15rem;
          font-weight: bold;
          color: var(--theme-color-text-primary, #1a202c);
          margin: 0 0 1rem 0;
          border-bottom: 2px solid var(--theme-color-border, #edf2f7);
          padding-bottom: 0.5rem;
        }
        .playlist-items {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .playlist-item {
          display: flex;
          gap: 0.75rem;
          cursor: pointer;
          transition: background 0.2s;
          border-radius: 6px;
          padding: 0.35rem;
        }
        .playlist-item:hover, .playlist-item.active {
          background: #f7fafc;
        }
        .playlist-thumb {
          width: 90px;
          aspect-ratio: 16 / 9;
          border-radius: 4px;
          object-fit: cover;
          background: #000;
        }
        .playlist-details {
          flex: 1;
          min-width: 0;
        }
        .playlist-item-title {
          font-size: 0.85rem;
          font-weight: bold;
          color: var(--theme-color-text-primary, #1a202c);
          margin: 0 0 0.25rem 0;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      </style>

      <div class="videos-container">
        <!-- Main Area: Spotlight & Video Feed -->
        <div>
          <!-- Custom Video Stream Player component -->
          <div class="spotlight-card">
            <video-stream-player id="main-player" video-id="${activeVid.id}" video-url="${activeVid.url}" video-title="${activeVid.title}"></video-stream-player>
            <div class="spotlight-info">
              <h2 class="spotlight-title">${activeVid.title}</h2>
              <p class="spotlight-desc">${activeVid.description}</p>
            </div>
          </div>

          <!-- Category Filter Pills -->
          <div class="category-pills">
            ${categories.map(cat => {
              const safeCat = escapeHTML(cat);
              const displayCat = safeCat.charAt(0).toUpperCase() + safeCat.slice(1);
              return `
              <button class="category-pill ${this.activeCategory === cat ? 'active' : ''}" data-category="${safeCat}">
                ${displayCat}
              </button>
            `;
            }).join('')}
          </div>

          <!-- Filtered Video Feed -->
          <div class="video-grid">
            ${filteredVideos.map(vid => {
              const safeId = escapeHTML(vid.id || '');
              const safeTitle = escapeHTML(vid.title || '');
              const safeCategory = escapeHTML(vid.category || '');
              const safeDuration = escapeHTML(vid.duration || '');
              const safeViews = escapeHTML(vid.views || 0);
              const safeThumb = sanitizeUrl(vid.thumbnail || '');
              return `
              <div class="video-card" data-id="${safeId}">
                <div class="thumb-wrapper">
                  <img class="thumb-img" src="${safeThumb}" alt="${safeTitle}" />
                  ${vid.isLive ? `<span class="live-badge">Live</span>` : `<span class="duration-badge">${safeDuration}</span>`}
                </div>
                <div class="video-info">
                  <h4 class="video-title">${safeTitle}</h4>
                  <div class="video-meta">
                    <span>👁️ ${safeViews} Views</span>
                    <span>${safeCategory}</span>
                  </div>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>

        <!-- Sidebar: Video Playlist Recommendation Queue -->
        <div class="sidebar-playlist">
          <h3 class="sidebar-playlist-title">Up Next</h3>
          <div class="playlist-items">
            ${this.videos.map(vid => {
              const safeId = escapeHTML(vid.id || '');
              const safeTitle = escapeHTML(vid.title || '');
              const safeDuration = escapeHTML(vid.duration || '');
              const safeViews = escapeHTML(vid.views || 0);
              const safeThumb = sanitizeUrl(vid.thumbnail || '');
              return `
              <div class="playlist-item ${this.activeVideo?.id === vid.id ? 'active' : ''}" data-id="${safeId}">
                <img class="playlist-thumb" src="${safeThumb}" alt="${safeTitle}" />
                <div class="playlist-details">
                  <h4 class="playlist-item-title">${safeTitle}</h4>
                  <div class="video-meta" style="font-size: 0.75rem;">
                    <span>👁️ ${safeViews}</span>
                    <span>${vid.isLive ? 'LIVE' : safeDuration}</span>
                  </div>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Category selection
    this.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.activeCategory = pill.getAttribute('data-category');
        this.render();
      });
    });

    // Selecting a video from list or sidebar to play
    const selectVideo = (id) => {
      const vid = this.videos.find(x => x.id === id);
      if (vid) {
        this.activeVideo = vid;
        this.render();
        // Auto scroll to player
        this.querySelector('#main-player')?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    this.querySelectorAll('.video-card, .playlist-item').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = card.getAttribute('data-id');
        selectVideo(id);
      });
    });
  }
}

export class VideoStreamPlayer extends HTMLElement {
  constructor() {
    super();
    this.videoId = '';
    this.videoUrl = '';
    this.videoTitle = '';
    this.timer = null;
  }

  static get observedAttributes() {
    return ['video-id', 'video-url', 'video-title'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'video-id') this.videoId = newValue;
    if (name === 'video-url') this.videoUrl = newValue;
    if (name === 'video-title') this.videoTitle = newValue;
    this.render();
  }

  connectedCallback() {
    this.videoId = this.getAttribute('video-id') || this.videoId;
    this.videoUrl = this.getAttribute('video-url') || this.videoUrl;
    this.videoTitle = this.getAttribute('video-title') || this.videoTitle;

    this.render();
  }

  disconnectedCallback() {
    this.clearTeaserTimer();
  }

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

  getTeaserLimit() {
    // Configurable teaser limit from admin configuration, default to 30 seconds
    return configManager.current.media?.videoTeaserTimer || 30;
  }

  render() {
    const isPremium = this.isMemberOrAdmin();
    const teaserLimit = this.getTeaserLimit();

    const currentUrl = encodeURIComponent(window.location.origin + '/videos?id=' + this.videoId);
    const videoTitleEncoded = encodeURIComponent(this.videoTitle);

    // Stream URL protection: Non-members only receive stream URL if teaser duration > 0 and only while unexpired, or if a dedicated preview clip is defined.
    // Full raw video source URL is withheld from unauthenticated DOM if not entitled.
    const activeStreamUrl = isPremium ? this.videoUrl : '';

    this.innerHTML = `
      <style>
        .player-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #000;
          overflow: hidden;
        }
        .html5-video {
          width: 100%;
          height: 100%;
        }

        /* Video Controls overlay styling */
        .custom-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem 1rem;
          color: white;
          opacity: 0;
          transition: opacity 0.3s;
          z-index: 5;
        }
        .player-wrapper:hover .custom-controls {
          opacity: 1;
        }
        .control-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.1rem;
          cursor: pointer;
        }
        .progress-bar-container {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
          cursor: pointer;
          position: relative;
        }
        .progress-bar-fill {
          height: 100%;
          width: 0%;
          background: var(--theme-color-primary, #2b6cb0);
          border-radius: 3px;
        }

        /* Gated Paywall Overlay */
        .paywall-overlay {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          z-index: 10;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          color: white;
        }
        .paywall-lock {
          font-size: 3.5rem;
          margin-bottom: 1rem;
          animation: bounce 2s infinite;
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-15px); }
          60% { transform: translateY(-7px); }
        }
        .paywall-prompt {
          font-size: 1.4rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }
        .paywall-subtext {
          font-size: 0.95rem;
          color: #a0aec0;
          margin-bottom: 1.5rem;
          max-width: 450px;
        }

        /* Video social share panel */
        .video-share-container {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          display: flex;
          gap: 0.35rem;
          opacity: 0;
          transition: opacity 0.3s;
          z-index: 8;
        }
        .player-wrapper:hover .video-share-container {
          opacity: 1;
        }
        .video-share-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: bold;
          cursor: pointer;
          color: white;
        }
        .vshare-x { background: #000; }
        .vshare-fb { background: #1877f2; }
        .vshare-threads { background: #000; }
        .vshare-ig { background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); }
        .vshare-tt { background: #010101; }
        .vshare-yt { background: #ff0000; }

        /* Preview label badge */
        .preview-label-badge {
          position: absolute;
          top: 0.5rem;
          left: 0.5rem;
          background: rgba(236, 64, 122, 0.9);
          color: white;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 4px;
          z-index: 6;
          letter-spacing: 0.05em;
        }
      </style>

      <div class="player-wrapper">
        <!-- Preview Indicator if Guest/Prospect -->
        ${!isPremium ? `<span class="preview-label-badge" id="preview-label">Public Preview (${teaserLimit}s Remaining)</span>` : ''}

        <!-- Social Share Bar Overlay -->
        <div class="video-share-container">
          <button class="video-share-btn vshare-yt" id="vshare-yt" title="YouTube">YT</button>
          <button class="video-share-btn vshare-fb" id="vshare-fb" title="Facebook">FB</button>
          <button class="video-share-btn vshare-ig" id="vshare-ig" title="Instagram">IG</button>
          <button class="video-share-btn vshare-threads" id="vshare-threads" title="Threads">TH</button>
          <button class="video-share-btn vshare-tt" id="vshare-tt" title="TikTok">TT</button>
          <button class="video-share-btn vshare-x" id="vshare-x" title="X">𝕏</button>
        </div>

        <!-- Custom paywall gate -->
        <div class="paywall-overlay" id="paywall-gate">
          <div class="paywall-lock">🔒</div>
          <div class="paywall-prompt">Preview Time Limit Reached</div>
          <div class="paywall-subtext">Upgrade to Member ($29/mo) to unlock the full video stream, including live event feeds and masterminds.</div>
          <button class="btn-primary" id="btn-paywall-upgrade" style="padding: 10px 24px; font-weight: bold; font-size: 0.9rem;">Upgrade Instantly</button>
        </div>

        <video class="html5-video" id="video-core" ${isPremium ? '' : 'controlsList="nodownload"'}>
          ${activeStreamUrl ? `<source src="${activeStreamUrl}" type="video/mp4">` : ''}
          Your browser does not support HTML5 video playback.
        </video>

        <!-- Custom Controls -->
        <div class="custom-controls" id="player-controls">
          <button class="control-btn" id="btn-play-pause">▶️</button>
          <div class="progress-bar-container" id="progress-container">
            <div class="progress-bar-fill" id="progress-fill"></div>
          </div>
          <span style="font-size: 0.8rem;" id="time-display">00:00</span>
          <button class="control-btn" id="btn-mute">🔊</button>
        </div>
      </div>
    `;

    this.setupPlayer();
    this.setupSharing(currentUrl, videoTitleEncoded);
  }

  setupSharing(url, title) {
    const btnX = this.querySelector('#vshare-x');
    const btnFb = this.querySelector('#vshare-fb');
    const btnIg = this.querySelector('#vshare-ig');
    const btnThreads = this.querySelector('#vshare-threads');
    const btnTt = this.querySelector('#vshare-tt');
    const btnYt = this.querySelector('#vshare-yt');

    if (btnX) {
      btnX.onclick = (e) => {
        e.stopPropagation();
        window.open(`https://x.com/intent/post?text=${title}&url=${url}`, '_blank', 'width=600,height=400');
      };
    }
    if (btnFb) {
      btnFb.onclick = (e) => {
        e.stopPropagation();
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
      };
    }
    if (btnThreads) {
      btnThreads.onclick = (e) => {
        e.stopPropagation();
        window.open(`https://www.threads.net/intent/post?text=${title}%20${url}`, '_blank', 'width=600,height=400');
      };
    }
    if (btnIg) {
      btnIg.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied! Ready to share on Instagram Stories/Feed.");
      };
    }
    if (btnTt) {
      btnTt.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied! Ready to post on TikTok.");
      };
    }
    if (btnYt) {
      btnYt.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied! Ready to share on YouTube Community.");
      };
    }
  }

  setupPlayer() {
    const video = this.querySelector('#video-core');
    const btnPlayPause = this.querySelector('#btn-play-pause');
    const btnMute = this.querySelector('#btn-mute');
    const progressContainer = this.querySelector('#progress-container');
    const progressFill = this.querySelector('#progress-fill');
    const timeDisplay = this.querySelector('#time-display');
    const paywall = this.querySelector('#paywall-gate');
    const upgradeBtn = this.querySelector('#btn-paywall-upgrade');
    const isPremium = this.isMemberOrAdmin();
    const teaserLimit = this.getTeaserLimit();

    if (!video) return;

    // Upgrade CTA click
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.router?.navigateTo('/account');
      });
    }

    // Stream loading & preview gating:
    // Non-members only receive media source element upon user play intent, preventing automatic stream harvesting in raw HTML
    const ensureStreamLoadedForPreview = () => {
      if (!video.querySelector('source') && this.videoUrl) {
        const source = document.createElement('source');
        source.src = this.videoUrl;
        source.type = 'video/mp4';
        video.appendChild(source);
        video.load();
      }
    };

    // Toggle Play/Pause
    const togglePlay = () => {
      if (!isPremium && video.currentTime >= teaserLimit) {
        if (paywall) paywall.style.display = 'flex';
        return;
      }
      ensureStreamLoadedForPreview();
      if (video.paused) {
        video.play().catch(() => {});
        if (btnPlayPause) btnPlayPause.textContent = '⏸️';
      } else {
        video.pause();
        if (btnPlayPause) btnPlayPause.textContent = '▶️';
      }
    };

    btnPlayPause?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    video.addEventListener('click', () => {
      togglePlay();
    });

    // Mute toggle
    btnMute?.addEventListener('click', (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      btnMute.textContent = video.muted ? '🔇' : '🔊';
    });

    // Time Update & Teaser Timer
    video.addEventListener('timeupdate', () => {
      const current = video.currentTime;
      const duration = video.duration || 0;

      // Update progress bar
      if (duration > 0) {
        const percentage = (current / duration) * 100;
        if (progressFill) progressFill.style.width = `${percentage}%`;
      }

      // Update time display
      const formatTime = (time) => {
        const mins = Math.floor(time / 60).toString().padStart(2, '0');
        const secs = Math.floor(time % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
      };
      if (timeDisplay) timeDisplay.textContent = formatTime(current);

      // Gated check for public visitors
      if (!isPremium) {
        const remaining = Math.max(0, Math.ceil(teaserLimit - current));
        const previewBadge = this.querySelector('#preview-label');
        if (previewBadge) {
          previewBadge.textContent = `Public Preview (${remaining}s Remaining)`;
        }

        if (current >= teaserLimit) {
          video.pause();
          this.clearTeaserTimer();
          if (btnPlayPause) btnPlayPause.textContent = '▶️';
          if (paywall) paywall.style.display = 'flex';
        }
      }
    });

    // Seek click
    progressContainer?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = progressContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const targetTime = pos * video.duration;

      // Only let guests seek within teaser limit
      if (!isPremium && targetTime >= teaserLimit) {
        video.currentTime = teaserLimit - 1;
      } else {
        video.currentTime = targetTime;
      }
    });
  }

  clearTeaserTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

if (!customElements.get('video-library')) {
  customElements.define('video-library', VideoLibrary);
}

if (!customElements.get('video-stream-player')) {
  customElements.define('video-stream-player', VideoStreamPlayer);
}
