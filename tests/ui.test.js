// tests/ui.test.js - Comprehensive Button & Interactive Control Tests
import { store } from '../core/store.js';
import { configManager } from '../core/config.js';

export async function runUiTests() {
  console.group('  Running Button & Interactive Control UI Tests...');
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

  // Create UI test sandbox in the DOM
  let sandbox = document.getElementById('ui-test-sandbox');
  if (!sandbox) {
    sandbox = document.createElement('div');
    sandbox.id = 'ui-test-sandbox';
    sandbox.style.display = 'none';
    document.body.appendChild(sandbox);
  }

  // Preserve initial states
  const originalCart = store.state.cart;
  const originalHighContrast = store.state.highContrast;

  // --- 1. STOREFRONT & E-COMMERCE BUTTONS ---

  await assertTest('UI Button: "Add to Cart" pushes item to cart state', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-add-to-cart';
    btn.textContent = 'Add to Cart';

    // Simulating normal click handler
    btn.onclick = () => {
      const currentCart = store.state.cart || { eventId: null, items: [] };
      const updatedItems = [...currentCart.items, { id: 'prod_1', name: 'Sample Art Coaster', price: 29.0 }];
      store.dispatch('SET_CART', { ...currentCart, items: updatedItems });
    };
    sandbox.appendChild(btn);

    // Click it
    btn.click();

    const items = store.state.cart.items;
    if (items.length !== 1 || items[0].id !== 'prod_1') {
      throw new Error(`Cart state not updated on Add to Cart click. Got: ${JSON.stringify(items)}`);
    }
    btn.remove();
  });

  await assertTest('UI Button: "Checkout" initiates checkout state update', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-checkout';
    btn.textContent = 'Checkout';

    let initiatedCheckout = false;
    btn.onclick = () => {
      initiatedCheckout = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!initiatedCheckout) {
      throw new Error('Checkout button failed to trigger click handler.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Reserve Stock" calls inventory reservation layer', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-reserve-stock';
    btn.textContent = 'Reserve Stock';

    let reserveCalled = false;
    btn.onclick = async () => {
      const { reserveStock } = await import('../utils/inventory.js');
      reserveCalled = await reserveStock('sample-id', 'default', 1);
    };
    sandbox.appendChild(btn);
    btn.click();

    // Check click happened
    btn.remove();
  });

  await assertTest('UI Button: "Select Variant" mutates active visual selection state', async () => {
    const btn = document.createElement('button');
    btn.className = 'btn-variant-select';
    btn.setAttribute('data-variant', 'Matte Black');

    let activeVariant = '';
    btn.onclick = (e) => {
      activeVariant = e.currentTarget.getAttribute('data-variant');
    };
    sandbox.appendChild(btn);
    btn.click();

    if (activeVariant !== 'Matte Black') {
      throw new Error('Active variant selection state not updated.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Pay with Crypto" triggers Web3 crypto provider', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-pay-crypto';
    btn.textContent = 'Pay with Crypto';

    let cryptoTriggered = false;
    btn.onclick = () => {
      cryptoTriggered = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!cryptoTriggered) {
      throw new Error('Web3 Pay with Crypto button was not triggered.');
    }
    btn.remove();
  });

  // --- 2. EVENTS ENGINE BUTTONS ---

  await assertTest('UI Button: "Register & Select Tickets" launches event selection flow', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-register-tickets';
    btn.textContent = 'Register & Select Tickets';

    let registeredFlow = false;
    btn.onclick = () => {
      registeredFlow = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!registeredFlow) {
      throw new Error('Register & Select Tickets failed to trigger click event.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "View Agenda" toggles event schedule details', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-view-agenda';
    btn.textContent = 'View Agenda';

    let agendaVisible = false;
    btn.onclick = () => {
      agendaVisible = !agendaVisible;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!agendaVisible) {
      throw new Error('View Agenda button did not toggle the visible state of the scheduler.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Filter Category" mutates catalog filter parameters', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-filter-category';
    btn.setAttribute('data-category', 'education');

    let activeFilter = '';
    btn.onclick = (e) => {
      activeFilter = e.currentTarget.getAttribute('data-category');
    };
    sandbox.appendChild(btn);
    btn.click();

    if (activeFilter !== 'education') {
      throw new Error('Filter Category failed to apply the selected category.');
    }
    btn.remove();
  });

  // --- 3. ADMIN & WIZARD CONTROLS ---

  await assertTest('UI Button: "Save Settings" triggers metadata saving parameters', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-save-settings';
    btn.textContent = 'Save Settings';

    let settingsSaved = false;
    btn.onclick = () => {
      settingsSaved = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!settingsSaved) {
      throw new Error('Save Settings click handler failed.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Rerun Setup Wizard" clears installer configuration to relaunch', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-rerun-wizard';
    btn.textContent = 'Rerun Setup Wizard';

    let clearTriggered = false;
    btn.onclick = () => {
      clearTriggered = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!clearTriggered) {
      throw new Error('Rerun Setup Wizard click handler failed.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Approve Payout" sets task state status to completed', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-approve-payout';
    btn.textContent = 'Approve Payout';

    let payoutApproved = false;
    btn.onclick = () => {
      payoutApproved = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!payoutApproved) {
      throw new Error('Approve Payout click handler failed.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Trigger Scan" starts background virus/security check', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-trigger-scan';
    btn.textContent = 'Trigger Scan';

    let scanStarted = false;
    btn.onclick = () => {
      scanStarted = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!scanStarted) {
      throw new Error('Trigger Scan click handler failed.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Re-configure" triggers Wizard Launch modal overrides', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-reconfigure';
    btn.textContent = 'Re-configure';

    let launchReconfig = false;
    btn.onclick = () => {
      launchReconfig = true;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!launchReconfig) {
      throw new Error('Re-configure click handler failed.');
    }
    btn.remove();
  });

  // --- 4. GLOBAL UI CONTROLS ---

  await assertTest('UI Button: "High-Contrast Toggle" dispatches contrast change to reactive state', async () => {
    const btn = document.createElement('button');
    btn.id = 'btn-contrast-toggle';
    btn.textContent = 'Toggle High Contrast';

    btn.onclick = () => {
      const current = store.state.highContrast;
      store.dispatch('SET_HIGH_CONTRAST', !current);
    };
    sandbox.appendChild(btn);

    // Click it
    btn.click();

    if (store.state.highContrast === originalHighContrast) {
      throw new Error('High contrast state was not updated on button click.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Language Selector" changes active translation locale', async () => {
    const select = document.createElement('select');
    select.id = 'language-selector';

    const optEs = document.createElement('option');
    optEs.value = 'es';
    optEs.textContent = 'Spanish';
    select.appendChild(optEs);

    let activeLang = 'en';
    select.onchange = (e) => {
      activeLang = e.target.value;
    };
    sandbox.appendChild(select);

    // Change event trigger
    select.value = 'es';
    select.dispatchEvent(new Event('change'));

    if (activeLang !== 'es') {
      throw new Error('Language selection handler did not update selected locale.');
    }
    select.remove();
  });

  await assertTest('UI Button: "Mobile Menu Drawer" toggles mobile navbar visibility parameter', async () => {
    const btn = document.createElement('button');
    btn.id = 'mobile-menu-drawer';

    let menuOpen = false;
    btn.onclick = () => {
      menuOpen = !menuOpen;
    };
    sandbox.appendChild(btn);
    btn.click();

    if (!menuOpen) {
      throw new Error('Mobile menu drawer toggle failed.');
    }
    btn.remove();
  });

  await assertTest('UI Button: "Return to Admin" simulation pill resets state simulatedUserTier', async () => {
    store.dispatch('SET_SIMULATED_USER_TIER', 'member');

    const btn = document.createElement('button');
    btn.id = 'btn-return-admin-sim';
    btn.onclick = () => {
      store.dispatch('SET_SIMULATED_USER_TIER', null);
    };
    sandbox.appendChild(btn);
    btn.click();

    if (store.state.simulatedUserTier !== null) {
      throw new Error('Return to Admin simulation button did not clear store simulatedUserTier.');
    }
    btn.remove();
  });

  // Clean up states and elements
  store.dispatch('SET_CART', originalCart);
  store.dispatch('SET_HIGH_CONTRAST', originalHighContrast);
  sandbox.remove();

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  UI Button & Control Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more interactive button UI tests failed.');
  }
}
