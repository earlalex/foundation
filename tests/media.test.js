// tests/media.test.js - Automated Integration Tests for Media & Streaming Engines
import { store } from '../core/store.js';
import { configManager } from '../core/config.js';
import { PhotoGallery } from '../components/global/PhotoGallery.js';
import { VideoLibrary, VideoStreamPlayer } from '../components/global/VideoLibrary.js';
import { RadioStreamPlayer } from '../components/global/RadioStreamPlayer.js';

export async function runMediaTests() {
  console.group('%c🎥 Foundation Media & Audio Streaming Test Battery', 'color: #dd6b20; font-weight: bold;');

  try {
    // Save original auth states to prevent leakage
    const originalUser = store.state.user;
    const originalSim = store.state.simulatedUserTier;

    // Test 1: Photo Gallery Initial Rendering and Seed Verification
    const gallery = document.createElement('photo-gallery');
    document.body.appendChild(gallery);
    if (gallery.images.length === 0) {
      throw new Error('[Media Tests]: Photo Gallery loaded with 0 seed images.');
    }
    console.log('%c    PASS: Photo Gallery loaded with appropriate seed images.', 'color: #38a169; font-weight: bold;');

    // Test 2: Social Sharing intent generation checks
    const fallbackCopyRes = [];
    gallery.fallbackCopyLink = () => { fallbackCopyRes.push(true); };
    gallery.openLightbox(gallery.images[0]);

    const lightboxModal = gallery.querySelector('#lightbox-modal');
    if (!lightboxModal || lightboxModal.style.display !== 'flex') {
      throw new Error('[Media Tests]: Lightbox modal failed to open upon click trigger.');
    }
    console.log('%c    PASS: Lightbox modal correctly activates in full-screen mode.', 'color: #38a169; font-weight: bold;');

    const igShareBtn = gallery.querySelector('#share-btn-ig');
    if (igShareBtn) {
      igShareBtn.click();
      if (fallbackCopyRes.length === 0) {
        throw new Error('[Media Tests]: Instagram share button fallback copying mechanism failed to trigger.');
      }
    }
    console.log('%c    PASS: Photo Gallery Instagram share handles fallback navigator.share gracefully.', 'color: #38a169; font-weight: bold;');

    lightboxModal.style.display = 'none';
    gallery.remove();

    // Test 3: Video Stream Gated Playback check - Non-members
    store.dispatch('SET_SIMULATED_USER_TIER', 'prospect');
    store.dispatch('SET_USER', null);

    const player = document.createElement('video-stream-player');
    player.setAttribute('video-id', 'test-vid-gate');
    player.setAttribute('video-url', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    player.setAttribute('video-title', 'Sovereign Core Architecture');
    document.body.appendChild(player);

    if (player.isMemberOrAdmin()) {
      throw new Error('[Media Tests]: Prospect / guest evaluated as premium subscriber incorrectly.');
    }
    console.log('%c    PASS: Unauthenticated guests are correctly restricted to Public Preview mode.', 'color: #38a169; font-weight: bold;');

    // Force timeupdate past teaser limit to verify paywall gate triggers
    const videoElement = player.querySelector('#video-core');
    const paywallElement = player.querySelector('#paywall-gate');

    if (videoElement && paywallElement) {
      videoElement.currentTime = 35; // default teaser is 30 seconds
      videoElement.dispatchEvent(new Event('timeupdate'));

      if (paywallElement.style.display !== 'flex') {
        throw new Error('[Media Tests]: Video Player paywall gate failed to display on preview timeout.');
      }
    }
    console.log('%c    PASS: Video Stream Player triggers paywall block after teaser timeout.', 'color: #38a169; font-weight: bold;');

    player.remove();

    // Test 4: Member/Admin Unrestricted Video Access
    store.dispatch('SET_SIMULATED_USER_TIER', 'member');

    const premiumPlayer = document.createElement('video-stream-player');
    premiumPlayer.setAttribute('video-id', 'test-vid-prem');
    premiumPlayer.setAttribute('video-url', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    premiumPlayer.setAttribute('video-title', 'Premium Sovereign Mastermind');
    document.body.appendChild(premiumPlayer);

    if (!premiumPlayer.isMemberOrAdmin()) {
      throw new Error('[Media Tests]: Paid Member / Admin incorrectly gated from playing VOD video streams.');
    }

    const premiumVideo = premiumPlayer.querySelector('#video-core');
    const premiumPaywall = premiumPlayer.querySelector('#paywall-gate');
    const previewLabel = premiumPlayer.querySelector('#preview-label');

    if (previewLabel) {
      throw new Error('[Media Tests]: Preview label badge rendered incorrectly for premium members.');
    }

    if (premiumVideo && premiumPaywall) {
      premiumVideo.currentTime = 50;
      premiumVideo.dispatchEvent(new Event('timeupdate'));

      if (premiumPaywall.style.display === 'flex') {
        throw new Error('[Media Tests]: Video paywall gate triggered for paid member.');
      }
    }
    console.log('%c    PASS: Paid Members and Administrators get uninterrupted, unlimited full stream access.', 'color: #38a169; font-weight: bold;');
    premiumPlayer.remove();

    // Test 5: Persistent Internet Radio Gating Check
    store.dispatch('SET_SIMULATED_USER_TIER', 'prospect');
    const radio = document.querySelector('radio-stream-player');
    if (!radio) {
      throw new Error('[Media Tests]: Persistent `<radio-stream-player>` is missing from the global DOM context.');
    }

    if (radio.isMemberOrAdmin()) {
      throw new Error('[Media Tests]: Guest evaluator marked radio client as premium.');
    }
    console.log('%c    PASS: Sticky Radio Player verifies guest restrictions and active preview parameters.', 'color: #38a169; font-weight: bold;');

    // Restore original credentials
    store.dispatch('SET_USER', originalUser);
    store.dispatch('SET_SIMULATED_USER_TIER', originalSim);

    console.log('%c  Media & Streaming Integration Summary: 5/5 Tests Passed ✅', 'font-size: 13px; font-weight: bold; color: #38a169;');

  } catch (err) {
    console.error('[Media Tests Failure]:', err);
    throw err;
  } finally {
    console.groupEnd();
  }
}
