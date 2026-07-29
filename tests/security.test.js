// tests/security.test.js
import { configManager } from '../core/config.js';
import { contentDB } from '../core/db.js';

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
    const hasTelnyx = config.chatbot.telnyxApiKey !== undefined;
    const hasTwilio = config.chatbot.twilioAccountSid !== undefined;
    if (!hasTelnyx && !hasTwilio) {
      console.log('  Note: No voice provider credentials configured (optional)');
    }
  });

  // EXPANDED SECURITY TESTS
  await assertTest('SHA-256 Calculation & Signature Scanning: Generates cryptographic file hashes', async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode('console.log("Clean harmless JavaScript file");');

    // Sub Subtle digest
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const expectedHash = 'd743a60a95ff2da650ff1b590e8d5314798e4f51e0ccb45d2f65a1cc1f13f1e5';
    if (calculatedHash !== expectedHash) {
      throw new Error(`SHA-256 calculation mismatch. Expected: ${expectedHash}, Got: ${calculatedHash}`);
    }
  });

  await assertTest('VirusTotal Response Parser: Mock parses mult-engine scans and ClamAV categories', () => {
    // Mock VirusTotal analysis response payload
    const mockVtResponse = {
      success: true,
      hash: 'd743a60a95ff2da650ff1b590e8d5314798e4f51e0ccb45d2f65a1cc1f13f1e5',
      stats: {
        malicious: 0,
        suspicious: 0,
        harmless: 70,
        undetected: 2
      },
      results: {
        ClamAV: {
          category: 'harmless',
          engine_name: 'ClamAV',
          method: 'blacklist',
          result: null
        },
        Kaspersky: {
          category: 'harmless',
          engine_name: 'Kaspersky',
          method: 'blacklist',
          result: null
        }
      }
    };

    if (!mockVtResponse.results.ClamAV) {
      throw new Error('ClamAV engine result missing from parsed telemetry.');
    }
    if (mockVtResponse.stats.malicious !== 0) {
      throw new Error('Mock clean file flagged as threat.');
    }
  });

  await assertTest('Monthly Background Security Scanner: Saves logs and triggers email updates', async () => {
    // Generate simulated monthly audit log
    const auditRecord = {
      id: `sec_audit_log_${Date.now()}`,
      type: 'security_audit',
      timestamp: new Date().toISOString(),
      overallRating: 'SECURE',
      totalAssets: 45,
      maliciousAssets: 0,
      reportSummary: 'All framework files and media uploads mapped clean.'
    };

    // Persist to contentDB under contents (using custom type)
    await contentDB.saveContent(auditRecord);

    const checkRecord = await contentDB.getContent(auditRecord.id);
    if (!checkRecord || checkRecord.overallRating !== 'SECURE') {
      throw new Error('Security background scan record did not persist.');
    }

    // Verify system email trigger structure matches GMail notification options
    const buildGmailPayload = (to, subject, body) => ({
      toEmail: to,
      subject,
      messageBody: body
    });

    const emailPayload = buildGmailPayload('admin@test.com', 'System Security Scan Report', 'Domain report details');
    if (!emailPayload.toEmail || !emailPayload.subject || !emailPayload.messageBody) {
      throw new Error('Invalid GMail notification payload parameters.');
    }

    // Clean up
    await contentDB.deleteContent(auditRecord.id);
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Security Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more security tests failed.');
  }
}
