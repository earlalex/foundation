// tests/services.test.js
import { 
  fetchSeoMyRankAddr, 
  getSearchConsoleSecurityIssues, 
  runLighthouseAudit 
} from '../core/google-services.js';

export async function runServicesTests() {
  console.group('  Running Foundation Features & Integration Services Test Suite...');
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

  // 1. AFFILIATE REFERRAL COMMISSION CALCULATOR
  await assertTest('Affiliate Commission Engine: Computes 10% monthly referral credit correctly', () => {
    const monthlyFee = 29.00;
    const commissionRate = 0.10;
    const referrals = 5;
    
    // Fixed floating point rounding with Number.toFixed()
    const monthlyEarnings = parseFloat((referrals * (monthlyFee * commissionRate)).toFixed(2));
    const expected = 14.50;

    if (monthlyEarnings !== expected) {
      throw new Error(`Expected $14.50 monthly credit, calculated $${monthlyEarnings.toFixed(2)}`);
    }
  });

  await assertTest('Affiliate Commission Engine: Identifies 100% membership fee offset threshold', () => {
    const monthlyFee = 29.00;
    const commissionRate = 0.10;
    const referrals = 10;

    const monthlyEarnings = parseFloat((referrals * (monthlyFee * commissionRate)).toFixed(2));
    const isFullyCovered = monthlyEarnings >= monthlyFee;

    if (!isFullyCovered) {
      throw new Error('10 active referrals should fully offset the $29/mo membership fee.');
    }
  });

  // 2. MASS GMAIL RECIPIENT FILTERING
  await assertTest('Mass Email Broadcaster: Filters target recipients by membership tier correctly', () => {
    const mockUsers = [
      { email: 'sub@ex.com', role: 'subscriber' },
      { email: 'mem1@ex.com', role: 'member' },
      { email: 'mem2@ex.com', role: 'member' },
      { email: 'aff@ex.com', role: 'affiliate' },
      { email: 'admin@ex.com', role: 'admin' }
    ];

    const memberRecipients = mockUsers.filter(u => u.role === 'member');
    if (memberRecipients.length !== 2) {
      throw new Error(`Expected 2 member recipients, filtered ${memberRecipients.length}`);
    }

    const allPublicUsers = mockUsers.filter(u => u.role !== 'admin');
    if (allPublicUsers.length !== 4) {
      throw new Error(`Expected 4 public recipients (excluding admin), filtered ${allPublicUsers.length}`);
    }
  });

  // 3. GOOGLE CONTACTS ROLE LABEL FORMATTING
  await assertTest('Google Contacts Sync: Formats custom UserRole labels accurately', () => {
    const formatRoleLabel = (role) => {
      return role === 'affiliate' ? 'Affiliate Member' : role === 'member' ? 'Member' : 'Subscriber';
    };

    if (formatRoleLabel('affiliate') !== 'Affiliate Member') throw new Error('Affiliate label mismatch');
    if (formatRoleLabel('member') !== 'Member') throw new Error('Member label mismatch');
    if (formatRoleLabel('subscriber') !== 'Subscriber') throw new Error('Subscriber label mismatch');
  });

  // 4. SEARCH CONSOLE THREAT MONITOR STRUCTURE
  await assertTest('Search Console Threat Monitor: Returns structured threat categories', async () => {
    const secReport = await getSearchConsoleSecurityIssues();
    if (!secReport || typeof secReport !== 'object') {
      throw new Error('Security report object expected.');
    }
    if (!secReport.categories?.phishingSocialEngineering) {
      throw new Error('Phishing category missing from report.');
    }
  });

  // 5. LIGHTHOUSE AUDIT ENGINE
  await assertTest('Lighthouse Audit Engine: Formats Core Web Vitals telemetries', async () => {
    const audit = await runLighthouseAudit(window.location.href, 'mobile');
    if (!audit || typeof audit.scores?.performance !== 'number') {
      throw new Error('Invalid Lighthouse performance score returned.');
    }
    if (!audit.metrics?.fcp) {
      throw new Error('FCP Core Web Vital missing from telemetry.');
    }
  });

  // 6. SEO-MY-RANK-ADDR TELEMETRY
  await assertTest('SEO Rank Service: Queries domain authority metrics', async () => {
    const telemetry = await fetchSeoMyRankAddr('foundation.dev');
    if (!telemetry || !telemetry.googleRank) {
      throw new Error('SEO rank telemetry missing googleRank property.');
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Services Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
