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
import { FRAMEWORK_AFFILIATES } from '../../../core/affiliates.js';

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
            title: "Step 4/5: API Keys & Cloud Configuration",
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

                <div style="border-left: 3px solid #319795; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #319795; display: flex; justify-content: space-between; align-items: center;">
                  <span>Google Workspace OAuth:</span>
                  <a href="${FRAMEWORK_AFFILIATES.googleWorkspace.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #2b6cb0; text-decoration: underline; font-weight: bold;">Visit Google Workspace Console</a>
                </div>
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

                <div style="border-left: 3px solid #38a169; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #38a169; display: flex; justify-content: space-between; align-items: center;">
                  <span>Stripe Monetization:</span>
                  <a href="${FRAMEWORK_AFFILIATES.stripe.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #38a169; text-decoration: underline; font-weight: bold;">Set up Stripe Dashboard</a>
                </div>
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
                    <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; width: 100%; justify-content: space-between;">
                      <span>VirusTotal API Key:</span>
                      <a href="${FRAMEWORK_AFFILIATES.virusTotal.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.7rem; color: #2b6cb0; text-decoration: underline; font-weight: bold;">Get VirusTotal API Key</a>
                    </label>
                    <input type="password" id="wz-vt-key" value="vt_api_mock_token" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                  </div>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; width: 100%; justify-content: space-between;">
                    <span>LastPass Provisioning Key:</span>
                    <a href="${FRAMEWORK_AFFILIATES.lastpass.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.7rem; color: #2b6cb0; text-decoration: underline; font-weight: bold;">Get LastPass Key</a>
                  </label>
                  <input type="password" id="wz-lp-hash" value="lp_provision_mock_hash_11" required style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
                </div>

                <div style="border-left: 3px solid #e53e3e; padding-left: 6px; margin-top: 0.5rem; margin-bottom: 0.25rem; font-weight: bold; font-size: 0.85rem; color: #e53e3e; display: flex; justify-content: space-between; align-items: center;">
                  <span>Cloudflare Deployment:</span>
                  <a href="${FRAMEWORK_AFFILIATES.cloudflare.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #e53e3e; text-decoration: underline; font-weight: bold;">Deploy Cloudflare</a>
                </div>
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
          },
          {
            title: "Step 5/5: Analytics & SEO Engine",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 380px; overflow-y: auto; padding-right: 8px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="font-weight: 800; font-size: 1rem; color: var(--theme-color-primary, #2b6cb0);">Google Analytics & Search Console Setup</span>
                  <a href="${FRAMEWORK_AFFILIATES.googleAnalytics.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; background: #e6fffa; color: #319795; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-decoration: none; border: 1px solid #b2f5ea; display: inline-flex; align-items: center; gap: 4px;">
                    Powered by Google Analytics
                  </a>
                </div>

                <div style="border-left: 3px solid #2b6cb0; padding-left: 6px; margin-bottom: 0.5rem; font-weight: bold; font-size: 0.85rem; color: #2b6cb0;">Step 1: Google Search Console (GSC) Domain Setup</div>
                <div style="background: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 10px; font-size: 0.8rem; color: #4a5568; line-height: 1.5; margin-bottom: 0.75rem;">
                  <strong>Domain Ownership Verification & Page Indexing Guide:</strong>
                  <ol style="margin: 4px 0 0 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 4px;">
                    <li>Add your base domain as a property inside your <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" style="color: #2b6cb0; text-decoration: underline; font-weight: bold;">Google Search Console Dashboard</a>.</li>
                    <li>Copy the TXT verification record and insert it into your DNS records (Cloudflare Pages settings or domain registrar). Click <strong>Verify</strong>.</li>
                    <li>Submit your sitemap at: <code>https://yourdomain.com/sitemap.xml</code>. This allows Google and AI crawlers to fully index your GrapesJS and CMS custom routes.</li>
                  </ol>
                </div>

                <div style="border-left: 3px solid #38a169; padding-left: 6px; margin-bottom: 0.5rem; font-weight: bold; font-size: 0.85rem; color: #38a169;">Step 2: Google Analytics 4 (GA4) Measurement ID</div>
                <div>
                  <label style="font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 0.25rem;">
                    GA4 Measurement ID (G-XXXXXXXXXX):
                    <span class="tooltip-wrapper">
                      <span class="tooltip-icon">?</span>
                      <span class="tooltip-text">Create a GA4 Property, navigate to Admin -> Data Streams -> Web, and copy the Measurement ID matching 'G-XXXXXXXXXX'.</span>
                    </span>
                  </label>
                  <input type="text" id="wz-ga4-measurement-id" value="${configManager.current.analytics?.googleAnalyticsId || ''}" placeholder="G-XXXXXXXXXX" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  <span style="font-size: 0.75rem; color: #a0aec0; display: block; margin-top: 2px;">Used to dynamically inject GA4 gtag tracking scripts for virtual pageviews & ecommerce metrics.</span>
                </div>
              </div>
            `,
            validate: () => {
              const id = document.getElementById('wz-ga4-measurement-id')?.value;
              if (!id) throw new Error("GA4 Measurement ID is required to wire up routing event logs.");
            },
            save: (data) => {
              data.analytics = {
                googleAnalyticsId: document.getElementById('wz-ga4-measurement-id').value
              };
            }
          }
        ]
      },

      // MASTER SECTION 2: Business Operations Wizard
      section2: {
        title: "Section 2: Business Operations Wizard",
        steps: [
          {
            title: "Step 1/4: Ticketing & Product Pricing Defaults",
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
            title: "Step 2/4: Finances & Payroll Options",
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
            title: "Step 3/4: Outbound Payroll & Payouts",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="font-weight: 800; font-size: 1rem; color: var(--theme-color-primary, #2b6cb0);">Wise Business International Payroll Engine</span>
                  <a href="${FRAMEWORK_AFFILIATES.wise.url}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; background: #e6fffa; color: #319795; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-decoration: none; border: 1px solid #b2f5ea; display: inline-flex; align-items: center; gap: 4px;">
                    Powered by Wise
                  </a>
                </div>
                <p style="font-size: 0.825rem; color: #718096; margin: 0 0 0.5rem 0; line-height: 1.4;">Zero-fee cross-border contractor payouts processed directly from your Wise USD balance at true mid-market exchange rates.</p>

                <div>
                  <label style="font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 0.25rem;">
                    Wise API Token:
                    <span class="tooltip-wrapper">
                      <span class="tooltip-icon">?</span>
                      <span class="tooltip-text">Generate an API token inside your Wise Business Dashboard under Settings -> API Tokens. Select 'Full Access' or 'Payout Access'.</span>
                    </span>
                  </label>
                  <input type="password" id="wz-wise-key" value="${configManager.current.wise?.apiKey || ''}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  <span style="font-size: 0.75rem; color: #a0aec0; display: block; margin-top: 2px;">Used to authenticate zero-fee cross-border payouts directly from your Wise USD balance.</span>
                </div>

                <div>
                  <label style="font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 0.25rem;">
                    Profile ID:
                    <span class="tooltip-wrapper">
                      <span class="tooltip-icon">?</span>
                      <span class="tooltip-text">Found under your Wise Account Details or automatically fetched when your API token is verified.</span>
                    </span>
                  </label>
                  <input type="text" id="wz-wise-profile" value="${configManager.current.wise?.profileId || ''}" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  <span style="font-size: 0.75rem; color: #a0aec0; display: block; margin-top: 2px;">Your Wise Business Account ID.</span>
                </div>

                <div>
                  <label style="font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 0.25rem;">
                    Environment Mode:
                  </label>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="wz-wise-sandbox" ${configManager.current.wise?.sandbox !== false ? 'checked' : ''} style="cursor: pointer;" />
                    <span style="font-size: 0.85rem; font-weight: 500;">Sandbox / Test Mode (Uncheck for Live Mode)</span>
                  </div>
                  <span style="font-size: 0.75rem; color: #a0aec0; display: block; margin-top: 2px;">Switch between Wise Live Production API and Sandbox testing.</span>
                </div>

                <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 8px;">
                  <button type="button" id="btn-wz-verify-wise" style="
                    padding: 6px 12px;
                    background: var(--theme-color-accent, #38a169);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 0.85rem;
                  ">Verify API Token & Fetch Profile ID</button>
                  <span id="wise-verify-feedback" style="display: none; font-size: 0.8rem; font-weight: bold;"></span>
                </div>
              </div>
            `,
            validate: () => {
              const k = document.getElementById('wz-wise-key')?.value;
              if (!k) throw new Error("Wise API Token is required.");
            },
            save: (data) => {
              data.wise = {
                apiKey: document.getElementById('wz-wise-key').value,
                profileId: document.getElementById('wz-wise-profile').value,
                sandbox: document.getElementById('wz-wise-sandbox').checked
              };
            }
          },
          {
            title: "Step 4/4: OnlineJobs.ph & VA Hub credentials",
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
            title: "Step 1/3: Kanban, Lead Scoring & SMTP Defaults",
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
            title: "Step 2/3: AI Chatbot & Telephony Setup",
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
          },
          {
            title: "Step 3/3: Onboard Employee #1 (Gemini Spark)",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left; max-height: 380px; overflow-y: auto; padding-right: 8px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
                  <span style="font-weight: 800; font-size: 1rem; color: var(--theme-color-primary, #2b6cb0);">Gemini Spark Onboarding</span>
                  <a href="${FRAMEWORK_AFFILIATES.geminiSpark?.url || 'https://ai.google.dev/'}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; background: #e6fffa; color: #319795; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-decoration: none; border: 1px solid #b2f5ea; display: inline-flex; align-items: center; gap: 4px;">
                    Powered by Gemini Spark
                  </a>
                </div>
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">
                  Configure permissions and capabilities for Gemini Spark, your Admin's Right-Hand Chief Operating Agent.
                </p>

                <div>
                  <label style="font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 0.25rem;">
                    Gemini API Key:
                    <span class="tooltip-wrapper">
                      <span class="tooltip-icon">?</span>
                      <span class="tooltip-text">Gemini Spark acts as your 24/7 Chief Operating Officer. It monitors background metrics, drafts financial transactions, and alerts you when critical approvals are needed.</span>
                    </span>
                  </label>
                  <input type="password" id="wz-spark-key" value="${configManager.current.geminiSpark?.apiKey || 'gemini_spark_mock_api_key_882'}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>

                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Work Shift Frequency:</label>
                  <select id="wz-spark-frequency" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="Continuous 24/7" ${configManager.current.geminiSpark?.frequency === 'Continuous 24/7' ? 'selected' : ''}>Continuous 24/7</option>
                    <option value="Hourly" ${configManager.current.geminiSpark?.frequency === 'Hourly' ? 'selected' : ''}>Hourly</option>
                    <option value="Daily Audit" ${configManager.current.geminiSpark?.frequency === 'Daily Audit' || !configManager.current.geminiSpark?.frequency ? 'selected' : ''}>Daily Audit</option>
                  </select>
                </div>

                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Agent Autonomy Mode:</label>
                  <select id="wz-spark-autonomy" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                    <option value="Strict Approval Mode" ${configManager.current.geminiSpark?.autonomyMode === 'Strict Approval Mode' || !configManager.current.geminiSpark?.autonomyMode ? 'selected' : ''}>Strict Approval Mode</option>
                    <option value="Semi-Autonomous" ${configManager.current.geminiSpark?.autonomyMode === 'Semi-Autonomous' ? 'selected' : ''}>Semi-Autonomous</option>
                  </select>
                </div>

                <div style="margin-top: 0.5rem;">
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem;">Interactive Permissions Toggle Grid:</label>
                  <div style="display: flex; flex-direction: column; gap: 0.5rem; background: #f7fafc; padding: 10px; border-radius: 6px; border: 1px solid #edf2f7;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                      <input type="checkbox" id="wz-spark-p-wise" ${configManager.current.geminiSpark?.permissions?.draftWisePayrolls !== false ? 'checked' : ''} />
                      Allow Spark to draft Wise VA Payrolls
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                      <input type="checkbox" id="wz-spark-p-inventory" ${configManager.current.geminiSpark?.permissions?.monitorInventory !== false ? 'checked' : ''} />
                      Allow Spark to monitor physical product inventory
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                      <input type="checkbox" id="wz-spark-p-hipaa" ${configManager.current.geminiSpark?.permissions?.reviewHipaaLogs !== false ? 'checked' : ''} />
                      Allow Spark to review HIPAA logs daily
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                      <input type="checkbox" id="wz-spark-p-autoapprove" ${configManager.current.geminiSpark?.permissions?.autoApproveNonFinancial === true ? 'checked' : ''} />
                      Allow Spark to auto-approve non-financial actions
                    </label>
                  </div>
                </div>
              </div>
            `,
            validate: () => {
              const k = document.getElementById('wz-spark-key')?.value;
              if (!k) throw new Error("Gemini API Key is required for Gemini Spark onboarding.");
            },
            save: (data) => {
              data.geminiSpark = {
                apiKey: document.getElementById('wz-spark-key').value,
                frequency: document.getElementById('wz-spark-frequency').value,
                autonomyMode: document.getElementById('wz-spark-autonomy').value,
                permissions: {
                  draftWisePayrolls: document.getElementById('wz-spark-p-wise').checked,
                  monitorInventory: document.getElementById('wz-spark-p-inventory').checked,
                  reviewHipaaLogs: document.getElementById('wz-spark-p-hipaa').checked,
                  autoApproveNonFinancial: document.getElementById('wz-spark-p-autoapprove').checked
                }
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

      // Bind Wise Profile ID verification click event
      const verifyWiseBtn = modal.querySelector('#btn-wz-verify-wise');
      if (verifyWiseBtn) {
        verifyWiseBtn.onclick = async () => {
          const keyInput = modal.querySelector('#wz-wise-key');
          const profileInput = modal.querySelector('#wz-wise-profile');
          const sandboxCheckbox = modal.querySelector('#wz-wise-sandbox');
          const fb = modal.querySelector('#wise-verify-feedback');

          if (!keyInput || !keyInput.value) {
            toast.warning('Please input a Wise API Token.');
            return;
          }

          verifyWiseBtn.textContent = 'Verifying...';
          if (fb) {
            fb.style.display = 'inline';
            fb.style.color = '#2b6cb0';
            fb.textContent = 'Verifying token...';
          }

          // Dynamically set temp wise config for the API call to work
          const originalWise = configManager.current.wise || {};
          configManager.current.wise = {
            apiKey: keyInput.value,
            sandbox: sandboxCheckbox ? sandboxCheckbox.checked : true
          };

          try {
            const { getWiseProfile } = await import('../../../utils/backend-wise.js');
            const profile = await getWiseProfile();
            if (profile && profile.id) {
              if (profileInput) {
                profileInput.value = profile.id;
              }
              if (fb) {
                fb.style.color = '#38a169';
                fb.textContent = `Verified! Profile ID: ${profile.id}`;
              }
              toast.success(`Wise API Connection verified successfully! Auto-populated Profile ID: ${profile.id}`);
            } else {
              throw new Error('No profile data returned');
            }
          } catch (e) {
            if (fb) {
              fb.style.color = '#e53e3e';
              fb.textContent = 'Verification failed';
            }
            toast.error('Wise verification failed: ' + e.message);
          } finally {
            verifyWiseBtn.textContent = 'Verify API Token & Fetch Profile ID';
            // Restore config just in case
            configManager.current.wise = originalWise;
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

  /**
   * Launch a wizard modal specifically for default page overrides (home, about, events, contact)
   * @param {string} pageId - One of: 'home', 'about', 'events', 'contact'
   * @param {Function} onComplete - Callback executed upon successful setup completion
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
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Hero Headline:</label>
            <input type="text" id="wz-home-headline" value="${prefilledHeadline}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Hero Sub-headline:</label>
            <input type="text" id="wz-home-subheadline" value="${prefilledSubheadline}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Banner Background Image URL:</label>
            <input type="url" id="wz-home-bg" value="${prefilledBg}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Featured Section Order (comma separated):</label>
            <input type="text" id="wz-home-sections" value="${prefilledSections}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Primary CTA Buttons (comma separated):</label>
            <input type="text" id="wz-home-cta" value="${prefilledCta}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
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
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Founder/Team Story:</label>
            <textarea id="wz-about-story" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 80px; box-sizing: border-box;">${prefilledFounderStory}</textarea>
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Mission Statement:</label>
            <input type="text" id="wz-about-mission" value="${prefilledMission}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Milestones Timeline (comma separated Year:Event):</label>
            <input type="text" id="wz-about-timeline" value="${prefilledTimeline}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Executive Bio:</label>
            <textarea id="wz-about-bio" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 80px; box-sizing: border-box;">${prefilledBio}</textarea>
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
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Event Header Copy:</label>
            <input type="text" id="wz-events-header" value="${prefilledHeaderCopy}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Ticket Terms:</label>
            <input type="text" id="wz-events-terms" value="${prefilledTicketTerms}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Refund Policy:</label>
            <textarea id="wz-events-refund" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 60px; box-sizing: border-box;">${prefilledRefundPolicy}</textarea>
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Vendor Space Notices:</label>
            <textarea id="wz-events-vendor-notice" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 60px; box-sizing: border-box;">${prefilledVendorNotice}</textarea>
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

            <!-- Dynamic Event Interactive Registration Panel / Modal -->
            <div id="booking-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000; justify-content: center; align-items: center; padding: 1.5rem;">
              <div style="background: var(--theme-color-surface, #ffffff); border-radius: 12px; width: 100%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--theme-color-border, #e2e8f0); background: var(--theme-color-background, #f7fafc); border-radius: 12px 12px 0 0;">
                  <div>
                    <h2 id="modal-event-title" style="margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c);">Event Registration</h2>
                    <p id="modal-event-date" style="margin: 0.25rem 0 0 0; font-size: 0.9rem; color: var(--theme-color-primary, #2b6cb0); font-weight: bold;"></p>
                  </div>
                  <button id="btn-close-booking" style="background: transparent; border: none; font-size: 2rem; line-height: 1; cursor: pointer; color: var(--theme-color-text-secondary, #a0aec0);">&times;</button>
                </div>
                <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 2rem;">
                  <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--theme-color-border, #e2e8f0); padding-bottom: 0.25rem;">
                    <button class="booking-tab-btn active" data-tab="tickets" style="padding: 10px 16px; font-weight: bold; font-size: 0.95rem; cursor: pointer; border: none; background: transparent; color: var(--theme-color-primary, #2b6cb0); border-bottom: 3px solid var(--theme-color-primary, #2b6cb0);">1. Select Tickets</button>
                    <button class="booking-tab-btn" data-tab="vendors" style="padding: 10px 16px; font-weight: bold; font-size: 0.95rem; cursor: pointer; border: none; background: transparent; color: var(--theme-color-text-secondary, #4a5568); border-bottom: 3px solid transparent;">2. Vendor Spaces</button>
                    <button class="booking-tab-btn" data-tab="sponsors" style="padding: 10px 16px; font-weight: bold; font-size: 0.95rem; cursor: pointer; border: none; background: transparent; color: var(--theme-color-text-secondary, #4a5568); border-bottom: 3px solid transparent;">3. Sponsorship Packages</button>
                  </div>
                  <div id="booking-sec-tickets" class="booking-section-panel" style="display: block;">
                    <h3 style="margin-top: 0; font-size: 1.2rem; margin-bottom: 1rem; color: var(--theme-color-text-primary, #2d3748);">Choose Ticket Tier</h3>
                    <div id="ticket-tiers-container" style="display: flex; flex-direction: column; gap: 1rem;"></div>
                  </div>
                  <div id="booking-sec-vendors" class="booking-section-panel" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 1.2rem; margin-bottom: 1rem; color: var(--theme-color-text-primary, #2d3748);">Exhibition & Booth Spaces</h3>
                    <div style="overflow-x: auto;">
                      <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                          <tr style="border-bottom: 2px solid var(--theme-color-border, #e2e8f0); font-size: 0.85rem; color: var(--theme-color-text-secondary, #4a5568);">
                            <th style="padding: 10px;">Booth Package</th>
                            <th style="padding: 10px;">Included Perks</th>
                            <th style="padding: 10px;">Price</th>
                            <th style="padding: 10px; text-align: right;">Action</th>
                          </tr>
                        </thead>
                        <tbody id="vendor-packages-tbody"></tbody>
                      </table>
                    </div>
                  </div>
                  <div id="booking-sec-sponsors" class="booking-section-panel" style="display: none;">
                    <h3 style="margin-top: 0; font-size: 1.2rem; margin-bottom: 1rem; color: var(--theme-color-text-primary, #2d3748);">Corporate Sponsorship Packages</h3>
                    <div style="overflow-x: auto;">
                      <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                          <tr style="border-bottom: 2px solid var(--theme-color-border, #e2e8f0); font-size: 0.85rem; color: var(--theme-color-text-secondary, #4a5568);">
                            <th style="padding: 10px;">Sponsorship Tier</th>
                            <th style="padding: 10px;">Logo Placement</th>
                            <th style="padding: 10px; text-align: center;">Complimentary Passes</th>
                            <th style="padding: 10px;">Price</th>
                            <th style="padding: 10px; text-align: right;">Action</th>
                          </tr>
                        </thead>
                        <tbody id="sponsorship-packages-tbody"></tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- FLOATING / SLIDE-OUT CART OVERLAY -->
            <div id="cart-sidebar" style="position: fixed; top: 0; right: -420px; width: 100%; max-width: 400px; height: 100%; background: var(--theme-color-surface, #ffffff); box-shadow: -10px 0 30px rgba(0,0,0,0.15); z-index: 1100; transition: right 0.3s ease-in-out; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid var(--theme-color-border, #e2e8f0); background: var(--theme-color-background, #f7fafc);">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); display: flex; align-items: center; gap: 0.5rem;">
                  <span>🛒</span> Event Registration Cart
                </h3>
                <button id="btn-close-cart" style="background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: var(--theme-color-text-secondary, #a0aec0); font-weight: bold;">&times;</button>
              </div>
              <div id="cart-items-container" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;"></div>
              <div style="padding: 1.5rem; border-top: 1px solid var(--theme-color-border, #e2e8f0); background: var(--theme-color-background, #f7fafc); display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568);">
                  <span>Subtotal:</span>
                  <span id="cart-lbl-subtotal">$0.00</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568);">
                  <span>Event Tax (8.25%):</span>
                  <span id="cart-lbl-tax">$0.00</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568);">
                  <span>Platform Service Fee:</span>
                  <span id="cart-lbl-fee">$0.00</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.25rem; color: var(--theme-color-text-primary, #1a202c); border-top: 1px solid var(--theme-color-border, #cbd5e0); padding-top: 0.5rem; margin-top: 0.25rem;">
                  <span>Grand Total:</span>
                  <span id="cart-lbl-total">$0.00</span>
                </div>
                <button id="btn-cart-checkout" class="btn-primary" style="margin-top: 0.5rem; padding: 12px; font-weight: bold; border-radius: 6px; text-align: center; font-size: 1rem; width: 100%;">Proceed to Secure Checkout</button>
              </div>
            </div>

            <!-- FLOATING CART BUTTON TRIGGER -->
            <button id="btn-floating-cart" style="position: fixed; bottom: 2rem; right: 2rem; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); cursor: pointer; z-index: 999; font-size: 1.5rem; transition: transform 0.2s;">
              <span>🛒</span>
              <span id="cart-count-badge" style="position: absolute; top: 0; right: 0; background: var(--theme-color-danger, #e53e3e); color: white; font-size: 0.75rem; font-weight: bold; border-radius: 50%; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; padding: 2px;">0</span>
            </button>
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
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Consultation Hero Copy Headline:</label>
            <input type="text" id="wz-contact-hero" value="${prefilledHeroCopy}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Booking Deposit Rules:</label>
            <input type="text" id="wz-contact-deposit" value="${prefilledDepositRules}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Operating Hours Details:</label>
            <input type="text" id="wz-contact-hours" value="${prefilledHoursText}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Direct Message Confirmation Notice (Trust Indicator):</label>
            <input type="text" id="wz-contact-confirm" value="${prefilledConfirmation}" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
        </div>
      `;

      saveHandler = async () => {
        const heroText = document.getElementById('wz-contact-hero').value;
        const depositRules = document.getElementById('wz-contact-deposit').value;
        const hoursText = document.getElementById('wz-contact-hours').value;
        const confirmText = document.getElementById('wz-contact-confirm').value;

        // Auto-populate Corporate Contact Details from Business Profile
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

              <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; font-size: 0.95rem; font-weight: 600; color: #2f855a;">
                <span style="font-size: 1.2rem;">⚡</span>
                <span>${confirmText}</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
              <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem; align-items: start;" class="contact-main-grid">

                <div style="display: flex; flex-direction: column; gap: 2rem;">

                  <div class="card" style="padding: 1.5rem; border-radius: 8px; border-top: 4px solid var(--theme-color-primary, #2b6cb0); background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h2 style="margin-top: 0; font-size: 1.35rem; font-weight: bold; color: var(--theme-color-text-primary, #1a202c); margin-bottom: 1.25rem;">
                      Send Inquiry
                    </h2>
                    <form id="contact-message-form" style="display: flex; flex-direction: column; gap: 1rem;">
                      <div>
                        <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Your Name:</label>
                        <input type="text" id="msg-name" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                      </div>
                      <div>
                        <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Your Email:</label>
                        <input type="email" id="msg-email" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                      </div>
                      <div>
                        <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Message Body:</label>
                        <textarea id="msg-body" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 120px; box-sizing: border-box; resize: vertical;"></textarea>
                      </div>
                      <button type="submit" class="btn-primary" style="padding: 12px; font-weight: bold; border-radius: 4px; width: 100%;">
                        Deliver Message
                      </button>
                    </form>
                  </div>

                  <div class="card" style="padding: 1.5rem; border-radius: 8px; background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 4px solid var(--theme-color-primary, #2b6cb0);">
                    <h3 style="margin-top: 0; font-size: 1.25rem; margin-bottom: 1.25rem; color: var(--theme-color-text-primary, #1a202c); font-weight: bold; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem;">
                      Contact Information
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 1.25rem; font-size: 0.9rem; line-height: 1.5;">
                      <div>
                        <strong style="color: var(--theme-color-text-secondary, #4a5568); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Office Headquarters:</strong>
                        <span id="sidebar-biz-address" style="color: var(--theme-color-text-primary, #2d3748); font-weight: 500;">${addressVal}</span>
                      </div>
                      <div>
                        <strong style="color: var(--theme-color-text-secondary, #4a5568); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Corporate Email:</strong>
                        <a id="sidebar-biz-email" href="mailto:${emailVal}" style="color: var(--theme-color-primary, #2b6cb0); font-weight: 600; text-decoration: none;">${emailVal}</a>
                      </div>
                      <div>
                        <strong style="color: var(--theme-color-text-secondary, #4a5568); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Phone Hotline:</strong>
                        <span id="sidebar-biz-phone" style="color: var(--theme-color-text-primary, #2d3748); font-weight: 500;">${phoneVal}</span>
                      </div>
                      <div>
                        <strong style="color: var(--theme-color-text-secondary, #4a5568); display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Operating Hours:</strong>
                        <span id="sidebar-biz-hours" style="color: var(--theme-color-text-primary, #2d3748); font-weight: 500;">${hoursText}</span>
                      </div>
                    </div>
                  </div>

                </div>

                <div class="card" style="padding: 1.5rem; border-radius: 8px; border-top: 4px solid #319795; background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 1.5rem;">
                  <h2 style="margin-top: 0; font-size: 1.35rem; font-weight: bold; color: var(--theme-color-text-primary, #1a202c);">
                    Schedule Strategic Consultation
                  </h2>
                  <p style="font-size: 0.85rem; color: #a0aec0; margin: 0;">${depositRules}</p>

                  <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                      <span style="font-weight: 700; font-size: 0.95rem; color: var(--theme-color-text-primary, #2d3748);">
                        Select an Available Date:
                      </span>
                      <div style="display: flex; gap: 0.5rem;">
                        <button id="btn-prev-month" type="button" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #e2e8f0; color: #4a5568; font-weight: 600; border-radius: 4px; border: none; cursor: pointer;">
                          &lt; Prev Month
                        </button>
                        <button id="btn-next-month" type="button" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #e2e8f0; color: #4a5568; font-weight: 600; border-radius: 4px; border: none; cursor: pointer;">
                          Next Month &gt;
                        </button>
                      </div>
                    </div>
                    <div id="calendar-wrapper" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;"></div>
                  </div>

                  <form id="appointment-form" style="display: grid; grid-template-columns: 1fr; gap: 1rem; border-top: 1px solid var(--theme-color-border, #edf2f7); padding-top: 1.5rem;">
                    <input type="hidden" id="appt-date" required />
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;" class="appointment-details-row">
                      <div>
                        <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Full Name:</label>
                        <input type="text" id="appt-name" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                      </div>
                      <div>
                        <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Email Address:</label>
                        <input type="email" id="appt-email" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                      </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                      <div>
                        <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Available Time Slot:</label>
                        <select id="appt-timeslot" required style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;">
                          <option value="">Select a date on the calendar above first...</option>
                        </select>
                      </div>
                      <div>
                        <label style="display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">Consultation Objectives & Notes (Optional):</label>
                        <textarea id="appt-notes" style="width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box; min-height: 60px; resize: vertical;"></textarea>
                      </div>
                      <div style="margin-top: 0.5rem;">
                        <button type="submit" id="btn-book-appt" class="btn-primary" style="background: #38a169; width: 100%; padding: 12px; font-weight: bold; border-radius: 4px; border: none; cursor: pointer; color: white;">
                          Confirm Google Meet Appointment
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

              </div>
            </div>

            <style>
              @media (max-width: 768px) {
                .contact-main-grid { grid-template-columns: 1fr !important; }
                .appointment-details-row { grid-template-columns: 1fr !important; }
              }
            </style>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 3rem 0;" />
            <div style="margin-top: 2rem;">
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); margin-bottom: 1.25rem; text-align: center;">Our Executive Leadership</h3>
              <author-card layout="full"></author-card>
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
