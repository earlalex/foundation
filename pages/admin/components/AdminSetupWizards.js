/**
 * pages/admin/components/AdminSetupWizards.js
 * Implements interactive, step-by-step setup modals for each of the 8 Admin sections.
 */
import { configManager } from '../../../core/config.js';
import { toast } from '../../../utils/toast.js';

export class AdminSetupWizards {
  /**
   * Launch a specific wizard modal
   * @param {string} wizardType - One of: 'site', 'api', 'business', 'finances', 'lastpass', 'marketing', 'security', 'va'
   * @param {Function} onComplete - Callback executed upon successful setup completion
   */
  static launch(wizardType, onComplete) {
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

    const wizardDefs = {
      site: {
        title: "Site & Brand Setup Wizard",
        steps: [
          {
            title: "Step 1: Website Name & Base Domain",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Website Title:</label>
                  <input type="text" id="wz-site-title" placeholder="Foundation Framework" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Base URL / Domain:</label>
                  <input type="url" id="wz-site-domain" placeholder="https://example.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const t = document.getElementById('wz-site-title')?.value;
              const d = document.getElementById('wz-site-domain')?.value;
              if (!t || !d) throw new Error("Please enter both Title and Domain!");
            },
            save: (data) => {
              data.siteTitle = document.getElementById('wz-site-title').value;
              data.siteDomain = document.getElementById('wz-site-domain').value;
            }
          },
          {
            title: "Step 2: Branding Assets",
            html: `
              <p style="text-align: left; font-size: 0.85rem; color: #718096; margin-bottom: 1rem;">Setup site logo and favicon placeholders or upload them later.</p>
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Site Logo Link:</label>
                  <input type="text" id="wz-logo-src" placeholder="/logo.png" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Favicon Link:</label>
                  <input type="text" id="wz-favicon-src" placeholder="/favicon.ico" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            save: (data) => {
              data.siteLogo = { src: document.getElementById('wz-logo-src')?.value || '/logo.png', category: 'images' };
              data.siteFavicon = { src: document.getElementById('wz-favicon-src')?.value || '/favicon.ico', category: 'images' };
            }
          },
          {
            title: "Step 3: Select Theme Palette",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <label style="display: block; font-weight: bold; font-size: 0.9rem;">Default Brand Palette Preset:</label>
                <select id="wz-theme-preset" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                  <option value="default">Foundation Blue Presets</option>
                  <option value="emerald">Emerald Modern</option>
                  <option value="midnight">Midnight Dark Theme</option>
                  <option value="cyberpunk">Cyberpunk Neon Preset</option>
                </select>
              </div>
            `,
            save: (data) => {
              data.themePreset = document.getElementById('wz-theme-preset')?.value || 'default';
            }
          }
        ]
      },
      api: {
        title: "API Keys & Cloud Setup Wizard",
        steps: [
          {
            title: "Step 1: Firebase Credentials",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Firebase Project ID:</label>
                  <input type="text" id="wz-fb-project" placeholder="demo-foundation-app" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Firebase Web API Key:</label>
                  <input type="password" id="wz-fb-key" placeholder="AIzaSy..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const p = document.getElementById('wz-fb-project')?.value;
              const k = document.getElementById('wz-fb-key')?.value;
              if (!p || !k) throw new Error("Both Project ID and API Key are required!");
            },
            save: (data) => {
              data.firebase = {
                projectId: document.getElementById('wz-fb-project').value,
                apiKey: document.getElementById('wz-fb-key').value
              };
            }
          },
          {
            title: "Step 2: Google OAuth Client ID/Secret",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Google Client ID:</label>
                  <input type="text" id="wz-google-id" placeholder="123456-abc.apps.googleusercontent.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Google Client Secret:</label>
                  <input type="password" id="wz-google-secret" placeholder="••••••••••••••••••••••••" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const i = document.getElementById('wz-google-id')?.value;
              const s = document.getElementById('wz-google-secret')?.value;
              if (!i || !s) throw new Error("Google Client ID & Secret are required!");
            },
            save: (data) => {
              data.google = {
                clientId: document.getElementById('wz-google-id').value,
                clientSecret: document.getElementById('wz-google-secret').value
              };
            }
          },
          {
            title: "Step 3: Centralized AI Model Keys",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Supply at least one valid AI token to power automated pipelines.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Google Gemini API Key:</label>
                  <input type="password" id="wz-gemini-key" placeholder="AIzaSy..." style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OpenAI API Key:</label>
                  <input type="password" id="wz-openai-key" placeholder="sk-proj-..." style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const g = document.getElementById('wz-gemini-key')?.value;
              const o = document.getElementById('wz-openai-key')?.value;
              if (!g && !o) throw new Error("At least one AI token (Gemini or OpenAI) must be supplied!");
            },
            save: (data) => {
              data.aiConfig = {
                geminiApiKey: document.getElementById('wz-gemini-key').value,
                openaiApiKey: document.getElementById('wz-openai-key').value,
                preferredProvider: document.getElementById('wz-gemini-key').value ? 'gemini' : 'openai'
              };
            }
          }
        ]
      },
      business: {
        title: "Business & Legal Setup Wizard",
        steps: [
          {
            title: "Step 1: Corporate Entity & Headquarters",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Legal Corporate Name:</label>
                  <input type="text" id="wz-biz-name" placeholder="Acme Corporation LLC" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Headquarters Address:</label>
                  <input type="text" id="wz-biz-address" placeholder="100 Innovation Way, Suite 30" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const n = document.getElementById('wz-biz-name')?.value;
              const a = document.getElementById('wz-biz-address')?.value;
              if (!n || !a) throw new Error("Corporate Name and Address are required!");
            },
            save: (data) => {
              data.businessProfile = {
                ...(configManager.current.businessProfile || {}),
                legalName: document.getElementById('wz-biz-name').value,
                address: document.getElementById('wz-biz-address').value
              };
            }
          },
          {
            title: "Step 2: EIN & Contact Info",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">EIN / Tax ID:</label>
                  <input type="text" id="wz-biz-ein" placeholder="12-3456789" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Business Phone:</label>
                  <input type="tel" id="wz-biz-phone" placeholder="1-800-555-0199" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const e = document.getElementById('wz-biz-ein')?.value;
              const p = document.getElementById('wz-biz-phone')?.value;
              if (!e || !p) throw new Error("EIN and Phone are required!");
            },
            save: (data) => {
              data.businessProfile.ein = document.getElementById('wz-biz-ein').value;
              data.businessProfile.phone = document.getElementById('wz-biz-phone').value;
            }
          },
          {
            title: "Step 3: NAICS Code Classification",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">NAICS Code:</label>
                  <select id="wz-biz-naics" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="541511">541511 - Custom Computer Programming Services</option>
                    <option value="541512">541512 - Computer Systems Design Services</option>
                    <option value="541611">541611 - Administrative Management Consulting</option>
                    <option value="454110">454110 - Electronic Shopping and Mail-Order Houses</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Industry Definition:</label>
                  <input type="text" id="wz-biz-naics-def" value="Custom Computer Programming Services" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            save: (data) => {
              data.businessProfile.naicsCode = document.getElementById('wz-biz-naics').value;
              data.businessProfile.naicsDefinition = document.getElementById('wz-biz-naics-def').value;
            }
          }
        ]
      },
      finances: {
        title: "Finances & ACH Setup Wizard",
        steps: [
          {
            title: "Step 1: Stripe API Keys",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Stripe Publishable Key:</label>
                  <input type="text" id="wz-stripe-pub" placeholder="pk_test_..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Stripe Secret Key:</label>
                  <input type="password" id="wz-stripe-sec" placeholder="sk_test_..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const p = document.getElementById('wz-stripe-pub')?.value;
              const s = document.getElementById('wz-stripe-sec')?.value;
              if (!p || !s) throw new Error("Stripe keys are required!");
            },
            save: (data) => {
              data.stripe = {
                ...(configManager.current.stripe || {}),
                publishableKey: document.getElementById('wz-stripe-pub').value,
                secretKey: document.getElementById('wz-stripe-sec').value
              };
            }
          },
          {
            title: "Step 2: Webhooks & Membership Prices",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Stripe Webhook Secret:</label>
                  <input type="password" id="wz-stripe-webhook" placeholder="whsec_..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Membership Price ID:</label>
                  <input type="text" id="wz-stripe-price" placeholder="price_1..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const w = document.getElementById('wz-stripe-webhook')?.value;
              const pr = document.getElementById('wz-stripe-price')?.value;
              if (!w || !pr) throw new Error("Webhook secret & Price ID are required!");
            },
            save: (data) => {
              data.stripe.webhookSecret = document.getElementById('wz-stripe-webhook').value;
              data.stripe.priceId = document.getElementById('wz-stripe-price').value;
            }
          },
          {
            title: "Step 3: Stripe Connect ACH & Fees",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure Connect parameters to settle ACH payments instantly.</p>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="wz-stripe-ach" checked style="cursor: pointer;" />
                  <label for="wz-stripe-ach" style="font-weight: bold; font-size: 0.9rem; cursor: pointer;">Enable ACH Direct Debit payment methods</label>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Application Fee Parameter (Cents):</label>
                  <input type="number" id="wz-stripe-fee" value="500" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  <span style="font-size: 0.75rem; color: #718096;">Saves flat $5.00 Connect application fee dynamically (500 cents).</span>
                </div>
              </div>
            `,
            save: (data) => {
              data.stripe.enableAch = document.getElementById('wz-stripe-ach').checked;
              data.stripe.achFee = Number(document.getElementById('wz-stripe-fee').value || 500);
            }
          }
        ]
      },
      lastpass: {
        title: "Password Vault (LastPass) Setup Wizard",
        steps: [
          {
            title: "Step 1: LastPass Credentials",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">LastPass Enterprise API Key / Provisioning Hash:</label>
                  <input type="password" id="wz-lp-hash" placeholder="Enter API key" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Company ID / Hash:</label>
                  <input type="text" id="wz-lp-company" placeholder="Enter Company ID" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const h = document.getElementById('wz-lp-hash')?.value;
              const c = document.getElementById('wz-lp-company')?.value;
              if (!h || !c) throw new Error("API Key & Company ID are required!");
            },
            save: (data) => {
              data.lastpass = {
                provisioningHash: document.getElementById('wz-lp-hash').value,
                companyId: document.getElementById('wz-lp-company').value,
                apiEndpoint: "https://lastpass.com/enterprise/api.php"
              };
            }
          },
          {
            title: "Step 2: Zero-Visibility Editor Sharing",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; line-height: 1.4;">Zero-Visibility sharing prevents Editor VAs from unmasking shared accounts while granting programmatic LastPass extension access.</p>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="wz-lp-zero-vis" checked style="cursor: pointer;" />
                  <label for="wz-lp-zero-vis" style="font-weight: bold; font-size: 0.9rem; cursor: pointer;">Force Masked/Hidden Passwords for Editors</label>
                </div>
              </div>
            `,
            save: (data) => {
              data.lastpass.forceMasked = document.getElementById('wz-lp-zero-vis').checked;
            }
          }
        ]
      },
      va: {
        title: "VA Hiring Hub (OnlineJobs) Setup Wizard",
        steps: [
          {
            title: "Step 1: OnlineJobs.ph Integration",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OnlineJobs.ph API Token / Connection Secret:</label>
                  <input type="password" id="wz-va-api" placeholder="Enter API secret token" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Pipeline ID Reference:</label>
                  <input type="text" id="wz-va-pipeline" placeholder="pipe_9901" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const a = document.getElementById('wz-va-api')?.value;
              const p = document.getElementById('wz-va-pipeline')?.value;
              if (!a || !p) throw new Error("API Token & Pipeline reference are required!");
            },
            save: (data) => {
              data.vaHub = {
                apiKey: document.getElementById('wz-va-api').value,
                pipelineId: document.getElementById('wz-va-pipeline').value
              };
            }
          },
          {
            title: "Step 2: Default Onboarding Templates",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Welcome Email Subject Line:</label>
                  <input type="text" id="wz-va-subject" value="Welcome to our Team!" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Editor VA Onboarding welcome body:</label>
                  <textarea id="wz-va-onboard-text" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 90px; box-sizing: border-box;">Welcome to our team! Please complete your OAuth onboarding by clicking the system links provided...</textarea>
                </div>
              </div>
            `,
            validate: () => {
              const s = document.getElementById('wz-va-subject')?.value;
              const o = document.getElementById('wz-va-onboard-text')?.value;
              if (!s || !o) throw new Error("Both subject line and onboarding template are required!");
            },
            save: (data) => {
              data.vaHub.welcomeEmailSubject = document.getElementById('wz-va-subject').value;
              data.vaHub.onboardingTemplate = document.getElementById('wz-va-onboard-text').value;
            }
          }
        ]
      },
      marketing: {
        title: "Automated Marketing Setup Wizard",
        steps: [
          {
            title: "Step 1: Gmail Send Notification credentials",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Gmail Sender Address:</label>
                  <input type="email" id="wz-mkt-sender" placeholder="marketing@example.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Sender Name Alias:</label>
                  <input type="text" id="wz-mkt-alias" value="Core Notification System" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const s = document.getElementById('wz-mkt-sender')?.value;
              const a = document.getElementById('wz-mkt-alias')?.value;
              if (!s || !a) throw new Error("Both Sender and Alias are required!");
            },
            save: (data) => {
              data.marketing = {
                gmailSender: document.getElementById('wz-mkt-sender').value,
                defaultSenderAlias: document.getElementById('wz-mkt-alias').value
              };
            }
          },
          {
            title: "Step 2: Default Sequencing Rules",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Sequence Trigger Event:</label>
                  <select id="wz-mkt-trigger" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="user_signup">On User Registration</option>
                    <option value="dues_overdue">On Dues Overdue Penalty</option>
                    <option value="lead_contact">On Prospect Submission</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Sequence Delays (Hours):</label>
                  <input type="number" id="wz-mkt-delay" value="24" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            save: (data) => {
              data.marketing.defaultTrigger = document.getElementById('wz-mkt-trigger').value;
              data.marketing.defaultDelay = Number(document.getElementById('wz-mkt-delay').value || 24);
            }
          }
        ]
      },
      security: {
        title: "Security & Threats Setup Wizard",
        steps: [
          {
            title: "Step 1: VirusTotal Key Setup",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096;">Ensure <code>VIRUSTOTAL_API_KEY</code> is correctly written into Cloudflare Pages settings for automatic signature checks.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">VirusTotal API Key (Edge proxy integration):</label>
                  <input type="password" id="wz-sec-vt" placeholder="Enter secure VT key" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const vt = document.getElementById('wz-sec-vt')?.value;
              if (!vt) throw new Error("VirusTotal API Key is required!");
            },
            save: (data) => {
              data.virustotal = { apiKey: document.getElementById('wz-sec-vt').value };
            }
          },
          {
            title: "Step 2: Background Threat Schedules",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; line-height: 1.4;">Automated monthly background cron audits verify file signature hashes against ClamAV and 70+ engines continuously.</p>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="wz-sec-schedule" checked style="cursor: pointer;" />
                  <label for="wz-sec-schedule" style="font-weight: bold; font-size: 0.9rem; cursor: pointer;">Enable Automated Monthly Background Scan</label>
                </div>
              </div>
            `,
            save: (data) => {
              data.security = { monthlyScanEnabled: document.getElementById('wz-sec-schedule').checked };
            }
          }
        ]
      }
    };

    const config = wizardDefs[wizardType];
    if (!config) {
      console.error(`Unknown setup wizard type: ${wizardType}`);
      return;
    }

    let currentStepIndex = 0;
    const collector = {};

    const renderStep = () => {
      const step = config.steps[currentStepIndex];
      modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 500px; padding: 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.2); position: relative; color: #1a202c;">
          <h3 style="margin-top: 0; font-size: 1.4rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0); border-bottom: 2px solid #edf2f7; padding-bottom: 0.75rem; margin-bottom: 1.5rem;">
            ${config.title}
          </h3>
          <h4 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; font-weight: bold; text-align: left;">
            ${step.title}
          </h4>

          <form id="wizard-step-form" style="margin-bottom: 1.5rem;">
            ${step.html}
          </form>

          <div style="display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid #edf2f7; padding-top: 1.25rem;">
            <button id="wz-cancel" style="background: transparent; border: 1px solid #cbd5e0; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer;">
              Cancel
            </button>
            <div style="display: flex; gap: 0.75rem;">
              ${currentStepIndex > 0 ? `
                <button id="wz-prev" style="background: #edf2f7; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer; color: #4a5568;">
                  Back
                </button>
              ` : ''}
              <button id="wz-next" class="btn-primary" style="background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: 6px; padding: 8px 20px; font-weight: bold; cursor: pointer;">
                ${currentStepIndex === config.steps.length - 1 ? 'Finish & Unlock' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      `;

      // Cancel listener
      modal.querySelector('#wz-cancel').addEventListener('click', () => {
        modal.remove();
      });

      // Prev step listener
      const prevBtn = modal.querySelector('#wz-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          currentStepIndex--;
          renderStep();
        });
      }

      // Next / Finish step listener
      modal.querySelector('#wz-next').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          if (step.validate) {
            step.validate();
          }
          step.save(collector);

          if (currentStepIndex === config.steps.length - 1) {
            // Finish wizard execution and write data!
            modal.innerHTML = `
              <div style="background: white; border-radius: 12px; width: 100%; max-width: 400px; padding: 2.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚡</div>
                <h3 style="margin-top: 0; margin-bottom: 0.5rem; font-weight: 800;">Activating Section...</h3>
                <p style="color: #718096; font-size: 0.9rem; margin-bottom: 0;">Writing secure database parameters & syncing state...</p>
              </div>
            `;

            const mergedConfig = {
              ...configManager.current,
              ...collector
            };

            // Recursively merge sub-objects to ensure existing unrelated nested keys are not fully overwritten
            for (const [k, v] of Object.entries(collector)) {
              if (v && typeof v === 'object' && !Array.isArray(v)) {
                mergedConfig[k] = {
                  ...(configManager.current[k] || {}),
                  ...v
                };
              }
            }

            const wizardTypeToConfigKey = {
              site: 'site',
              api: 'api',
              business: 'businessProfile',
              finances: 'stripe',
              lastpass: 'lastpass',
              marketing: 'marketing',
              security: 'security',
              va: 'vaHub'
            };

            const configKey = wizardTypeToConfigKey[wizardType];
            if (configKey) {
              mergedConfig[configKey] = mergedConfig[configKey] || {};
              mergedConfig[configKey].isConfigured = true;
            }

            const success = await configManager.saveToFirebase(mergedConfig);
            if (success) {
              toast.success(`${config.title} successfully configured and unlocked!`);
              // Dispatch standard event trigger
              window.dispatchEvent(new CustomEvent('CONFIG_UPDATED', { detail: { wizardType } }));
              modal.remove();
              if (onComplete) onComplete();
            } else {
              toast.error("Wizards sync to Firebase settings document failed.");
              renderStep();
            }
          } else {
            currentStepIndex++;
            renderStep();
          }
        } catch (err) {
          toast.error(err.message);
        }
      });
    };

    document.body.appendChild(modal);
    renderStep();
  }
}
