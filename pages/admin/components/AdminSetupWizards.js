/**
 * pages/admin/components/AdminSetupWizards.js
 * Implements interactive, step-by-step setup modals for each of the Admin sections
 * with strict sequential order enforcement and secure temporary secret storage.
 */
import { configManager } from '../../../core/config.js';
import { toast } from '../../../utils/toast.js';
import {
  writeTempCredentialsVault,
  readTempCredentialsVault,
  deleteTempCredentialsVault
} from '../../../core/drive-upload.js';
import { contentDB } from '../../../core/db.js';

export class AdminSetupWizards {
  /**
   * Helper to retrieve current onboarding sequence progress
   */
  static getOnboardingProgress() {
    const cfg = configManager.current || {};
    const step1 = !!(cfg.google?.clientId && cfg.google?.clientSecret && cfg.google?.ownerEmail);
    const step2 = !!(cfg.firebase?.apiKey && cfg.firebase?.projectId && cfg.firebase?.authDomain);
    const step3 = !!(cfg.cloudflare?.zoneId && cfg.cloudflare?.pagesUrl && cfg.cloudflare?.workerApiKey);
    const step4 = !!(cfg.lastpass?.provisioningHash && cfg.lastpass?.companyId);
    return { step1, step2, step3, step4 };
  }

  /**
   * Enforce strict sequential onboarding order
   * @param {number} targetStep
   */
  static enforceSequence(targetStep) {
    const progress = this.getOnboardingProgress();
    if (targetStep >= 2 && !progress.step1) {
      throw new Error("Strict Sequence Block: Step 1 (Google Workspace) is not fully configured yet!");
    }
    if (targetStep >= 3 && !progress.step2) {
      throw new Error("Strict Sequence Block: Step 2 (Firebase) is not fully configured yet!");
    }
    if (targetStep >= 4 && !progress.step3) {
      throw new Error("Strict Sequence Block: Step 3 (Cloudflare) is not fully configured yet!");
    }
    if (targetStep >= 5 && !progress.step4) {
      throw new Error("Strict Sequence Block: Step 4 (LastPass Password Vault) is not fully configured yet!");
    }
  }

  /**
   * Launch a specific wizard modal
   * @param {string} wizardType - One of: 'google_workspace', 'firebase_cloud', 'cloudflare_edge', 'lastpass_vault', 'site', 'business', 'finances', 'marketing', 'security', 'va'
   * @param {Function} onComplete - Callback executed upon successful setup completion
   */
  static launch(wizardType, onComplete) {
    // 1. Enforce sequence checks dynamically before launching
    try {
      if (wizardType === 'firebase_cloud') this.enforceSequence(2);
      else if (wizardType === 'cloudflare_edge') this.enforceSequence(3);
      else if (wizardType === 'lastpass_vault') this.enforceSequence(4);
      else if (['site', 'business', 'finances', 'marketing', 'security', 'va'].includes(wizardType)) {
        this.enforceSequence(5);
      }
    } catch (err) {
      toast.error(err.message);
      return;
    }

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
      // STEP 1: Google Workspace Setup
      google_workspace: {
        title: "Step 1: Google Workspace Setup Wizard",
        steps: [
          {
            title: "OAuth Credentials & Admin Email",
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
          }
        ]
      },

      // STEP 2: Firebase Setup
      firebase_cloud: {
        title: "Step 2: Firebase Setup Wizard",
        steps: [
          {
            title: "Firebase/Firestore Integration Keys",
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
          }
        ]
      },

      // STEP 3: Cloudflare Setup
      cloudflare_edge: {
        title: "Step 3: Cloudflare Edge Setup Wizard",
        steps: [
          {
            title: "Cloudflare Zone & Worker Integration",
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
            }
          }
        ]
      },

      // STEP 4: LastPass Vault Setup
      lastpass_vault: {
        title: "Step 4: LastPass Vault Setup Wizard",
        steps: [
          {
            title: "LastPass Enterprise Connection",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">LastPass Enterprise API Key / Provisioning Hash:</label>
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

      // Everything Else individual step definitions:
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
            title: "Step 2: Dynamic Path Overrides &pres",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Company Name Parameter:</label>
                  <input type="text" id="wz-site-company" placeholder="Ascension Avenue Academy" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Site Name Parameter:</label>
                  <input type="text" id="wz-site-name" placeholder="Foundation" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
              </div>
            `,
            validate: () => {
              const c = document.getElementById('wz-site-company')?.value;
              const s = document.getElementById('wz-site-name')?.value;
              if (!c || !s) throw new Error("Company Name and Site Name are required!");
            },
            save: (data) => {
              data.site = {
                ...(configManager.current.site || {}),
                companyName: document.getElementById('wz-site-company').value,
                siteName: document.getElementById('wz-site-name').value
              };
            }
          }
        ]
      },
      business: {
        title: "Business & Legal Setup Wizard",
        steps: [
          {
            title: "Step 1: Corporate Entity Details",
            html: `
              <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Legal Corporate Name:</label>
                  <input type="text" id="wz-biz-name" value="Ascension Avenue Academy" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-weight: bold; font-size: 0.9rem; margin-bottom: 0.25rem;">Headquarters Address:</label>
                  <input type="text" id="wz-biz-address" placeholder="100 Innovation Way" required style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
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
          }
        ]
      },
      finances: {
        title: "Finances & ACH Setup Wizard",
        steps: [
          {
            title: "Stripe Connections",
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
                secretKey: document.getElementById('wz-stripe-sec').value,
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
              google_workspace: 'google',
              firebase_cloud: 'firebase',
              cloudflare_edge: 'cloudflare',
              lastpass_vault: 'lastpass',
              business: 'businessProfile',
              finances: 'stripe'
            };

            const configKey = wizardTypeToConfigKey[wizardType];
            if (configKey) {
              mergedConfig[configKey] = mergedConfig[configKey] || {};
              mergedConfig[configKey].isConfigured = true;
            }

            const success = await configManager.saveToFirebase(mergedConfig);
            if (success) {
              // DIRECTIVE 2.2: TEMPORARY SECRET STORAGE VAULT FLOW
              if (['google_workspace', 'firebase_cloud', 'cloudflare_edge'].includes(wizardType)) {
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

              // DIRECTIVE 2.2: STEP 4 LASTPASS CONFIGURATION RECOVERY FLOW
              if (wizardType === 'lastpass_vault') {
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
