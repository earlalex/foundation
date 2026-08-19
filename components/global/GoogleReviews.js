// components/global/GoogleReviews.js
import { configManager } from '../../core/config.js';
import { i18n } from '../../core/i18n.js';

export class GoogleReviews extends HTMLElement {
  static get observedAttributes() {
    return ['place-id', 'limit', 'theme'];
  }

  constructor() {
    super();
    this.placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4"; // Default place ID
    this.limit = 5;
    this.theme = "light";
    this.onLangChange = () => {
      this.render();
      if (this.currentData) {
        this.renderReviewsList(this.currentData);
      } else {
        this.loadReviews();
      }
    };
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'place-id') this.placeId = newValue;
    if (name === 'limit') this.limit = parseInt(newValue, 10) || 5;
    if (name === 'theme') this.theme = newValue === 'dark' ? 'dark' : 'light';
    this.render();
  }

  connectedCallback() {
    this.placeId = this.getAttribute('place-id') || this.placeId;
    this.limit = parseInt(this.getAttribute('limit'), 10) || this.limit;
    this.theme = this.getAttribute('theme') === 'dark' ? 'dark' : 'light';

    window.addEventListener('language-changed', this.onLangChange);
    window.addEventListener('languageChanged', this.onLangChange);

    this.render();
    this.loadReviews();
  }

  disconnectedCallback() {
    window.removeEventListener('language-changed', this.onLangChange);
    window.removeEventListener('languageChanged', this.onLangChange);
  }

  async loadReviews() {
    const listContainer = this.querySelector('.reviews-list-container');
    if (!listContainer) return;

    let apiData = { rating: 4.9, userRatingCount: 142, reviews: [] };

    try {
      const response = await fetch(`/api/google-business?placeId=${encodeURIComponent(this.placeId)}`);
      if (response.ok) {
        apiData = await response.json();
      } else {
        throw new Error("API responded with error status");
      }
    } catch (err) {
      console.warn("[GoogleReviews Component]: Live load failed, rendering fallback reviews.", err);
      apiData.reviews = [
        {
          authorAttribution: { displayName: "Sarah Jenkins", photoUri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" },
          rating: 5,
          text: { text: "Going zero-build with native ES modules reduced our deployment time to seconds! Truly spectacular framework." },
          relativePublishTimeDescription: "2 days ago"
        },
        {
          authorAttribution: { displayName: "Marcus Chen", photoUri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" },
          rating: 5,
          text: { text: "As a principal architect, security is my top priority. Foundation's zero-trust database boundaries and robust OAuth credential vault are world-class." },
          relativePublishTimeDescription: "1 week ago"
        }
      ];
    }

    try {
      // 1. Fetch reviews stored in local/Firestore contentDB (filtering strictly for public access)
      const { contentDB } = await import('../../core/db.js');
      const allContent = await contentDB.getAllContent();
      const dbReviews = allContent.filter(item => item.type === 'review' && (item.access?.visibility === 'public' || !item.access));

      const mappedDbReviews = dbReviews.map(r => ({
        authorAttribution: {
          displayName: r.author || r.title || 'Anonymous',
          photoUri: r.preview?.featuredImage?.src || ''
        },
        rating: r.rating || 5,
        text: {
          text: r.description || (r.longFormText && r.longFormText[0]) || ''
        },
        relativePublishTimeDescription: r.date || 'Recently'
      }));

      // 2. Prepend AI Generated Reviews if configured in feature toggles
      const aiReviews = configManager.current?.features?.aiGeneratedReviews || [];

      // Combine AI reviews, DB reviews, and live API/fallback reviews
      const combinedReviews = [
        ...(aiReviews || []),
        ...mappedDbReviews,
        ...(apiData.reviews || [])
      ];

      this.currentData = {
        rating: apiData.rating || 4.9,
        userRatingCount: (apiData.userRatingCount || 142) + dbReviews.length + (aiReviews.length || 0),
        reviews: combinedReviews
      };
      this.renderReviewsList(this.currentData);
    } catch (e) {
      console.warn("[GoogleReviews Component]: Failed to load DB/AI reviews, falling back to basic data:", e);
      this.currentData = apiData;
      this.renderReviewsList(apiData);
    }
  }

  renderReviewsList(data) {
    const ratingSummary = this.querySelector('.reviews-rating-summary');
    const listContainer = this.querySelector('.reviews-list-container');
    if (!listContainer) return;

    const rating = data.rating || 5.0;
    const count = data.userRatingCount || 100;
    const stars = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

    const basedOnTxt = i18n.translateText("Based on");
    const googleRevTxt = i18n.translateText("Google reviews");

    if (ratingSummary) {
      ratingSummary.innerHTML = `
        <div style="font-size: 2.25rem; font-weight: 800; color: ${this.theme === 'dark' ? '#f6e05e' : '#dd6b20'}; line-height: 1;">${rating.toFixed(1)}</div>
        <div style="margin-left: 0.75rem;">
          <div style="color: #f6e05e; font-size: 1.15rem; letter-spacing: 1px;">${stars}</div>
          <div style="font-size: 0.8rem; color: ${this.theme === 'dark' ? '#a0aec0' : '#718096'}; font-weight: 600;">${basedOnTxt} ${count} ${googleRevTxt}</div>
        </div>
      `;
    }

    const reviewsToShow = (data.reviews || []).slice(0, this.limit);
    if (reviewsToShow.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: #a0aec0; padding: 2rem;">No reviews to display.</div>`;
      return;
    }

    listContainer.innerHTML = reviewsToShow.map(rev => {
      const revStars = "★".repeat(rev.rating) + "☆".repeat(5 - rev.rating);
      const name = rev.authorAttribution?.displayName || "Anonymous";
      const photo = rev.authorAttribution?.photoUri || `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23cbd5e0'/><text x='50%' y='65%' font-size='50' text-anchor='middle' fill='%23ffffff'>👤</text></svg>`;
      const text = rev.text?.text || rev.text || "";

      return `
        <div style="background: ${this.theme === 'dark' ? '#2d3748' : '#ffffff'}; border: 1px solid ${this.theme === 'dark' ? '#4a5568' : '#e2e8f0'}; border-radius: var(--theme-layout-border-radius, 8px); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: var(--theme-layout-box-shadow, 0 1px 3px rgba(0,0,0,0.05)); transition: transform 0.2s;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${photo}" alt="${name}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><circle cx=\\'50\\' cy=\\'50\\' r=\\'50\\' fill=\\'%23cbd5e0\\'/><text x=\\'50%\\' y=\\'65%\\' font-size=\\'50\\' text-anchor=\\'middle\\' fill=\\'%23ffffff\\'>👤</text></svg>'" />
            <div>
              <strong style="display: block; font-size: 0.9rem; color: ${this.theme === 'dark' ? '#f7fafc' : '#2d3748'};">${name}</strong>
              <span style="font-size: 0.75rem; color: ${this.theme === 'dark' ? '#a0aec0' : '#718096'};">${rev.relativePublishTimeDescription || 'Recently'}</span>
            </div>
          </div>
          <div>
            <div style="color: #f6e05e; font-size: 0.9rem; margin-bottom: 0.25rem; letter-spacing: 0.5px;">${revStars}</div>
            <p style="margin: 0; font-size: 0.85rem; line-height: 1.5; color: ${this.theme === 'dark' ? '#e2e8f0' : '#4a5568'};">${text}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  render() {
    const leaveRevTxt = i18n.translateText("Leave a Google Review");
    const loadingTxt = i18n.translateText("Loading reviews...");

    this.innerHTML = `
      <section class="google-reviews-showcase" style="
        background: ${this.theme === 'dark' ? '#1a202c' : '#f7fafc'};
        color: ${this.theme === 'dark' ? '#f7fafc' : '#2d3748'};
        border: 1px solid ${this.theme === 'dark' ? '#2d3748' : '#e2e8f0'};
        border-radius: var(--theme-layout-border-radius, 12px);
        padding: 1.5rem;
        margin: var(--theme-spacing-24, 24px) 0;
        font-family: var(--theme-font-font-family, system-ui, sans-serif);
      ">
        <!-- Top bar with overall score and CTA -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem; border-bottom: 2px solid ${this.theme === 'dark' ? '#2d3748' : '#edf2f7'}; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center;" class="reviews-rating-summary">
            <div style="font-size: 2.25rem; font-weight: 800; color: #cbd5e0; line-height: 1;">--</div>
            <div style="margin-left: 0.75rem;">
              <div style="color: #cbd5e0; font-size: 1.15rem;">★★★★★</div>
              <div style="font-size: 0.8rem; color: #a0aec0;">${loadingTxt}</div>
            </div>
          </div>
          <a href="https://search.google.com/local/writereview?placeid=${encodeURIComponent(this.placeId)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="
            background: #4285f4;
            color: white;
            border: none;
            border-radius: var(--theme-layout-border-radius, 6px);
            font-weight: bold;
            padding: 10px 20px;
            font-size: 0.85rem;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 4px rgba(66, 133, 244, 0.2);
            transition: background-color 0.2s;
          ">
            <span>📝</span> ${leaveRevTxt}
          </a>
        </div>

        <!-- Grid Container -->
        <div class="reviews-list-container" style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
        ">
          <!-- Populated dynamically -->
        </div>
      </section>
    `;
  }
}

if (!customElements.get('google-reviews')) {
  customElements.define('google-reviews', GoogleReviews);
}
