/**
 * pages/admin/components/AdminSetupWizards.js
 * Implements interactive, step-by-step setup modals for each of the 4 master admin section wizards.
 */
import { configManager } from '../../../core/config.js';
import { toast } from '../../../utils/toast.js';
import {
  writeTempCredentialsVault,
  readTempCredentialsVault,
  deleteTempCredentialsVault
} from '../../../core/drive-upload.js';
import { contentDB } from '../../../core/db.js';
import { sendGmailNotification } from '../../../core/google-services.js';

export class AdminSetupWizards {
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
   * Launch a specific wizard modal
   * @param {string} wizardType - One of: 'section1', 'section2', 'section3', 'section4'
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
      // MASTER SECTION 1: Platform Setup & Identity Wizard
      section1: {
        title: "Section 1: Platform Setup & Identity Wizard",
        steps: [
          {
            title: "Step 1/4: Site & Brand Metadata",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure the default metadata details for the web framework identity.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Website Title:</label>
                  <input type="text" id="wz-site-title" value="Foundation Framework" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Tagline / Slogan:</label>
                  <input type="text" id="wz-site-tagline" value="A zero-build web framework" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Base Domain URL:</label>
                  <input type="url" id="wz-site-domain" value="${window.location.origin}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Meta Description:</label>
                  <textarea id="wz-site-desc" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 50px; box-sizing: border-box;">A modern experience built on zero-build principles.</textarea>
                </div>
              </div>
            `,
            validate: () => {
              const t = document.getElementById('wz-site-title')?.value;
              const d = document.getElementById('wz-site-domain')?.value;
              if (!t || !d) throw new Error("Website Title and Domain URL are required!");
            },
            save: (data) => {
              data.siteTitle = document.getElementById('wz-site-title').value;
              data.siteTagline = document.getElementById('wz-site-tagline').value;
              data.siteDomain = document.getElementById('wz-site-domain').value;
              data.siteDescription = document.getElementById('wz-site-desc').value;
              data.site = {
                companyName: document.getElementById('wz-site-title').value,
                siteName: document.getElementById('wz-site-title').value,
                isConfigured: true
              };
            }
          },
          {
            title: "Step 2/4: Business & Legal Profile",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 380px; overflow-y: auto; padding-right: 8px;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure corporate and regulatory details for legal identity.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Legal Corporate Name:</label>
                  <input type="text" id="wz-biz-name" value="Ascension Avenue Academy" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">EIN / Tax ID:</label>
                  <input type="text" id="wz-biz-ein" placeholder="12-3456789" value="12-3456789" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Headquarters Address:</label>
                  <input type="text" id="wz-biz-address" value="100 Innovation Way" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">NAICS Code:</label>
                    <input type="text" id="wz-biz-naics" value="541511" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  </div>
                  <div>
                    <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">NAICS Description:</label>
                    <input type="text" id="wz-biz-naics-def" value="Custom Computer Programming Services" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  </div>
                </div>
              </div>
            `,
            validate: () => {
              const n = document.getElementById('wz-biz-name')?.value;
              const e = document.getElementById('wz-biz-ein')?.value;
              if (!n || !e) throw new Error("Corporate Name and EIN are required!");
            },
            save: (data) => {
              data.businessProfile = {
                ...(configManager.current.businessProfile || {}),
                legalName: document.getElementById('wz-biz-name').value,
                ein: document.getElementById('wz-biz-ein').value,
                address: document.getElementById('wz-biz-address').value,
                naicsCode: document.getElementById('wz-biz-naics').value,
                naicsDefinition: document.getElementById('wz-biz-naics-def').value,
                isConfigured: true
              };
            }
          },
          {
            title: "Step 3/4: Public Profile",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure the public-facing author persona card details.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Full Author Name:</label>
                  <input type="text" id="wz-author-name" value="Jane Doe" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Professional Role / Title:</label>
                  <input type="text" id="wz-author-role" value="Lead Systems Architect" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Short Bio Teaser:</label>
                  <textarea id="wz-author-bio" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 50px; box-sizing: border-box;">Building clean, zero-build cloud web platforms.</textarea>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">GitHub Profile URL:</label>
                  <input type="url" id="wz-author-github" value="https://github.com/example" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const name = document.getElementById('wz-author-name')?.value;
              if (!name) throw new Error("Author Name is required.");
            },
            save: (data) => {
              data.author = {
                name: document.getElementById('wz-author-name').value,
                role: document.getElementById('wz-author-role').value,
                bio: document.getElementById('wz-author-bio').value,
                github: document.getElementById('wz-author-github').value
              };
            }
          },
          {
            title: "Step 4/4: API Keys & Cloud Configuration",
            html: `
              <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left; max-height: 380px; overflow-y: auto; padding-right: 8px; box-sizing: border-box;">
                <p style="font-size: 0.8rem; color: #718096; margin-bottom: 0.25rem;">Provide third-party service credentials securely to wire up platform features.</p>

                <div style="border-left: 3px solid #2b6cb0; padding-left: 6px; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #2b6cb0;">Firebase Connection:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Firebase Web API Key:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Navigate to your Firebase Console > Project Settings > General > Web API Key.</span>
                      </span>
                    </label>
                    <input type="password" id="wz-fb-key" value="AIzaSy_fb_mock_key_992" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Firebase Project ID:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Found in your Firebase Console under Project Settings > General > Project ID.</span>
                      </span>
                    </label>
                    <input type="text" id="wz-fb-project" value="demo-proj-id" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    Auth Domain:
                    <div class="tooltip-wrapper"><span class="tooltip-icon">?</span><span class="tooltip-text">Found in Firebase Console > Project Settings as 'authDomain'.</span></div>
                  </label>
                  <input type="text" id="wz-fb-auth-domain" value="demo-proj-id.firebaseapp.com" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                </div>

                <div style="border-left: 3px solid #319795; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #319795;">Google Workspace OAuth:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Google Client ID:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Visit Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs.</span>
                      </span>
                    </label>
                    <input type="text" id="wz-google-id" value="g_client_id_01" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Google Client Secret:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Obtained alongside your Google Client ID under OAuth 2.0 Credentials client configuration.</span>
                      </span>
                    </label>
                    <input type="password" id="wz-google-secret" value="g_secret_99" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    Workspace Owner Email:
                    <div class="tooltip-wrapper"><span class="tooltip-icon">?</span><span class="tooltip-text">Your primary admin Gmail or Google Workspace email address.</span></div>
                  </label>
                  <input type="email" id="wz-google-owner" value="admin@ascensionavenue.com" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                </div>

                <div style="border-left: 3px solid #805ad5; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #805ad5;">AI Integrations:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Google Gemini Key:
                      <div class="tooltip-wrapper"><span class="tooltip-icon">?</span><span class="tooltip-text">Generated in Google AI Studio > Get API Key.</span></div>
                    </label>
                    <input type="password" id="wz-gemini-key" value="gemini_api_key_101" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      OpenAI API Key:
                      <div class="tooltip-wrapper"><span class="tooltip-icon">?</span><span class="tooltip-text">Acquired in OpenAI Developer Platform > API Keys.</span></div>
                    </label>
                    <input type="password" id="wz-openai-key" value="openai_api_key_mock" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>

                <div style="border-left: 3px solid #38a169; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #38a169;">Stripe Monetization:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Stripe Publishable Key:
                      <div class="tooltip-wrapper"><span class="tooltip-icon">?</span><span class="tooltip-text">Obtained in Stripe Dashboard > Developers > API keys as 'pk_test_...'.</span></div>
                    </label>
                    <input type="text" id="wz-stripe-pub" value="pk_test_456" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Stripe Secret Key:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Find this key under your Stripe Dashboard > Developers > API Keys > Secret key.</span>
                      </span>
                    </label>
                    <input type="password" id="wz-stripe-sec" value="sk_test_123" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    Monthly Membership Price ID:
                    <span class="tooltip-wrapper">
                      <span class="tooltip-icon">?</span>
                      <span class="tooltip-text">Acquired from a Price point configured under a Subscription Product on your Stripe Dashboard > Products.</span>
                    </span>
                  </label>
                  <input type="text" id="wz-stripe-price" value="price_abc" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                </div>

                <div style="border-left: 3px solid #dd6b20; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #dd6b20;">Analytics, Security & Vault:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      GA4 Property ID:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Get this 9-digit numeric ID inside Google Analytics Admin Console > Property Settings.</span>
                      </span>
                    </label>
                    <input type="text" id="wz-ga4-property" value="987654321" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      VirusTotal API Key:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Available in your VirusTotal profile menu dropdown under API Key section.</span>
                      </span>
                    </label>
                    <input type="password" id="wz-vt-key" value="vt_api_mock_token" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    LastPass Provisioning Key:
                    <div class="tooltip-wrapper"><span class="tooltip-icon">?</span><span class="tooltip-text">Acquired in LastPass Admin Console > User Provisioning > API Tokens.</span></div>
                  </label>
                  <input type="password" id="wz-lp-hash" value="lp_provision_mock_hash_11" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                </div>

                <div style="border-left: 3px solid #e53e3e; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #e53e3e;">Cloudflare Deployment:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Cloudflare Zone ID:
                      <span class="tooltip-wrapper">
                        <span class="tooltip-icon">?</span>
                        <span class="tooltip-text">Retrieve from Cloudflare Dashboard domain overview sidebar.</span>
                      </span>
                    </label>
                    <input type="text" id="wz-cf-zone" value="zone_123_abc" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                      Pages Deployment URL:
                      <div class="tooltip-wrapper"><span class="tooltip-icon">?</span><span class="tooltip-text">Your live site origin or Cloudflare Pages project domain.</span></div>
                    </label>
                    <input type="url" id="wz-cf-pages" value="${window.location.origin}" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    Cloudflare Worker API Key:
                    <span class="tooltip-wrapper">
                      <span class="tooltip-icon">?</span>
                      <span class="tooltip-text">Generate a custom Cloudflare Worker API token in My Profile > API Tokens.</span>
                    </span>
                  </label>
                  <input type="password" id="wz-cf-key" value="cf_worker_mock_secret" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                </div>
              </div>
            `,
            validate: () => {
              const inputs = ['wz-fb-key', 'wz-fb-project', 'wz-google-id', 'wz-google-secret', 'wz-stripe-sec', 'wz-stripe-pub', 'wz-stripe-price', 'wz-vt-key', 'wz-lp-hash'];
              inputs.forEach(id => {
                if (!document.getElementById(id)?.value) {
                  throw new Error(`The key input "${id.replace('wz-', '').toUpperCase()}" is required.`);
                }
              });
            },
            save: (data) => {
              data.firebase = {
                apiKey: document.getElementById('wz-fb-key').value,
                projectId: document.getElementById('wz-fb-project').value,
                authDomain: document.getElementById('wz-fb-auth-domain').value,
                databaseRulesInitialized: true
              };
              data.google = {
                clientId: document.getElementById('wz-google-id').value,
                clientSecret: document.getElementById('wz-google-secret').value,
                ownerEmail: document.getElementById('wz-google-owner').value,
                consentScreenCompleted: true
              };
              data.aiConfig = {
                geminiApiKey: document.getElementById('wz-gemini-key').value,
                openaiApiKey: document.getElementById('wz-openai-key').value,
                preferredProvider: "gemini"
              };
              data.stripe = {
                ...(configManager.current.stripe || {}),
                secretKey: document.getElementById('wz-stripe-sec').value,
                publishableKey: document.getElementById('wz-stripe-pub').value,
                priceId: document.getElementById('wz-stripe-price').value,
                achFee: 500,
                enableAch: true,
                isConfigured: true
              };
              data.thirdParty = {
                ...(configManager.current.thirdParty || {}),
                ga4PropertyId: document.getElementById('wz-ga4-property').value
              };
              data.virustotal = {
                apiKey: document.getElementById('wz-vt-key').value
              };
              data.lastpass = {
                ...(configManager.current.lastpass || {}),
                provisioningHash: document.getElementById('wz-lp-hash').value,
                apiEndpoint: "https://lastpass.com/enterprise/api.php",
                isConfigured: true
              };
              data.cloudflare = {
                ...(configManager.current.cloudflare || {}),
                zoneId: document.getElementById('wz-cf-zone').value,
                pagesUrl: document.getElementById('wz-cf-pages').value,
                workerApiKey: document.getElementById('wz-cf-key').value,
                wranglerValidated: true
              };
              data.isInstalled = true;
              data.adminEmails = [document.getElementById('wz-google-owner')?.value || "admin@example.com"];
            }
          }
        ]
      },

      // MASTER SECTION 2: Business Operations Wizard
      section2: {
        title: "Section 2: Business Operations Wizard",
        steps: [
          {
            title: "Step 1/3: Ticketing & Product Pricing Defaults",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096;">Configure baseline parameters for ticketing and digital product listings.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Standard Event Ticket Price ($):</label>
                  <input type="number" id="wz-default-ticket-price" value="99.00" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Ticket Capacity:</label>
                  <input type="number" id="wz-default-ticket-capacity" value="100" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Product Base Price ($):</label>
                  <input type="number" id="wz-default-product-price" value="29.00" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Pricing Currency:</label>
                  <select id="wz-default-currency" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
              </div>
            `,
            validate: () => {
              const pr = document.getElementById('wz-default-ticket-price')?.value;
              if (!pr) throw new Error("Baseline pricing parameters are required.");
            },
            save: (data) => {
              data.businessDefaults = {
                defaultTicketPrice: Number(document.getElementById('wz-default-ticket-price').value),
                defaultTicketCapacity: Number(document.getElementById('wz-default-ticket-capacity').value),
                defaultProductPrice: Number(document.getElementById('wz-default-product-price').value),
                defaultCurrency: document.getElementById('wz-default-currency').value
              };
            }
          },
          {
            title: "Step 2/3: Finances & Payroll Options",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure flat fees and default contractor pay options. The ACH payment path enforces a flat $5.00 application fee parameter by default.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Flat ACH App Fee ($):</label>
                  <input type="number" id="wz-finances-ach-fee" value="5.00" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default VA Pay Structure:</label>
                  <select id="wz-default-pay-structure" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="hourly">Hourly Rate</option>
                    <option value="salary">Fixed Salary</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Payroll Frequency:</label>
                  <select id="wz-default-pay-frequency" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-weekly" selected>Bi-weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Disbursement Method:</label>
                  <select id="wz-default-pay-method" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="ACH">ACH Direct Deposit</option>
                    <option value="Check">Company Check</option>
                    <option value="Direct">Direct Wire</option>
                  </select>
                </div>
              </div>
            `,
            validate: () => {
              const fee = document.getElementById('wz-finances-ach-fee')?.value;
              if (!fee) throw new Error("ACH application fee threshold parameter is required.");
            },
            save: (data) => {
              data.stripe = {
                ...(configManager.current.stripe || {}),
                achFee: Math.round(parseFloat(document.getElementById('wz-finances-ach-fee').value) * 100),
                enableAch: true,
                isConfigured: true
              };
              data.payrollDefaults = {
                payStructure: document.getElementById('wz-default-pay-structure').value,
                frequency: document.getElementById('wz-default-pay-frequency').value,
                disbursementMethod: document.getElementById('wz-default-pay-method').value
              };
            }
          },
          {
            title: "Step 3/3: OnlineJobs.ph & VA Hub credentials",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure the active Virtual Assistant job pipeline credentials.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OnlineJobs.ph API / Pipeline ID:</label>
                  <input type="text" id="wz-va-pipe" value="pipeline_1234_demo" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">VA Integration Key:</label>
                  <input type="password" id="wz-va-key" value="va_api_mock_secret_key" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">VA welcome Email Template:</label>
                  <textarea id="wz-va-template" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 50px; box-sizing: border-box;">Welcome to our team! Please complete your onboarding...</textarea>
                </div>
              </div>
            `,
            validate: () => {
              const pipe = document.getElementById('wz-va-pipe')?.value;
              const k = document.getElementById('wz-va-key')?.value;
              if (!pipe || !k) throw new Error("Pipeline ID and VA Integration Key are required.");
            },
            save: (data) => {
              data.vaHub = {
                apiKey: document.getElementById('wz-va-key').value,
                pipelineId: document.getElementById('wz-va-pipe').value,
                onboardingTemplate: document.getElementById('wz-va-template').value,
                welcomeEmailSubject: "Welcome to the Team!",
                isConfigured: true
              };
            }
          }
        ]
      },

      // MASTER SECTION 3: Growth & Marketing Wizard
      section3: {
        title: "Section 3: Growth & Marketing Wizard",
        steps: [
          {
            title: "Step 1/2: Kanban, Lead Scoring & SMTP Defaults",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096;">Establish workspace Kanban columns, Gmail dispatcher defaults, and Lead Scoring parameters.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Standard Kanban Columns:</label>
                  <input type="text" id="wz-kanban-cols" value="Backlog, In Progress, Review, Completed" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Gmail/SMTP Sender:</label>
                  <input type="email" id="wz-mkt-sender" value="newsletter@yourdomain.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Sender Alias:</label>
                  <input type="text" id="wz-mkt-alias" value="Notification System" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Dittofeed Lead Scoring Threshold:</label>
                  <input type="number" id="wz-lead-score-threshold" value="50" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const s = document.getElementById('wz-mkt-sender')?.value;
              if (!s) throw new Error("Default SMTP sender is required.");
            },
            save: (data) => {
              data.marketing = {
                gmailSender: document.getElementById('wz-mkt-sender').value,
                defaultSenderAlias: document.getElementById('wz-mkt-alias').value,
                defaultDelay: 24,
                defaultTrigger: "user_signup",
                leadScoreThreshold: Number(document.getElementById('wz-lead-score-threshold').value),
                isConfigured: true
              };
              data.kanbanDefaults = {
                columns: document.getElementById('wz-kanban-cols').value.split(',').map(c => c.trim()).filter(Boolean)
              };
            }
          },
          {
            title: "Step 2/2: AI Chatbot & Telephony Setup",
            html: `
              <div style="display: flex; flex-direction: column; gap: 0.75rem; text-align: left; max-height: 380px; overflow-y: auto; padding-right: 8px;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.25rem;">Configure the support chatbot persona parameters and Telnyx/Twilio phone credentials.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.15rem;">Chatbot Welcoming Greeting Message:</label>
                  <input type="text" id="wz-mkt-chat-welcome" value="Hello! How can I help you today?" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.15rem;">Chatbot AI System Prompt:</label>
                  <textarea id="wz-mkt-chat-prompt" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 40px; box-sizing: border-box;">You are a helpful customer support agent.</textarea>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.15rem;">Voice Welcome Message Speech:</label>
                  <input type="text" id="wz-chat-voice-welcome" value="Thank you for calling Foundation support. How can I help you today?" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600;">Telnyx Phone Number:</label>
                    <input type="text" id="wz-chat-telnyx-num" value="+18005550199" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                  <div>
                    <label style="font-size: 0.8rem; font-weight: 600;">Twilio Phone Number:</label>
                    <input type="text" id="wz-chat-twilio-num" value="+18005550100" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.15rem; margin-top: 0.5rem;">Dispatch Test Verification Email To:</label>
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="email" id="wz-mkt-test-email" placeholder="test@example.com" style="flex: 1; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                    <button type="button" id="btn-wz-test-email" style="
                      padding: 6px 12px;
                      background: var(--theme-color-accent, #38a169);
                      color: white;
                      border: none;
                      border-radius: 4px;
                      font-weight: bold;
                      cursor: pointer;
                    ">Verify Email Dispatch</button>
                  </div>
                </div>
              </div>
            `,
            validate: () => {
              const w = document.getElementById('wz-mkt-chat-welcome')?.value;
              if (!w) throw new Error("Chatbot welcome greeting is required.");
            },
            save: (data) => {
              data.chatbot = {
                ...(configManager.current.chatbot || {}),
                enabled: true,
                welcomeMessage: document.getElementById('wz-mkt-chat-welcome').value,
                systemPrompt: document.getElementById('wz-mkt-chat-prompt').value,
                voiceWelcomeMessage: document.getElementById('wz-chat-voice-welcome').value,
                telnyxPhoneNumber: document.getElementById('wz-chat-telnyx-num').value,
                twilioPhoneNumber: document.getElementById('wz-chat-twilio-num').value
              };
            }
          }
        ]
      },

      // MASTER SECTION 4: Platform Operations Wizard
      section4: {
        title: "Section 4: Platform Operations Wizard",
        steps: [
          {
            title: "Step 1/2: OWASP ZAP Scanner Settings",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure the active OWASP ZAP daemon scanning credentials.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OWASP ZAP Base URL:</label>
                  <input type="url" id="wz-sec-zap-url" value="https://wwtesw.zaproxy.org" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OWASP ZAP API Key:</label>
                  <input type="password" id="wz-sec-zap-key" value="zap_api_mock_token_991" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <button type="button" id="btn-wz-test-zap" style="
                    padding: 8px 16px;
                    background: var(--theme-color-accent, #38a169);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 0.85rem;
                  ">
                    Test ZAP REST API Connection
                  </button>
                  <div id="wz-zap-feedback" style="display: none; font-size: 0.8rem; margin-top: 4px; font-weight: bold;"></div>
                </div>
              </div>
            `,
            validate: () => {
              const url = document.getElementById('wz-sec-zap-url')?.value;
              const k = document.getElementById('wz-sec-zap-key')?.value;
              if (!url || !k) throw new Error("ZAP URL and ZAP API Key are required!");
            },
            save: (data) => {
              data.security = {
                ...(configManager.current.security || {}),
                zapApiUrl: document.getElementById('wz-sec-zap-url').value,
                zapApiKey: document.getElementById('wz-sec-zap-key').value,
                isConfigured: true
              };
            }
          },
          {
            title: "Step 2/2: Threat Rules & Lighthouse Thresholds",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Set automated scanning triggers and PageSpeed core performance thresholds.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Automated Background Scanner:</label>
                  <select id="wz-vt-auto-scan" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="true">Enabled (Automated monthly background scans)</option>
                    <option value="false">Disabled (Manual trigger only)</option>
                  </select>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div>
                    <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Lighthouse Perf Target:</label>
                    <input type="number" id="wz-lh-perf-target" value="95" min="0" max="100" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  </div>
                  <div>
                    <label style="display: block; font-weight: bold; font-size: 0.85rem; margin-bottom: 0.25rem;">Lighthouse Access Target:</label>
                    <input type="number" id="wz-lh-access-target" value="95" min="0" max="100" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  </div>
                </div>
              </div>
            `,
            validate: () => {
              const p = document.getElementById('wz-lh-perf-target')?.value;
              if (!p) throw new Error("Lighthouse target thresholds are required.");
            },
            save: (data) => {
              data.security = {
                ...(configManager.current.security || {}),
                monthlyScanEnabled: document.getElementById('wz-vt-auto-scan').value === "true"
              };
              data.performanceDefaults = {
                perfTarget: Number(document.getElementById('wz-lh-perf-target').value),
                accessTarget: Number(document.getElementById('wz-lh-access-target').value)
              };
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

      // Bind Test Email click event for Section 3 Step 2
      const testEmailBtn = modal.querySelector('#btn-wz-test-email');
      if (testEmailBtn) {
        testEmailBtn.onclick = async () => {
          const testEmail = modal.querySelector('#wz-mkt-test-email').value;
          if (!testEmail) {
            toast.warning('Please input a test recipient email.');
            return;
          }
          testEmailBtn.textContent = 'Sending...';
          try {
            const success = await sendGmailNotification({
              toEmail: testEmail,
              subject: "Workspace Verification - Sample Test Email",
              messageBody: "Congratulations, the Section 3 Growth & Marketing setup wizard connections are verified!"
            });
            if (success) {
              toast.success(`Verified: Test welcome email dispatched safely to ${testEmail}!`);
            } else {
              toast.warning('Test dispatch registered. Save report or login to complete.');
            }
          } catch (e) {
            toast.error('Dispatch failed: ' + e.message);
          } finally {
            testEmailBtn.textContent = 'Verify Email Dispatch';
          }
        };
      }

      // Bind Test ZAP REST API Connection
      const testZapBtn = modal.querySelector('#btn-wz-test-zap');
      if (testZapBtn) {
        testZapBtn.onclick = async () => {
          const url = modal.querySelector('#wz-sec-zap-url').value;
          const key = modal.querySelector('#wz-sec-zap-key').value;
          const fb = modal.querySelector('#wz-zap-feedback');
          if (fb) {
            fb.style.display = 'block';
            fb.style.color = '#2b6cb0';
            fb.textContent = 'Testing connection...';
          }
          try {
            const res = await fetch('/api/zap-scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'test-connection', baseUrl: url, apiKey: key })
            });
            const d = await res.json();
            if (fb) {
              if (d.success) {
                fb.style.color = '#38a169';
                fb.textContent = `Success: ZAP Daemon online. (Version: ${d.version})`;
              } else {
                fb.style.color = '#e53e3e';
                fb.textContent = `Offline: ${d.error || 'Connection failed'}`;
              }
            }
          } catch (e) {
            if (fb) {
              fb.style.color = '#e53e3e';
              fb.textContent = 'Failed: Proxy scan service offline.';
            }
          }
        };
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

            mergedConfig.sectionWizards = mergedConfig.sectionWizards || {};
            mergedConfig.sectionWizards[wizardType] = true;

            const success = await configManager.saveToFirebase(mergedConfig);
            if (success) {
              // TEMPORARY SECRET STORAGE VAULT FLOW (Section 1 completed)
              if (wizardType === 'section1') {
                try {
                  const tempCreds = {
                    google: mergedConfig.google || {},
                    firebase: mergedConfig.firebase || {},
                    cloudflare: mergedConfig.cloudflare || {},
                    timestamp: new Date().toISOString()
                  };
                  await writeTempCredentialsVault(tempCreds);
                  toast.success("Credentials temporarily stored in private encrypted vault on Google Drive.");
                } catch (e) {
                  console.warn("Failed to write to temporary Google Drive credentials file:", e);
                }
              }

              // LASTPASS CONFIGURATION RECOVERY FLOW (Section 2 completed: now we can move temp creds to LP)
              if (wizardType === 'section2') {
                try {
                  const tempCreds = await readTempCredentialsVault();
                  if (tempCreds) {
                    // Push all keys, secrets, and passwords into LastPass secure notes or database credentials
                    const googleCred = {
                      id: `cred_google_oauth_${Date.now()}`,
                      serviceName: "Google Workspace Admin OAuth",
                      loginUrl: "https://console.cloud.google.com/apis/credentials",
                      username: tempCreds.google?.ownerEmail || "admin@example.com",
                      encryptedPassKey: tempCreds.google?.clientSecret || "N/A",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    const firebaseCred = {
                      id: `cred_firebase_web_${Date.now()}`,
                      serviceName: "Firebase Web Project ID / Auth Domain",
                      loginUrl: "https://console.firebase.google.com",
                      username: tempCreds.firebase?.projectId || "N/A",
                      encryptedPassKey: tempCreds.firebase?.apiKey || "N/A",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    const cloudflareCred = {
                      id: `cred_cloudflare_worker_${Date.now()}`,
                      serviceName: "Cloudflare Zone ID & Pages",
                      loginUrl: tempCreds.cloudflare?.pagesUrl || "https://dash.cloudflare.com",
                      username: tempCreds.cloudflare?.zoneId || "N/A",
                      encryptedPassKey: tempCreds.cloudflare?.workerApiKey || "N/A",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };

                    await contentDB.saveVaultCredential(googleCred);
                    await contentDB.saveVaultCredential(firebaseCred);
                    await contentDB.saveVaultCredential(cloudflareCred);

                    toast.success("Pushing temporary credentials to secure LastPass Vault complete!");

                    // Permanently delete the temporary file and purge caches
                    await deleteTempCredentialsVault();
                    toast.success("Temporary credential cache permanently purged from Google Drive corporate-binder.");
                  }
                } catch (e) {
                  console.warn("Failed to complete temporary credentials LastPass sync flow:", e);
                }
              }

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
