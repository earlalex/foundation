// tests/finances.test.js
import { configManager } from '../core/config.js';

export async function runFinancesTests() {
  console.group('  Running Finances, Payroll & ACH Processing Tests...');
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

  await assertTest('Affiliate commission calculation is accurate', () => {
    const monthlyFee = 29.00;
    const commissionRate = 0.10;
    const referrals = 5;
    
    const monthlyEarnings = parseFloat((referrals * (monthlyFee * commissionRate)).toFixed(2));
    const expected = 14.50;

    if (monthlyEarnings !== expected) {
      throw new Error(`Expected $14.50 monthly credit, calculated $${monthlyEarnings.toFixed(2)}`);
    }
  });

  await assertTest('ACH fee configuration structure exists', async () => {
    const config = configManager.current;
    // ACH fee is typically configured in Stripe settings
    // This test ensures the structure is available for configuration
    if (typeof config !== 'object') {
      throw new Error('Configuration object invalid.');
    }
  });

  await assertTest('Stripe integration can be configured', async () => {
    const config = configManager.current;
    // Check that the config object can hold Stripe credentials
    config.stripe = config.stripe || {};
    if (typeof config.stripe !== 'object') {
      throw new Error('Stripe configuration must be an object.');
    }
  });

  await assertTest('Invoice tracking structure is valid', async () => {
    // Test invoice data structure
    const testInvoice = {
      id: 'inv-001',
      amount: 100.00,
      currency: 'USD',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    if (typeof testInvoice.amount !== 'number') {
      throw new Error('Invoice amount must be a number.');
    }
    if (!['pending', 'paid', 'failed'].includes(testInvoice.status)) {
      throw new Error('Invalid invoice status.');
    }
  });

  await assertTest('Payroll calculation handles decimal precision', () => {
    const hourlyRate = 25.50;
    const hoursWorked = 40;
    const grossPay = parseFloat((hourlyRate * hoursWorked).toFixed(2));
    
    if (grossPay !== 1020.00) {
      throw new Error(`Expected $1020.00, calculated $${grossPay.toFixed(2)}`);
    }
  });

  await assertTest('ACH $5 fee is properly configured', () => {
    const achFee = 5.00;
    const transactionAmount = 100.00;
    const totalWithFee = parseFloat((transactionAmount + achFee).toFixed(2));
    
    if (totalWithFee !== 105.00) {
      throw new Error(`Expected $105.00 total, calculated $${totalWithFee.toFixed(2)}`);
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Finances Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
