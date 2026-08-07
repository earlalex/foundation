// pages/videos/videos.js
import '../../components/global/VideoLibrary.js';

export function initVideosPage() {
  console.log('[Videos Page]: Initialized');
  const libraryEl = document.getElementById('videos-portal');
  if (libraryEl) {
    console.log('[Videos Page]: VideoLibrary Web Component found');
  }
}
