// tests/hooks-plugins.test.js - Unit and integration tests for Hook System and Plugins Registry
import { hookSystem, addAction, doAction, addFilter, applyFilters } from '../core/hooks.js';
import { pluginManager } from '../core/plugins.js';

export async function runHooksPluginsTests() {
  console.group('Testing System-Wide Hooks & Plugins Pipeline...');

  // 1. Actions Queue Priority & Execution
  const actionExecutionOrder = [];
  addAction('test_action', () => {
    actionExecutionOrder.push('second');
  }, 20);

  addAction('test_action', () => {
    actionExecutionOrder.push('first');
  }, 5);

  await doAction('test_action');
  if (actionExecutionOrder[0] === 'first' && actionExecutionOrder[1] === 'second') {
    console.log('%c    PASS: Actions Queue executes callbacks in exact sorted priority order.', 'color: #38a169; font-weight: bold;');
  } else {
    throw new Error('Actions execution priority order is incorrect.');
  }

  // 2. Filter Pipeline data manipulation
  addFilter('test_filter', (val) => {
    return val + ' first';
  }, 10);

  addFilter('test_filter', (val) => {
    return val + ' second';
  }, 20);

  const filterResult = applyFilters('test_filter', 'base');
  if (filterResult === 'base first second') {
    console.log('%c    PASS: Filters Pipeline seamlessly mutates value payloads sequentially.', 'color: #38a169; font-weight: bold;');
  } else {
    throw new Error(`Filters payload mutation failed: received "${filterResult}"`);
  }

  // 3. Error boundary isolation (A failing hook shouldn't crash the application)
  let guardTriggered = false;
  addAction('failing_action', () => {
    throw new Error('Simulated failure');
  }, 10);
  addAction('failing_action', () => {
    guardTriggered = true;
  }, 20);

  await doAction('failing_action');
  if (guardTriggered) {
    console.log('%c    PASS: Error boundary isolates failing action callbacks safely.', 'color: #38a169; font-weight: bold;');
  } else {
    throw new Error('Failing action hook crashed or blocked subsequent hook executions.');
  }

  // 4. Plugin manager registry & status toggling
  const initialCount = pluginManager.getPlugins().length;
  if (initialCount >= 2) {
    console.log('%c    PASS: Plugin Manager loads default system-wide manifests cleanly.', 'color: #38a169; font-weight: bold;');
  } else {
    throw new Error('Plugin Manager failed to load initial active plugin manifest models.');
  }

  pluginManager.togglePlugin('custom-analytics', false);
  const analyticsPlugin = pluginManager.getPlugins().find(p => p.id === 'custom-analytics');
  if (analyticsPlugin && analyticsPlugin.enabled === false) {
    console.log('%c    PASS: Admin controls safely toggle active states of individual plugins.', 'color: #38a169; font-weight: bold;');
  } else {
    throw new Error('Plugin state toggling failed inside Plugin Manager registry.');
  }

  console.groupEnd();
}
