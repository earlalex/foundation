// core/radio.js - Internet Radio & Audio Playlist Coordinator
import { configManager } from './config.js';
import { contentDB } from './db.js';

export class RadioCoordinator {
  constructor() {
    this.streamUrl = 'https://ice6.securenetsystems.net/DEMOSTN'; // Robust live fallback stream
    this.includeInRadioStreamOnly = false;
    this.teaserDuration = 45; // Default 45 seconds preview for guests
  }

  getLiveStreamUrl() {
    return configManager.current.media?.radioStreamUrl || this.streamUrl;
  }

  getTeaserDuration() {
    return configManager.current.media?.radioTeaserDuration || this.teaserDuration;
  }

  async getRadioPlaylist() {
    const defaultMockPlaylist = [
      {
        id: 'track-1',
        title: 'Sovereign Beats & Lo-Fi',
        artist: 'Foundation Audio Network',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80'
      },
      {
        id: 'track-2',
        title: 'Zero-Build Deep Dives',
        artist: 'EarlAlex Tech Stream',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80'
      },
      {
        id: 'track-3',
        title: 'Edge Computing Ambient',
        artist: 'Sovereign Radio Network',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80'
      }
    ];

    try {
      // Fetch all publications/products and filter items with includeInRadioStream: true
      const allContent = await contentDB.getAllContent();
      if (!Array.isArray(allContent)) return defaultMockPlaylist;

      const playlist = allContent.filter(item => item && (item.includeInRadioStream === true || item.type === 'podcast'));
      if (playlist.length === 0) return defaultMockPlaylist;

      return playlist.map(item => ({
        id: item.id || `radio-track-${Math.random().toString(36).substr(2, 9)}`,
        title: item.title || 'Untitled Stream Track',
        artist: item.author || 'Foundation Resident',
        src: item.audioUrl || item.audio?.src || item.src || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        cover: item.cover || item.preview?.featuredImage?.src || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80'
      }));
    } catch (e) {
      // Catches permission-denied ([code=permission-denied]), timeout, network errors
      console.warn('[RadioCoordinator]: Database query failed or permission denied, using default fallback playlist silently.', e?.message || e);
      return defaultMockPlaylist;
    }
  }
}

export const radioCoordinator = new RadioCoordinator();
