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
  let totalTests = 0;
  let totalPassed = 0;

  const testSuites = [
    { name: 'Schemas & Data Validation', runner: runSchemaTests },
    { name: 'Store & Reactive State', runner: runStoreTests },
    { name: 'Router & Navigation Guards', runner: runRouterTests },
    { name: 'Services & Integrations', runner: runServicesTests },
    { name: 'ContentDB & LocalStorage', runner: runDbTests },
    { name: 'Edge API Endpoints', runner: runApiTests },
    { name: 'Security & VirusTotal', runner: runSecurityTests },
    { name: 'Finances & ACH Processing', runner: runFinancesTests },
    { name: 'Marketing Workflows', runner: runMarketingTests }
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

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined' && window.location.search.includes('runTests=true')) {
  runAllTests().then(results => {
    console.log('%cTest execution complete.', 'color: #3182ce; font-weight: bold;');
  });
}

// Export for programmatic use
export { runSchemaTests, runStoreTests, runRouterTests, runServicesTests, runDbTests, runApiTests, runSecurityTests, runFinancesTests, runMarketingTests };
