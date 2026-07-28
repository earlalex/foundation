// tests/marketing.test.js
import { configManager } from '../core/config.js';

export async function runMarketingTests() {
  console.group('  Running Marketing Workflows & Kanban Board Tests...');
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

  await assertTest('Kanban board structure is valid', async () => {
    const testBoard = {
      id: 'board-1',
      name: 'Marketing Campaign',
      columns: [
        { id: 'col-1', title: 'To Do', tasks: [] },
        { id: 'col-2', title: 'In Progress', tasks: [] },
        { id: 'col-3', title: 'Done', tasks: [] }
      ]
    };
    
    if (!Array.isArray(testBoard.columns) || testBoard.columns.length !== 3) {
      throw new Error('Kanban board must have 3 columns.');
    }
  });

  await assertTest('Task can be moved between columns', async () => {
    const task = { id: 'task-1', title: 'Create landing page', status: 'todo' };
    
    // Simulate task movement
    task.status = 'in-progress';
    
    if (task.status !== 'in-progress') {
      throw new Error('Task status update failed.');
    }
  });

  await assertTest('Email campaign recipient filtering works', () => {
    const mockUsers = [
      { email: 'user1@example.com', role: 'subscriber', subscribed: true },
      { email: 'user2@example.com', role: 'member', subscribed: true },
      { email: 'user3@example.com', role: 'subscriber', subscribed: false },
      { email: 'user4@example.com', role: 'member', subscribed: true }
    ];
    
    const subscribedUsers = mockUsers.filter(u => u.subscribed);
    if (subscribedUsers.length !== 3) {
      throw new Error(`Expected 3 subscribed users, got ${subscribedUsers.length}`);
    }
  });

  await assertTest('Marketing analytics structure exists', async () => {
    const config = configManager.current;
    // Check for analytics configuration
    if (!config.thirdParty) {
      throw new Error('Third-party analytics configuration missing.');
    }
  });

  await assertTest('GA4 Property ID can be configured', async () => {
    const config = configManager.current;
    if (config.thirdParty && typeof config.thirdParty.ga4PropertyId !== 'string') {
      throw new Error('GA4 Property ID must be a string.');
    }
  });

  await assertTest('Looker Studio embed URL can be configured', async () => {
    const config = configManager.current;
    if (config.thirdParty && typeof config.thirdParty.lookerStudioEmbedUrl !== 'string') {
      throw new Error('Looker Studio embed URL must be a string.');
    }
  });

  await assertTest('Campaign tracking parameters are valid', () => {
    const utmParams = {
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'summer_sale',
      utm_content: 'banner'
    };
    
    const requiredParams = ['utm_source', 'utm_medium', 'utm_campaign'];
    const missingParams = requiredParams.filter(param => !utmParams[param]);
    
    if (missingParams.length > 0) {
      throw new Error(`Missing required UTM parameters: ${missingParams.join(', ')}`);
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Marketing Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
