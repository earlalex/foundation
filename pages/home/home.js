// pages/home/home.js
import { contentDB } from '/core/db.js';

export async function initHomePage() {
  const feed = document.getElementById('content-feed');
  if (!feed) return; // Guard in case element isn't in DOM

  try {
    const posts = await contentDB.getContentByType('blog', 10);

    if (!posts || posts.length === 0) {
      feed.innerHTML = '<p style="color: #718096;">No posts published yet. Visit the Admin area to create your first post!</p>';
      return;
    }

    feed.innerHTML = posts.map(post => `
      <article style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; background: #fff;">
        ${post.preview?.featuredImage?.src ? `
          <img src="${post.preview.featuredImage.src}" alt="${post.title}" style="max-width: 100%; border-radius: 6px; margin-bottom: 1rem; display: block;" />
        ` : ''}
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">${post.title}</h3>
        <p style="color: #718096; font-size: 0.875rem; margin: 0 0 1rem 0;">By ${post.author || 'Admin'} • ${post.date}</p>
        <p style="margin: 0 0 1rem 0; color: #4a5568; line-height: 1.5;">${post.preview?.teaserText || post.description}</p>
      </article>
    `).join('');

  } catch (err) {
    feed.innerHTML = '<p style="color: #e53e3e;">Failed to load posts.</p>';
  }
}