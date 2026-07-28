// tests/store.test.js
import { store } from '../core/store.js';

export function runStoreTests() {
  console.group('  Running Global Store State Tests...');
  let totalTests = 0;
  let passedTests = 0;

  function assertTest(testName, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`%c    PASS: ${testName}`, 'color: #38a169; font-weight: bold;');
      passedTests++;
    } catch (err) {
      console.error(`    FAIL: ${testName}\n     Reason: ${err.message}`);
    }
  }

  assertTest('Reads initial state cleanly', () => {
    const currentState = store.state;
    if (typeof currentState !== 'object' || currentState === null) {
      throw new Error('State is not an object.');
    }
  });

  assertTest('Blocks direct state mutation (Strict Immutability)', () => {
    try {
      store.state.theme = 'hacked-theme';
      if (store.state.theme === 'hacked-theme') {
        throw new Error('State was directly mutated! Immutability broken.');
      }
    } catch (err) {
      if (!(err instanceof TypeError) && !err.message.includes('read only')) {
        throw err;
      }
    }
  });

  assertTest('Dispatches TOGGLE_THEME action successfully', () => {
    const initialTheme = store.state.theme;
    store.dispatch('TOGGLE_THEME');
    const newTheme = store.state.theme;
    if (newTheme === initialTheme) {
      throw new Error('Dispatch failed to update theme state.');
    }
  });

  assertTest('Dispatches APPLY_THEME_JSON action', () => {
    const mockTheme = { name: 'Test Theme', colors: { primary: '#000000' } };
    store.dispatch('APPLY_THEME_JSON', mockTheme);
    if (store.state.activeBrandGuide?.name !== 'Test Theme') {
      throw new Error('Failed to update activeBrandGuide state.');
    }
  });

  assertTest('Dispatches SET_DEV_MODE action', () => {
    store.dispatch('SET_DEV_MODE', true);
    if (store.state.devMode !== true) {
      throw new Error('SET_DEV_MODE failed to update state.');
    }
  });

  assertTest('Triggers subscriber callbacks on state update', () => {
    let listenerFired = false;
    const unsubscribe = store.subscribe(() => {
      listenerFired = true;
    });
    store.dispatch('TOGGLE_THEME');
    unsubscribe();
    if (!listenerFired) {
      throw new Error('Subscriber was not notified of state change.');
    }
  });

  assertTest('Unsubscribes listeners cleanly', () => {
    let callCount = 0;
    const unsubscribe = store.subscribe(() => {
      callCount++;
    });
    store.dispatch('TOGGLE_THEME');
    unsubscribe();
    store.dispatch('TOGGLE_THEME');
    if (callCount !== 1) {
      throw new Error(`Expected listener to fire 1 time, but fired ${callCount} times.`);
    }
  });

  assertTest('Rejects dispatch with invalid schema payload', () => {
    const userBefore = store.state.user;
    store.dispatch('SET_USER', {
      uid: 99999, // Invalid type: expected string
      email: 'test@example.com',
      isAdmin: true
    });
    if (store.state.user !== userBefore) {
      throw new Error('State updated despite schema validation failure!');
    }
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Store Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}
