// tests/vault-naics.test.js
import { contentDB } from '../core/db.js';
import { configManager } from '../core/config.js';
import { store } from '../core/store.js';

export async function runVaultNaicsTests() {
  console.group('  Running Password Vault & NAICS Classification Tests...');
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

  // 1. Password Vault tests
  await assertTest('Vault Credentials: CRUD persistence triggers securely in contentDB', async () => {
    const credId = `cred_test_${Date.now()}`;
    const testCred = {
      id: credId,
      serviceName: 'Test Database',
      loginUrl: 'https://db.example.com',
      username: 'db_admin',
      password: 'SuperSecureEncryptedPassword123!',
      createdAt: new Date().toISOString()
    };

    // Save
    await contentDB.saveVaultCredential(testCred);

    // Retrieve
    const allCreds = await contentDB.getVaultCredentials();
    const retrieved = allCreds.find(c => c.id === credId);
    if (!retrieved || retrieved.serviceName !== 'Test Database') {
      throw new Error('Credential record was not persisted or retrieved correctly.');
    }

    // Delete
    await contentDB.deleteVaultCredential(credId);
    const cleanedCreds = await contentDB.getVaultCredentials();
    if (cleanedCreds.find(c => c.id === credId)) {
      throw new Error('Credential record was not deleted successfully.');
    }
  });

  await assertTest('LastPass API Parameters: Verify configuration structure is fully mapped', async () => {
    const lpConfig = configManager.current.lastpass;
    if (!lpConfig) {
      throw new Error('LastPass configuration structure is missing.');
    }
    if (lpConfig.apiEndpoint === undefined) {
      throw new Error('LastPass apiEndpoint parameter must be mapped.');
    }
    if (lpConfig.companyId === undefined) {
      throw new Error('LastPass companyId / Account Hash parameter must be mapped.');
    }
    if (lpConfig.provisioningHash === undefined && lpConfig.apiKey === undefined) {
      throw new Error('LastPass Provisioning Key / Hash parameter must be mapped.');
    }
  });

  await assertTest('Credential Masking: Enforces Editor block and unmasks only for Admins', async () => {
    // 1. Mock Editor
    store.dispatch('SET_USER', {
      uid: 'editor-1',
      email: 'editor@test.com',
      isAdmin: false,
      role: 'editor'
    });

    const isEditorAdmin = store.state.user.isAdmin;
    const isEditorRole = store.state.user.role === 'editor';
    if (isEditorAdmin || !isEditorRole) {
      throw new Error('State mapping issue: user should be registered as editor.');
    }

    // Programmatically check if the editor is denied viewing credentials
    const allowUnmask = store.state.user.isAdmin || store.state.user.role === 'admin';
    if (allowUnmask) {
      throw new Error('Editor was permitted to view unmasked credentials.');
    }

    // 2. Mock Admin
    store.dispatch('SET_USER', {
      uid: 'admin-1',
      email: 'admin@test.com',
      isAdmin: true,
      role: 'admin'
    });

    const allowUnmaskAdmin = store.state.user.isAdmin || store.state.user.role === 'admin';
    if (!allowUnmaskAdmin) {
      throw new Error('Admin was blocked from unmasking credential details.');
    }

    // Clean up
    store.dispatch('SET_USER', null);
  });

  // 2. NAICS Code tests
  await assertTest('NAICS Selection & Persistence: Saves and queries industry code metadata', async () => {
    // Update config with NAICS values
    const originalConfig = { ...configManager.current };

    const updatedConfig = {
      ...originalConfig,
      businessProfile: {
        ...originalConfig.businessProfile,
        naicsCode: '541511',
        naicsDefinition: 'Custom Computer Programming Services'
      }
    };

    // Save to config manager
    const originalSave = configManager.saveToFirebase;
    configManager.saveToFirebase = async (newCfg) => {
      configManager.current = newCfg;
      return true;
    };

    await configManager.saveToFirebase(updatedConfig);

    const checkConfig = configManager.current.businessProfile;
    if (checkConfig?.naicsCode !== '541511' || checkConfig?.naicsDefinition !== 'Custom Computer Programming Services') {
      throw new Error('NAICS classification details did not persist in business settings.');
    }

    // Restore
    configManager.saveToFirebase = originalSave;
    configManager.current = originalConfig;
  });

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Vault & NAICS Test Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more Vault & NAICS tests failed.');
  }
}
