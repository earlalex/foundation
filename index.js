// index.js
import { errorHandler } from './core/error-handler.js';
import { store } from './core/store.js';
import { authManager } from './core/auth.js';
import { Router } from './router/router.js';
import { themeEngine } from './core/theme.js';
import { logger } from './core/logger.js';
import { configManager } from './core/config.js';
import { initNavbar } from './core/navbar.js';

// Web Components
import './components/global/ContentCard.js';
import './components/global/AuthorCard.js';
import './components/global/ChatWidget.js';
import './components/global/HeroBanner.js';
import './components/global/FeatureGrid.js';
import './components/global/PricingTable.js';
import './components/global/TestimonialSlider.js';
import './components/global/CtaBlock.js';
import './components/global/AppointmentPicker.js';

// Automated Test Suites
import { runSchemaTests, runStoreTests, runRouterTests, runServicesTests } from './tests/index.js';
import { toast } from './utils/toast.js';

// Page Controllers (Lazily Loaded in Route Splitting / pageLoaded events)
import { initHomePage } from './pages/home/home.js';

logger.info('Foundation Core initializing...');

/**
 * Emergency Console Bypass for Local Development
 * Usage in Browser Console: foundationDevBypass()
 */
window.foundationDevBypass = function() {
  window.__FOUNDATION_DEV_BYPASS__ = true;
  window.store = store;
  store.dispatch('SET_USER', {
    uid: 'admin_bypass',
    email: 'admin@example.com',
    displayName: 'Bypass Admin',
    isAdmin: true,
    role: 'admin'
  });
  store.dispatch('SET_DEV_MODE', true);
  console.log('%c[Security Bypass Granted]: Emergency Console Dev Bypass Active.', 'color: #38a169; font-weight: bold;');
  window.router?.loadRoute('/admin');
};

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Active Plugins & Hooks
  try {
    const { pluginManager } = await import('./core/plugins.js');
    pluginManager.initializeActivePlugins();

    const { doAction } = await import('./core/hooks.js');
    await doAction('foundation_init');
  } catch (err) {
    console.error('[Foundation Init Hooks]: Active plugins initialization failed.', err);
  }

  // 1. Initialize Master Configuration (reads LocalStorage / Firestore)
  const isInstalled = await configManager.init();

  // 2. Boot Test Suites in Dev Mode
  if (store.state.devMode) {
    logger.group('Dev Mode Test Suite Execution');
    window.store = store;
    window.logger = logger;
    
    runSchemaTests();
    runStoreTests();
    await runRouterTests();
    await runServicesTests();
    
    logger.groupEnd();
  }

  // 3. Mount Router Instance
  window.router = new Router({
    '/home': {
      title: 'Home',
      description: 'Welcome to Foundation - A custom zero-build web framework.',
      viewPath: './pages/home/home.html'
    },
    '/about': {
      title: 'About Me',
      description: 'Learn more about the creator and platform architect.',
      viewPath: './pages/about/about.html'
    },
    '/events': {
      title: 'Events & Live Meets',
      description: 'Upcoming webinars and interactive video sessions.',
      viewPath: './pages/events/events.html'
    },
    '/contact': {
      title: 'Contact & Appointments',
      description: 'Schedule a consultation or send an inquiry.',
      viewPath: './pages/contact/contact.html'
    },
    '/detail': {
      title: 'Publication Detail',
      description: 'Read full articles, publications, and event details.',
      viewPath: './pages/detail/detail.html'
    },
    '/admin': {
      title: 'Admin Dashboard',
      description: 'Manage settings and site metadata.',
      viewPath: './pages/admin/admin.html'
    },
    '/login': {
      title: 'Sign In / Register',
      description: 'Log in to your Foundation account portal.',
      viewPath: './pages/login.html'
    },
    '/account': {
      title: 'Customer Dashboard',
      description: 'Manage your unlocked premium publications and subscription billing.',
      viewPath: './pages/account.html'
    },
    '/404': {
      title: 'Page Not Found',
      description: 'The page you requested could not be found.',
      viewPath: './pages/404.html'
    }
  });

  // 4. Initialize Top Global Navbar Header
  initNavbar();

  // Initialize Global Website Footer Features
  initGlobalFooter();

  // Active Simulation Mode Observer and Sticky Bottom-Right Badge
  store.subscribe((state) => {
    let badge = document.getElementById('simulation-active-badge');
    if (state.simulatedUserTier) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'simulation-active-badge';
        document.body.appendChild(badge);
      }

      const roleCapitalized = state.simulatedUserTier.charAt(0).toUpperCase() + state.simulatedUserTier.slice(1);
      badge.innerHTML = `
        <span class="badge-short-text">⚠️ Simulation Mode</span>
        <span class="badge-full-text" style="display: none; align-items: center; gap: 0.75rem;">
          <span>⚠️ SIMULATION MODE ACTIVE: Viewing site as [ <strong>${roleCapitalized}</strong> ]</span>
          <button id="btn-return-admin-sim" style="background: #ffffff; color: #e53e3e; border: none; padding: 4px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.8rem; margin-left: 5px; transition: background 0.2s;">
            Return to Admin Command Center
          </button>
        </span>
      `;

      // Add dynamic mouseover events to safely toggle block displays inside the flex layout transitions
      badge.addEventListener('mouseenter', () => {
        const fullText = badge.querySelector('.badge-full-text');
        if (fullText) fullText.style.display = 'flex';
      });
      badge.addEventListener('mouseleave', () => {
        const fullText = badge.querySelector('.badge-full-text');
        if (fullText) fullText.style.display = 'none';
      });

      // Bind listener
      const btn = badge.querySelector('#btn-return-admin-sim');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          store.dispatch('SET_SIMULATED_USER_TIER', null);
          window.router.navigateTo('/admin');
        });
      }
    } else {
      if (badge) {
        badge.remove();
      }
    }
  });

  // 5. Hard Guard: If uninstalled, render Setup Wizard. Otherwise, initialize route cleanly.
  if (!isInstalled && !window.__FOUNDATION_DEV_BYPASS__) {
    logger.warn('[Core]: Platform unconfigured. Intercepting route to render Setup Wizard.');
    window.router.renderSetupWizard();
  } else {
    await window.router.init();
  }

  // Mount Chat Widget globally if enabled and available
  const chatbotEnabled = configManager.current.chatbot?.enabled !== false;
  if (chatbotEnabled) {
    const chatWidget = document.createElement('chat-widget');
    document.body.appendChild(chatWidget);
  }

  // Global Footer Newsletter Form Logic
  const footerConsent = document.getElementById('footer-newsletter-consent');
  const footerSubmit = document.getElementById('btn-footer-newsletter-submit');
  const footerForm = document.getElementById('footer-newsletter-form');

  if (footerConsent && footerSubmit) {
    footerConsent.addEventListener('change', (e) => {
      footerSubmit.disabled = !e.target.checked;
      if (e.target.checked) {
        footerSubmit.style.cursor = 'pointer';
        footerSubmit.style.opacity = '1';
      } else {
        footerSubmit.style.cursor = 'not-allowed';
        footerSubmit.style.opacity = '0.5';
      }
    });
  }

  footerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('footer-newsletter-email');
    if (!emailInput) return;

    const email = emailInput.value.trim();
    if (!email) return;

    try {
      const { toast } = await import('./utils/toast.js');
      toast.success(`Successfully subscribed ${email} to our newsletter!`);
      footerForm.reset();
      if (footerSubmit) {
        footerSubmit.disabled = true;
        footerSubmit.style.cursor = 'not-allowed';
        footerSubmit.style.opacity = '0.5';
      }
    } catch (err) {
      console.error('[Footer Newsletter]: Subscription error', err);
    }
  });
});

async function initGlobalFooter() {
  const footerContainer = document.getElementById('global-footer');
  if (!footerContainer) return;

  const footerCfg = configManager.current.footer || {
    brand: { show: true, title: "Foundation", tagline: "A custom zero-build web framework for modern serverless architectures." },
    legal: { show: true, heading: "Legal & Policies", links: [{ label: "Terms of Use", url: "/terms" }, { label: "Privacy Policy", url: "/privacy" }, { label: "Cookie Settings", url: "/cookies" }] },
    newsletter: { show: true, heading: "Newsletter", text: "Subscribe to our newsletter for exclusive updates.", consentCopy: "I agree to receive email communications and accept the privacy policy." },
    social: { show: true, heading: "Follow Us", links: [{ name: "twitter", url: "https://x.com" }, { name: "linkedin", url: "https://linkedin.com" }, { name: "youtube", url: "https://youtube.com" }, { name: "github", url: "https://github.com" }, { name: "facebook", url: "https://facebook.com" }, { name: "instagram", url: "https://instagram.com" }] }
  };

  let colsHtml = '';

  if (footerCfg.brand?.show !== false) {
    colsHtml += `
      <div class="footer-column brand-column">
        <h3 class="footer-title">${footerCfg.brand.title || 'Foundation'}</h3>
        <p class="footer-tagline">${footerCfg.brand.tagline || ''}</p>
        <span class="footer-copyright">&copy; 2026 ${footerCfg.brand.title || 'Foundation'} Framework. All rights reserved.</span>
      </div>
    `;
  }

  if (footerCfg.legal?.show !== false) {
    colsHtml += `
      <div class="footer-column links-column">
        <h4 class="footer-heading">${footerCfg.legal.heading || 'Legal & Policies'}</h4>
        <ul class="footer-links">
          ${(footerCfg.legal.links || []).map(link => `<li><a href="${link.url}" class="spa-footer-link">${link.label}</a></li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (footerCfg.newsletter?.show !== false) {
    colsHtml += `
      <div class="footer-column newsletter-column">
        <h4 class="footer-heading">${footerCfg.newsletter.heading || 'Newsletter'}</h4>
        <p class="newsletter-text">${footerCfg.newsletter.text || ''}</p>
        <form id="footer-newsletter-form" class="newsletter-form">
          <input type="email" id="newsletter-email" placeholder="Your Email Address" required class="newsletter-input" />
          <button type="submit" id="newsletter-submit" class="btn-primary newsletter-btn" disabled>Subscribe</button>
          <label class="newsletter-consent">
            <input type="checkbox" id="newsletter-consent-cb" required />
            <span>${footerCfg.newsletter.consentCopy || ''}</span>
          </label>
        </form>
      </div>
    `;
  }

  if (footerCfg.social?.show !== false) {
    colsHtml += `
      <div class="footer-column social-column">
        <h4 class="footer-heading">${footerCfg.social.heading || 'Follow Us'}</h4>
        <div class="footer-social-icons">
          ${(footerCfg.social.links || []).map(link => `
            <a href="${link.url}" target="_blank" aria-label="${link.name}" class="social-icon-link" id="footer-icon-${link.name}"></a>
          `).join('')}
        </div>
      </div>
    `;
  }

  footerContainer.innerHTML = `<div class="footer-container">${colsHtml}</div>`;

  // Load SVG Icons for Social and Layout sections from default-set or custom config
  try {
    const iconSetType = configManager.current.iconSet || 'default';
    let iconData = null;

    if (iconSetType === 'default') {
      const response = await fetch('./assets/icons/default-set.json');
      if (response.ok) {
        iconData = await response.json();
      }
    } else if (iconSetType === 'custom' && configManager.current.customIconData) {
      iconData = configManager.current.customIconData;
    }

    if (iconData) {
      const iconKeys = ['twitter', 'linkedin', 'youtube', 'github', 'facebook', 'instagram'];
      iconKeys.forEach(key => {
        const el = document.getElementById(`footer-icon-${key}`);
        if (el && iconData[key]) {
          el.innerHTML = iconData[key];
        }
      });
    }
  } catch (err) {
    console.warn('[Footer Icons]: Bypassed full SVG injection, using fallback styling.', err);
  }

  // Bind newsletter consent checkbox and submit behaviors
  const consentCb = document.getElementById('newsletter-consent-cb');
  const submitBtn = document.getElementById('newsletter-submit');
  const newsletterForm = document.getElementById('footer-newsletter-form');

  if (consentCb && submitBtn) {
    consentCb.addEventListener('change', (e) => {
      submitBtn.disabled = !e.target.checked;
    });
  }

  newsletterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newsletter-email')?.value;
    if (!email) return;

    if (!consentCb?.checked) {
      toast.error('You must consent to receive communications before subscribing.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Subscribing...';

    try {
      // Create user or update status in ContentDB
      const { contentDB } = await import('./core/db.js');
      const { createGoogleContact } = await import('./core/google-services.js');

      // Create contact and save user locally / Firestore
      await contentDB.saveUser({
        email,
        role: 'subscriber',
        name: email.split('@')[0],
        newsletterSubscribed: true,
        consentDate: new Date().toISOString()
      });

      // Synchronize with Google Contacts mock/live bridge
      await createGoogleContact({
        name: email.split('@')[0],
        email,
        role: 'Subscriber'
      });

      toast.success('Successfully subscribed to our newsletter! Check your inbox for updates.');
      newsletterForm.reset();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subscribe';
    } catch (err) {
      console.error('[Newsletter Subscription]: Error registering subscriber.', err);
      toast.error('Failed to subscribe. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Subscribe';
    }
  });

  // Attach SPA Router handling to footer link clicks
  document.querySelectorAll('.spa-footer-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      window.router?.navigateTo(href);
    });
  });
}

// Single Unified Page Lifecycle Listener
window.addEventListener('pageLoaded', (e) => {
  logger.log(`Page lifecycle transition -> ${e.detail.path}`);
  
  // Guard: Skip page controllers if platform is unconfigured / running setup wizard
  const isConfigured = configManager.current.isInstalled && (configManager.current.adminEmails?.length > 0);
  if (!isConfigured && !window.__FOUNDATION_DEV_BYPASS__) return;

  if (e.detail.path === '/home') {
    initHomePage();
  } else if (e.detail.path === '/about') {
    import('./pages/about/about.js').then(m => m.initAboutPage());
  } else if (e.detail.path === '/events') {
    import('./pages/events/events.js').then(m => m.initEventsPage());
  } else if (e.detail.path === '/contact') {
    import('./pages/contact/contact.js').then(m => m.initContactPage());
  } else if (e.detail.path === '/detail') {
    import('./pages/detail/detail.js').then(m => m.initDetailPage());
  } else if (e.detail.path === '/admin') {
    import('./pages/admin/admin.js').then(m => m.initAdminPage());
  } else if (e.detail.path === '/account') {
    import('./pages/account.js').then(m => m.initAccountPage());
  }
});