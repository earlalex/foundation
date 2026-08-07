// pages/gallery/gallery.js
import '../../components/global/PhotoGallery.js';

export function initGalleryPage() {
  console.log('[Gallery Page]: Initialized');
  const galleryEl = document.getElementById('instagram-gallery');
  if (galleryEl) {
    console.log('[Gallery Page]: Gallery Web Component found');
  }
}
