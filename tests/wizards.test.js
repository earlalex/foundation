// tests/wizards.test.js - Automated tests for Configuration Readiness Guards and Setup Wizards
import { configManager } from '../core/config.js';
import { store } from '../core/store.js';

export async function runWizardsTests() {
  console.group('  Running Setup Wizards & Configuration Guard Tests...');
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

  // Preserve initial configuration state
  const originalConfig = { ...configManager.current };

  await assertTest('Readiness Guards: Detects unconfigured site/brand configuration', async () => {
    configManager.current = {
      ...configManager.current,
      siteTitle: "Foundation Framework", // default title
      siteDomain: ""
    };
    if (configManager.isBrandConfigured()) {
      throw new Error("Brand guard falsely marked default title and empty domain as configured.");
    }
  });

  await assertTest('Readiness Guards: Identifies fully configured brand state correctly', async () => {
    configManager.current = {
      ...configManager.current,
      siteTitle: "Acme Corporate Framework",
      siteDomain: "https://acme.org"
    };
    if (!configManager.isBrandConfigured()) {
      throw new Error("Brand guard failed to identify custom title and valid base domain as configured.");
    }
  });

  await assertTest('Readiness Guards: Validates API configuration requirements', async () => {
    configManager.current = {
      ...configManager.current,
      firebase: { apiKey: "", projectId: "" },
      google: { clientId: "", clientSecret: "" },
      aiConfig: { geminiApiKey: "" }
    };
    if (configManager.isApiKeysConfigured()) {
      throw new Error("API guard falsely flagged empty values as configured.");
    }

    configManager.current = {
      ...configManager.current,
      firebase: { apiKey: "ai_fb_api_key_123", projectId: "demo-proj-id" },
      google: { clientId: "g_client_id_01", clientSecret: "g_secret_99" },
      aiConfig: { geminiApiKey: "gemini_api_key_101" }
    };
    if (!configManager.isApiKeysConfigured()) {
      throw new Error("API guard failed to validate fully configured state keys.");
    }
  });

  await assertTest('Readiness Guards: Verifies Finances & Stripe Connect ACH setup', async () => {
    configManager.current = {
      ...configManager.current,
      stripe: { secretKey: "", publishableKey: "", priceId: "" }
    };
    if (configManager.isFinancesConfigured()) {
      throw new Error("Finances guard failed to block empty Stripe keys.");
    }

    configManager.current = {
      ...configManager.current,
      stripe: { secretKey: "sk_test_123", publishableKey: "pk_test_456", priceId: "price_abc", achFee: 500 }
    };
    if (!configManager.isFinancesConfigured()) {
      throw new Error("Finances guard failed to authorize fully configured Stripe parameters.");
    }
  });

  // Restore configuration state
  configManager.current = originalConfig;

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Wizards Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more Wizards & Guards tests failed.');
  }
}
