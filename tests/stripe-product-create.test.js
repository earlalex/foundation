// tests/stripe-product-create.test.js - Stripe Product/Price Creation API Tests
import { configManager } from '../core/config.js';

export async function runStripeProductCreateTests() {
  console.group('  Running Stripe Product Create Endpoint Tests...');
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

  await assertTest('Stripe Product Create: Endpoint handles missing authorization header with HTTP 403 Forbidden', async () => {
    let response;
    try {
      response = await fetch('/api/stripe-product-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Course', amount: 9900 })
      });
    } catch (e) {
      // Genuinely offline/unreachable endpoint - skip test
      console.log('    [SKIP]: Endpoint unreachable, skipping test:', e.message);
      throw new Error('SKIP: Endpoint unreachable');
    }

    if (response.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden, got ${response.status}`);
    }
  });

  await assertTest('Stripe Product Create: Endpoint processes authorized request with simulation mode fallback', async () => {
    let response;
    try {
      response = await fetch('/api/stripe-product-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock_admin_test_token'
        },
        body: JSON.stringify({ name: 'Sovereign Architecture Guide', amount: 4900, currency: 'usd' })
      });
    } catch (e) {
      // Genuinely offline/unreachable endpoint - skip test
      console.log('    [SKIP]: Endpoint unreachable, skipping test:', e.message);
      throw new Error('SKIP: Endpoint unreachable');
    }

    if (response.status !== 200) {
      throw new Error(`Expected HTTP 200 OK, got ${response.status}`);
    }

    const data = await response.json();
    if (!data.productId || !data.priceId) {
      throw new Error('Response payload missing productId or priceId');
    }
  });

  await assertTest('Stripe Product Create: Validation rejects requests missing required fields', async () => {
    let response;
    try {
      response = await fetch('/api/stripe-product-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock_admin_test_token'
        },
        body: JSON.stringify({ description: 'Missing name and amount' })
      });
    } catch (e) {
      // Genuinely offline/unreachable endpoint - skip test
      console.log('    [SKIP]: Endpoint unreachable, skipping test:', e.message);
      throw new Error('SKIP: Endpoint unreachable');
    }

    if (response.status !== 400) {
      throw new Error(`Expected HTTP 400 Bad Request for missing required fields, got ${response.status}`);
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Stripe Product Create Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more Stripe Product Create API tests failed.');
  }
}
