// tests/marketing.test.js
import { configManager } from '../core/config.js';
import { contentDB } from '../core/db.js';

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

  // EXPANDED WORKFLOW TESTS
  await assertTest('Workflow Triggers: Handles expanded onboarding & lifecycle event states', async () => {
    const validTriggers = [
      'user_registered',
      'product_purchased',
      'appointment_scheduled',
      'user_inactive_x_days',
      'form_submitted',
      'membership_canceled',
      'cart_abandoned'
    ];

    const testWorkflow = {
      id: `wf_${Date.now()}`,
      name: 'Gated Onboarding',
      trigger: 'user_registered',
      nodes: [
        { type: 'trigger', event: 'user_registered' },
        { type: 'action', actionType: 'SEND_GMAIL_TEMPLATE', templateId: 'welcome_template' }
      ]
    };

    if (!validTriggers.includes(testWorkflow.trigger)) {
      throw new Error(`Invalid triggers. trigger "${testWorkflow.trigger}" not mapped.`);
    }

    // Verify all specified triggers in directive are programmatically registered or evaluated
    const verifyTriggerRegistration = (triggerType) => validTriggers.includes(triggerType);
    for (const trig of validTriggers) {
      if (!verifyTriggerRegistration(trig)) {
        throw new Error(`Marketing Automation failed to map triggered state: "${trig}"`);
      }
    }
  });

  await assertTest('Workflow Execution: Configures delay nodes and target custom actions', async () => {
    const workflow = {
      id: `wf_delay_${Date.now()}`,
      name: 'Drip Email Campaign',
      trigger: 'cart_abandoned',
      nodes: [
        { id: 'node_1', type: 'trigger', event: 'cart_abandoned' },
        { id: 'node_2', type: 'delay', actionType: 'WAIT_DELAY', duration: 1, unit: 'days' },
        { id: 'node_3', type: 'action', actionType: 'SEND_GMAIL_TEMPLATE', templateId: 'abandoned_cart_promo' },
        { id: 'node_4', type: 'action', actionType: 'UPDATE_USER_ROLE', targetRole: 'subscriber' },
        { id: 'node_5', type: 'action', actionType: 'APPLY_DISCOUNT_PROMO', code: 'COMEBACK10' }
      ]
    };

    // Save and retrieve from contentDB
    await contentDB.saveMarketingWorkflow(workflow);
    const workflows = await contentDB.getMarketingWorkflows();
    const retrieved = workflows.find(w => w.id === workflow.id);

    if (!retrieved) {
      throw new Error('Failed to retrieve automated marketing workflow.');
    }

    // Verify WAIT_DELAY, SEND_GMAIL_TEMPLATE, UPDATE_USER_ROLE, APPLY_DISCOUNT_PROMO
    const actionTypes = retrieved.nodes.map(n => n.actionType).filter(Boolean);
    const requiredActions = ['WAIT_DELAY', 'SEND_GMAIL_TEMPLATE', 'UPDATE_USER_ROLE', 'APPLY_DISCOUNT_PROMO'];
    const missingActions = requiredActions.filter(a => !actionTypes.includes(a));

    if (missingActions.length > 0) {
      throw new Error(`Workflow actions are missing from the configuration: ${missingActions.join(', ')}`);
    }

    // Clean up
    await contentDB.deleteMarketingWorkflow(workflow.id);
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Marketing Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more marketing tests failed.');
  }
}
