// components/global/PhotoGallery.js
import { lazyLoader } from '../../utils/lazyLoader.js';
import { toast } from '../../utils/toast.js';

export class PhotoGallery extends HTMLElement {
  constructor() {
    super();
    this.images = [];
  }

  async connectedCallback() {
    // Read list of images from attributes or let page controller supply them
    const imagesAttr = this.getAttribute('images');
    if (imagesAttr) {
      try {
        this.images = JSON.parse(imagesAttr);
      } catch (e) {
        console.error('[PhotoGallery]: Invalid images attribute', e);
      }
    } else {
      try {
        const { contentDB } = await import('../../core/db.js');
        const dbGallery = await contentDB.getContentByType('gallery');
        if (Array.isArray(dbGallery) && dbGallery.length > 0) {
          this.images = dbGallery.map(g => ({
            id: g.id,
            src: g.src || g.url || '',
            title: g.title,
            caption: g.caption || g.description || '',
            author: g.author || 'Foundation Resident',
            authorAvatar: g.authorAvatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
            date: g.date || '',
            category: g.category || 'General',
            likes: g.likes || 0,
            views: g.views || 0
          }));
          this.render();
          return;
        }
      } catch (e) {
        console.warn('[PhotoGallery]: Failed to fetch gallery from contentDB', e);
      }

      // Fallback Seed Images
      this.images = [
        {
          id: 'gallery-img-1',
          src: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
          title: 'Foundation Summit HQ',
          caption: 'Inside the main conference hall as developers gather for the sovereign zero-build keynote speech.',
          author: 'EarlAlex',
          authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
          date: '2026-08-01',
          category: 'Keynote',
          likes: 42,
          views: 312
        },
        {
          id: 'gallery-img-2',
          src: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800',
          title: 'Visual Design Systems',
          caption: 'An elegant display of custom bento design components running completely within native CSS grid frameworks.',
          author: 'Jane Doe',
          authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
          date: '2026-08-02',
          category: 'Design',
          likes: 128,
          views: 945
        },
        {
          id: 'gallery-img-3',
          src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
          title: 'Prisinte ES Code',
          caption: 'Clean, beautiful ESM syntax loaded directly inside Chrome and Safari dev tools with absolutely zero transpilers.',
          author: 'Alex Rivers',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          date: '2026-08-03',
          category: 'Engineering',
          likes: 84,
          views: 520
        },
        {
          id: 'gallery-img-4',
          src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
          title: 'Sovereign Workplace',
          caption: 'Remote workspace configured entirely with localized edge synchronization servers for absolute sovereign data control.',
          author: 'Jane Doe',
          authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
          date: '2026-08-04',
          category: 'Lifestyle',
          likes: 215,
          views: 1120
        },
        {
          id: 'gallery-img-5',
          src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
          title: 'SEO Telemetry Charts',
          caption: 'Automatic organic ranking monitors retrieving Moz and Search Console updates in real-time.',
          author: 'Alex Rivers',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          date: '2026-08-05',
          category: 'Growth',
          likes: 67,
          views: 405
        },
        {
          id: 'gallery-img-6',
          src: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
          title: 'Developer Mastermind',
          caption: 'Collaboration session between core architectural teams designing serverless Wise and LastPass vault integrations.',
          author: 'EarlAlex',
          authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
          date: '2026-08-06',
          category: 'Community',
          likes: 93,
          views: 630
        }
      ];
    }
    this.render();
  }

  setImages(newImages) {
    this.images = newImages;
    this.render();
  }

  render() {
    this.innerHTML = `
      <style>
        .masonry-grid {
          column-count: 1;
          column-gap: 1.5rem;
          width: 100%;
          margin: 1.5rem 0;
        }
        @media (min-width: 640px) {
          .masonry-grid {
            column-count: 2;
          }
        }
        @media (min-width: 1024px) {
          .masonry-grid {
            column-count: 3;
          }
        }
        .masonry-item {
          break-inside: avoid;
          background: var(--theme-color-surface, #ffffff);
          border: 1px solid var(--theme-color-border, #e2e8f0);
          border-radius: var(--theme-layout-border-radius, 8px);
          margin-bottom: 1.5rem;
          overflow: hidden;
          position: relative;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .masonry-item:hover {
          transform: translateY(-4px);
          box-shadow: var(--theme-layout-box-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
        }
        .masonry-img-wrapper {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: #edf2f7;
          aspect-ratio: 16 / 10;
        }
        .masonry-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.5s ease;
        }
        .masonry-item:hover .masonry-img {
          transform: scale(1.05);
        }
        .masonry-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          opacity: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.3s ease;
          gap: 1.5rem;
          color: white;
          font-weight: bold;
          font-size: 1.1rem;
        }
        .masonry-item:hover .masonry-overlay {
          opacity: 1;
        }
        .stat-indicator {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .stat-icon {
          font-size: 1.2rem;
        }
        .masonry-info {
          padding: 1rem;
        }
        .masonry-title {
          font-size: 1rem;
          font-weight: bold;
          margin: 0 0 0.35rem 0;
          color: var(--theme-color-text-primary, #1a202c);
        }
        .masonry-teaser {
          font-size: 0.85rem;
          color: var(--theme-color-text-secondary, #4a5568);
          margin: 0 0 0.5rem 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .masonry-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: var(--theme-color-text-secondary, #718096);
          border-top: 1px solid var(--theme-color-border, #edf2f7);
          padding-top: 0.5rem;
          margin-top: 0.5rem;
        }
        .author-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .author-badge img {
          width: 18px;
          height: 18px;
          border-radius: 50%;
        }

        /* Lightbox CSS */
        .lightbox-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 1000;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          backdrop-filter: blur(5px);
        }
        .lightbox-content {
          background: var(--theme-color-surface, #ffffff);
          border-radius: var(--theme-layout-border-radius, 12px);
          max-width: 900px;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          position: relative;
        }
        @media (min-width: 768px) {
          .lightbox-content {
            grid-template-columns: 1.2fr 1fr;
          }
        }
        .lightbox-media {
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          aspect-ratio: 1;
        }
        @media (min-width: 768px) {
          .lightbox-media {
            aspect-ratio: auto;
            height: 100%;
          }
        }
        .lightbox-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          max-height: 70vh;
        }
        .lightbox-details {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-left: 1px solid var(--theme-color-border, #edf2f7);
        }
        .lightbox-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .lightbox-author {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .lightbox-author-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid var(--theme-color-primary, #2b6cb0);
        }
        .lightbox-author-name {
          font-weight: bold;
          font-size: 0.9rem;
          color: var(--theme-color-text-primary, #1a202c);
        }
        .lightbox-close {
          background: transparent;
          border: none;
          color: var(--theme-color-text-secondary, #718096);
          font-size: 1.5rem;
          font-weight: bold;
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
        }
        .lightbox-close:hover {
          color: #ef4444;
        }
        .lightbox-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--theme-color-text-primary, #1a202c);
          margin: 0 0 0.5rem 0;
        }
        .lightbox-caption {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--theme-color-text-secondary, #4a5568);
          margin-bottom: 1rem;
        }
        .lightbox-tags {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }
        .tag-pill {
          background: #ebf8ff;
          color: var(--theme-color-primary, #2b6cb0);
          font-size: 0.75rem;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 9999px;
        }
        .share-actions-title {
          font-size: 0.85rem;
          text-transform: uppercase;
          font-weight: 800;
          color: var(--theme-color-text-secondary, #718096);
          margin-bottom: 0.5rem;
          letter-spacing: 0.05em;
        }
        .share-bar {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .share-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 6px 12px;
          border-radius: var(--theme-layout-border-radius, 6px);
          font-size: 0.8rem;
          font-weight: bold;
          border: none;
          cursor: pointer;
          color: white;
          transition: opacity 0.2s;
        }
        .share-btn:hover {
          opacity: 0.9;
        }
        .share-x { background: #000000; }
        .share-fb { background: #1877f2; }
        .share-threads { background: #000000; }
        .share-ig { background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); }
      </style>

      <div class="masonry-grid">
        ${this.images.map((img) => `
          <div class="masonry-item" data-id="${img.id}">
            <div class="masonry-img-wrapper">
              <img class="masonry-img" data-src="${img.src}" alt="${img.title}" loading="lazy" />
              <div class="masonry-overlay">
                <div class="stat-indicator">
                  <span class="stat-icon">❤️</span>
                  <span>${img.likes}</span>
                </div>
                <div class="stat-indicator">
                  <span class="stat-icon">👁️</span>
                  <span>${img.views}</span>
                </div>
              </div>
            </div>
            <div class="masonry-info">
              <h4 class="masonry-title">${img.title}</h4>
              <p class="masonry-teaser">${img.caption}</p>
              <div class="masonry-meta">
                <div class="author-badge">
                  <img src="${img.authorAvatar}" alt="${img.author}" />
                  <span>${img.author}</span>
                </div>
                <span>${img.date}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Lightbox Modal -->
      <div class="lightbox-modal" id="lightbox-modal">
        <div class="lightbox-content" id="lightbox-content">
          <!-- Populated dynamically on click -->
        </div>
      </div>
    `;

    // Initialize Lazy Loading
    lazyLoader.scan(this);

    // Bind event listeners
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('.masonry-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const img = this.images.find((x) => x.id === id);
        if (img) this.openLightbox(img);
      });
    });
  }

  openLightbox(img) {
    const modal = this.querySelector('#lightbox-modal');
    const content = this.querySelector('#lightbox-content');
    if (!modal || !content) return;

    // Increment views locally
    img.views++;
    this.renderViews(img.id, img.views);

    // Safe escape HTML helper
    const escape = (str) => {
      if (typeof str !== 'string') return '';
      return str.replace(/[&<>'"]/g, (tag) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag));
    };

    const currentUrl = encodeURIComponent(window.location.origin + '/gallery?id=' + img.id);
    const textCaption = encodeURIComponent(img.caption);

    content.innerHTML = `
      <div class="lightbox-media">
        <img src="${img.src}" alt="${escape(img.title)}" class="lightbox-img" />
      </div>
      <div class="lightbox-details">
        <div>
          <div class="lightbox-header">
            <div class="lightbox-author">
              <img src="${img.authorAvatar}" alt="${escape(img.author)}" class="lightbox-author-avatar" />
              <span class="lightbox-author-name">${escape(img.author)}</span>
            </div>
            <button class="lightbox-close" id="btn-close-lightbox" aria-label="Close Lightbox">&times;</button>
          </div>
          <h3 class="lightbox-title">${escape(img.title)}</h3>
          <p class="lightbox-caption">${escape(img.caption)}</p>
          <div class="lightbox-tags">
            <span class="tag-pill">${escape(img.category)}</span>
            <span class="tag-pill">❤️ ${img.likes} Likes</span>
            <span class="tag-pill" id="lightbox-views-${img.id}">👁️ ${img.views} Views</span>
          </div>
        </div>

        <div>
          <div class="share-actions-title">Share to Socials</div>
          <div class="share-bar">
            <button class="share-btn share-x" id="share-btn-x">𝕏 Post</button>
            <button class="share-btn share-fb" id="share-btn-fb">Facebook</button>
            <button class="share-btn share-threads" id="share-btn-threads">Threads</button>
            <button class="share-btn share-ig" id="share-btn-ig">Instagram</button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Event listeners inside Lightbox
    const closeBtn = content.querySelector('#btn-close-lightbox');
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Close on click outside content
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    };

    // Social Sharing Intents
    content.querySelector('#share-btn-x').onclick = () => {
      const intentUrl = `https://x.com/intent/post?text=${textCaption}&url=${currentUrl}`;
      window.open(intentUrl, '_blank', 'width=600,height=400');
    };

    content.querySelector('#share-btn-fb').onclick = () => {
      const intentUrl = `https://www.facebook.com/sharer/sharer.php?u=${currentUrl}`;
      window.open(intentUrl, '_blank', 'width=600,height=400');
    };

    content.querySelector('#share-btn-threads').onclick = () => {
      const intentUrl = `https://www.threads.net/intent/post?text=${textCaption}%20${currentUrl}`;
      window.open(intentUrl, '_blank', 'width=600,height=400');
    };

    content.querySelector('#share-btn-ig').onclick = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: img.title,
            text: img.caption,
            url: window.location.origin + '/gallery?id=' + img.id
          });
        } catch (e) {
          this.fallbackCopyLink();
        }
      } else {
        this.fallbackCopyLink();
      }
    };
  }

  fallbackCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied! Ready to share on Instagram Stories/Feed.");
  }

  renderViews(imgId, views) {
    const statOverlay = this.querySelector(`.masonry-item[data-id="${imgId}"] .stat-indicator:nth-child(2) span:nth-child(2)`);
    if (statOverlay) statOverlay.textContent = views;

    const modalViews = this.querySelector(`#lightbox-views-${imgId}`);
    if (modalViews) modalViews.textContent = `👁️ ${views} Views`;
  }
}

if (!customElements.get('photo-gallery')) {
  customElements.define('photo-gallery', PhotoGallery);
}
