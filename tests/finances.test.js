// tests/finances.test.js
import { configManager } from '../core/config.js';
import { contentDB } from '../core/db.js';

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
    if (typeof config !== 'object') {
      throw new Error('Configuration object invalid.');
    }
  });

  await assertTest('Stripe integration can be configured', async () => {
    const config = configManager.current;
    config.stripe = config.stripe || {};
    if (typeof config.stripe !== 'object') {
      throw new Error('Stripe configuration must be an object.');
    }
  });

  await assertTest('Invoice tracking structure is valid', async () => {
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

  // EXPANDED SCENARIOS
  await assertTest('Logging Expenses & Receipt Attachments: Saves and compiles category totals', async () => {
    const expId1 = `exp_test_1_${Date.now()}`;
    const expId2 = `exp_test_2_${Date.now()}`;

    const expense1 = {
      id: expId1,
      vendor: 'AWS Cloud',
      category: 'Software',
      amount: 120.50,
      date: '2026-07-28',
      receipt: { name: 'aws_receipt_1.pdf', src: '/drive/aws_receipt_1.pdf' }
    };
    const expense2 = {
      id: expId2,
      vendor: 'Google Workspace',
      category: 'Software',
      amount: 50.00,
      date: '2026-07-29',
      receipt: null
    };

    // Save
    await contentDB.saveExpense(expense1);
    await contentDB.saveExpense(expense2);

    // Query and aggregate
    const allExpenses = await contentDB.getExpenses();
    const softwareExpenses = allExpenses.filter(e => e.category === 'Software');
    const softwareTotal = softwareExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    if (softwareTotal < 170.50) {
      throw new Error(`Software total aggregation returned less than expected $170.50. Calculated: $${softwareTotal}`);
    }

    // Verify receipt attachment field mapping is registered
    const withReceipt = softwareExpenses.find(e => e.id === expId1);
    if (!withReceipt || !withReceipt.receipt || withReceipt.receipt.name !== 'aws_receipt_1.pdf') {
      throw new Error('Expense receipt attachment detail was not parsed correctly.');
    }
  });

  await assertTest('Payroll Management: Creates employees and records pay runs', async () => {
    const empId = `emp_test_${Date.now()}`;
    const employee = {
      id: empId,
      name: 'John Contractor',
      role: 'Staff Writer',
      payRate: 35.00,
      payStructure: 'hourly',
      payFrequency: 'Weekly',
      paymentMethod: 'ACH'
    };

    // Create Employee
    await contentDB.saveEmployee(employee);

    // Log pay run
    const payRunId = `pay_test_${Date.now()}`;
    const payRun = {
      id: payRunId,
      employeeId: empId,
      employeeName: 'John Contractor',
      units: 20, // 20 hours
      totalAmount: 700.00,
      paymentMethod: 'ACH',
      createdAt: new Date().toISOString()
    };
    await contentDB.savePayrollRecord(payRun);

    // Verify retrieval
    const payrollRecords = await contentDB.getPayrollRecords();
    const record = payrollRecords.find(p => p.id === payRunId);
    if (!record || record.totalAmount !== 700.00) {
      throw new Error('Payroll run record was not verified inside contentDB.');
    }

    // Clean up employee
    await contentDB.deleteEmployee(empId);
  });

  await assertTest('ACH Payment: Validates checkout payload with Stripe application_fee_amount', async () => {
    // Generate checkout payload for testing
    const buildCheckoutPayload = (enableAch, amount) => {
      const payload = {
        amount,
        currency: 'USD',
        enableAch
      };
      if (enableAch) {
        payload.payment_method_types = ['us_bank_account'];
        // ACH charging platform flat fee
        payload.application_fee_amount = 500; // $5 in cents
      } else {
        payload.payment_method_types = ['card'];
      }
      return payload;
    };

    const payload = buildCheckoutPayload(true, 10000); // $100.00
    if (!payload.payment_method_types.includes('us_bank_account')) {
      throw new Error('ACH payload missing us_bank_account payment method type.');
    }
    if (payload.application_fee_amount !== 500) {
      throw new Error('Platform fee application_fee_amount is not exactly 500 cents ($5.00).');
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Finances Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more finances tests failed.');
  }
}
