// pages/detail/detail.js
import { contentDB } from '../../core/db.js';
import { renderContent } from '../../utils/universalRenderer.js';
import { authManager } from '../../core/auth.js';

export async function initDetailPage() {
  const container = document.getElementById('detail-view-container');
  if (!container) return;

  // Extract content ID from URL query parameters (e.g., /detail?id=my-first-post)
  const urlParams = new URLSearchParams(window.location.search);
  const contentId = urlParams.get('id');

  if (!contentId) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h2 style="margin-top: 0; color: #e53e3e;">Publication Not Specified</h2>
        <p style="color: #718096; margin-bottom: 1.5rem;">No valid publication ID was provided in the route.</p>
        <a href="/home" class="btn-primary">Return to Homepage</a>
      </div>
    `;
    return;
  }

  try {
    const item = await contentDB.getContentById(contentId);

    if (!item) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem;">
          <h2 style="margin-top: 0; color: #e53e3e;">Publication Not Found</h2>
          <p style="color: #718096; margin-bottom: 1.5rem;">The requested publication ("${contentId}") could not be located in Firestore.</p>
          <a href="/home" class="btn-primary">Return to Feed</a>
        </div>
      `;
      return;
    }

    // Render Unlocked vs Paywall View using Universal Renderer
    container.innerHTML = renderContent(item);

    // Wire Paywall Action Listeners
    document.getElementById('btn-paywall-subscribe')?.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/stripe-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'member', action: 'checkout' })
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert('Stripe Gateway initializing. Please check configuration.');
        }
      } catch (err) {
        alert(`Checkout error: ${err.message}`);
      }
    });

    document.getElementById('btn-paywall-login')?.addEventListener('click', async () => {
      await authManager.loginWithGoogle();
      window.location.reload();
    });

  } catch (err) {
    console.error('Error initializing detail page:', err);
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem; color: #e53e3e;">
        Failed to load publication details.
      </div>
    `;
  }
}