// utils/heroEngine.js
import { contentDB } from '../core/db.js';

/**
 * Dynamically renders the admin-editable Hero Section for any page route
 * @param {string} path - The relative path of the route (e.g., '/home')
 */
export async function renderHeroSection(path) {
  const app = document.getElementById('app');
  if (!app) return;

  // Normalize path to pageId
  let pageId = path;
  if (pageId.startsWith('/')) {
    pageId = pageId.substring(1);
  }
  if (pageId.endsWith('.html')) {
    pageId = pageId.substring(0, pageId.length - 5);
  }
  if (!pageId || pageId === '') {
    pageId = 'home';
  }

  // Skip rendering on auth, admin, or login pages to avoid layout clash
  const skipPages = ['admin', 'login', 'account', '404'];
  if (skipPages.includes(pageId)) {
    const existing = document.getElementById('dynamic-hero-banner');
    if (existing) existing.remove();
    return;
  }

  // Remove existing banner first
  const existing = document.getElementById('dynamic-hero-banner');
  if (existing) {
    existing.remove();
  }

  // Retrieve Hero Config from database/localStorage
  let config = null;
  try {
    config = await contentDB.getHeroConfig(pageId);
  } catch (err) {
    console.warn('[HeroEngine]: Failed to fetch hero config, using fallback default.', err);
  }

  // Default values mapping in case no admin config exists yet
  if (!config) {
    config = getDefaultHeroConfig(pageId);
  }

  // If explicitly disabled by admin, do not render
  if (config.enabled === false) {
    return;
  }

  // Create banner container
  const banner = document.createElement('div');
  banner.id = 'dynamic-hero-banner';
  banner.className = 'reveal-on-scroll';

  // Apply beautiful styles supporting CSS parallax background attachment
  const bgGradient = config.backgroundGradient || 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
  const imgUrl = config.heroImageUrl ? config.heroImageUrl.trim() : '';

  let styleStr = `
    padding: 6rem 2rem;
    text-align: center;
    position: relative;
    overflow: hidden;
    color: #ffffff;
    font-family: system-ui, -apple-system, sans-serif;
    border-bottom: 1px solid var(--theme-color-border, #edf2f7);
    margin-bottom: 2.5rem;
    background: ${bgGradient};
  `;

  if (imgUrl) {
    styleStr += `
      background-image: linear-gradient(rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.75)), url('${imgUrl}');
      background-attachment: fixed;
      background-size: cover;
      background-position: center;
    `;
  }

  banner.style.cssText = styleStr;

  // Construct primary and secondary CTA elements
  const primaryCtaHtml = (config.primaryCtaText && config.primaryCtaUrl)
    ? `<a href="${config.primaryCtaUrl}" class="btn-primary" style="padding: 12px 28px; font-weight: 700; border-radius: var(--theme-layout-border-radius, 6px); text-decoration: none; display: inline-block;">${config.primaryCtaText}</a>`
    : '';

  const secondaryCtaHtml = (config.secondaryCtaText && config.secondaryCtaUrl)
    ? `<a href="${config.secondaryCtaUrl}" class="btn-secondary" style="padding: 12px 28px; font-weight: 700; border-radius: var(--theme-layout-border-radius, 6px); text-decoration: none; color: #ffffff; border-color: rgba(255, 255, 255, 0.4); display: inline-block;">${config.secondaryCtaText}</a>`
    : '';

  banner.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; position: relative; z-index: 2;">
      <h1 style="font-size: clamp(2.25rem, 5vw, 3.5rem); font-weight: 800; line-height: 1.15; letter-spacing: -0.03em; margin: 0; text-shadow: 0 2px 10px rgba(0,0,0,0.3); color: #ffffff;">
        ${config.title || 'Welcome to Foundation'}
      </h1>
      <p style="font-size: clamp(1.1rem, 2.5vw, 1.25rem); color: rgba(255, 255, 255, 0.9); max-width: 650px; margin: 0; line-height: 1.6; text-shadow: 0 1px 5px rgba(0,0,0,0.25); text-align: center !important;">
        ${config.subtitle || 'A modular web platform running natively in the browser.'}
      </p>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-top: 1rem;">
        ${primaryCtaHtml}
        ${secondaryCtaHtml}
      </div>
    </div>
  `;

  // Prepend as first child of #app so it sits beautifully at the very top of each page!
  app.insertBefore(banner, app.firstChild);

  // Trigger reveal directly
  setTimeout(() => {
    banner.classList.add('fade-in-up');
  }, 50);
}

function getDefaultHeroConfig(pageId) {
  switch (pageId) {
    case 'home':
      return {
        enabled: true,
        title: "Welcome to Foundation",
        subtitle: "A zero-build, modular web platform running natively in the browser.",
        primaryCtaText: "Explore Courses",
        primaryCtaUrl: "/education",
        secondaryCtaText: "Upcoming Events",
        secondaryCtaUrl: "/events",
        backgroundGradient: "linear-gradient(135deg, #1e293b 0%, #2b6cb0 100%)",
        heroImageUrl: ""
      };
    case 'about':
      return {
        enabled: true,
        title: "About Our Platform",
        subtitle: "Learn more about the principles and creator behind this clean, zero-build cloud native architecture.",
        primaryCtaText: "Book Consultation",
        primaryCtaUrl: "/contact",
        secondaryCtaText: "Home Page",
        secondaryCtaUrl: "/home",
        backgroundGradient: "linear-gradient(135deg, #4c1d95 0%, #805ad5 100%)",
        heroImageUrl: ""
      };
    case 'events':
      return {
        enabled: true,
        title: "Live Meets & Webinars",
        subtitle: "Accelerate your product scaling with regular interactive strategy workshops and keynotes.",
        primaryCtaText: "Schedule 1-on-1 Call",
        primaryCtaUrl: "/contact",
        secondaryCtaText: "Read Blog",
        secondaryCtaUrl: "/home",
        backgroundGradient: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
        heroImageUrl: ""
      };
    case 'contact':
      return {
        enabled: true,
        title: "Let's Connect & Accelerate",
        subtitle: "Schedule a 1-on-1 strategic consultation or submit a support inquiry directly to our corporate deck.",
        primaryCtaText: "Our Webinars",
        primaryCtaUrl: "/events",
        secondaryCtaText: "Explore Courses",
        secondaryCtaUrl: "/education",
        backgroundGradient: "linear-gradient(135deg, #7c2d12 0%, #dd6b20 100%)",
        heroImageUrl: ""
      };
    default:
      return {
        enabled: true,
        title: pageId.charAt(0).toUpperCase() + pageId.slice(1),
        subtitle: "A customized system page running natively in the browser.",
        primaryCtaText: "Return Home",
        primaryCtaUrl: "/home",
        secondaryCtaText: "",
        secondaryCtaUrl: "",
        backgroundGradient: "linear-gradient(135deg, #1e293b 0%, #475569 100%)",
        heroImageUrl: ""
      };
  }
}
