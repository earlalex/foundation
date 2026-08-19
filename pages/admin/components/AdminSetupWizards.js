/**
 * pages/admin/components/AdminSetupWizards.js
 * Implements interactive, step-by-step setup modals for the Single Unified Master Onboarding Wizard.
 * Centered around a Conversational AI-First Prompt Flow (Mode A) with a Traditional Blueprint Form (Mode B) fallback.
 * Employs a house foundation structural analogy with a Live Blueprint Preview Sidebar.
 */
import { configManager } from '../../../core/config.js';
import { toast } from '../../../utils/toast.js';
import { store } from '../../../core/store.js';
import { contentDB } from '../../../core/db.js';
import { themeEngine } from '../../../core/theme.js';
import { uploadFileToDrive } from '../../../core/drive-upload.js';
import { generateHeroBackground, generateProductMockup } from '../../../utils/ai-imagen.js';

/**
 * Synthesize Design System from Purpose, Mission, Values, and KPIs
 */
export async function synthesizeBrandFromWorksheet(worksheetData) {
  const purpose = worksheetData.purpose || "";
  const mission = worksheetData.mission || "";
  const values = worksheetData.values || worksheetData.coreValues || [];
  const kpis = worksheetData.kpis || worksheetData.kpiCategories || [];

  const systemPrompt = `You are a Principal Brand Strategist and Master Design Psychologist.
Analyze this organizational foundation worksheet:

- PURPOSE: ${purpose}
- MISSION: ${mission}
- 9 CORE VALUES: ${JSON.stringify(values)}
- 12 KPIS: ${JSON.stringify(kpis)}

Synthesize a complete design system adhering to color psychology, WCAG 2.1 AA contrast standards, and typographic semantics.

Return ONLY a valid JSON object matching this schema:
{
  "archetype": "string (e.g. Sovereign Ruler, Heroic Catalyst, Wise Sage, Creative Innovator)",
  "voiceAndTone": "string (e.g. Authoritative, Direct, Sovereign, Grounded)",
  "colors": {
    "primary": "string (Hex code matching psychological intent)",
    "primaryHover": "string (Hex code)",
    "accent": "string (Hex code for high-contrast CTAs)",
    "surface": "string (Hex code for background)",
    "surfaceAlt": "string (Hex code for cards)",
    "textPrimary": "string (Hex code for text)",
    "textSecondary": "string (Hex code)"
  },
  "typography": {
    "headingFont": "string (Google Font name, e.g. Cinzel, Playfair Display, Plus Jakarta Sans)",
    "bodyFont": "string (Google Font name, e.g. Inter, Plus Jakarta Sans)",
    "headingStyle": "string"
  },
  "designRationale": {
    "colorPsychology": "string (Detailed explanation of why these colors match the Purpose, Mission, and Values)",
    "typographyRationale": "string (Detailed explanation of font semantics)",
    "archetypeRationale": "string (Detailed explanation of brand persona)"
  }
}`;

  try {
    const response = await fetch('/api/ai-writer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: systemPrompt, responseFormat: 'json' })
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[synthesizeBrandFromWorksheet]: API call failed, using fallback:', err.message);
  }

  // Fallback response matching schema
  return {
    archetype: "Sovereign Ruler & Heroic Catalyst",
    voiceAndTone: "Authoritative, Direct, Sovereign, Grounded",
    colors: {
      primary: "#1E3A8A",
      primaryHover: "#1D4ED8",
      accent: "#D97706",
      surface: "#FFFFFF",
      surfaceAlt: "#F8FAFC",
      textPrimary: "#0F172A",
      textSecondary: "#475569"
    },
    typography: {
      headingFont: "Cinzel",
      bodyFont: "Plus Jakarta Sans",
      headingStyle: "Uppercase, High-Tracking, Serif Authority"
    },
    designRationale: {
      colorPsychology: "Deep Navy (#1E3A8A) was selected for Primary to convey Sovereignty, Integrity, and Enterprise Stability. Solar Gold (#D97706) provides high-contrast CTAs representing Radiant Optimism and Legacy.",
      typographyRationale: "Cinzel was selected for headings to convey Executive Sovereignty and Structural Authority. Plus Jakarta Sans provides geometric body clarity.",
      archetypeRationale: "Your brand persona combines the Sovereign Ruler with the Heroic Catalyst, balancing executive authority with transformative action."
    }
  };
}

export async function generateSemanticBrandGuide({ purpose, mission, values, kpis }) {
  return await synthesizeBrandFromWorksheet({ purpose, mission, values, kpis });
}

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
    if (wizardType === 'worksheet' || wizardType === 'foundation-worksheet') {
      return AdminSetupWizards.launchFoundationWorksheetWizard(onComplete);
    }
    if (wizardType === 'brand' || wizardType === 'brand-stylist') {
      return AdminSetupWizards.launchBrandStylistWizard(onComplete);
    }
    const wizard = document.createElement('master-setup-wizard');
    wizard.setAttribute('mode', 'modal');
    if (onComplete) {
      wizard.onCompleteCallback = onComplete;
    }
    document.body.appendChild(wizard);
  }

  /**
   * Launch Pre-Onboarding Foundation Worksheet & Brand Synthesis Wizard
   */
  static launchFoundationWorksheetWizard(onComplete = null) {
    const wizard = document.createElement('foundation-worksheet-wizard');
    if (onComplete) {
      wizard.onCompleteCallback = onComplete;
    }
    document.body.appendChild(wizard);
  }

  /**
   * Launch Brand Stylist Wizard
   */
  static launchBrandStylistWizard(onComplete = null) {
    const wizard = document.createElement('brand-stylist-wizard');
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
            <input type="text" id="wz-home-sections" aria-label="Featured Section Order" value="${prefilledSections}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label for="wz-home-cta" style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Primary CTA Buttons (comma separated):</label>
            <input type="text" id="wz-home-cta" aria-label="Primary CTA Buttons" value="${prefilledCta}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
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
            <input type="text" id="wz-about-timeline" aria-label="Milestones Timeline" value="${prefilledTimeline}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
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
    this.currentMode = 'A'; // Mode A: Conversational AI, Mode B: Traditional multi-step
    this.traditionalStep = 1;
    this.totalTraditionalSteps = 7;

    // Core state structure synchronizing both Mode A and Mode B configurations on-the-fly
    this.config = {
      siteTitle: "Foundation Framework",
      siteDomain: window.location.origin,
      adminEmail: "admin@earlalex.com",
      supportEmail: "support@earlalex.com",
      firebaseApiKey: "AIzaSy_fb_mock_key_992",
      firebaseProjectId: "demo-proj-id",
      googleClientId: "g_client_id_01",
      googleClientSecret: "g_secret_99",
      googleServiceAccountToken: '{"type": "service_account"}',
      geminiApiKey: "gemini_api_key_101",
      openaiApiKey: "openai_api_key_mock",
      preferredModel: "gemini",
      voiceModel: "alloy",
      stripeSecretKey: "sk_test_123",
      stripePublishableKey: "pk_test_456",
      stripeWebhookSecret: "whsec_mock",
      stripeMembershipPriceId: "price_abc",
      wiseApiKey: "wise_api_key_mock",
      wiseProfileId: "wise_profile_id_mock",
      telnyxApiKey: "telnyx_api_key_mock",
      telnyxPhoneNumber: "+18005550199",
      twilioAccountSid: "AC_twilio_sid_mock",
      twilioAuthToken: "twilio_token_mock",
      twilioPhoneNumber: "+18005550100",
      vtApiKey: "vt_api_mock_token",
      zapEndpoint: "https://wwtesw.zaproxy.org/",
      lastpassCid: "lp_cid_mock",
      lastpassHash: "lp_hash_mock",
      ga4Id: "G-987654321",
      lookerUrl: "https://lookerstudio.google.com/embed/reporting/123",
      googlePlaceId: "place_id_mock",
      adsensePub: "ca-pub-123456789",
      features: {
        chatWidget: true,
        webRadioPlayer: true,
        videoPortal: true,
        photoGallery: true,
        aiSparkAgent: true,
        dummyDataGenerator: true,
        adSenseUnits: false,
        web3CryptoCheckout: true
      },
      heroBannerUrl: ""
    };

    // Chat mode active turns:
    // Turn 1: Laying the Concrete / Identity
    // Turn 2: Installing Utility Lines / API Connections
    // Turn 3: Pouring Framework / Feature Toggles
    this.chatTurn = 1;
    this.chatHistory = [];
  }

  connectedCallback() {
    this.isModal = this.getAttribute('mode') === 'modal';

    // Fetch and populate configuration if pre-existing
    const currentGlobal = configManager.current || {};
    this.config = {
      ...this.config,
      ...(currentGlobal || {}),
      siteTitle: currentGlobal?.siteTitle || this.config.siteTitle,
      siteDomain: currentGlobal?.siteDomain || this.config.siteDomain,
      adminEmail: (currentGlobal?.adminEmails && currentGlobal?.adminEmails[0]) || currentGlobal?.adminEmail || this.config.adminEmail,
      supportEmail: currentGlobal?.businessProfile?.supportEmail || currentGlobal?.supportEmail || this.config.supportEmail,
      firebaseApiKey: currentGlobal?.firebase?.apiKey || this.config.firebaseApiKey,
      firebaseProjectId: currentGlobal?.firebase?.projectId || this.config.firebaseProjectId,
      googleClientId: currentGlobal?.google?.clientId || this.config.googleClientId,
      googleClientSecret: currentGlobal?.google?.clientSecret || this.config.googleClientSecret,
      googleServiceAccountToken: currentGlobal?.google?.serviceAccountToken || this.config.googleServiceAccountToken,
      geminiApiKey: currentGlobal?.aiConfig?.geminiApiKey || this.config.geminiApiKey,
      openaiApiKey: currentGlobal?.aiConfig?.openaiApiKey || this.config.openaiApiKey,
      preferredModel: currentGlobal?.aiConfig?.preferredModel || this.config.preferredModel,
      voiceModel: currentGlobal?.chatbot?.voiceModel || this.config.voiceModel,
      stripeSecretKey: currentGlobal?.stripe?.secretKey || this.config.stripeSecretKey,
      stripePublishableKey: currentGlobal?.stripe?.publishableKey || this.config.stripePublishableKey,
      stripeWebhookSecret: currentGlobal?.stripe?.webhookSecret || this.config.stripeWebhookSecret,
      stripeMembershipPriceId: currentGlobal?.stripe?.priceId || this.config.stripeMembershipPriceId,
      wiseApiKey: currentGlobal?.wise?.apiKey || this.config.wiseApiKey,
      wiseProfileId: currentGlobal?.wise?.profileId || this.config.wiseProfileId,
      telnyxApiKey: currentGlobal?.chatbot?.telnyxApiKey || this.config.telnyxApiKey,
      telnyxPhoneNumber: currentGlobal?.chatbot?.telnyxPhoneNumber || this.config.telnyxPhoneNumber,
      twilioAccountSid: currentGlobal?.chatbot?.twilioAccountSid || this.config.twilioAccountSid,
      twilioAuthToken: currentGlobal?.chatbot?.twilioAuthToken || this.config.twilioAuthToken,
      twilioPhoneNumber: currentGlobal?.chatbot?.twilioPhoneNumber || this.config.twilioPhoneNumber,
      vtApiKey: currentGlobal?.virustotal?.apiKey || this.config.vtApiKey,
      zapEndpoint: currentGlobal?.security?.zapApiUrl || this.config.zapEndpoint,
      lastpassCid: currentGlobal?.lastpass?.companyId || this.config.lastpassCid,
      lastpassHash: currentGlobal?.lastpass?.provisioningHash || this.config.lastpassHash,
      ga4Id: currentGlobal?.analytics?.googleAnalyticsId || this.config.ga4Id,
      lookerUrl: currentGlobal?.thirdParty?.lookerStudioEmbedUrl || this.config.lookerUrl,
      googlePlaceId: currentGlobal?.thirdParty?.googlePlaceId || this.config.googlePlaceId,
      adsensePub: currentGlobal?.thirdParty?.adsensePublisherId || this.config.adsensePub,
      features: {
        ...(this.config.features || {}),
        ...(currentGlobal?.features || {})
      }
    };

    // Initialize Chat History
    this.addContractorMessage("✨ Conversational AI Architect", "Before you build the rooms and roof of your digital enterprise, we must lay a solid, reinforced foundation. Let's start by laying the concrete! What is the name of your enterprise or brand, and what primary domain or niche are we building on?");

    this.render();
    this.updateActiveModeDisplay();
    this.setupCommonListeners();
  }

  logWizardNotification(message, category = 'System Alerts') {
    try {
      const history = JSON.parse(localStorage.getItem('foundation_notification_history') || '[]');
      const newNotif = {
        id: 'notif_wizard_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        message,
        type: 'info',
        category,
        timestamp: new Date().toISOString(),
        isRead: false
      };
      history.unshift(newNotif);
      localStorage.setItem('foundation_notification_history', JSON.stringify(history.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('notification-received', { detail: newNotif }));
      console.log('[Wizard Notification Handled Silently]:', message);
    } catch (err) {
      console.warn('Failed to route wizard notification:', err);
    }
  }

  addContractorMessage(sender, text) {
    this.chatHistory.push({ sender, text, isAI: true });
    this.logWizardNotification(`AI Contractor: ${text.substring(0, 80)}...`);
  }

  addUserMessage(text) {
    this.chatHistory.push({ sender: "You", text, isAI: false });
  }

  render() {
    this.innerHTML = `
      <div class="setup-wizard-modal-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 100005; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;">

        <div class="wizard-card" style="background: white; border-radius: 12px; width: 100%; max-width: 900px; height: 600px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; overflow: hidden; position: relative;">

          <!-- Header and Mode Toggle -->
          <div style="background: var(--theme-color-surface-alt, #f8fafc); border-bottom: 1px solid var(--theme-color-border, #e2e8f0); padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.5rem;">🏗️</span>
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin: 0;">Foundation Architect Onboarding</h2>
            </div>

            <!-- Dual-Mode Toggle Buttons -->
            <div style="background: #edf2f7; padding: 3px; border-radius: 8px; display: flex; gap: 4px;">
              <button id="toggle-mode-a" class="toggle-mode-btn" style="border: none; background: white; padding: 6px 14px; font-size: 0.8rem; font-weight: bold; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                ✨ Conversational AI Architect
              </button>
              <button id="toggle-mode-b" class="toggle-mode-btn" style="border: none; background: transparent; padding: 6px 14px; font-size: 0.8rem; font-weight: bold; border-radius: 6px; color: #718096; cursor: pointer; transition: all 0.2s;">
                📋 Traditional Blueprint Form
              </button>
            </div>
          </div>

          <!-- Wizard Body: Main Workspace & Blueprint Sidebar -->
          <div style="display: flex; flex: 1; overflow: hidden;">

            <!-- Left Workspace Pane -->
            <div id="wizard-workspace" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid var(--theme-color-border, #e2e8f0);">

              <!-- Mode A Layout (Conversational Prompt Flow) -->
              <div id="mode-a-pane" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
                <div class="chat-history-container" id="chat-history" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: #fdfdfd;">
                  <!-- Rendered dynamically -->
                </div>

                <!-- Chat Input area with helper triggers -->
                <div style="padding: 1rem; border-top: 1px solid var(--theme-color-border, #e2e8f0); background: #f8fafc; display: flex; flex-direction: column; gap: 0.5rem;">
                  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="help-btn-guide" data-target="help-m-free-email" style="background: #ebf8ff; border: 1px solid #bee3f8; color: #2b6cb0; border-radius: 12px; padding: 3px 10px; font-size: 0.72rem; font-weight: bold; cursor: pointer;">
                      [❓ How to set up Free Emails]
                    </button>
                    <button id="ai-gen-hero-trigger" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 12px; padding: 3px 10px; font-size: 0.72rem; font-weight: bold; cursor: pointer;">
                      ✨ Generate AI Brand Hero with Imagen
                    </button>
                  </div>

                  <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="chat-input-field" placeholder="Reply to Digital Contractor..." style="flex: 1; padding: 10px 14px; border: 1px solid #cbd5e0; border-radius: 8px; font-size: 0.9rem;" />
                    <button id="chat-send-btn" class="btn-primary" style="padding: 10px 20px; border-radius: 8px;">Send</button>
                  </div>
                </div>
              </div>

              <!-- Mode B Layout (Traditional Form Flow) -->
              <div id="mode-b-pane" style="display: none; flex-direction: column; height: 100%; overflow: hidden; background: white;">

                <div class="wizard-step-body" id="traditional-form-pane" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                  <!-- Dynamically populated fields -->
                </div>

                <!-- Traditional Step Navigation Controls -->
                <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--theme-color-border, #e2e8f0); background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.8rem; font-weight: bold; color: #718096;" id="traditional-step-indicator">
                    Step 1 of 7
                  </span>
                  <div style="display: flex; gap: 0.5rem;">
                    <button id="trad-back-btn" class="btn-secondary" style="padding: 6px 14px; font-size: 0.85rem;">Back</button>
                    <button id="trad-next-btn" class="btn-primary" style="padding: 6px 18px; font-size: 0.85rem;">Next Step</button>
                  </div>
                </div>

              </div>

            </div>

            <!-- Right Site Blueprint Preview Sidebar -->
            <div id="wizard-sidebar" style="width: 300px; display: flex; flex-direction: column; background: #0f172a; color: #e2e8f0; padding: 1.5rem; overflow-y: auto; box-sizing: border-box;">
              <h3 style="color: #60a5fa; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-top: 0; margin-bottom: 1rem; border-bottom: 1px solid #1e293b; padding-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>📋</span> Site Blueprint Preview
              </h3>

              <!-- House Analogy Blueprint Graphic (SVG representation) -->
              <div style="display: flex; justify-content: center; margin-bottom: 1.5rem; background: #1e293b; border-radius: 8px; padding: 1rem;">
                <svg id="house-blueprint-svg" viewBox="0 0 160 140" width="100%" height="130" style="display: block;">
                  <!-- Foundation Concrete Slab -->
                  <rect id="blueprint-slab" x="20" y="100" width="120" height="20" rx="3" fill="#334155" stroke="#475569" stroke-width="2" style="transition: all 0.3s;" />
                  <text x="80" y="113" fill="#cbd5e1" font-size="7" font-weight="bold" text-anchor="middle">CONCRETE SLAB</text>

                  <!-- Utility Lines -->
                  <!-- Yellow: Database/Auth -->
                  <path id="blueprint-line-db" d="M 40 100 L 40 60" stroke="#334155" stroke-width="2" stroke-dasharray="2,2" style="transition: all 0.3s;" />
                  <!-- Blue: Stripe -->
                  <path id="blueprint-line-stripe" d="M 80 100 L 80 60" stroke="#334155" stroke-width="2" stroke-dasharray="2,2" style="transition: all 0.3s;" />
                  <!-- Green: Comms/Twilio -->
                  <path id="blueprint-line-twilio" d="M 120 100 L 120 60" stroke="#334155" stroke-width="2" stroke-dasharray="2,2" style="transition: all 0.3s;" />

                  <!-- Framework Roof / Walls -->
                  <polygon id="blueprint-roof" points="15,45 80,10 145,45" fill="none" stroke="#334155" stroke-width="2" style="transition: all 0.3s;" />
                  <line id="blueprint-wall-l" x1="25" y1="45" x2="25" y2="100" stroke="#334155" stroke-width="2" style="transition: all 0.3s;" />
                  <line id="blueprint-wall-r" x1="135" y1="45" x2="135" y2="100" stroke="#334155" stroke-width="2" style="transition: all 0.3s;" />
                </svg>
              </div>

              <!-- Parameter extraction checks -->
              <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.8rem;">
                <div style="display: flex; align-items: flex-start; gap: 0.5rem;" id="bp-check-slab">
                  <span class="bp-icon" style="color: #64748b;">⚪</span>
                  <div>
                    <strong style="display: block; color: #f1f5f9;">Concrete Base / Identity</strong>
                    <span class="bp-detail" style="color: #94a3b8; font-size: 0.72rem;">Brand Title, Canonical Domain</span>
                  </div>
                </div>

                <div style="display: flex; align-items: flex-start; gap: 0.5rem;" id="bp-check-utilities">
                  <span class="bp-icon" style="color: #64748b;">⚪</span>
                  <div>
                    <strong style="display: block; color: #f1f5f9;">Utility API Connections</strong>
                    <span class="bp-detail" style="color: #94a3b8; font-size: 0.72rem;">Firebase & Stripe integrations</span>
                  </div>
                </div>

                <div style="display: flex; align-items: flex-start; gap: 0.5rem;" id="bp-check-framework">
                  <span class="bp-icon" style="color: #64748b;">⚪</span>
                  <div>
                    <strong style="display: block; color: #f1f5f9;">Operational Framework</strong>
                    <span class="bp-detail" style="color: #94a3b8; font-size: 0.72rem;">Enabled Modules (Radio, Videos, etc.)</span>
                  </div>
                </div>
              </div>

              <!-- Extracted variables summaries -->
              <div style="margin-top: 1.5rem; border-top: 1px solid #1e293b; padding-top: 1rem; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="color: #94a3b8; font-weight: bold;">EXTRACTED BLUEPRINT STATE:</div>
                <div>🏷️ Title: <span id="val-bp-title" style="color: #38bdf8; font-weight: bold;">Pending...</span></div>
                <div>🌐 Domain: <span id="val-bp-domain" style="color: #38bdf8;">Pending...</span></div>
                <div>🔑 Firebase: <span id="val-bp-firebase" style="color: #94a3b8;">Pending...</span></div>
                <div>💳 Stripe: <span id="val-bp-stripe" style="color: #94a3b8;">Pending...</span></div>
                <div>📞 Telephony: <span id="val-bp-phone" style="color: #94a3b8;">Pending...</span></div>
              </div>

            </div>

          </div>

          <!-- Helper step guides modal/panel panels -->
          <div id="help-m-free-email" class="help-guide-panel" style="display: none; position: absolute; bottom: 80px; left: 20px; right: 20px; background: white; border: 2px solid #bbf7d0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-radius: 8px; padding: 1.25rem; z-index: 100010; color: #1a202c; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
              <strong style="color: #166534; font-size: 0.9rem;">Free Email DNS Configuration Guide:</strong>
              <button class="help-close-btn" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #a0aec0;">&times;</button>
            </div>
            <p style="font-size: 0.78rem; color: #2d3748; line-height: 1.4; margin-bottom: 0;">
              To dispatch free outbound transactional emails with high deliverability via MailChannels and receive free inbound forwarding via Cloudflare Email Routing, configure these DNS records on your domain registrar:
            </p>
            <ul style="margin: 5px 0; padding-left: 15px; font-size: 0.75rem; color: #4a5568;">
              <li><strong>SPF Record (TXT):</strong> Value: <code>v=spf1 include:relay.mailchannels.net ~all</code></li>
              <li><strong>MailChannels Domain Lockdown (TXT):</strong> Name: <code>_mailchannels</code>, Value: <code>v=mc1 cfid=your-pages-subdomain.pages.dev</code></li>
              <li><strong>DMARC Record (TXT):</strong> Name: <code>_dmarc</code>, Value: <code>v=DMARC1; p=none; rua=mailto:admin@yourdomain.com</code></li>
            </ul>
          </div>

          <!-- Footer Action Bar -->
          <div style="background: var(--theme-color-surface-alt, #f8fafc); border-top: 1px solid var(--theme-color-border, #e2e8f0); padding: 0.75rem 1.5rem; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box;">
            <button id="cancel-wizard-btn" class="btn-secondary" style="padding: 8px 16px; font-size: 0.85rem; border: 1px solid #cbd5e0;">
              Cancel Installation
            </button>
            <button id="master-finish-btn" class="btn-primary" style="padding: 10px 24px; font-size: 0.9rem; font-weight: bold; background: #38a169; border-color: #2f855a; display: none;">
              ✨ Finish Installation & Lock State
            </button>
          </div>

        </div>
      </div>
    `;

    this.renderChatHistory();
    this.updateBlueprintDisplay();
  }

  updateActiveModeDisplay() {
    const modeA = this.querySelector('#mode-a-pane');
    const modeB = this.querySelector('#mode-b-pane');
    const btnA = this.querySelector('#toggle-mode-a');
    const btnB = this.querySelector('#toggle-mode-b');

    if (this.currentMode === 'A') {
      modeA.style.display = 'flex';
      modeB.style.display = 'none';
      btnA.style.background = 'white';
      btnA.style.color = 'var(--theme-color-text-primary)';
      btnB.style.background = 'transparent';
      btnB.style.color = '#718096';
    } else {
      modeA.style.display = 'none';
      modeB.style.display = 'flex';
      btnB.style.background = 'white';
      btnB.style.color = 'var(--theme-color-text-primary)';
      btnA.style.background = 'transparent';
      btnA.style.color = '#718096';
      this.renderTraditionalStep();
    }
  }

  renderChatHistory() {
    const chatHistEl = this.querySelector('#chat-history');
    if (!chatHistEl) return;

    chatHistEl.innerHTML = this.chatHistory.map(msg => `
      <div style="display: flex; flex-direction: column; align-items: ${msg.isAI ? 'flex-start' : 'flex-end'}; max-width: 85%; align-self: ${msg.isAI ? 'flex-start' : 'flex-end'};">
        <span style="font-size: 0.72rem; color: #718096; font-weight: bold; margin-bottom: 2px;">${msg.sender}</span>
        <div style="padding: 10px 14px; border-radius: 12px; font-size: 0.85rem; line-height: 1.4; background: ${msg.isAI ? '#ebf8ff' : 'var(--theme-color-primary, #2b6cb0)'}; color: ${msg.isAI ? '#2b6cb0' : 'white'}; border-top-${msg.isAI ? 'left' : 'right'}-radius: 2px; text-align: left;">
          ${msg.text}
        </div>
      </div>
    `).join('');

    // If chatTurn is 3, append operational chips directly within the chat body for interactive toggling
    if (this.chatTurn === 3 && this.currentMode === 'A') {
      const chipsEl = document.createElement('div');
      chipsEl.style.cssText = "display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; align-self: flex-start; max-width: 100%;";

      const modules = [
        { key: 'chatWidget', label: '💬 AI Chat Widget' },
        { key: 'webRadioPlayer', label: '📻 Web Radio Player' },
        { key: 'videoPortal', label: '📹 Video Portal' },
        { key: 'aiSparkAgent', label: '✨ AI Spark COO' }
      ];

      chipsEl.innerHTML = modules.map(m => {
        const active = this.config.features[m.key];
        return `
          <button class="toggle-chip-btn" data-key="${m.key}" style="border: 1px solid ${active ? '#38a169' : '#cbd5e0'}; background: ${active ? '#f0fdf4' : 'white'}; color: ${active ? '#166534' : '#4a5568'}; padding: 6px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            ${m.label} ${active ? '✓' : '✗'}
          </button>
        `;
      }).join('');

      chipsEl.querySelectorAll('.toggle-chip-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const key = btn.dataset.key;
          this.config.features[key] = !this.config.features[key];
          this.logWizardNotification(`Toggled Module framework wall: ${key} = ${this.config.features[key]}`);
          this.renderChatHistory();
          this.updateBlueprintDisplay();
        };
      });

      chatHistEl.appendChild(chipsEl);
    }

    // Scroll to bottom
    chatHistEl.scrollTop = chatHistEl.scrollHeight;
  }

  updateBlueprintDisplay() {
    const slab = this.querySelector('#blueprint-slab');
    const lineDb = this.querySelector('#blueprint-line-db');
    const lineStripe = this.querySelector('#blueprint-line-stripe');
    const lineTwilio = this.querySelector('#blueprint-line-twilio');
    const roof = this.querySelector('#blueprint-roof');
    const wallL = this.querySelector('#blueprint-wall-l');
    const wallR = this.querySelector('#blueprint-wall-r');

    // Values Elements
    const valTitle = this.querySelector('#val-bp-title');
    const valDomain = this.querySelector('#val-bp-domain');
    const valFirebase = this.querySelector('#val-bp-firebase');
    const valStripe = this.querySelector('#val-bp-stripe');
    const valPhone = this.querySelector('#val-bp-phone');

    // Check items elements
    const iconSlab = this.querySelector('#bp-check-slab .bp-icon');
    const iconUtil = this.querySelector('#bp-check-utilities .bp-icon');
    const iconFrame = this.querySelector('#bp-check-framework .bp-icon');

    // Turn 1 Checks (Concrete Slab)
    const isSlabSet = this.config.siteTitle && this.config.siteDomain;
    if (isSlabSet) {
      if (slab) slab.setAttribute('fill', '#475569');
      if (iconSlab) {
        iconSlab.textContent = '🟢';
        iconSlab.style.color = '#10b981';
      }
      if (valTitle) {
        valTitle.textContent = this.config.siteTitle;
        valTitle.style.color = '#38bdf8';
      }
      if (valDomain) {
        valDomain.textContent = this.config.siteDomain;
        valDomain.style.color = '#38bdf8';
      }
    } else {
      if (slab) slab.setAttribute('fill', '#334155');
      if (iconSlab) iconSlab.textContent = '⚪';
    }

    // Turn 2 Checks (Utilities Connecting)
    const isFirebaseSet = this.config.firebaseApiKey && this.config.firebaseProjectId;
    const isStripeSet = this.config.stripeSecretKey && this.config.stripePublishableKey;
    const isTelephonySet = this.config.telnyxApiKey || this.config.twilioAccountSid;

    if (isFirebaseSet) {
      if (lineDb) lineDb.setAttribute('stroke', '#eab308'); // Neon Yellow
      if (valFirebase) {
        valFirebase.textContent = this.config.firebaseProjectId;
        valFirebase.style.color = '#f59e0b';
      }
    } else {
      if (lineDb) lineDb.setAttribute('stroke', '#334155');
    }

    if (isStripeSet) {
      if (lineStripe) lineStripe.setAttribute('stroke', '#3b82f6'); // Neon Blue
      if (valStripe) {
        valStripe.textContent = "Connected";
        valStripe.style.color = '#3b82f6';
      }
    } else {
      if (lineStripe) lineStripe.setAttribute('stroke', '#334155');
    }

    if (isTelephonySet) {
      if (lineTwilio) lineTwilio.setAttribute('stroke', '#22c55e'); // Neon Green
      if (valPhone) {
        valPhone.textContent = this.config.telnyxPhoneNumber || this.config.twilioPhoneNumber;
        valPhone.style.color = '#22c55e';
      }
    } else {
      if (lineTwilio) lineTwilio.setAttribute('stroke', '#334155');
    }

    const isUtilitiesConfigured = isFirebaseSet && isStripeSet;
    if (isUtilitiesConfigured) {
      if (iconUtil) {
        iconUtil.textContent = '🟢';
        iconUtil.style.color = '#10b981';
      }
    } else {
      if (iconUtil) iconUtil.textContent = '⚪';
    }

    // Turn 3 Checks (Framework Walls Raising Up)
    const activeFeatures = Object.values(this.config.features).filter(Boolean).length;
    if (activeFeatures >= 3) {
      if (roof) roof.setAttribute('stroke', '#f97316'); // Orange studs
      if (wallL) wallL.setAttribute('stroke', '#f97316');
      if (wallR) wallR.setAttribute('stroke', '#f97316');
      if (iconFrame) {
        iconFrame.textContent = '🟢';
        iconFrame.style.color = '#10b981';
      }
    } else {
      if (roof) roof.setAttribute('stroke', '#334155');
      if (wallL) wallL.setAttribute('stroke', '#334155');
      if (wallR) wallR.setAttribute('stroke', '#334155');
      if (iconFrame) iconFrame.textContent = '⚪';
    }

    // Show or hide final lock installation button
    const finishBtn = this.querySelector('#master-finish-btn');
    if (isSlabSet && isUtilitiesConfigured && finishBtn) {
      finishBtn.style.display = 'block';
    } else if (finishBtn) {
      finishBtn.style.display = 'none';
    }
  }

  processConversationalTurn(userText) {
    const rawLower = userText.toLowerCase().trim();
    if (!rawLower) return;

    this.addUserMessage(userText);

    if (this.chatTurn === 1) {
      // Heuristically extract site identity parameters
      let foundTitle = "";
      let foundDomain = "";

      // Look for title quotes e.g. "My Brand"
      const titleQuotesMatch = userText.match(/"([^"]+)"/);
      if (titleQuotesMatch && titleQuotesMatch[1]) {
        foundTitle = titleQuotesMatch[1].trim();
      } else {
        const titleIntroMatch = userText.match(/(?:brand|name|enterprise|site)\s+(?:is|called)?\s+([A-Za-z0-9\s]+)/i);
        if (titleIntroMatch && titleIntroMatch[1]) {
          foundTitle = titleIntroMatch[1].trim();
        } else {
          // Fallback to first few capitalised words
          const caps = userText.match(/[A-Z][a-z]+/g);
          if (caps && caps.length > 0) {
            foundTitle = caps.slice(0, 3).join(' ');
          }
        }
      }

      // Look for URL/domain
      const domainMatch = userText.match(/https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+/);
      if (domainMatch) {
        foundDomain = domainMatch[0].trim();
        if (!foundDomain.startsWith('http')) {
          foundDomain = 'https://' + foundDomain;
        }
      }

      if (foundTitle) this.config.siteTitle = foundTitle;
      if (foundDomain) this.config.siteDomain = foundDomain;

      // Autogenerate Local SEO Microdata & Tagline
      let seoCategory = "Enterprise Solutions";
      if (rawLower.includes('wellness') || rawLower.includes('health') || rawLower.includes('spa')) {
        seoCategory = "Wellness & Sovereign Health Studio";
        this.config.siteTagline = "Cultivating health excellence & modern holistic vitality.";
      } else if (rawLower.includes('shop') || rawLower.includes('commerce') || rawLower.includes('store')) {
        seoCategory = "Premium Retail & Logistics";
        this.config.siteTagline = "Sovereign custom products delivered with transactional integrity.";
      } else if (rawLower.includes('radio') || rawLower.includes('stream') || rawLower.includes('media') || rawLower.includes('audio')) {
        seoCategory = "Decentralized Audio & Broadcast Media Hub";
        this.config.siteTagline = "Continuous secure sovereign stream broadcasts and communication pods.";
      }

      this.config.businessProfile = {
        category: seoCategory,
        niche: seoCategory,
        isConfigured: true
      };

      this.chatTurn = 2;
      this.addContractorMessage(
        "✨ Conversational AI Architect",
        `Wonderful! Concrete is poured for <strong>"${this.config.siteTitle}"</strong> at domain <code>${this.config.siteDomain}</code>. We have autogenerated sovereign <strong>"${seoCategory}"</strong> local SEO schemas!<br><br>Let's install the utility lines. Paste your Stripe, Telnyx, Twilio, Firebase, or Google keys, or describe what cloud services you want enabled!`
      );

    } else if (this.chatTurn === 2) {
      // Extract credentials and API connections
      let firebaseApiKey = userText.match(/AIzaSy[A-Za-z0-9_-]+/)?.[0];
      let stripeSecret = userText.match(/sk_(?:test|live)_[A-Za-z0-9]+/)?.[0];
      let stripePublishable = userText.match(/pk_(?:test|live)_[A-Za-z0-9]+/)?.[0];
      let twilioSid = userText.match(/AC[a-f0-9]{32}/i)?.[0];
      let twilioToken = userText.match(/[a-f0-9]{32}/i)?.[0]; // 32 chars hex
      let preferredModel = rawLower.includes('openai') || rawLower.includes('gpt') ? 'openai' : 'gemini';

      if (firebaseApiKey) this.config.firebaseApiKey = firebaseApiKey;
      if (stripeSecret) this.config.stripeSecretKey = stripeSecret;
      if (stripePublishable) this.config.stripePublishableKey = stripePublishable;
      if (twilioSid) this.config.twilioAccountSid = twilioSid;
      if (twilioToken && twilioToken !== twilioSid) this.config.twilioAuthToken = twilioToken;
      this.config.preferredModel = preferredModel;

      const hasStripe = this.config.stripeSecretKey && this.config.stripePublishableKey;
      const hasFirebase = this.config.firebaseApiKey && this.config.firebaseProjectId;

      this.chatTurn = 3;
      this.addContractorMessage(
        "✨ Conversational AI Architect",
        `Perfect! Connected water lines (Stripe: ${hasStripe ? '✓ Live' : 'Fallback Active'}), power utilities (Firebase: ${hasFirebase ? '✓ Live' : 'Fallback Active'}), and voice/SMS communication links (Preferred model: <code>${preferredModel}</code>).<br><br>Now, let's raise the operational framework. Which modular features belong on your floorplan? Choose by clicking the chips below, or typing your choices!`
      );

    } else {
      // Toggle toggles based on text description
      if (rawLower.includes('radio') || rawLower.includes('music')) this.config.features.webRadioPlayer = true;
      if (rawLower.includes('video') || rawLower.includes('stream')) this.config.features.videoPortal = true;
      if (rawLower.includes('chat') || rawLower.includes('assistant')) this.config.features.chatWidget = true;
      if (rawLower.includes('spark') || rawLower.includes('coo')) this.config.features.aiSparkAgent = true;

      this.addContractorMessage(
        "✨ Conversational AI Architect",
        "Our structural blueprint parameters look beautifully locked in! Click the green button below to pour the final concrete layers and lock state!"
      );
    }

    this.renderChatHistory();
    this.updateBlueprintDisplay();
  }

  renderTraditionalStep() {
    const pane = this.querySelector('#traditional-form-pane');
    if (!pane) return;

    const stepIndicator = this.querySelector('#traditional-step-indicator');
    if (stepIndicator) {
      stepIndicator.textContent = `Step ${this.traditionalStep} of 7`;
    }

    let formContent = '';

    if (this.traditionalStep === 1) {
      formContent = `
        <div class="form-group-set" style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top:0; color:var(--theme-color-primary, #2b6cb0);">🏠 Step 1: Site Identity Base</h3>
          <p style="font-size:0.8rem; color:#718096; margin-bottom:0.5rem;">"Configures core branding, metadata headers, and canonical URLs."</p>
          <div>
            <label for="m-site-title" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Website Title *</label>
            <input type="text" id="m-site-title" value="${this.config.siteTitle}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-site-domain" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Base Domain *</label>
            <input type="url" id="m-site-domain" value="${this.config.siteDomain}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-admin-email" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Primary Admin Email *</label>
            <input type="email" id="m-admin-email" value="${this.config.adminEmail}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-support-email" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Support Email *</label>
            <input type="email" id="m-support-email" value="${this.config.supportEmail}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
        </div>
      `;
    } else if (this.traditionalStep === 2) {
      formContent = `
        <div class="form-group-set" style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top:0; color:var(--theme-color-primary, #2b6cb0);">⚡ Step 2: Real-time NoSQL Database & Google Authentication</h3>
          <p style="font-size:0.8rem; color:#718096; margin-bottom:0.5rem;">"Connect firestore connections and SSO logins."</p>
          <div>
            <label for="m-fb-key" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Firebase API Key *</label>
            <input type="text" id="m-fb-key" value="${this.config.firebaseApiKey}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-fb-project" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Firebase Project ID *</label>
            <input type="text" id="m-fb-project" value="${this.config.firebaseProjectId}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-google-id" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Google Client ID *</label>
            <input type="text" id="m-google-id" value="${this.config.googleClientId}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-google-secret" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Google Client Secret *</label>
            <input type="password" id="m-google-secret" value="${this.config.googleClientSecret}" required style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-google-service-token" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Google Service Account Token *</label>
            <textarea id="m-google-service-token" required style="width:100%; height:50px; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box; font-family:monospace;">${this.config.googleServiceAccountToken}</textarea>
          </div>
        </div>
      `;
    } else if (this.traditionalStep === 3) {
      formContent = `
        <div class="form-group-set" style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top:0; color:var(--theme-color-primary, #2b6cb0);">🧠 Step 3: AI Intelligence Models</h3>
          <div>
            <label for="m-gemini-key" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Gemini API Key</label>
            <input type="password" id="m-gemini-key" value="${this.config.geminiApiKey}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-openai-key" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">OpenAI API Key</label>
            <input type="password" id="m-openai-key" value="${this.config.openaiApiKey}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-preferred-model" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Preferred Model</label>
            <select id="m-preferred-model" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;">
              <option value="gemini" ${this.config.preferredModel === 'gemini' ? 'selected' : ''}>Google Gemini</option>
              <option value="openai" ${this.config.preferredModel === 'openai' ? 'selected' : ''}>OpenAI GPT-4</option>
            </select>
          </div>
        </div>
      `;
    } else if (this.traditionalStep === 4) {
      formContent = `
        <div class="form-group-set" style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top:0; color:var(--theme-color-primary, #2b6cb0);">💳 Step 4: E-Commerce & Payouts</h3>
          <div>
            <label for="m-stripe-sec" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Stripe Secret Key</label>
            <input type="password" id="m-stripe-sec" value="${this.config.stripeSecretKey}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-stripe-pub" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Stripe Publishable Key</label>
            <input type="text" id="m-stripe-pub" value="${this.config.stripePublishableKey}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-stripe-webhook" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Stripe Webhook Secret</label>
            <input type="password" id="m-stripe-webhook" value="${this.config.stripeWebhookSecret}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-stripe-price" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Stripe Price ID</label>
            <input type="text" id="m-stripe-price" value="${this.config.stripeMembershipPriceId}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
        </div>
      `;
    } else if (this.traditionalStep === 5) {
      formContent = `
        <div class="form-group-set" style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top:0; color:var(--theme-color-primary, #2b6cb0);">📞 Step 5: Comms & Telephony</h3>
          <div>
            <label for="m-telnyx-key" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Telnyx API Key</label>
            <input type="password" id="m-telnyx-key" value="${this.config.telnyxApiKey}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-telnyx-phone" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Telnyx Phone Number</label>
            <input type="text" id="m-telnyx-phone" value="${this.config.telnyxPhoneNumber}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-twilio-sid" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Twilio SID</label>
            <input type="text" id="m-twilio-sid" value="${this.config.twilioAccountSid}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-twilio-token" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Twilio Auth Token</label>
            <input type="password" id="m-twilio-token" value="${this.config.twilioAuthToken}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
        </div>
      `;
    } else if (this.traditionalStep === 6) {
      formContent = `
        <div class="form-group-set" style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top:0; color:var(--theme-color-primary, #2b6cb0);">🛡️ Step 6: Cyber Security Vault</h3>
          <div>
            <label for="m-vt-key" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">VirusTotal API Key</label>
            <input type="password" id="m-vt-key" value="${this.config.vtApiKey}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-zap-endpoint" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">OWASP ZAP Endpoint</label>
            <input type="url" id="m-zap-endpoint" value="${this.config.zapEndpoint}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
        </div>
      `;
    } else {
      formContent = `
        <div class="form-group-set" style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top:0; color:var(--theme-color-primary, #2b6cb0);">📊 Step 7: Analytics & SEO Settings</h3>
          <div>
            <label for="m-ga4-id" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">GA4 Measurement ID</label>
            <input type="text" id="m-ga4-id" value="${this.config.ga4Id}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
          <div>
            <label for="m-looker-url" style="font-weight:bold; font-size:0.85rem; display:block; margin-bottom:4px;">Looker Studio Embed URL</label>
            <input type="url" id="m-looker-url" value="${this.config.lookerUrl}" style="width:100%; padding:8px; border:1px solid #cbd5e0; border-radius:6px; box-sizing:border-box;" />
          </div>
        </div>
      `;
    }

    pane.innerHTML = formContent;
    this.setupTraditionalInputBindings();
  }

  setupTraditionalInputBindings() {
    // Bind change/input handlers to instantly sync traditional fields with this.config state object
    const fieldsToMap = {
      'm-site-title': 'siteTitle',
      'm-site-domain': 'siteDomain',
      'm-admin-email': 'adminEmail',
      'm-support-email': 'supportEmail',
      'm-fb-key': 'firebaseApiKey',
      'm-fb-project': 'firebaseProjectId',
      'm-google-id': 'googleClientId',
      'm-google-secret': 'googleClientSecret',
      'm-google-service-token': 'googleServiceAccountToken',
      'm-gemini-key': 'geminiApiKey',
      'm-openai-key': 'openaiApiKey',
      'm-preferred-model': 'preferredModel',
      'm-stripe-sec': 'stripeSecretKey',
      'm-stripe-pub': 'stripePublishableKey',
      'm-stripe-webhook': 'stripeWebhookSecret',
      'm-stripe-price': 'stripeMembershipPriceId',
      'm-telnyx-key': 'telnyxApiKey',
      'm-telnyx-phone': 'telnyxPhoneNumber',
      'm-twilio-sid': 'twilioAccountSid',
      'm-twilio-token': 'twilioAuthToken',
      'm-vt-key': 'vtApiKey',
      'm-zap-endpoint': 'zapEndpoint',
      'm-ga4-id': 'ga4Id',
      'm-looker-url': 'lookerUrl'
    };

    Object.entries(fieldsToMap).forEach(([elId, configKey]) => {
      const el = this.querySelector(`#${elId}`);
      if (el) {
        el.oninput = () => {
          this.config[configKey] = el.value.trim();
          this.updateBlueprintDisplay();
        };
      }
    });
  }

  setupCommonListeners() {
    const toggleA = this.querySelector('#toggle-mode-a');
    const toggleB = this.querySelector('#toggle-mode-b');

    toggleA.onclick = (e) => {
      e.preventDefault();
      this.currentMode = 'A';
      this.updateActiveModeDisplay();
    };

    toggleB.onclick = (e) => {
      e.preventDefault();
      this.currentMode = 'B';
      this.updateActiveModeDisplay();
    };

    // Chat Send message
    const sendBtn = this.querySelector('#chat-send-btn');
    const inputField = this.querySelector('#chat-input-field');

    const handleSend = () => {
      const txt = inputField.value.trim();
      if (!txt) return;
      inputField.value = '';
      this.processConversationalTurn(txt);
    };

    sendBtn.onclick = (e) => {
      e.preventDefault();
      handleSend();
    };

    inputField.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    };

    // Traditional step navigation buttons
    const tradBack = this.querySelector('#trad-back-btn');
    const tradNext = this.querySelector('#trad-next-btn');

    tradBack.onclick = (e) => {
      e.preventDefault();
      if (this.traditionalStep > 1) {
        this.traditionalStep--;
        this.renderTraditionalStep();
      }
    };

    tradNext.onclick = (e) => {
      e.preventDefault();
      if (this.traditionalStep < this.totalTraditionalSteps) {
        this.traditionalStep++;
        this.renderTraditionalStep();
      } else {
        toast.info("Traditional setup steps complete! Click complete setup at bottom right.");
      }
    };

    // AI asset generation button inside prompt workspace
    const aiGenHeroBtn = this.querySelector('#ai-gen-hero-trigger');
    aiGenHeroBtn.onclick = async (e) => {
      e.preventDefault();
      aiGenHeroBtn.disabled = true;
      aiGenHeroBtn.textContent = 'Generating...';
      try {
        const url = await generateHeroBackground(this.config.siteTitle);
        this.config.heroBannerUrl = url;
        this.addContractorMessage("✨ Conversational AI Architect", `Generated a high impact 16:9 modern hero background! <br><img src="${url}" style="width:100%; border-radius:6px; margin-top:8px; aspect-ratio:16/9; object-fit:cover;"/>`);
        this.renderChatHistory();
        this.updateBlueprintDisplay();
        this.logWizardNotification('Generated professional brand hero visual assets');
      } catch (err) {
        toast.error('AI asset generation offline.');
      } finally {
        aiGenHeroBtn.disabled = false;
        aiGenHeroBtn.textContent = '✨ Generate AI Brand Hero with Imagen';
      }
    };

// Email DNS guide close & toggle handling
    const emailHelpPanel = this.querySelector('#help-m-free-email');
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

    const helpCloseBtn = this.querySelector('.help-close-btn');
    if (helpCloseBtn) {
      helpCloseBtn.onclick = (e) => {
        e.preventDefault();
        if (emailHelpPanel) emailHelpPanel.style.display = 'none';
      };
    }

    // Cancel / Exit Onboarding
    this.querySelector('#cancel-wizard-btn').onclick = (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to exit? All unsaved credentials might be lost.')) {
        this.remove();
      }
    };

    // Complete setup / Lock State trigger
    const finishBtn = this.querySelector('#master-finish-btn');
    finishBtn.onclick = async (e) => {
      e.preventDefault();
      finishBtn.disabled = true;
      finishBtn.textContent = 'Writing System Locks...';
      await this.finishSetup();
    };
  }

  async finishSetup() {
    const currentGlobal = configManager.current || {};
    const finalConfig = {
      ...currentGlobal,
      siteTitle: this.config.siteTitle || "Foundation Framework",
      siteDomain: this.config.siteDomain || window.location.origin,
      adminEmails: [this.config.adminEmail || "admin@earlalex.com"],
      isInstalled: true,
      site: {
        companyName: this.config.siteTitle || "Foundation Framework",
        siteName: this.config.siteTitle || "Foundation Framework",
        isConfigured: true
      },
      businessProfile: {
        ...(currentGlobal?.businessProfile || {}),
        supportEmail: this.config.supportEmail,
        email: this.config.supportEmail,
        isConfigured: true
      },
      firebase: {
        apiKey: this.config.firebaseApiKey,
        projectId: this.config.firebaseProjectId,
        authDomain: `${this.config.firebaseProjectId}.firebaseapp.com`,
        databaseRulesInitialized: true
      },
      google: {
        clientId: this.config.googleClientId,
        clientSecret: this.config.googleClientSecret,
        serviceAccountToken: this.config.googleServiceAccountToken,
        ownerEmail: this.config.adminEmail,
        consentScreenCompleted: true
      },
      aiConfig: {
        geminiApiKey: this.config.geminiApiKey,
        openaiApiKey: this.config.openaiApiKey,
        preferredProvider: this.config.preferredModel
      },
      chatbot: {
        ...(configManager.current.chatbot || {}),
        enabled: true,
        openaiApiKey: this.config.openaiApiKey,
        telnyxApiKey: this.config.telnyxApiKey,
        telnyxPhoneNumber: this.config.telnyxPhoneNumber,
        twilioAccountSid: this.config.twilioAccountSid,
        twilioAuthToken: this.config.twilioAuthToken,
        twilioPhoneNumber: this.config.twilioPhoneNumber
      },
      stripe: {
        ...(configManager.current.stripe || {}),
        secretKey: this.config.stripeSecretKey,
        publishableKey: this.config.stripePublishableKey,
        webhookSecret: this.config.stripeWebhookSecret,
        priceId: this.config.stripeMembershipPriceId,
        isConfigured: true
      },
      wise: {
        apiKey: this.config.wiseApiKey,
        profileId: this.config.wiseProfileId,
        sandbox: true
      },
      virustotal: {
        apiKey: this.config.vtApiKey
      },
      security: {
        ...(configManager.current.security || {}),
        zapApiUrl: this.config.zapEndpoint,
        isConfigured: true
      },
      analytics: {
        googleAnalyticsId: this.config.ga4Id
      },
      thirdParty: {
        ...(configManager.current.thirdParty || {}),
        ga4PropertyId: this.config.ga4Id,
        lookerStudioEmbedUrl: this.config.lookerUrl,
        googlePlaceId: this.config.googlePlaceId,
        adsensePublisherId: this.config.adsensePub
      },
      features: {
        ...this.config.features
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
      let saveResult = false;
      try {
        saveResult = await configManager.saveToFirebase(finalConfig);
      } catch (err) {
        console.warn("[MasterSetupWizard] Remote config save deferred/offline:", err);
      }

      // Always write fallback to LocalStorage directly so setup is never blocked by remote timeouts
      try {
        localStorage.setItem('foundation_config', JSON.stringify(finalConfig));
        saveResult = true;
      } catch (lsErr) {
        console.warn("[MasterSetupWizard] LocalStorage fallback write issue:", lsErr);
      }

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
        console.warn("Failed to post setup completion to edge API endpoint:", err.message);
      }

      // 3. Create the Initial Blueprint Snapshot (Directly satisfies Directive 3.1)
      try {
        const { createSiteSnapshot } = await import('../../../utils/snapshotEngine.js');
        await createSiteSnapshot('Initial House Blueprint');
        this.logWizardNotification('Created Initial House Blueprint system state snapshot successfully', 'System Alerts');
      } catch (snapshotErr) {
        console.warn('Initial Blueprint snapshot creation deferred or offline:', snapshotErr.message);
      }

      // 4. Dispatch store SET_DEV_MODE to false and re-evaluate auth states
      store.dispatch('SET_DEV_MODE', false);

      toast.success("Platform master onboarding completed successfully!");

      // Execute custom callback if present
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }

      // 5. Clean reload
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
      const finishBtn = this.querySelector('#master-finish-btn');
      if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.textContent = '✨ Finish Installation & Lock State';
      }
    }
  }
}

if (!customElements.get('master-setup-wizard')) {
  customElements.define('master-setup-wizard', MasterSetupWizard);
}

/**
 * Custom Web Component <foundation-worksheet-wizard>
 * Pre-Onboarding Foundation Worksheet & Semantic Brand Synthesis Engine
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return str == null ? '' : String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeCssHex(hex, fallback = "#1E3A8A") {
  if (typeof hex !== 'string') return fallback;
  const clean = hex.trim();
  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(clean)) {
    return clean;
  }
  return fallback;
}

/**
 * Custom Web Component <foundation-worksheet-wizard>
 * Pre-Onboarding Foundation Worksheet & Semantic Brand Synthesis Engine
 */
export class FoundationWorksheetWizard extends HTMLElement {
  constructor() {
    super();
    this.uid = 'fws_' + Math.random().toString(36).substring(2, 8);
    this.currentStep = 1;
    this.totalSteps = 5;
    this.synthesizedBrand = null;
    this.isSynthesizing = false;
    this.isConfirming = false;

    // Pre-filled EarlAlex baseline defaults
    this.worksheet = {
      purpose: "My/Our purpose is to elevate men and women into full alignment with their potential - empowering them to reclaim sovereignty over their mind, body, and business through discipline, clarity, and higher consciousness.",
      mission: "My/Our mission is to build transformational frameworks, like Elevated Universe Academy and The Hunt, that merge fitness, mindset, and entrepreneurship. I create actionable programs, tools, and content that help people realign with their true purpose and achieve sustainable success with integrity and clarity.",
      values: [
        { name: "Alignment over Achievement", desc: "True success flows from staying rooted in your why, not chasing hollow milestones." },
        { name: "Discipline", desc: "Consistency is the foundation of mastery." },
        { name: "Integrity", desc: "Always act in truth, even when it's inconvenient." },
        { name: "Ownership", desc: "Radical accountability for actions, choices, and results." },
        { name: "Creativity", desc: "Use innovation and unique expression as a force for change." },
        { name: "Sovereignty", desc: "Build life and business structures that ensure freedom and independence." },
        { name: "Growth", desc: "Never stop evolving mentally, spiritually, and physically." },
        { name: "Community Impact", desc: "Lift others as you rise, creating a ripple effect of empowerment." },
        { name: "Health is Wealth", desc: "Physical, mental, and spiritual well-being come before profits or recognition." }
      ],
      kpis: [
        { category: "Health & Energy / Financial Performance", title: "Complete 4 rounds of physical & mental performance programs (e.g., The Hunt) consistently within 90 days." },
        { category: "Health & Energy / Financial Performance", title: "Track body composition: reach target weight and strength milestones." },
        { category: "Health & Energy / Financial Performance", title: "Maintain quarterly revenue growth targets for enterprise offers." },
        { category: "Relationships / Customer & Market", title: "Build primary subscriber email list to target volume within 90 days." },
        { category: "Relationships / Customer & Market", title: "Collect 30+ client/student testimonials or success stories." },
        { category: "Relationships / Customer & Market", title: "Maintain consistent weekly audience engagement across media channels." },
        { category: "Personal Growth / Operational Excellence", title: "Read/study 2 books per month on leadership, NLP, or metaphysics." },
        { category: "Personal Growth / Operational Excellence", title: "Complete targeted certifications or technical skill modules." },
        { category: "Personal Growth / Operational Excellence", title: "Maintain a documented content and release calendar." },
        { category: "Wealth & Legacy / Learning & Innovation", title: "Launch entry offer funnels successfully with 100+ sales." },
        { category: "Wealth & Legacy / Learning & Innovation", title: "Develop core curriculum into fully recorded, scalable modules." },
        { category: "Wealth & Legacy / Learning & Innovation", title: "Publish 1 major content series documenting the sovereign journey." }
      ]
    };
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <div class="worksheet-modal-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 100010; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;">
        <div class="worksheet-modal-card" style="background: white; border-radius: 12px; width: 100%; max-width: 900px; height: max-content; max-height: calc(100vh - 40px); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); font-family: system-ui, sans-serif; color: #1a202c;">

          <!-- Header -->
          <div style="background: var(--theme-color-surface-alt, #f8fafc); border-bottom: 1px solid var(--theme-color-border, #e2e8f0); padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">📝</span>
              <div>
                <h2 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0);">Foundation Worksheet & Brand Synthesis</h2>
                <span style="font-size: 0.75rem; color: #718096;" id="${this.uid}-step-title">Step ${this.currentStep} of ${this.totalSteps}: Purpose (Your Why)</span>
              </div>
            </div>
            <button id="${this.uid}-close-btn" class="close-worksheet-modal" style="background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: #a0aec0;">&times;</button>
          </div>

          <!-- Body Step Content -->
          <div id="${this.uid}-step-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
            ${this.renderStepContent()}
          </div>

          <!-- Footer Actions -->
          <div style="background: var(--theme-color-surface-alt, #f8fafc); border-top: 1px solid var(--theme-color-border, #e2e8f0); padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <button id="${this.uid}-prev-btn" class="btn-secondary" style="padding: 8px 16px; font-weight: 600;" ${this.currentStep === 1 ? 'disabled' : ''}>Back</button>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span style="font-size: 0.8rem; font-weight: bold; color: #718096; margin-right: 0.5rem;">Step ${this.currentStep}/${this.totalSteps}</span>
              ${this.currentStep < this.totalSteps ? `
                <button id="${this.uid}-next-btn" class="btn-primary" style="padding: 8px 20px; font-weight: bold;">Next Step</button>
              ` : `
                <button id="${this.uid}-confirm-btn" class="btn-primary" style="padding: 10px 24px; font-weight: bold; background: #38a169; border-color: #2f855a;">✨ Confirm & Apply Custom Brand System</button>
              `}
            </div>
          </div>

        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderStepContent() {
    if (this.currentStep === 1) {
      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top: 0; color: var(--theme-color-primary, #2b6cb0);">1. Purpose (Your Why)</h3>
          <p style="font-size: 0.85rem; color: #718096; line-height: 1.5; margin-bottom: 0.5rem;">
            The core reason you exist or operate beyond making money. What impact do you genuinely want to create?
          </p>
          <div>
            <label for="${this.uid}-purpose-input" style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Purpose Statement:</label>
            <textarea id="${this.uid}-purpose-input" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box; line-height: 1.5;">${escapeHTML(this.worksheet.purpose)}</textarea>
          </div>
        </div>
      `;
    }

    if (this.currentStep === 2) {
      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top: 0; color: var(--theme-color-primary, #2b6cb0);">2. Mission (Your What & How)</h3>
          <p style="font-size: 0.85rem; color: #718096; line-height: 1.5; margin-bottom: 0.5rem;">
            What you deliver, for whom, how you uniquely deliver it, and the intended outcome. Format: <em>"My mission is to [WHAT] for [WHO] by [HOW], so that [OUTCOME]."</em>
          </p>
          <div>
            <label for="${this.uid}-mission-input" style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Mission Statement:</label>
            <textarea id="${this.uid}-mission-input" style="width: 100%; height: 120px; padding: 10px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box; line-height: 1.5;">${escapeHTML(this.worksheet.mission)}</textarea>
          </div>
        </div>
      `;
    }

    if (this.currentStep === 3) {
      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top: 0; color: var(--theme-color-primary, #2b6cb0);">3. The 9 Core Values</h3>
          <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Non-negotiable principles shaping decisions, culture, and behavior.</p>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem; max-height: 320px; overflow-y: auto; padding-right: 4px;">
            ${this.worksheet.values.map((v, i) => `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem;">
                <label style="font-size: 0.8rem; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); display: block; margin-bottom: 2px;">Value ${i + 1}: ${escapeHTML(v.name)}</label>
                <input type="text" class="ws-val-desc" data-index="${i}" value="${escapeHTML(v.desc)}" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.8rem; box-sizing: border-box;" />
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.currentStep === 4) {
      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <h3 style="margin-top: 0; color: var(--theme-color-primary, #2b6cb0);">4. The 12 Key Performance Indicators (KPI Scoreboard)</h3>
          <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">3 KPIs per category tracking growth across health, customer, growth, and wealth.</p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 320px; overflow-y: auto; padding-right: 4px;">
            ${this.worksheet.kpis.map((k, i) => `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.75rem; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 0.72rem; font-weight: bold; color: #718096; text-transform: uppercase;">${escapeHTML(k.category)}</span>
                <input type="text" class="ws-kpi-input" data-index="${i}" value="${escapeHTML(k.title)}" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.8rem; box-sizing: border-box;" />
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Step 5: Design Psychology Synthesis & Rationale Card Preview
    if (this.isSynthesizing) {
      return `
        <div style="text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;" class="spin-icon">✨</div>
          <h3 style="margin: 0 0 0.5rem 0; color: var(--theme-color-primary, #2b6cb0);">Synthesizing Brand System via Gemini AI...</h3>
          <p style="color: #718096; font-size: 0.9rem;">Applying color psychology, typographic semantics, and brand archetype rules based on your Purpose, Mission, and Values.</p>
        </div>
      `;
    }

    const brand = this.synthesizedBrand || {
      archetype: "Sovereign Ruler & Heroic Catalyst",
      voiceAndTone: "Authoritative, Direct, Sovereign, Grounded",
      colors: {
        primary: "#1E3A8A",
        primaryHover: "#1D4ED8",
        accent: "#D97706",
        surface: "#FFFFFF",
        surfaceAlt: "#F8FAFC",
        textPrimary: "#0F172A",
        textSecondary: "#475569"
      },
      typography: {
        headingFont: "Cinzel",
        bodyFont: "Plus Jakarta Sans",
        headingStyle: "Uppercase, High-Tracking, Serif Authority"
      },
      designRationale: {
        colorPsychology: "Deep Navy (#1E3A8A) was selected for Primary to convey Sovereignty, Integrity, and Enterprise Stability. Solar Gold (#D97706) provides high-contrast CTAs representing Radiant Optimism and Legacy.",
        typographyRationale: "Cinzel was selected for headings to convey Executive Sovereignty and Structural Authority. Plus Jakarta Sans provides geometric body clarity.",
        archetypeRationale: "Your brand persona combines the Sovereign Ruler with the Heroic Catalyst, balancing executive authority with transformative action."
      }
    };

    const safePrimary = sanitizeCssHex(brand.colors?.primary, "#1E3A8A");
    const safeHover = sanitizeCssHex(brand.colors?.primaryHover, "#1D4ED8");
    const safeAccent = sanitizeCssHex(brand.colors?.accent, "#D97706");
    const safeSurface = sanitizeCssHex(brand.colors?.surface, "#FFFFFF");
    const safeSurfaceAlt = sanitizeCssHex(brand.colors?.surfaceAlt, "#F8FAFC");
    const safeTextPrimary = sanitizeCssHex(brand.colors?.textPrimary, "#0F172A");

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem; color: #166534; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <strong style="font-size: 0.95rem; display: block;">✨ Brand Design Psychology Synthesis Complete!</strong>
            <span style="font-size: 0.8rem;">Review your custom color swatches, typographic semantics, and rationale below before applying.</span>
          </div>
          <button id="${this.uid}-resynth-btn" class="ws-re-synthesize-btn" style="padding: 6px 12px; font-size: 0.8rem; background: #ffffff; border: 1px solid #bbf7d0; color: #166534; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🔄 Re-Synthesize
          </button>
        </div>

        <!-- Interactive Brand Psychology Rationale Card -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; box-shadow: 0 4px 6px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 1rem;">

          <!-- Palette Swatches -->
          <div>
            <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; color: #718096; letter-spacing: 0.05em;">Derived Palette Swatches:</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.5rem;">
              <div style="background: ${safePrimary}; color: white; padding: 0.75rem; border-radius: 6px; text-align: center; font-size: 0.72rem; font-weight: bold; border: 1px solid rgba(0,0,0,0.1);">
                Primary<br><code>${escapeHTML(safePrimary)}</code>
              </div>
              <div style="background: ${safeHover}; color: white; padding: 0.75rem; border-radius: 6px; text-align: center; font-size: 0.72rem; font-weight: bold; border: 1px solid rgba(0,0,0,0.1);">
                Hover<br><code>${escapeHTML(safeHover)}</code>
              </div>
              <div style="background: ${safeAccent}; color: white; padding: 0.75rem; border-radius: 6px; text-align: center; font-size: 0.72rem; font-weight: bold; border: 1px solid rgba(0,0,0,0.1);">
                Accent<br><code>${escapeHTML(safeAccent)}</code>
              </div>
              <div style="background: ${safeSurface}; color: ${safeTextPrimary}; padding: 0.75rem; border-radius: 6px; text-align: center; font-size: 0.72rem; font-weight: bold; border: 1px solid #cbd5e0;">
                Surface<br><code>${escapeHTML(safeSurface)}</code>
              </div>
              <div style="background: ${safeSurfaceAlt}; color: ${safeTextPrimary}; padding: 0.75rem; border-radius: 6px; text-align: center; font-size: 0.72rem; font-weight: bold; border: 1px solid #cbd5e0;">
                Surface Alt<br><code>${escapeHTML(safeSurfaceAlt)}</code>
              </div>
            </div>
          </div>

          <!-- Color Psychology Rationale -->
          <div style="background: #f8fafc; border-left: 4px solid ${safePrimary}; padding: 0.85rem; border-radius: 4px;">
            <strong style="display: block; font-size: 0.85rem; color: ${safePrimary}; margin-bottom: 2px;">🎨 Color Psychology Rationale:</strong>
            <p style="margin: 0; font-size: 0.8rem; color: #334155; line-height: 1.5;">${escapeHTML(brand.designRationale?.colorPsychology)}</p>
          </div>

          <!-- Typographic Rationale -->
          <div style="background: #f8fafc; border-left: 4px solid ${safeAccent}; padding: 0.85rem; border-radius: 4px;">
            <strong style="display: block; font-size: 0.85rem; color: ${safeAccent}; margin-bottom: 2px;">✍️ Typographic Semantics (Headings: <em>${escapeHTML(brand.typography?.headingFont)}</em> | Body: <em>${escapeHTML(brand.typography?.bodyFont)}</em>):</strong>
            <p style="margin: 0; font-size: 0.8rem; color: #334155; line-height: 1.5;">${escapeHTML(brand.designRationale?.typographyRationale)}</p>
          </div>

          <!-- Archetype & Voice Card -->
          <div style="background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 6px; padding: 0.85rem; color: #1e3a8a;">
            <strong style="display: block; font-size: 0.85rem; margin-bottom: 2px;">👑 Brand Archetype & Tone: <em>${escapeHTML(brand.archetype)}</em></strong>
            <p style="margin: 0; font-size: 0.8rem; line-height: 1.5;"><strong>Voice & Tone:</strong> ${escapeHTML(brand.voiceAndTone)}. <br>${escapeHTML(brand.designRationale?.archetypeRationale)}</p>
          </div>

        </div>

        <!-- Output binder status -->
        <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: flex-end;">
          <button id="${this.uid}-download-md-btn" class="ws-download-md-btn" style="padding: 6px 12px; font-size: 0.8rem; background: transparent; border: 1px solid #cbd5e0; border-radius: 6px; font-weight: 600; cursor: pointer;">
            📄 Download corporate-binder/Foundation_Worksheet.md
          </button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.querySelector(`#${this.uid}-close-btn`)?.addEventListener('click', () => this.remove());

    const prevBtn = this.querySelector(`#${this.uid}-prev-btn`);
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (this.currentStep > 1) {
          this.currentStep--;
          this.render();
        }
      };
    }

    const nextBtn = this.querySelector(`#${this.uid}-next-btn`);
    if (nextBtn) {
      nextBtn.onclick = async () => {
        if (this.isSynthesizing) return;
        this.saveCurrentStepInputs();
        if (this.currentStep < this.totalSteps) {
          this.currentStep++;
          if (this.currentStep === 5 && !this.synthesizedBrand) {
            await this.performBrandSynthesis();
          } else {
            this.render();
          }
        }
      };
    }

    const reSynthBtn = this.querySelector(`#${this.uid}-resynth-btn`);
    if (reSynthBtn) {
      reSynthBtn.onclick = async () => {
        if (this.isSynthesizing) return;
        await this.performBrandSynthesis();
      };
    }

    const downloadMdBtn = this.querySelector(`#${this.uid}-download-md-btn`);
    if (downloadMdBtn) {
      downloadMdBtn.onclick = () => {
        const mdContent = this.generateMarkdownBinderContent();
        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "Foundation_Worksheet.md";
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    const confirmBtn = this.querySelector(`#${this.uid}-confirm-btn`);
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        if (this.isSynthesizing || this.isConfirming) {
          toast.warning("Brand synthesis or system confirmation is currently in progress. Please wait.");
          return;
        }

        this.isConfirming = true;
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Injecting Custom Design System...";

        try {
          if (!this.synthesizedBrand) {
            await this.performBrandSynthesis();
          }

          const brand = this.synthesizedBrand || {
            colors: { primary: "#1E3A8A", primaryHover: "#1D4ED8", accent: "#D97706", surface: "#FFFFFF", surfaceAlt: "#F8FAFC", textPrimary: "#0F172A", textSecondary: "#475569" },
            typography: { headingFont: "Cinzel", bodyFont: "Plus Jakarta Sans" }
          };

          // 1. Inject tokens into themeEngine
          themeEngine.applyCustomDesignSystem({
            '--theme-color-primary': brand.colors.primary,
            '--theme-color-primary-hover': brand.colors.primaryHover,
            '--theme-color-accent': brand.colors.accent,
            '--theme-color-surface': brand.colors.surface,
            '--theme-color-surface-alt': brand.colors.surfaceAlt,
            '--theme-font-family-heading': brand.typography.headingFont,
            '--theme-font-family-body': brand.typography.bodyFont
          });

          // 2. Persist brandGuide in configManager
          const updatedConfig = {
            ...(configManager.current || {}),
            brandGuide: brand,
            foundationWorksheet: this.worksheet
          };
          configManager.current = updatedConfig;
          localStorage.setItem('foundation_theme_custom', JSON.stringify(brand));

          // 3. Save Markdown to corporate-binder/
          const mdText = this.generateMarkdownBinderContent();
          const mdFile = new File([new Blob([mdText], { type: 'text/markdown' })], "Foundation_Worksheet.md", { type: 'text/markdown' });
          mdFile.isCorporateBinder = true;
          let driveUploadRes = null;
          try {
            driveUploadRes = await uploadFileToDrive(mdFile);
          } catch (e) {
            console.warn('[FoundationWorksheetWizard] Drive backup deferred:', e.message);
          }

          if (driveUploadRes && driveUploadRes.id) {
            toast.success("Semantic Brand Guide synthesized & archived to Google Drive (corporate-binder/Foundation_Worksheet.md)!");
          } else {
            toast.info("Semantic Brand Guide synthesized & saved locally (Google Drive backup offline or unconfigured).");
          }

          if (this.onCompleteCallback) {
            this.onCompleteCallback(brand, driveUploadRes);
          }
          this.remove();
        } catch (err) {
          this.isConfirming = false;
          toast.error("Failed to apply brand theme: " + err.message);
          confirmBtn.disabled = false;
          confirmBtn.textContent = "✨ Confirm & Apply Custom Brand System";
        }
      };
    }
  }

  saveCurrentStepInputs() {
    if (this.currentStep === 1) {
      const p = this.querySelector(`#${this.uid}-purpose-input`)?.value;
      if (p) this.worksheet.purpose = p.trim();
    } else if (this.currentStep === 2) {
      const m = this.querySelector(`#${this.uid}-mission-input`)?.value;
      if (m) this.worksheet.mission = m.trim();
    } else if (this.currentStep === 3) {
      this.querySelectorAll('.ws-val-desc').forEach(el => {
        const idx = Number(el.dataset.index);
        if (this.worksheet.values[idx]) {
          this.worksheet.values[idx].desc = el.value.trim();
        }
      });
    } else if (this.currentStep === 4) {
      this.querySelectorAll('.ws-kpi-input').forEach(el => {
        const idx = Number(el.dataset.index);
        if (this.worksheet.kpis[idx]) {
          this.worksheet.kpis[idx].title = el.value.trim();
        }
      });
    }
  }

  async performBrandSynthesis() {
    if (this.isSynthesizing) return;
    this.isSynthesizing = true;
    toast.info("Synthesizing custom brand identity with Gemini AI...", 3000);
    this.render();

    try {
      const valuesArr = this.worksheet.values.map(v => `${v.name}: ${v.desc}`);
      const kpisArr = this.worksheet.kpis.map(k => `${k.category}: ${k.title}`);

      this.synthesizedBrand = await synthesizeBrandFromWorksheet({
        purpose: this.worksheet.purpose,
        mission: this.worksheet.mission,
        values: valuesArr,
        kpis: kpisArr
      });
      toast.success("Brand Design Psychology Synthesis complete!");
    } catch (err) {
      console.warn('Brand synthesis deferred, using default fallback:', err);
      toast.warning("Brand synthesis offline. Fallback design system applied.");
    } finally {
      this.isSynthesizing = false;
      this.render();
    }
  }

  generateMarkdownBinderContent() {
    const brand = this.synthesizedBrand || {};
    return `# Foundation Worksheet & Semantic Brand Guide

## 1. Purpose (Your Why)
"${this.worksheet.purpose}"

## 2. Mission (Your What & How)
"${this.worksheet.mission}"

## 3. The 9 Core Values
${this.worksheet.values.map((v, i) => `${i + 1}. **${v.name}**: ${v.desc}`).join('\n')}

## 4. The 12 Key Performance Indicators (KPI Scoreboard)
${this.worksheet.kpis.map((k, i) => `${i + 1}. [${k.category}] ${k.title}`).join('\n')}

---

## 5. Synthesized Brand Design System
- **Archetype**: ${brand.archetype || "Sovereign Master"}
- **Voice & Tone**: ${brand.voiceAndTone || "Authoritative, Sovereign, Direct"}

### Derived Color Palette
- **Primary**: \`${brand.colors?.primary || "#1E3A8A"}\`
- **Primary Hover**: \`${brand.colors?.primaryHover || "#1D4ED8"}\`
- **Accent**: \`${brand.colors?.accent || "#D97706"}\`
- **Surface**: \`${brand.colors?.surface || "#FFFFFF"}\`
- **Surface Alt**: \`${brand.colors?.surfaceAlt || "#F8FAFC"}\`
- **Text Primary**: \`${brand.colors?.textPrimary || "#0F172A"}\`

### Typographic Semantics
- **Heading Font**: ${brand.typography?.headingFont || "Cinzel"}
- **Body Font**: ${brand.typography?.bodyFont || "Plus Jakarta Sans"}

### Design Psychology Rationale
- **Color Psychology**: ${brand.designRationale?.colorPsychology || "Deep Navy selected for Sovereignty & Integrity."}
- **Typography Rationale**: ${brand.designRationale?.typographyRationale || "Cinzel selected for Executive Sovereignty."}
- **Archetype Rationale**: ${brand.designRationale?.archetypeRationale || "Sovereign Ruler persona."}

---
*Generated dynamically in corporate-binder/ on ${new Date().toLocaleString()}*
`;
  }
}

/**
 * Custom Web Component <brand-stylist-wizard>
 */
export class BrandStylistWizard extends HTMLElement {
  constructor() {
    super();
    this.uid = 'bs_' + Math.random().toString(36).substring(2, 8);
    this.brand = configManager.current?.brandGuide || {
      archetype: "Sovereign Ruler",
      voiceAndTone: "Authoritative, Direct, Sovereign",
      colors: {
        primary: "#1E3A8A",
        primaryHover: "#1D4ED8",
        accent: "#D97706",
        surface: "#FFFFFF",
        surfaceAlt: "#F8FAFC",
        textPrimary: "#0F172A",
        textSecondary: "#475569"
      },
      typography: {
        headingFont: "Cinzel",
        bodyFont: "Plus Jakarta Sans",
        headingStyle: "Uppercase, High-Tracking"
      },
      designRationale: {
        colorPsychology: "Deep Navy selected for Sovereignty and Integrity. Solar Gold for radiant energy.",
        typographyRationale: "Cinzel selected for Executive Authority.",
        archetypeRationale: "Sovereign Ruler persona."
      }
    };
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <div class="brand-stylist-modal-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 100010; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;">
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 800px; padding: 1.5rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); font-family: system-ui, sans-serif; color: #1a202c; display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem;">
            <h3 style="margin: 0; color: var(--theme-color-primary, #2b6cb0); font-size: 1.25rem; font-weight: 800;">🎨 Brand Stylist & Theme Customizer</h3>
            <button id="${this.uid}-close-btn" style="background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: #a0aec0;">&times;</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label for="${this.uid}-primary" style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px;">Primary Color:</label>
              <input type="color" id="${this.uid}-primary" value="${escapeHTML(sanitizeCssHex(this.brand.colors?.primary, '#1E3A8A'))}" style="width: 100%; height: 38px; border: 1px solid #cbd5e0; border-radius: 6px; cursor: pointer;" />
            </div>
            <div>
              <label for="${this.uid}-accent" style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px;">Accent Color:</label>
              <input type="color" id="${this.uid}-accent" value="${escapeHTML(sanitizeCssHex(this.brand.colors?.accent, '#D97706'))}" style="width: 100%; height: 38px; border: 1px solid #cbd5e0; border-radius: 6px; cursor: pointer;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label for="${this.uid}-heading-font" style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px;">Heading Google Font:</label>
              <input type="text" id="${this.uid}-heading-font" value="${escapeHTML(this.brand.typography?.headingFont)}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box;" />
            </div>
            <div>
              <label for="${this.uid}-body-font" style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px;">Body Google Font:</label>
              <input type="text" id="${this.uid}-body-font" value="${escapeHTML(this.brand.typography?.bodyFont)}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 6px; box-sizing: border-box;" />
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <strong style="font-size: 0.85rem; color: #475569;">Design Rationale Preview:</strong>
            <p style="margin: 0; font-size: 0.8rem; color: #64748b;">${escapeHTML(this.brand.designRationale?.colorPsychology || "Customized brand color system.")}</p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            <button id="${this.uid}-cancel-btn" class="btn-secondary" style="padding: 8px 16px;">Cancel</button>
            <button id="${this.uid}-apply-btn" class="btn-primary" style="padding: 10px 20px; font-weight: bold; background: var(--theme-color-accent, #38a169);">
              Apply Brand Tokens
            </button>
          </div>
        </div>
      </div>
    `;

    this.querySelector(`#${this.uid}-close-btn`)?.addEventListener('click', () => this.remove());
    this.querySelector(`#${this.uid}-cancel-btn`)?.addEventListener('click', () => this.remove());

    this.querySelector(`#${this.uid}-apply-btn`)?.addEventListener('click', () => {
      const prim = this.querySelector(`#${this.uid}-primary`).value;
      const acc = this.querySelector(`#${this.uid}-accent`).value;
      const hFont = this.querySelector(`#${this.uid}-heading-font`).value.trim();
      const bFont = this.querySelector(`#${this.uid}-body-font`).value.trim();

      const updatedBrand = {
        ...this.brand,
        colors: { ...this.brand.colors, primary: prim, accent: acc },
        typography: { ...this.brand.typography, headingFont: hFont, bodyFont: bFont }
      };

      themeEngine.applyCustomDesignSystem({
        '--theme-color-primary': prim,
        '--theme-color-accent': acc,
        '--theme-font-family-heading': hFont,
        '--theme-font-family-body': bFont
      });

      configManager.current = { ...(configManager.current || {}), brandGuide: updatedBrand };
      localStorage.setItem('foundation_theme_custom', JSON.stringify(updatedBrand));
      toast.success("Brand Stylist tokens applied successfully!");
      if (this.onCompleteCallback) this.onCompleteCallback(updatedBrand);
      this.remove();
    });
  }
}

if (!customElements.get('foundation-worksheet-wizard')) {
  customElements.define('foundation-worksheet-wizard', FoundationWorksheetWizard);
}

if (!customElements.get('brand-stylist-wizard')) {
  customElements.define('brand-stylist-wizard', BrandStylistWizard);
}