// tests/index.js - Main Test Orchestrator
import { runSchemaTests } from './schemas.test.js';
import { runStoreTests } from './store.test.js';
import { runRouterTests } from './router.test.js';
import { runServicesTests } from './services.test.js';
import { runDbTests } from './db.test.js';
import { runApiTests } from './api.test.js';
import { runSecurityTests } from './security.test.js';
import { runFinancesTests } from './finances.test.js';
import { runMarketingTests } from './marketing.test.js';

// Newly added automated tests
import { runRbacTests } from './rbac.test.js';
import { runPagesTests } from './pages.test.js';
import { runVaultNaicsTests } from './vault-naics.test.js';
import { runWizardsTests } from './wizards.test.js';
import { runHooksPluginsTests } from './hooks-plugins.test.js';
import { runSparkTests } from './spark.test.js';
import { runUiTests } from './ui.test.js';
import { runMediaTests } from './media.test.js';

// Dynamically load optional test suites without breaking core boot
export async function runStripeProductCreateTests() {
  let stripeTestMod;
  try {
    stripeTestMod = await import('./stripe-product-create.test.js');
  } catch (err) {
    console.warn('[Test Runner]: Optional test file stripe-product-create.test.js not found or failed to load. Skipping.', err);
    return;
  }

  // Run the test outside try/catch so failures propagate to runAllTests
  if (typeof stripeTestMod.runStripeProductCreateTests === 'function') {
    await stripeTestMod.runStripeProductCreateTests();
  }
}

/**
 * Main test runner that executes all Foundation Framework test suites
 * Run this file to execute the complete test battery
 */
export async function runAllTests() {
  console.log('%c\n╔════════════════════════════════════════════════════════════════╗', 'color: #3182ce; font-weight: bold;');
  console.log('%c║     Foundation Framework - Complete Test Suite              ║', 'color: #3182ce; font-weight: bold;');
  console.log('%c╚════════════════════════════════════════════════════════════════╝\n', 'color: #3182ce; font-weight: bold;');

  let totalSuites = 0;
  let passedSuites = 0;

  const testSuites = [
    { name: 'Schemas & Data Validation', runner: runSchemaTests },
    { name: 'Store & Reactive State', runner: runStoreTests },
    { name: 'Router & Navigation Guards', runner: runRouterTests },
    { name: 'Services & Integrations', runner: runServicesTests },
    { name: 'ContentDB & LocalStorage', runner: runDbTests },
    { name: 'Edge API Endpoints', runner: runApiTests },
    { name: 'User Tier & RBAC Access Matrix', runner: runRbacTests },
    { name: 'Page Creator & WYSIWYG Editor', runner: runPagesTests },
    { name: 'Finances & ACH Processing', runner: runFinancesTests },
    { name: 'Marketing Workflows', runner: runMarketingTests },
    { name: 'Security & VirusTotal', runner: runSecurityTests },
    { name: 'Password Vault & NAICS Classification', runner: runVaultNaicsTests },
    { name: 'Setup Wizards & Configuration Guards', runner: runWizardsTests },
    { name: 'System Hooks & Plugin Extensions Registry', runner: runHooksPluginsTests },
    { name: 'Gemini Spark COO Agent Operations', runner: runSparkTests },
    { name: 'UI Buttons & Interactive Controls', runner: runUiTests },
    { name: 'Photo Gallery, Video Streaming & Radio Player', runner: runMediaTests },
    { name: 'Stripe Product Create Authorization & Token Verification', runner: runStripeProductCreateTests }
  ];

  for (const suite of testSuites) {
    totalSuites++;
    try {
      await suite.runner();
      passedSuites++;
    } catch (error) {
      console.error(`%c[ERROR] Test suite "${suite.name}" failed to execute:`, 'color: #e53e3e; font-weight: bold;', error);
    }
  }

  console.log('%c\n╔════════════════════════════════════════════════════════════════╗', 'color: #3182ce; font-weight: bold;');
  console.log('%c║                    Test Suite Summary                        ║', 'color: #3182ce; font-weight: bold;');
  console.log('%c╠════════════════════════════════════════════════════════════════╣', 'color: #3182ce; font-weight: bold;');
  console.log(`%c║  Suites Passed: ${passedSuites}/${totalSuites}                                                  ║`, 'color: #3182ce; font-weight: bold;');
  console.log('%c╚════════════════════════════════════════════════════════════════╝\n', 'color: #3182ce; font-weight: bold;');

  return {
    totalSuites,
    passedSuites,
    success: passedSuites === totalSuites
  };
}

// Auto-run tests if this file is executed directly or if runTests URL flag is active
if (typeof window !== 'undefined' && (window.location.search.includes('runTests=true') || window.location.search.includes('runTests=1'))) {
  runAllTests().then(results => {
    console.log('%cTest execution complete.', 'color: #3182ce; font-weight: bold;');
  });
}

// Export for programmatic use
export {
  runSchemaTests,
  runStoreTests,
  runRouterTests,
  runServicesTests,
  runDbTests,
  runApiTests,
  runSecurityTests,
  runFinancesTests,
  runMarketingTests,
  runRbacTests,
  runPagesTests,
  runVaultNaicsTests,
  runWizardsTests,
  runHooksPluginsTests,
  runSparkTests,
  runUiTests
};
