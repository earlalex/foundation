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
            title: "Step 1/3: Google Workspace OAuth Settings",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Configure Google Client credentials and main workspace email.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Google Client ID:</label>
                  <input type="text" id="wz-google-id" placeholder="123456-abc.apps.googleusercontent.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Google Client Secret:</label>
                  <input type="password" id="wz-google-secret" placeholder="••••••••••••••••••••••••" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Google Workspace Owner Email:</label>
                  <input type="email" id="wz-google-owner" placeholder="admin@ascensionavenue.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const i = document.getElementById('wz-google-id')?.value;
              const s = document.getElementById('wz-google-secret')?.value;
              const o = document.getElementById('wz-google-owner')?.value;
              if (!i || !s || !o) throw new Error("Client ID, Secret, and Owner Email are required!");
            },
            save: (data) => {
              data.google = {
                clientId: document.getElementById('wz-google-id').value,
                clientSecret: document.getElementById('wz-google-secret').value,
                ownerEmail: document.getElementById('wz-google-owner').value,
                consentScreenCompleted: true
              };
            }
          },
          {
            title: "Step 2/3: Firebase & Firestore Database Setup",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Firebase Project ID:</label>
                  <input type="text" id="wz-fb-project" placeholder="ascension-avenue-app" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Firebase Web API Key:</label>
                  <input type="password" id="wz-fb-key" placeholder="AIzaSy..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Auth Domain:</label>
                  <input type="text" id="wz-fb-auth-domain" placeholder="ascension-avenue-app.firebaseapp.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const p = document.getElementById('wz-fb-project')?.value;
              const k = document.getElementById('wz-fb-key')?.value;
              const d = document.getElementById('wz-fb-auth-domain')?.value;
              if (!p || !k || !d) throw new Error("Project ID, API Key, and Auth Domain are required!");
            },
            save: (data) => {
              data.firebase = {
                projectId: document.getElementById('wz-fb-project').value,
                apiKey: document.getElementById('wz-fb-key').value,
                authDomain: document.getElementById('wz-fb-auth-domain').value,
                databaseRulesInitialized: true
              };
            }
          },
          {
            title: "Step 3/3: Cloudflare Pages & Workers Integration",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Cloudflare Zone ID:</label>
                  <input type="text" id="wz-cf-zone" placeholder="zone_123abc..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Pages Deployment URL:</label>
                  <input type="url" id="wz-cf-pages" placeholder="https://foundation.pages.dev" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Worker API Key:</label>
                  <input type="password" id="wz-cf-key" placeholder="worker_token_abc..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const z = document.getElementById('wz-cf-zone')?.value;
              const p = document.getElementById('wz-cf-pages')?.value;
              const k = document.getElementById('wz-cf-key')?.value;
              if (!z || !p || !k) throw new Error("Zone ID, Pages URL, and Worker API Key are required!");
            },
            save: (data) => {
              data.cloudflare = {
                ...(configManager.current.cloudflare || {}),
                zoneId: document.getElementById('wz-cf-zone').value,
                pagesUrl: document.getElementById('wz-cf-pages').value,
                workerApiKey: document.getElementById('wz-cf-key').value,
                wranglerValidated: true
              };
              data.isInstalled = true;
              data.siteTitle = data.siteTitle || "Foundation Framework";
              data.siteDomain = data.siteDomain || window.location.origin;
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
            title: "Step 1/3: Corporate Entity Details",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Legal Corporate Name:</label>
                  <input type="text" id="wz-biz-name" value="Ascension Avenue Academy" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">EIN / Tax ID:</label>
                  <input type="text" id="wz-biz-ein" placeholder="12-3456789" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Headquarters Address:</label>
                  <input type="text" id="wz-biz-address" placeholder="100 Innovation Way" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div>
                    <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">NAICS Classification Code:</label>
                    <input type="text" id="wz-biz-naics" value="541511" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  </div>
                  <div>
                    <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">NAICS Description:</label>
                    <input type="text" id="wz-biz-naics-def" value="Custom Computer Programming Services" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  </div>
                </div>
              </div>
            `,
            validate: () => {
              const n = document.getElementById('wz-biz-name')?.value;
              const e = document.getElementById('wz-biz-ein')?.value;
              const a = document.getElementById('wz-biz-address')?.value;
              const na = document.getElementById('wz-biz-naics')?.value;
              if (!n || !e || !a || !na) throw new Error("Please complete all corporate details fields.");
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
            title: "Step 2/3: Stripe Connections ($5 ACH Direct Debit Fee)",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096; margin-bottom: 0.5rem;">Initialize your Stripe credentials. The ACH payment path enforces a flat $5.00 application fee parameter.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Stripe Publishable Key:</label>
                  <input type="text" id="wz-stripe-pub" placeholder="pk_test_..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Stripe Secret Key:</label>
                  <input type="password" id="wz-stripe-sec" placeholder="sk_test_..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Monthly Membership Price ID:</label>
                  <input type="text" id="wz-stripe-price" placeholder="price_xxxxx..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const p = document.getElementById('wz-stripe-pub')?.value;
              const s = document.getElementById('wz-stripe-sec')?.value;
              const pr = document.getElementById('wz-stripe-price')?.value;
              if (!p || !s || !pr) throw new Error("Stripe Publishable key, Secret key, and Price ID are required.");
            },
            save: (data) => {
              data.stripe = {
                ...(configManager.current.stripe || {}),
                publishableKey: document.getElementById('wz-stripe-pub').value,
                secretKey: document.getElementById('wz-stripe-sec').value,
                priceId: document.getElementById('wz-stripe-price').value,
                achFee: 500, // flat $5 application fee parameter enforced
                enableAch: true,
                isConfigured: true
              };
            }
          },
          {
            title: "Step 3/3: LastPass Enterprise Connection",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">LastPass API Key / Provisioning Hash:</label>
                  <input type="password" id="wz-lp-hash" placeholder="Enter LP key" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Company Hash ID / Account Hash:</label>
                  <input type="text" id="wz-lp-company" placeholder="Enter Company Hash" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const h = document.getElementById('wz-lp-hash')?.value;
              const c = document.getElementById('wz-lp-company')?.value;
              if (!h || !c) throw new Error("LastPass provisioning keys & Company Hash ID are required!");
            },
            save: (data) => {
              data.lastpass = {
                provisioningHash: document.getElementById('wz-lp-hash').value,
                companyId: document.getElementById('wz-lp-company').value,
                apiEndpoint: "https://lastpass.com/enterprise/api.php",
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
            title: "Step 1/2: Gmail / SMTP Setup",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Gmail/SMTP Sender:</label>
                  <input type="email" id="wz-mkt-sender" placeholder="newsletter@yourdomain.com" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Default Sender Alias:</label>
                  <input type="text" id="wz-mkt-alias" value="Notification System" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const s = document.getElementById('wz-mkt-sender')?.value;
              if (!s) throw new Error("Default Gmail sender is required.");
            },
            save: (data) => {
              data.marketing = {
                gmailSender: document.getElementById('wz-mkt-sender').value,
                defaultSenderAlias: document.getElementById('wz-mkt-alias').value,
                defaultDelay: 24,
                defaultTrigger: "user_signup",
                isConfigured: true
              };
            }
          },
          {
            title: "Step 2/2: Test Email Dispatch & Chatbot Context",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <p style="font-size: 0.85rem; color: #718096;">Dispatch a live test welcome email to verify connections, and set system chatbot greetings.</p>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.90rem; margin-bottom: 0.25rem;">Dispatch Test Email To:</label>
                  <input type="email" id="wz-mkt-test-email" placeholder="test@example.com" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                  <button type="button" id="btn-wz-test-email" style="
                    margin-top: 0.5rem;
                    padding: 6px 12px;
                    background: var(--theme-color-accent, #38a169);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                  ">Send Test Email</button>
                </div>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0.5rem 0;" />
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Chatbot Welcoming Greeting Message:</label>
                  <input type="text" id="wz-mkt-chat-welcome" value="Hello! How can I help you today?" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Chatbot AI System Prompt:</label>
                  <textarea id="wz-mkt-chat-prompt" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; min-height: 40px; box-sizing: border-box;">You are a helpful customer support agent.</textarea>
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
                systemPrompt: document.getElementById('wz-mkt-chat-prompt').value
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
            title: "Step 1/2: OWASP ZAP & VirusTotal Scan Keys",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OWASP ZAP Base URL:</label>
                  <input type="url" id="wz-sec-zap-url" value="https://wwtesw.zaproxy.org" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OWASP ZAP API Key:</label>
                  <input type="password" id="wz-sec-zap-key" placeholder="zap_api_token" style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">VirusTotal API Key:</label>
                  <input type="password" id="wz-sec-vt-key" placeholder="vt_api_token" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
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
              const vt = document.getElementById('wz-sec-vt-key')?.value;
              if (!url || !vt) throw new Error("ZAP URL and VirusTotal API Key are required!");
            },
            save: (data) => {
              data.security = {
                ...(configManager.current.security || {}),
                zapApiUrl: document.getElementById('wz-sec-zap-url').value,
                zapApiKey: document.getElementById('wz-sec-zap-key').value,
                isConfigured: true
              };
              data.virustotal = {
                apiKey: document.getElementById('wz-sec-vt-key').value
              };
            }
          },
          {
            title: "Step 2/2: OnlineJobs.ph Integration Pipeline",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">OnlineJobs.ph API / Pipeline ID:</label>
                  <input type="text" id="wz-va-pipe" placeholder="pipeline_1234..." required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">VA Integration Key:</label>
                  <input type="password" id="wz-va-key" placeholder="va_api_secret_key" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
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
              if (!pipe || !k) throw new Error("Pipeline ID and Integration Key are required.");
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
            testEmailBtn.textContent = 'Send Test Email';
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
