// utils/analytics.js - Google Analytics 4 Event Tracking Engine
import { configManager } from '../core/config.js';

/**
 * Dynamically injects GA4 script tags when Measurement ID is configured
 */
export function initGoogleAnalytics() {
  const measurementId = configManager.current.analytics?.googleAnalyticsId;
  if (!measurementId || measurementId.trim() === '') {
    console.log('[GA4 Engine]: GA4 Measurement ID not configured. Tracking disabled.');
    return;
  }

  // Check if already injected
  if (document.getElementById('ga4-script-tag')) return;

  console.log(`[GA4 Engine]: Injecting GA4 scripts for Measurement ID: ${measurementId}`);

  const scriptTag = document.createElement('script');
  scriptTag.id = 'ga4-script-tag';
  scriptTag.async = true;
  scriptTag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(scriptTag);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false }); // Disable automatic default pageview
}

/**
 * Tracks virtual page view on SPA route transition
 * @param {string} route - The route path (e.g. /home)
 * @param {string} title - The page document title
 */
export function trackPageView(route, title) {
  initGoogleAnalytics(); // Ensure initialized
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: route,
      page_title: title
    });
    console.log(`[GA4 Track]: Virtual Pageview tracked: ${route} - ${title}`);
  }
}

/**
 * Tracks generic / custom ecommerce events
 * @param {string} eventName - Custom event name
 * @param {Object} eventParams - Event parameters payload
 */
export function trackCustomEvent(eventName, eventParams = {}) {
  initGoogleAnalytics(); // Ensure initialized
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
    console.log(`[GA4 Track]: Custom Event tracked: ${eventName}`, eventParams);
  }
}

/**
 * Tracks checkout conversion
 * @param {Object} purchaseData
 */
export function trackCheckoutConversion(purchaseData) {
  trackCustomEvent('purchase', {
    transaction_id: purchaseData.id || `tx_${Date.now()}`,
    value: Number(purchaseData.amount) || 0.00,
    currency: purchaseData.currency || 'USD',
    items: purchaseData.items || []
  });
}

/**
 * Tracks Wise contractor payout trigger
 * @param {Object} payoutData
 */
export function trackWisePayoutTrigger(payoutData) {
  trackCustomEvent('wise_payout', {
    transaction_id: payoutData.id || `tx_payout_${Date.now()}`,
    value: Number(payoutData.amountUSD) || 0.00,
    currency: 'USD',
    employee_name: payoutData.employeeName || 'VA Contractor'
  });
}
