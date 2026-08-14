/**
 * pages/admin/components/AdminSetupWizards.js
 * Implements interactive, step-by-step setup modals for the Single Unified Master Onboarding Wizard.
 */
import { configManager } from '../../../core/config.js';
import { toast } from '../../../utils/toast.js';
import { store } from '../../../core/store.js';
import {
  writeTempCredentialsVault,
  readTempCredentialsVault,
  deleteTempCredentialsVault
} from '../../../core/drive-upload.js';
import { contentDB } from '../../../core/db.js';
import { sendGmailNotification } from '../../../core/google-services.js';
import { FRAMEWORK_AFFILIATES } from '../../../core/affiliates.js';

export class AdminSetupWizards {
  /**
   * Launch the Free Email DNS Guide Modal.
   */
  static launchDnsGuideModal() {
    import('../admin-site-settings.js').then(m => {
      m.launchDnsGuideModal();
    });
  }

  /**
   * Helper to retrieve current onboarding sequence progress
   */
  static getOnboardingProgress() {
    const cfg = configManager.current || {};
    const section1 = !!cfg.sectionWizards?.section1;
    const section2 = !!cfg.sectionWizards?.section2;
    const section3 = !!cfg.sectionWizards?.section3;
    const section4 = !!cfg.sectionWizards?.section4;
    return { section1, section2, section3, section4 };
  }

  /**
   * Launch the Single Unified Master Onboarding Wizard
   */
  static launch(wizardType = null, onComplete = null) {
    const wizard = document.createElement('master-setup-wizard');
    wizard.setAttribute('mode', 'modal');
    if (onComplete) {
      wizard.onCompleteCallback = onComplete;
    }
    document.body.appendChild(wizard);
  }

  /**
   * Launch a wizard modal specifically for default page overrides (home, about, events, contact)
   * This is retained for CMS layout overrides
   */
  static launchPageWizard(pageId, onComplete) {
    const modal = document.createElement('div');
    modal.className = 'setup-wizard-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
    `;

    const cfg = configManager.current || {};
    const biz = cfg.businessProfile || {};
    const profile = cfg.author || cfg.publicProfile || {};
    const appts = cfg.appointments || {};

    let title = "";
    let formHtml = "";
    let saveHandler = null;

    if (pageId === 'home') {
      title = "Home Page Wizard Configurator";
      const prefilledHeadline = `${cfg.siteTitle || 'Ascension Avenue Academy'} - ${cfg.siteTagline || 'Enterprise Growth'}`;
      const prefilledSubheadline = cfg.siteTagline || "Book a 1-on-1 strategic video consultation synchronized with Google Calendar.";
      const prefilledBg = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
      const prefilledSections = "blog, event, podcast, education";
      const prefilledCta = "Explore Platform, Join Academy";

      formHtml = `
        <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 420px; overflow-y: auto; padding-right: 8px;">
          <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure the default visual sections of your home page.</p>
          <div>
            <label for="wz-home-headline" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Hero Headline:</label>
            <input type="text" id="wz-home-headline" aria-label="Hero Headline" value="${prefilledHeadline}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-home-subheadline" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Hero Sub-headline:</label>
            <input type="text" id="wz-home-subheadline" aria-label="Hero Sub-headline" value="${prefilledSubheadline}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-home-bg" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Banner Background Image URL:</label>
            <input type="url" id="wz-home-bg" aria-label="Banner Background Image URL" value="${prefilledBg}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-home-sections" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Featured Section Order (comma separated):</label>
            <input type="text" id="wz-home-sections" aria-label="Featured Section Order (comma separated)" value="${prefilledSections}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-home-cta" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Primary CTA Buttons (comma separated):</label>
            <input type="text" id="wz-home-cta" aria-label="Primary CTA Buttons (comma separated)" value="${prefilledCta}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
        </div>
      `;

      saveHandler = async () => {
        const headline = document.getElementById('wz-home-headline').value;
        const subheadline = document.getElementById('wz-home-subheadline').value;
        const bg = document.getElementById('wz-home-bg').value;
        const sections = document.getElementById('wz-home-sections').value;
        const cta = document.getElementById('wz-home-cta').value;

        const compiledHtml = `
          <section style="max-width: 1000px; margin: 3rem auto; padding: 0 1.5rem; font-family: system-ui, sans-serif;">
            <div style="background-image: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('${bg}'); background-size: cover; background-position: center; border-radius: 12px; padding: 6rem 2rem; text-align: center; color: white; margin-bottom: 3.5rem;">
              <h1 style="font-size: 2.85rem; font-weight: 800; margin-bottom: 1rem; color: #ffffff; letter-spacing: -0.025em; line-height: 1.2;">
                ${headline}
              </h1>
              <p style="font-size: 1.25rem; color: #f7fafc; max-width: 650px; margin: 0 auto 2.5rem auto; line-height: 1.6;">
                ${subheadline}
              </p>
              <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                ${cta.split(',').map((btnText, idx) => `
                  <a href="${idx === 0 ? '/contact' : '/events'}" class="btn-primary" style="padding: 12px 28px; background: ${idx === 0 ? 'var(--theme-color-primary, #2b6cb0)' : '#ffffff'}; color: ${idx === 0 ? '#ffffff' : '#2b6cb0'}; font-weight: bold; border-radius: 6px; text-decoration: none; border: ${idx === 0 ? 'none' : '1px solid #2b6cb0'}; display: inline-block;">
                    ${btnText.trim()}
                  </a>
                `).join('')}
              </div>
            </div>
            <div id="home-sections-container" style="display: flex; flex-direction: column; gap: 3rem;">
              <p style="color: #a0aec0; text-align: center;">Loading publication sections...</p>
            </div>
          </section>
        `;

        return {
          id: 'home',
          title: "Home Page Override",
          description: subheadline,
          compiledHtml,
          compiledCss: "section { margin-top: 2rem; }"
        };
      };

    } else if (pageId === 'about') {
      title = "About Page Wizard Configurator";
      const prefilledFounderStory = "We started Ascension Avenue Academy to provide a premium browser-first web experience and enterprise scaling.";
      const prefilledMission = "To cultivate operational excellence, zero-build simplicity, and robust digital identity.";
      const prefilledTimeline = "2024: Foundation Beta, 2025: Production Release, 2026: V2 Launch";
      const prefilledBio = profile.bio || "Jane Doe is the Lead Systems Architect and Founder of Ascension Avenue Academy.";

      formHtml = `
        <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 420px; overflow-y: auto; padding-right: 8px;">
          <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Customize Founder details, Mission timeline, and story highlights.</p>
          <div>
            <label for="wz-about-story" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Founder/Team Story:</label>
            <textarea id="wz-about-story" aria-label="Founder/Team Story" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 80px; box-sizing: border-box;">${prefilledFounderStory}</textarea>
          </div>
          <div>
            <label for="wz-about-mission" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Mission Statement:</label>
            <input type="text" id="wz-about-mission" aria-label="Mission Statement" value="${prefilledMission}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-about-timeline" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Milestones Timeline (comma separated Year:Event):</label>
            <input type="text" id="wz-about-timeline" aria-label="Milestones Timeline (comma separated Year:Event)" value="${prefilledTimeline}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-about-bio" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Executive Bio:</label>
            <textarea id="wz-about-bio" aria-label="Executive Bio" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 80px; box-sizing: border-box;">${prefilledBio}</textarea>
          </div>
        </div>
      `;

      saveHandler = async () => {
        const story = document.getElementById('wz-about-story').value;
        const mission = document.getElementById('wz-about-mission').value;
        const timeline = document.getElementById('wz-about-timeline').value;
        const bio = document.getElementById('wz-about-bio').value;

        const compiledHtml = `
          <section style="max-width: 900px; margin: 3rem auto; padding: 0 1.5rem; font-family: system-ui, sans-serif;">
            <div style="text-align: center; margin-bottom: 3rem;">
              <h1 style="font-size: 2.5rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin-bottom: 0.5rem;">
                About Our Organization
              </h1>
              <p style="color: var(--theme-color-text-secondary, #4a5568); font-size: 1.1rem;">
                Meet the architect behind the zero-build Foundation.
              </p>
            </div>

            <div style="margin-bottom: 3rem;">
              <author-card layout="full"></author-card>
            </div>

            <div class="card" style="line-height: 1.8; font-size: 1.05rem; color: var(--theme-color-text-primary, #2d3748); padding: 2rem; border-radius: 8px; background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 4px solid var(--theme-color-primary, #2b6cb0); display: flex; flex-direction: column; gap: 1.5rem;">
              <div>
                <h3 style="margin-top: 0; font-size: 1.35rem; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 0.75rem;">Our Mission</h3>
                <p style="margin: 0; line-height: 1.6;">${mission}</p>
              </div>

              <div>
                <h3 style="margin-top: 0; font-size: 1.35rem; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 0.75rem;">Founder's Story</h3>
                <p style="margin: 0; line-height: 1.6;">${story}</p>
              </div>

              <div>
                <h3 style="margin-top: 0; font-size: 1.35rem; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 0.75rem;">Executive Bio</h3>
                <p style="margin: 0; line-height: 1.6;">${bio}</p>
              </div>

              <div>
                <h3 style="margin-top: 0; font-size: 1.35rem; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); margin-bottom: 1rem;">Key Milestones</h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; border-left: 2px solid #edf2f7; padding-left: 1rem; margin-left: 0.5rem;">
                  ${timeline.split(',').map(m => {
                    const parts = m.split(':');
                    const yr = parts[0]?.trim() || '';
                    const val = parts.slice(1).join(':')?.trim() || '';
                    return `
                      <div>
                        <strong style="color: var(--theme-color-primary, #2b6cb0);">${yr}</strong>
                        <span style="color: var(--theme-color-text-secondary, #4a5568); margin-left: 0.5rem;">${val}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </section>
        `;

        return {
          id: 'about',
          title: "About Page Override",
          description: mission,
          compiledHtml,
          compiledCss: ""
        };
      };

    } else if (pageId === 'events') {
      title = "Events Page Wizard Configurator";
      const prefilledHeaderCopy = "Upcoming Premium Events, Ticketing & Sponsorships";
      const prefilledTicketTerms = "All passes grant full access to stages, networking panels, and standard seating.";
      const prefilledRefundPolicy = biz.refundUrl ? `Refer to refunds policy at ${biz.refundUrl}` : "Non-refundable. Transfers allowed up to 48 hours prior.";
      const prefilledVendorNotice = "Spaces are extremely limited. Select Standard or Premium packages below.";

      formHtml = `
        <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 420px; overflow-y: auto; padding-right: 8px;">
          <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Establish policies, Terms, and headlines for the Events Subsystem.</p>
          <div>
            <label for="wz-events-header" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Event Header Copy:</label>
            <input type="text" id="wz-events-header" aria-label="Event Header Copy" value="${prefilledHeaderCopy}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-events-terms" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Ticket Terms:</label>
            <input type="text" id="wz-events-terms" aria-label="Default Ticket Terms" value="${prefilledTicketTerms}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-events-refund" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Refund Policy:</label>
            <textarea id="wz-events-refund" aria-label="Refund Policy" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 60px; box-sizing: border-box;">${prefilledRefundPolicy}</textarea>
          </div>
          <div>
            <label for="wz-events-vendor-notice" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Vendor Space Notices:</label>
            <textarea id="wz-events-vendor-notice" aria-label="Vendor Space Notices" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 60px; box-sizing: border-box;">${prefilledVendorNotice}</textarea>
          </div>
        </div>
      `;

      saveHandler = async () => {
        const headerCopy = document.getElementById('wz-events-header').value;
        const ticketTerms = document.getElementById('wz-events-terms').value;
        const refundPolicy = document.getElementById('wz-events-refund').value;
        const vendorNotice = document.getElementById('wz-events-vendor-notice').value;

        const compiledHtml = `
          <section style="max-width: 1200px; margin: 3rem auto; padding: 0 1.5rem; font-family: system-ui, sans-serif;">
            <div style="text-align: center; margin-bottom: 3rem;">
              <h1 style="font-size: 2.5rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin-bottom: 0.5rem;">
                ${headerCopy}
              </h1>
              <p style="color: var(--theme-color-text-secondary, #4a5568); font-size: 1.1rem; max-width: 700px; margin: 0 auto;">
                ${ticketTerms}
              </p>
            </div>

            <!-- Alert / Policies Box -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 3rem;">
              <div style="background: #fffaf0; border: 1px solid #fbd38d; border-radius: 8px; padding: 1.25rem; color: #c05621;">
                <strong style="font-size: 0.95rem; display: block; margin-bottom: 0.25rem;">⚖️ Cancellation & Refund Policy</strong>
                <p style="margin: 0; font-size: 0.85rem; line-height: 1.5;">${refundPolicy}</p>
              </div>
              <div style="background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 1.25rem; color: #2b6cb0;">
                <strong style="font-size: 0.95rem; display: block; margin-bottom: 0.25rem;">📢 Vendor & Exhibition Space Information</strong>
                <p style="margin: 0; font-size: 0.85rem; line-height: 1.5;">${vendorNotice}</p>
              </div>
            </div>

            <!-- Event Grid Feed -->
            <div id="events-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 2rem;">
              <p style="color: #a0aec0; text-align: center; grid-column: 1 / -1;">Loading event calendar...</p>
            </div>
          </section>
        `;

        return {
          id: 'events',
          title: "Events Page Override",
          description: headerCopy,
          compiledHtml,
          compiledCss: ""
        };
      };

    } else if (pageId === 'contact') {
      title = "Contact Page Wizard Configurator";
      const prefilledHeroCopy = "Let's Connect & Accelerate Your Growth";
      const prefilledDepositRules = "Booking is verified instantly. Operating hours Buffer & slot requirements apply.";

      let prefilledHoursText = "Monday - Friday: 09:00 - 17:00";
      if (appts.operatingHours) {
        const days = appts.operatingDays?.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') || 'Monday, Tuesday, Wednesday, Thursday, Friday';
        prefilledHoursText = `${days}: ${appts.operatingHours.start || '09:00'} - ${appts.operatingHours.end || '17:00'}`;
      }

      const prefilledConfirmation = "⚡ Average response time: < 24 business hours";

      formHtml = `
        <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 420px; overflow-y: auto; padding-right: 8px;">
          <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure the high-impact text blocks of your Consultation & Contact page.</p>
          <div>
            <label for="wz-contact-hero" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Consultation Hero Copy Headline:</label>
            <input type="text" id="wz-contact-hero" aria-label="Consultation Hero Copy Headline" value="${prefilledHeroCopy}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-contact-deposit" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Booking Deposit Rules:</label>
            <input type="text" id="wz-contact-deposit" aria-label="Booking Deposit Rules" value="${prefilledDepositRules}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-contact-hours" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Operating Hours Details:</label>
            <input type="text" id="wz-contact-hours" aria-label="Operating Hours Details" value="${prefilledHoursText}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-contact-confirm" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Direct Message Confirmation Notice (Trust Indicator):</label>
            <input type="text" id="wz-contact-confirm" aria-label="Direct Message Confirmation Notice" value="${prefilledConfirmation}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
        </div>
      `;

      saveHandler = async () => {
        const heroText = document.getElementById('wz-contact-hero').value;
        const depositRules = document.getElementById('wz-contact-deposit').value;
        const hoursText = document.getElementById('wz-contact-hours').value;
        const confirmText = document.getElementById('wz-contact-confirm').value;

        const addressVal = [biz.address, biz.city, biz.state, biz.zip].filter(Boolean).join(', ') || "100 Innovation Way, San Francisco, CA";
        const emailVal = biz.supportEmail || biz.email || "support@earlalex.com";
        const phoneVal = biz.phone || "1-800-555-0199";

        const compiledHtml = `
          <section style="max-width: 1100px; margin: 3rem auto; padding: 0 1.5rem; font-family: system-ui, sans-serif;">
            <div style="background: linear-gradient(135deg, #ebf8ff 0%, #f7fafc 100%); border-radius: 12px; border: 1px solid #bee3f8; padding: 2.5rem 2rem; text-align: center; margin-bottom: 3rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <h1 style="font-size: 2.5rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); margin: 0 0 0.75rem 0; line-height: 1.2;">
                ${heroText}
              </h1>
              <p style="font-size: 1.15rem; color: var(--theme-color-text-secondary, #4a5568); max-width: 800px; margin: 0 auto 1.5rem auto; line-height: 1.6;">
                Book a 1-on-1 strategic video consultation synchronized with Google Calendar or send an instant inquiry to our leadership team.
              </p>
            </div>
          </section>
        `;

        return {
          id: 'contact',
          title: "Contact Page Override",
          description: heroText,
          compiledHtml,
          compiledCss: ""
        };
      };
    }

    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; width: 100%; max-width: 500px; padding: 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.2); position: relative; color: #1a202c;">
        <h3 style="margin-top: 0; font-size: 1.4rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); border-bottom: 2px solid #edf2f7; padding-bottom: 0.75rem; margin-bottom: 1.5rem;">
          ${title}
        </h3>

        <form id="page-wizard-form" style="margin-bottom: 1.5rem;">
          ${formHtml}
        </form>

        <div style="display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid #edf2f7; padding-top: 1.25rem;">
          <button id="wz-cancel" style="background: transparent; border: 1px solid #cbd5e0; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer;">
            Cancel
          </button>
          <button id="wz-save" class="btn-primary" style="background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: 6px; padding: 8px 20px; font-weight: bold; cursor: pointer;">
            Save Override Configuration
          </button>
        </div>
      </div>
    `;

    modal.querySelector('#wz-cancel').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#wz-save').addEventListener('click', async (e) => {
      e.preventDefault();
      const saveBtn = modal.querySelector('#wz-save');
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving to Firestore...";

      try {
        const pageData = await saveHandler();
        const success = await contentDB.saveCustomPage(pageData);
        if (success) {
          toast.success(`Persistent Page override for "${pageId}" saved successfully!`);
          modal.remove();
          if (onComplete) onComplete();
        } else {
          toast.error("Failed to persist custom page layout. Please check Firebase rules/connectivity.");
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Override Configuration";
        }
      } catch (err) {
        toast.error(`Error saving: ${err.message}`);
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Override Configuration";
      }
    });

    document.body.appendChild(modal);
  }
}

/**
 * Custom Web Component <master-setup-wizard>
 */
export class MasterSetupWizard extends HTMLElement {
  constructor() {
    super();
    this.currentStep = 1;
    this.totalSteps = 7;
  }

  connectedCallback() {
    this.isModal = this.getAttribute('mode') === 'modal';
    this.render();
    this.showStep(this.currentStep);
    this.bindEvents();
  }

  showStep(stepNum) {
    this.querySelectorAll('.step-pane').forEach(pane => {
      pane.style.display = parseInt(pane.getAttribute('data-step'), 10) === stepNum ? 'block' : 'none';
    });
    const progressFill = this.querySelector('.progress-fill');
    if (progressFill) {
      progressFill.style.width = `${(stepNum / this.totalSteps) * 100}%`;
    }
    const stepNumLabel = this.querySelector('.current-step-num');
    if (stepNumLabel) {
      stepNumLabel.textContent = stepNum;
    }

    // Button states
    const backBtn = this.querySelector('.btn-back');
    const nextBtn = this.querySelector('.btn-next');
    if (backBtn) {
      backBtn.style.display = stepNum === 1 ? 'none' : 'block';
    }
    if (nextBtn) {
      if (stepNum === this.totalSteps) {
        nextBtn.textContent = 'Finish Installation & Lock State';
        nextBtn.className = 'btn-nav btn-next btn-finish';
      } else {
        nextBtn.textContent = 'Next Step';
        nextBtn.className = 'btn-nav btn-next';
      }
    }
  }

  validateStep(stepNum) {
    const pane = this.querySelector(`.step-pane[data-step="${stepNum}"]`);
    if (!pane) return true;
    const inputs = pane.querySelectorAll('input, select, textarea');
    let valid = true;
    inputs.forEach(input => {
      if (input.hasAttribute('required') && !input.value.trim()) {
        valid = false;
        input.style.border = '2px solid #e53e3e';
      } else {
        input.style.border = '1px solid #cbd5e0';
      }
    });

    // Custom check: AdSense Publisher ID in Step 7 must start with ca-pub-
    if (stepNum === 7) {
      const adsense = this.querySelector('#m-adsense-pub');
      if (adsense && adsense.value && !adsense.value.trim().startsWith('ca-pub-')) {
        valid = false;
        adsense.style.border = '2px solid #e53e3e';
        toast.error("AdSense Publisher ID must start with 'ca-pub-'");
      }
    }

    if (!valid) {
      toast.warning("Please fill out all required fields on this step.");
    }
    return valid;
  }

  bindEvents() {
    const backBtn = this.querySelector('.btn-back');
    const nextBtn = this.querySelector('.btn-next');
    const cancelBtn = this.querySelector('.btn-cancel-modal');

    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault();
        if (this.currentStep > 1) {
          this.currentStep--;
          this.showStep(this.currentStep);
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = async (e) => {
        e.preventDefault();
        if (this.validateStep(this.currentStep)) {
          if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.showStep(this.currentStep);
          } else {
            nextBtn.disabled = true;
            nextBtn.textContent = "Writing System Locks...";
            await this.finishSetup();
          }
        }
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        this.remove();
      };
    }

    // Bind help guides togglers
    this.querySelectorAll('.help-btn-guide').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        const panel = this.querySelector(`#${targetId}`);
        if (panel) {
          const isCollapsed = panel.style.display === 'none';
          panel.style.display = isCollapsed ? 'block' : 'none';

          const originalText = btn.getAttribute('data-label') || btn.textContent;
          if (!btn.getAttribute('data-label')) {
            btn.setAttribute('data-label', originalText);
          }
          btn.textContent = isCollapsed ? '[❌ Hide Guide]' : originalText;
        }
      };
    });
  }

  async finishSetup() {
    const finalConfig = {
      ...configManager.current,
      siteTitle: this.querySelector('#m-site-title').value.trim(),
      siteDomain: this.querySelector('#m-site-domain').value.trim(),
      adminEmails: [this.querySelector('#m-admin-email').value.trim()],
      isInstalled: true,
      site: {
        companyName: this.querySelector('#m-site-title').value.trim(),
        siteName: this.querySelector('#m-site-title').value.trim(),
        isConfigured: true
      },
      businessProfile: {
        ...(configManager.current.businessProfile || {}),
        supportEmail: this.querySelector('#m-support-email').value.trim(),
        email: this.querySelector('#m-support-email').value.trim(),
        isConfigured: true
      },
      firebase: {
        apiKey: this.querySelector('#m-fb-key').value.trim(),
        projectId: this.querySelector('#m-fb-project').value.trim(),
        authDomain: `${this.querySelector('#m-fb-project').value.trim()}.firebaseapp.com`,
        databaseRulesInitialized: true
      },
      google: {
        clientId: this.querySelector('#m-google-id').value.trim(),
        clientSecret: this.querySelector('#m-google-secret').value.trim(),
        serviceAccountToken: this.querySelector('#m-google-service-token').value.trim(),
        ownerEmail: this.querySelector('#m-admin-email').value.trim(),
        consentScreenCompleted: true
      },
      aiConfig: {
        geminiApiKey: this.querySelector('#m-gemini-key').value.trim(),
        openaiApiKey: this.querySelector('#m-openai-key').value.trim(),
        preferredProvider: this.querySelector('#m-preferred-model').value.trim()
      },
      chatbot: {
        ...(configManager.current.chatbot || {}),
        enabled: true,
        openaiApiKey: this.querySelector('#m-openai-key').value.trim(),
        telnyxApiKey: this.querySelector('#m-telnyx-key').value.trim(),
        telnyxPhoneNumber: this.querySelector('#m-telnyx-phone').value.trim(),
        twilioAccountSid: this.querySelector('#m-twilio-sid').value.trim(),
        twilioAuthToken: this.querySelector('#m-twilio-token').value.trim(),
        twilioPhoneNumber: this.querySelector('#m-twilio-phone').value.trim()
      },
      stripe: {
        ...(configManager.current.stripe || {}),
        secretKey: this.querySelector('#m-stripe-sec').value.trim(),
        publishableKey: this.querySelector('#m-stripe-pub').value.trim(),
        webhookSecret: this.querySelector('#m-stripe-webhook').value.trim(),
        priceId: this.querySelector('#m-stripe-price').value.trim(),
        isConfigured: true
      },
      wise: {
        apiKey: this.querySelector('#m-wise-key').value.trim(),
        profileId: this.querySelector('#m-wise-profile').value.trim(),
        sandbox: true
      },
      virustotal: {
        apiKey: this.querySelector('#m-vt-key').value.trim()
      },
      security: {
        ...(configManager.current.security || {}),
        zapApiUrl: this.querySelector('#m-zap-endpoint').value.trim(),
        isConfigured: true
      },
      lastpass: {
        ...(configManager.current.lastpass || {}),
        companyId: this.querySelector('#m-lastpass-cid').value.trim(),
        provisioningHash: this.querySelector('#m-lastpass-hash').value.trim(),
        isConfigured: true
      },
      analytics: {
        googleAnalyticsId: this.querySelector('#m-ga4-id').value.trim()
      },
      thirdParty: {
        ...(configManager.current.thirdParty || {}),
        ga4PropertyId: this.querySelector('#m-ga4-id').value.trim(),
        lookerStudioEmbedUrl: this.querySelector('#m-looker-url').value.trim(),
        googlePlaceId: this.querySelector('#m-google-place').value.trim(),
        adsensePublisherId: this.querySelector('#m-adsense-pub').value.trim()
      },
      sectionWizards: {
        section1: true,
        section2: true,
        section3: true,
        section4: true
      }
    };

    try {
      // 1. Save all credentials to LocalStorage and commit payload to Cloud Firestore
      const saveResult = await configManager.saveToFirebase(finalConfig);
      if (!saveResult) {
        throw new Error("Local and Firestore sync failed.");
      }

      // 2. Post the installation payload to edge API route
      try {
        await fetch('/api/complete-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isInstalled: true, siteTitle: finalConfig.siteTitle })
        });
      } catch (err) {
        console.warn("Failed to post to server API endpoint:", err.message);
      }

      // 3. Dispatch store SET_DEV_MODE to false and re-evaluate auth states
      store.dispatch('SET_DEV_MODE', false);

      toast.success("Platform master onboarding completed successfully!");

      // Execute custom callback if present
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }

      // 4. Force-load homepage and refresh DOM cleanly
      if (this.isModal) {
        this.remove();
        window.location.reload();
      } else {
        window.router.loadRoute('/home');
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (err) {
      toast.error("Failed to complete platform setup: " + err.message);
      const nextBtn = this.querySelector('.btn-next');
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Finish Installation & Lock State';
      }
    }
  }

  render() {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com';
    const cardHtml = `
      <div class="wizard-card" style="background: white; border-radius: 12px; width: 100%; max-width: 650px; padding: 2.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.15); box-sizing: border-box; text-align: left;">
        <div class="wizard-header">
          <h2>🚀 Foundation Master Onboarding</h2>
          <div class="wizard-progress">
            <div class="progress-fill"></div>
          </div>
          <div class="wizard-step-info">
            Step <span class="current-step-num">1</span> of 7
          </div>
        </div>

        <form id="master-wizard-form" style="margin-bottom: 1.5rem;">

          <!-- Step 1: Site Identity -->
          <div class="step-pane" data-step="1">
            <div class="instruction-callout">
              "Configures core branding, metadata headers, canonical URLs, and primary administrator access rights across the platform."
            </div>
            <div class="form-group">
              <label for="m-site-title">Website Title * <span class="help-btn-guide" data-target="help-m-site-title" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-site-title" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                Your company or brand's public display name across the platform.
              </div>
              <input type="text" id="m-site-title" aria-label="Website Title" value="Foundation Framework" required />
            </div>
            <div class="form-group">
              <label for="m-site-domain">Base Domain * <span class="help-btn-guide" data-target="help-m-site-domain" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-site-domain" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                The canonical production URL where your platform will be hosted (e.g., <code>https://earlalex.com</code>).
              </div>
              <input type="url" id="m-site-domain" aria-label="Base Domain" value="${origin}" required />
            </div>
            <div class="form-group">
              <label for="m-admin-email">Primary Admin Email * <span class="help-btn-guide" data-target="help-m-admin-email" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-admin-email" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                The email address for the root system administrator. Used to grant complete dashboard control.
              </div>
              <input type="email" id="m-admin-email" aria-label="Primary Admin Email" value="admin@earlalex.com" required />
            </div>
            <div class="form-group">
              <label for="m-support-email">Support Email * <span class="help-btn-guide" data-target="help-m-support-email" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-support-email" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                The default email address displayed on your legal policy pages and invoice receipts.
              </div>
              <input type="email" id="m-support-email" aria-label="Support Email" value="support@earlalex.com" required />
            </div>
            <div class="form-group">
              <span class="help-btn-guide" data-target="help-m-free-email" style="color: var(--theme-color-accent, #38a169); font-size: 0.8rem; font-weight: bold; cursor: pointer; text-decoration: underline;">[❓ How to set up Free Emails]</span>
              <div id="help-m-free-email" class="help-guide-panel" style="display:none; background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:6px; font-size:0.8rem; color:#166534; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                <strong>Free Email DNS Configuration Guide:</strong><br>
                To dispatch free outbound transactional emails with high deliverability via MailChannels and receive free inbound forwarding via Cloudflare Email Routing, configure these DNS records on your domain registrar:
                <ul style="margin: 5px 0; padding-left: 15px;">
                  <li><strong>SPF Record (TXT):</strong> Value: <code>v=spf1 include:relay.mailchannels.net ~all</code></li>
                  <li><strong>MailChannels Domain Lockdown (TXT):</strong> Name: <code>_mailchannels</code>, Value: <code>v=mc1 cfid=&lt;your-pages-subdomain&gt;.pages.dev</code></li>
                  <li><strong>DMARC Record (TXT):</strong> Name: <code>_dmarc</code>, Value: <code>v=DMARC1; p=none; rua=mailto:admin@yourdomain.com</code></li>
                  <li><strong>Cloudflare Inbound MX Records:</strong> Point MX records to <code>isaac.mx.cloudflare.net</code> and <code>linda.mx.cloudflare.net</code>.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Step 2: Database & Authentication -->
          <div class="step-pane" data-step="2">
            <div class="instruction-callout">
              "Powers real-time NoSQL storage via Cloud Firestore, user profile persistence, and 1-Click Google OAuth SSO authentication. Retrieve these from the Firebase Console and Google Cloud API Console."
            </div>
            <div class="form-group">
              <label for="m-fb-key">Firebase API Key * <span class="help-btn-guide" data-target="help-m-fb-key" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-fb-key" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Go to <a href="https://console.firebase.google.com/" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Firebase Console</a>.<br>
                2. Select your project (or create one).<br>
                3. Go to Project Settings &rarr; General.<br>
                4. Scroll to Your Apps and copy the <code>apiKey</code> from the Web App config block.
              </div>
              <input type="text" id="m-fb-key" aria-label="Firebase API Key" value="AIzaSy_fb_mock_key_992" required />
            </div>
            <div class="form-group">
              <label for="m-fb-project">Firebase Project ID * <span class="help-btn-guide" data-target="help-m-fb-project" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-fb-project" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Go to <a href="https://console.firebase.google.com/" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Firebase Console</a>.<br>
                2. Project ID is listed under your project title card on the homepage, or inside Project Settings &rarr; General &rarr; Project ID.
              </div>
              <input type="text" id="m-fb-project" aria-label="Firebase Project ID" value="demo-proj-id" required />
            </div>
            <div class="form-group">
              <label for="m-google-id">Google Client ID * <span class="help-btn-guide" data-target="help-m-google-id" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-google-id" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Open <a href="https://console.cloud.google.com/" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Google Cloud Console</a>.<br>
                2. Search and enable <strong>Gmail, Google Drive, People, and Admin SDK APIs</strong>.<br>
                3. Go to <strong>APIs & Services</strong> &rarr; <strong>Credentials</strong>.<br>
                4. Create an OAuth 2.0 Client ID (Web Application) with Authorized Redirect URI set to <code>https://&lt;your-domain&gt;/api/auth/callback</code>.<br>
                5. Copy the generated Client ID.
              </div>
              <input type="text" id="m-google-id" aria-label="Google Client ID" value="g_client_id_01" required />
            </div>
            <div class="form-group">
              <label for="m-google-secret">Google Client Secret * <span class="help-btn-guide" data-target="help-m-google-secret" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-google-secret" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Open <a href="https://console.cloud.google.com/" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Google Cloud Console</a>.<br>
                2. Navigate to Credentials and copy the Google Client Secret associated with your OAuth 2.0 Client ID.
              </div>
              <input type="password" id="m-google-secret" aria-label="Google Client Secret" value="g_secret_99" required />
            </div>
            <div class="form-group">
              <label for="m-google-service-token">Google Service Account Token * <span class="help-btn-guide" data-target="help-m-google-service-token" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-google-service-token" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Open Google Cloud Console &rarr; Service Accounts &rarr; Create Service Account.<br>
                2. Generate and download a Service Account JSON private key.<br>
                3. Paste the complete downloaded JSON key here.<br>
                4. Delegate Domain-Wide Authority for your administrative email domain (e.g. <code>admin@&lt;your-domain&gt;</code>).
              </div>
              <textarea id="m-google-service-token" aria-label="Google Service Account Token" style="height: 60px;" required>{"type": "service_account"}</textarea>
            </div>
          </div>

          <!-- Step 3: AI Intelligence -->
          <div class="step-pane" data-step="3">
            <div class="instruction-callout">
              "Enables the site chatbot, Gemini Spark COO autonomous agent, background marketing copywriting, and automated voice telephony responses."
            </div>
            <div class="form-group">
              <label for="m-gemini-key">Gemini API Key * <span class="help-btn-guide" data-target="help-m-gemini-key" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-gemini-key" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Navigate to <a href="https://aistudio.google.com/" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Google AI Studio Console</a>.<br>
                2. Click <strong>Get API Key</strong> and generate a free/premium api key for Google Gemini 2.5 Flash.
              </div>
              <input type="password" id="m-gemini-key" aria-label="Gemini API Key" value="gemini_api_key_101" required />
            </div>
            <div class="form-group">
              <label for="m-openai-key">OpenAI API Key * <span class="help-btn-guide" data-target="help-m-openai-key" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-openai-key" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Navigate to <a href="https://platform.openai.com/api-keys" target="_blank" style="color:#2b6cb0; text-decoration:underline;">OpenAI Developer Dashboard</a>.<br>
                2. Create a new secret key for <code>gpt-4o-mini</code> completion.
              </div>
              <input type="password" id="m-openai-key" aria-label="OpenAI API Key" value="openai_api_key_mock" required />
            </div>
            <div class="form-group">
              <label for="m-preferred-model">Preferred Model *</label>
              <select id="m-preferred-model" aria-label="Preferred Model" required>
                <option value="gemini" selected>Google Gemini</option>
                <option value="openai">OpenAI GPT-4</option>
              </select>
            </div>
            <div class="form-group">
              <label for="m-voice-model">Default Voice Model *</label>
              <select id="m-voice-model" aria-label="Default Voice Model" required>
                <option value="alloy" selected>Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </div>
          </div>

          <!-- Step 4: E-Commerce & Payouts -->
          <div class="step-pane" data-step="4">
            <div class="instruction-callout">
              "Enables credit card processing, $29/mo member paywall subscriptions, ACH bank transfers, and automated international Virtual Assistant payroll disbursements via Wise Business API."
            </div>
            <div class="form-group">
              <label for="m-stripe-sec">Stripe Secret Key * <span class="help-btn-guide" data-target="help-m-stripe-sec" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-stripe-sec" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Deep-link to <a href="https://dashboard.stripe.com/apikeys" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Stripe Developers Dashboard</a>.<br>
                2. Copy your Secret Key (begins with <code>sk_</code>).
              </div>
              <input type="password" id="m-stripe-sec" aria-label="Stripe Secret Key" value="sk_test_123" required />
            </div>
            <div class="form-group">
              <label for="m-stripe-pub">Stripe Publishable Key * <span class="help-btn-guide" data-target="help-m-stripe-pub" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-stripe-pub" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Copy your Stripe Publishable Key (begins with <code>pk_</code>) from the Developers Dashboard.
              </div>
              <input type="text" id="m-stripe-pub" aria-label="Stripe Publishable Key" value="pk_test_456" required />
            </div>
            <div class="form-group">
              <label for="m-stripe-webhook">Stripe Webhook Secret * <span class="help-btn-guide" data-target="help-m-stripe-webhook" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-stripe-webhook" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Go to Stripe Developers &rarr; Webhooks &rarr; Add endpoint.<br>
                2. Point endpoint URL to <code>https://&lt;your-domain&gt;/api/stripe-webhook</code>.<br>
                3. Enable events: <code>checkout.session.completed</code>, <code>invoice.payment_failed</code>, <code>customer.subscription.deleted</code>.<br>
                4. Copy the Webhook Signing Secret (starts with <code>whsec_</code>).
              </div>
              <input type="password" id="m-stripe-webhook" aria-label="Stripe Webhook Secret" value="whsec_mock" required />
            </div>
            <div class="form-group">
              <label for="m-stripe-price">Stripe Membership Price ID * <span class="help-btn-guide" data-target="help-m-stripe-price" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-stripe-price" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Navigate to Stripe Dashboard &rarr; Products.<br>
                2. Create a Monthly Subscription Product (e.g., $29/mo).<br>
                3. Copy its dynamic Price API ID (starts with <code>price_</code>).
              </div>
              <input type="text" id="m-stripe-price" aria-label="Stripe Membership Price ID" value="price_abc" required />
            </div>
            <div class="form-group">
              <label for="m-wise-key">Wise API Token * <span class="help-btn-guide" data-target="help-m-wise-key" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-wise-key" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Log into your Wise Business Account Settings.<br>
                2. Navigate to API Tokens &rarr; Create a Read/Write API Token.<br>
                3. Copy and paste the Wise Token here.
              </div>
              <input type="password" id="m-wise-key" aria-label="Wise API Token" value="wise_api_key_mock" required />
            </div>
            <div class="form-group">
              <label for="m-wise-profile">Wise Profile ID * <span class="help-btn-guide" data-target="help-m-wise-profile" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-wise-profile" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                Copy your Business Profile ID from the Wise API details page or retrieve it via a GET call to <code>/v1/profiles</code>.
              </div>
              <input type="text" id="m-wise-profile" aria-label="Wise Profile ID" value="wise_profile_id_mock" required />
            </div>
          </div>

          <!-- Step 5: Telephony & Comms -->
          <div class="step-pane" data-step="5">
            <div class="instruction-callout">
              "Enables automated SMS notifications, appointment confirmation texts, and two-way AI voice call interactions."
            </div>
            <div class="form-group">
              <label for="m-telnyx-key">Telnyx API Key * <span class="help-btn-guide" data-target="help-m-telnyx-key" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-telnyx-key" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Create an account in <a href="https://portal.telnyx.com/" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Telnyx Portal</a>.<br>
                2. Navigate to API Keys and copy your API v2 Key.
              </div>
              <input type="password" id="m-telnyx-key" aria-label="Telnyx API Key" value="telnyx_api_key_mock" required />
            </div>
            <div class="form-group">
              <label for="m-telnyx-phone">Telnyx Phone Number * <span class="help-btn-guide" data-target="help-m-telnyx-phone" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-telnyx-phone" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Navigate to Voice API Applications under Telnyx Portal &rarr; Create App.<br>
                2. Set Webhook URL to <code>https://&lt;your-domain&gt;/api/voice-webhook</code>.<br>
                3. Copy your purchased/assigned Telnyx phone number.
              </div>
              <input type="text" id="m-telnyx-phone" aria-label="Telnyx Phone Number" value="+18005550199" required />
            </div>
            <div class="form-group">
              <label for="m-twilio-sid">Twilio Account SID * <span class="help-btn-guide" data-target="help-m-twilio-sid" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-twilio-sid" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Open <a href="https://www.twilio.com/console" target="_blank" style="color:#2b6cb0; text-decoration:underline;">Twilio Console</a>.<br>
                2. Copy the Account SID listed on the main dashboard.
              </div>
              <input type="text" id="m-twilio-sid" aria-label="Twilio Account SID" value="AC_twilio_sid_mock" required />
            </div>
            <div class="form-group">
              <label for="m-twilio-token">Twilio Auth Token * <span class="help-btn-guide" data-target="help-m-twilio-token" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-twilio-token" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Open Twilio Console.<br>
                2. Copy the Auth Token listed alongside the Account SID.
              </div>
              <input type="password" id="m-twilio-token" aria-label="Twilio Auth Token" value="twilio_token_mock" required />
            </div>
            <div class="form-group">
              <label for="m-twilio-phone">Twilio Phone Number * <span class="help-btn-guide" data-target="help-m-twilio-phone" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-twilio-phone" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Purchase or choose an active phone number in Twilio Phone Numbers panel.<br>
                2. Set the Messaging Webhook URL to <code>https://&lt;your-domain&gt;/api/sms-webhook</code> (HTTP POST).
              </div>
              <input type="text" id="m-twilio-phone" aria-label="Twilio Phone Number" value="+18005550100" required />
            </div>
          </div>

          <!-- Step 6: Cyber & Vault -->
          <div class="step-pane" data-step="6">
            <div class="instruction-callout">
              "Powers automated background malware signature scanning on uploads, OWASP ZAP penetration testing, and secure credential vault synchronization."
            </div>
            <div class="form-group">
              <label for="m-vt-key">VirusTotal API Key * <span class="help-btn-guide" data-target="help-m-vt-key" style="color:var(--theme-color-primary, #2b6cb0); font-size:0.75rem; font-weight:bold; cursor:pointer; margin-left:0.5rem; text-decoration:underline;">[❓ How to get this]</span></label>
              <div id="help-m-vt-key" class="help-guide-panel" style="display:none; background:#f7fafc; border:1px solid #cbd5e0; padding:10px; border-radius:6px; font-size:0.8rem; color:#4a5568; margin-top:5px; margin-bottom:5px; line-height:1.4;">
                1. Navigate to <a href="https://www.virustotal.com/gui/my-apikey" target="_blank" style="color:#2b6cb0; text-decoration:underline;">VirusTotal API Access</a>.<br>
                2. Copy your 64-character free or premium API key for automated scanning.
              </div>
              <input type="password" id="m-vt-key" aria-label="VirusTotal API Key" value="vt_api_mock_token" required />
            </div>
            <div class="form-group">
              <label for="m-zap-endpoint">OWASP ZAP Endpoint *</label>
              <input type="url" id="m-zap-endpoint" aria-label="OWASP ZAP Endpoint" value="https://wwtesw.zaproxy.org/" required />
            </div>
            <div class="form-group">
              <label for="m-lastpass-cid">LastPass CID *</label>
              <input type="text" id="m-lastpass-cid" aria-label="LastPass CID" value="lp_cid_mock" required />
            </div>
            <div class="form-group">
              <label for="m-lastpass-hash">LastPass Master Hash *</label>
              <input type="password" id="m-lastpass-hash" aria-label="LastPass Master Hash" value="lp_hash_mock" required />
            </div>
          </div>

          <!-- Step 7: Analytics & Local SEO -->
          <div class="step-pane" data-step="7">
            <div class="instruction-callout">
              "Injects Google Analytics 4 tracking tags, populates executive Looker Studio dashboards, renders live Google Maps reviews, and activates AdSense units for non-paying visitors."
            </div>
            <div class="form-group">
              <label for="m-ga4-id">GA4 Measurement ID *</label>
              <input type="text" id="m-ga4-id" aria-label="GA4 Measurement ID" value="G-987654321" required />
            </div>
            <div class="form-group">
              <label for="m-looker-url">Looker Studio Embed URL *</label>
              <input type="url" id="m-looker-url" aria-label="Looker Studio Embed URL" value="https://lookerstudio.google.com/embed/reporting/123" required />
            </div>
            <div class="form-group">
              <label for="m-google-place">Google Place ID *</label>
              <input type="text" id="m-google-place" aria-label="Google Place ID" value="place_id_mock" required />
            </div>
            <div class="form-group">
              <label for="m-adsense-pub">Google AdSense Publisher ID *</label>
              <input type="text" id="m-adsense-pub" aria-label="Google AdSense Publisher ID" value="ca-pub-123456789" required />
            </div>
          </div>

        </form>

        <div class="wizard-footer" style="display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid #edf2f7; padding-top: 1.5rem; box-sizing: border-box;">
          <div>
            ${this.isModal ? `
              <button class="btn-nav btn-cancel-modal" style="background: transparent; border: 1px solid #cbd5e0; border-radius: 6px; padding: 10px 20px; font-weight: 600; cursor: pointer; font-size: 0.95rem; color: #4a5568;">
                Cancel
              </button>
            ` : ''}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-nav btn-back" style="background: #edf2f7; border: none; border-radius: 6px; padding: 10px 20px; font-weight: 600; cursor: pointer; font-size: 0.95rem; color: #4a5568; display: none;">
              Back
            </button>
            <button class="btn-nav btn-next" style="background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: 6px; padding: 10px 24px; font-weight: bold; cursor: pointer; font-size: 0.95rem; box-shadow: 0 4px 6px rgba(43, 108, 176, 0.2);">
              Next Step
            </button>
          </div>
        </div>
      </div>
    `;

    // Inject styles scoped inside the element
    const styleHtml = `
      <style>
        master-setup-wizard {
          display: flex !important;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100%;
          background: #f7fafc;
          padding: 2rem;
          box-sizing: border-box;
        }
        .wizard-progress {
          height: 8px;
          background: #edf2f7;
          border-radius: 4px;
          margin: 1.25rem 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--theme-color-primary, #2b6cb0);
          width: 14.28%;
          transition: width 0.3s ease;
        }
        .wizard-step-info {
          font-size: 0.85rem;
          font-weight: bold;
          color: #718096;
          text-align: right;
        }
        .instruction-callout {
          background: #ebf8ff;
          border-left: 4px solid #3182ce;
          color: #2b6cb0;
          padding: 1rem;
          border-radius: 6px;
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
          line-height: 1.5;
          font-style: italic;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        .form-group label {
          display: block;
          font-weight: bold;
          font-size: 0.85rem;
          margin-bottom: 0.35rem;
          color: #2d3748;
        }
        .form-group input, .form-group select, .form-group textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          box-sizing: border-box;
          font-size: 0.9rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
          outline: none;
          border-color: var(--theme-color-primary, #2b6cb0);
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }
        .btn-finish {
          background: #38a169 !important;
          box-shadow: 0 4px 6px rgba(56, 161, 105, 0.2) !important;
        }
      </style>
    `;

    if (this.isModal) {
      this.innerHTML = `
        <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); z-index: 100005; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;">
          ${cardHtml}
        </div>
        ${styleHtml}
      `;
    } else {
      this.innerHTML = `
        ${cardHtml}
        ${styleHtml}
      `;
    }
  }
}

if (!customElements.get('master-setup-wizard')) {
  customElements.define('master-setup-wizard', MasterSetupWizard);
}
