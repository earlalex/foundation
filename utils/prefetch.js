// utils/prefetch.js - Lightweight Asset Prefetch and Module Preload Manager

/**
 * Prefetches or preloads resources using browser hint tags.
 * Supports <link rel="prefetch">, <link rel="modulepreload">, <link rel="dns-prefetch">, and <link rel="preconnect">
 */
export class PrefetchManager {
  /**
   * Preload a JS module file (browser-native ES Module preloading)
   * @param {string} url - The URL of the ES module script to preload
   */
  static preloadModule(url) {
    if (typeof document === 'undefined') return;
    const exists = document.querySelector(`link[href="${url}"][rel="modulepreload"]`);
    if (exists) return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = url;
    document.head.appendChild(link);
  }

  /**
   * Prefetch a static asset or a future document
   * @param {string} url - The URL of the asset to prefetch
   */
  static prefetchAsset(url) {
    if (typeof document === 'undefined') return;
    const exists = document.querySelector(`link[href="${url}"][rel="prefetch"]`);
    if (exists) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }

  /**
   * Connect to critical origin domains in advance (DNS prefetch and preconnect)
   * @param {string} domainUrl - Domain URL (e.g. 'https://firestore.googleapis.com')
   */
  static preconnectDomain(domainUrl) {
    if (typeof document === 'undefined') return;
    const exists = document.querySelector(`link[href="${domainUrl}"][rel="preconnect"]`);
    if (exists) return;

    const dnsLink = document.createElement('link');
    dnsLink.rel = 'dns-prefetch';
    dnsLink.href = domainUrl;
    document.head.appendChild(dnsLink);

    const connLink = document.createElement('link');
    connLink.rel = 'preconnect';
    connLink.href = domainUrl;
    connLink.crossOrigin = 'anonymous';
    document.head.appendChild(connLink);
  }
}
