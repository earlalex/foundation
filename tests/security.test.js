// tests/security.test.js
import { configManager } from '../core/config.js';

export async function runSecurityTests() {
  console.group('  Running Security & VirusTotal Scan Tests...');
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

  await assertTest('Security configuration object exists', async () => {
    const config = configManager.current;
    if (!config.security) {
      throw new Error('Security configuration missing.');
    }
  });

  await assertTest('Monthly scan toggle is configurable', async () => {
    const config = configManager.current;
    if (typeof config.security?.monthlyScanEnabled !== 'boolean') {
      throw new Error('Monthly scan enabled flag must be boolean.');
    }
  });

  await assertTest('SEO-My-Rank API key configuration exists', async () => {
    const config = configManager.current;
    if (!config.seoMyRankAddr) {
      throw new Error('SEO-My-Rank configuration missing.');
    }
  });

  await assertTest('SEO-My-Rank cost tracking structure is valid', async () => {
    const config = configManager.current;
    const seoConfig = config.seoMyRankAddr;
    
    if (typeof seoConfig.costPerRequest !== 'number') {
      throw new Error('Cost per request must be a number.');
    }
    if (typeof seoConfig.totalSpent !== 'number') {
      throw new Error('Total spent must be a number.');
    }
    if (typeof seoConfig.requestCount !== 'number') {
      throw new Error('Request count must be a number.');
    }
  });

  await assertTest('LastPass provisioning configuration structure exists', async () => {
    const config = configManager.current;
    if (!config.lastpass) {
      throw new Error('LastPass configuration missing.');
    }
  });

  await assertTest('LastPass API endpoint is configured', async () => {
    const config = configManager.current;
    if (!config.lastpass?.apiEndpoint) {
      throw new Error('LastPass API endpoint not configured.');
    }
  });

  await assertTest('Chatbot voice credentials structure exists', async () => {
    const config = configManager.current;
    if (!config.chatbot) {
      throw new Error('Chatbot configuration missing.');
    }
    
    // Check for voice provider credentials
    const hasTelnyx = config.chatbot.telnyxApiKey !== undefined;
    const hasTwilio = config.chatbot.twilioAccountSid !== undefined;
    
    if (!hasTelnyx && !hasTwilio) {
      // This is acceptable - just checking structure exists
      console.log('  Note: No voice provider credentials configured (optional)');
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Security Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
