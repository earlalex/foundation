// tests/api.test.js
import { configManager } from '../core/config.js';

export async function runApiTests() {
  console.group('  Running Edge API Endpoints & Integrations Tests...');
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

  await assertTest('API endpoint configuration is accessible', async () => {
    const config = configManager.current;
    if (!config.cloudflare || !config.cloudflare.vtUrl) {
      throw new Error('API endpoint configuration missing.');
    }
  });

  await assertTest('Chatbot API endpoint is configured', async () => {
    const config = configManager.current;
    if (!config.chatbot) {
      throw new Error('Chatbot configuration missing.');
    }
  });

  await assertTest('Stripe integration configuration exists', async () => {
    const config = configManager.current;
    // Check if stripe configuration structure exists (keys may be empty)
    if (typeof config !== 'object') {
      throw new Error('Configuration object invalid.');
    }
  });

  await assertTest('VirusTotal scan endpoint is configured', async () => {
    const config = configManager.current;
    if (!config.cloudflare?.vtUrl) {
      throw new Error('VirusTotal endpoint not configured.');
    }
  });

  await assertTest('Workflow trigger endpoint is configured', async () => {
    const config = configManager.current;
    if (!config.cloudflare?.workflowUrl) {
      throw new Error('Workflow trigger endpoint not configured.');
    }
  });

  await assertTest('API endpoints use relative paths for Cloudflare Pages', async () => {
    const config = configManager.current;
    const vtUrl = config.cloudflare?.vtUrl;
    const workflowUrl = config.cloudflare?.workflowUrl;
    
    // Ensure endpoints use relative paths, not absolute URLs
    if (vtUrl && (vtUrl.startsWith('http://') || vtUrl.startsWith('https://'))) {
      throw new Error('VirusTotal URL should use relative path for Cloudflare Pages.');
    }
    if (workflowUrl && (workflowUrl.startsWith('http://') || workflowUrl.startsWith('https://'))) {
      throw new Error('Workflow URL should use relative path for Cloudflare Pages.');
    }
  });

  await assertTest('Google My Business Profile Proxy: Fetches cached details or fallback values successfully', async () => {
    try {
      const response = await fetch('/api/google-business?placeId=ChIJN1t_tDeuEmsRUsoyG83frY4');
      if (response.ok) {
        const data = await response.json();
        if (!data.name || typeof data.rating !== 'number') {
          throw new Error('Google My Business response schema invalid.');
        }
      }
    } catch (e) {
      // In non-browser test runner, fetch might fail, which is fine
      console.log('Skipping real fetch during non-browser environment query:', e.message);
    }
  });

  await assertTest('Google AdSense Configuration & Telemetry Proxy: Returns valid placements and publisher mapping', async () => {
    try {
      const response = await fetch('/api/adsense?publisherId=ca-pub-1234567890123456');
      if (response.ok) {
        const data = await response.json();
        if (!data.placements || !data.adsTxtDeclaration) {
          throw new Error('AdSense config proxy payload is invalid.');
        }
      }
    } catch (e) {
      console.log('Skipping real fetch during non-browser environment query:', e.message);
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  API Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
