// core/test-store.js
import { store } from './store.js';

export function runStoreTests() {
  console.group('🧪 Running Global Store State Tests...');
  let totalTests = 0;
  let passedTests = 0;

  function assertTest(testName, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`%c  ✅ PASS: ${testName}`, 'color: #38a169; font-weight: bold;');
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${testName}\n     Reason: ${err.message}`);
    }
  }

  // --- TEST 1: Read Initial State ---
  assertTest('Reads initial state cleanly', () => {
    const currentState = store.state;
    if (typeof currentState !== 'object' || currentState === null) {
      throw new Error('State is not an object.');
    }
  });

  // --- TEST 2: Enforce Immutability (Direct Mutation Must Fail) ---
  assertTest('Blocks direct state mutation', () => {
    try {
      // Attempting to directly write to state
      store.state.theme = 'hacked-theme';
      
      // If code reaches here without throwing in strict mode, verify state didn't change
      if (store.state.theme === 'hacked-theme') {
        throw new Error('State was directly mutated! Immutability broken.');
      }
    } catch (err) {
      // Expecting a TypeError because store.state is frozen!
      if (!(err instanceof TypeError) && !err.message.includes('read only')) {
        throw err;
      }
    }
  });

  // --- TEST 3: Controlled Action Dispatch ---
  assertTest('Updates state correctly via registered action', () => {
    const initialTheme = store.state.theme;
    
    // Dispatch action
    store.dispatch('TOGGLE_THEME');
    
    const newTheme = store.state.theme;
    if (newTheme === initialTheme) {
      throw new Error('Dispatch failed to update state.');
    }
  });

  // --- TEST 4: Pub/Sub Listener Notification ---
  assertTest('Triggers subscriber callbacks on state update', () => {
    let listenerFired = false;
    
    // Subscribe temporary listener
    const unsubscribe = store.subscribe((updatedState) => {
      listenerFired = true;
    });

    // Trigger update
    store.dispatch('TOGGLE_THEME');

    // Clean up subscriber
    unsubscribe();

    if (!listenerFired) {
      throw new Error('Subscriber was not notified of state change.');
    }
  });

  // --- TEST 5: Unsubscribe Handling ---
  assertTest('Unsubscribes listeners cleanly', () => {
    let callCount = 0;
    
    const unsubscribe = store.subscribe(() => {
      callCount++;
    });

    store.dispatch('TOGGLE_THEME'); // callCount = 1
    unsubscribe();                  // Detach
    store.dispatch('TOGGLE_THEME'); // Should NOT increment callCount

    if (callCount !== 1) {
      throw new Error(`Expected listener to fire 1 time, but fired ${callCount} times.`);
    }
  });

  // --- TEST 6: Invalid Payload Schema Guard ---
  assertTest('Rejects dispatch with invalid schema payload', () => {
    const userBefore = store.state.user;

    // Dispatching invalid user object (uid should be string, passing number)
    store.dispatch('SET_USER', {
      uid: 99999, // ❌ Invalid type according to schema!
      email: 'test@example.com',
      isAdmin: true
    });

    // Verify state was reverted/untouched
    if (store.state.user !== userBefore) {
      throw new Error('State updated despite schema validation failure!');
    }
  });

  // --- SUMMARY ---
  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n📊 Store Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '🎉' : '⚠️'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();
}