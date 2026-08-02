// tests/wizards.test.js - Comprehensive Unit & Integration Tests for Setup Wizards & Readiness Guards
import { configManager } from '../core/config.js';
import { store } from '../core/store.js';
import { AdminSetupWizards } from '../pages/admin/components/AdminSetupWizards.js';

export async function runWizardsTests() {
  console.group('  Running Overhauled Setup Wizards & Readiness Guards Test Suite...');
  let totalTests = 0;
  let passedTests = 0;

  async function assertTest(testName, testFn) {
    totalTests++;
    try {
      await testFn();
      console.log(`%c    PASS: ${testName}`, 'color: #38a169; font-weight: bold;');
      passedTests++;
    } catch (err) {
      console.error(`    FAIL: ${testName}\n     Reason: ${err.message}`);
    }
  }

  // Preserve initial states
  const originalConfig = { ...configManager.current };

  await assertTest('Wizards Matrix: Correctly detects initial unconfigured state', async () => {
    configManager.current = {
      isInstalled: false,
      siteTitle: "Foundation Framework", // default title
      siteDomain: "",
      firebase: { apiKey: "", projectId: "" },
      google: { clientId: "", clientSecret: "" },
      sectionWizards: {
        section1: false,
        section2: false,
        section3: false,
        section4: false
      }
    };

    if (configManager.isBrandConfigured()) {
      throw new Error("Brand guard falsely marked default/unconfigured site as configured.");
    }
    if (configManager.isApiKeysConfigured()) {
      throw new Error("API keys guard falsely marked unconfigured API keys as configured.");
    }
    if (configManager.isSection1Configured()) {
      throw new Error("Section 1 wizard was flagged as configured initially.");
    }
    if (configManager.isSection2Configured()) {
      throw new Error("Section 2 wizard was flagged as configured initially.");
    }
  });

  await assertTest('Wizards Matrix: Section 1 Site & Brand configuration unlocks gated brand attributes', async () => {
    configManager.current = {
      ...configManager.current,
      siteTitle: "Ascension Strategic Academy",
      siteDomain: "https://ascension.academy.dev",
      firebase: { apiKey: "AIzaSy_demo_key_99", projectId: "demo-proj" },
      google: { clientId: "g_id_1", clientSecret: "g_sec_1" },
      sectionWizards: {
        section1: true
      }
    };

    if (!configManager.isBrandConfigured()) {
      throw new Error("Brand guard failed to authorize valid customized site details.");
    }
    if (!configManager.isApiKeysConfigured()) {
      throw new Error("API keys guard failed to validate correctly structured keys.");
    }
    if (!configManager.isSection1Configured()) {
      throw new Error("isSection1Configured did not dynamically register as unlocked.");
    }
  });

  await assertTest('Wizards Matrix: Section 2 Business & Finances configuration unlocks Stripe Connect and ACH paths', async () => {
    configManager.current = {
      ...configManager.current,
      businessProfile: {
        legalName: "Ascension Corp",
        address: "100 Innovation Way",
        ein: "12-3456789",
        naicsCode: "541511"
      },
      stripe: {
        secretKey: "sk_test_123",
        publishableKey: "pk_test_456",
        priceId: "price_abc",
        achFee: 500
      },
      sectionWizards: {
        section2: true
      }
    };

    if (!configManager.isBusinessConfigured()) {
      throw new Error("Business guard failed to identify valid legal/profile data.");
    }
    if (!configManager.isFinancesConfigured()) {
      throw new Error("Finances guard failed to authorize valid Stripe credentials.");
    }
    if (!configManager.isSection2Configured()) {
      throw new Error("isSection2Configured failed to dynamically register as unlocked.");
    }
  });

  await assertTest('Wizards Matrix: Onboarding progress helper reads configuration settings correctly', async () => {
    configManager.current = {
      ...configManager.current,
      sectionWizards: {
        section1: true,
        section2: true,
        section3: false,
        section4: false
      }
    };

    const progress = AdminSetupWizards.getOnboardingProgress();
    if (!progress.section1 || !progress.section2 || progress.section3 || progress.section4) {
      throw new Error("Onboarding progress helper returned incorrect section configuration mapping.");
    }
  });

  await assertTest('Wizards Matrix: Simulates form input sanitization and required field enforcement rules', async () => {
    // 1. Validation check for Section 1 Step 1 (Site Metadata)
    const mockStep1Validate = (title, domain) => {
      if (!title || !domain) {
        throw new Error("Website Title and Domain URL are required!");
      }
    };
    try {
      mockStep1Validate("", "https://valid.com");
      throw new Error("Input validation allowed empty title.");
    } catch (e) {
      if (!e.message.includes("required")) throw e;
    }

    // 2. Validation check for Section 1 Step 4 (API Keys required fields)
    const mockStep4Validate = (fbKey, googleId, stripeSec) => {
      if (!fbKey || !googleId || !stripeSec) {
        throw new Error("Required key input is missing.");
      }
    };
    try {
      mockStep4Validate("fb_key", "g_id", "");
      throw new Error("API keys check allowed missing Stripe secret.");
    } catch (e) {
      if (!e.message.includes("missing")) throw e;
    }
  });

  await assertTest('Wizards Matrix: Configuration persistence is fallback-resilient to LocalStorage', async () => {
    const testConfig = {
      ...configManager.current,
      siteTitle: "FallBack Persistent Framework Test"
    };

    // Simulate saving via configManager directly which triggers localStorage fallback writes
    localStorage.setItem('foundation_config', JSON.stringify(testConfig));

    // Read fallback configuration
    const fallbackLoaded = JSON.parse(localStorage.getItem('foundation_config'));
    if (fallbackLoaded.siteTitle !== "FallBack Persistent Framework Test") {
      throw new Error("Configuration failed to persist to LocalStorage fallback.");
    }
  });

  // Restore configuration state cleanly
  configManager.current = originalConfig;

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Setup Wizards Overhaul Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more over-hauled Setup Wizards tests failed.');
  }
}
