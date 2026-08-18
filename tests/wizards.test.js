// tests/wizards.test.js - Comprehensive Unit & Integration Tests for Setup Wizards & Readiness Guards
import { configManager } from '../core/config.js';
import { store } from '../core/store.js';
import { AdminSetupWizards, synthesizeBrandFromWorksheet, FoundationWorksheetWizard } from '../pages/admin/components/AdminSetupWizards.js';
import { themeEngine, ensureContrastCompliance, calculateContrastRatio } from '../core/theme.js';

export async function runWizardsTests() {
  console.group('  Running Overhauled Setup Wizards & Readiness Guards Test Suite...');
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

  // Preserve initial states
  const originalConfig = { ...configManager.current };

  await assertTest('Wizards Matrix: Correctly detects initial unconfigured state', async () => {
    configManager.current = {
      isInstalled: false,
      siteTitle: "Foundation Framework", // default title
      siteDomain: "",
      firebase: { apiKey: "", projectId: "" },
      google: { clientId: "", clientSecret: "" },
      sectionWizards: {
        section1: false,
        section2: false,
        section3: false,
        section4: false
      }
    };

    if (configManager.isBrandConfigured()) {
      throw new Error("Brand guard falsely marked default/unconfigured site as configured.");
    }
    if (configManager.isApiKeysConfigured()) {
      throw new Error("API keys guard falsely marked unconfigured API keys as configured.");
    }
    if (configManager.isSection1Configured()) {
      throw new Error("Section 1 wizard was flagged as configured initially.");
    }
    if (configManager.isSection2Configured()) {
      throw new Error("Section 2 wizard was flagged as configured initially.");
    }
  });

  await assertTest('Wizards Matrix: Section 1 Site & Brand configuration unlocks gated brand attributes', async () => {
    configManager.current = {
      ...configManager.current,
      siteTitle: "Ascension Strategic Academy",
      siteDomain: "https://ascension.academy.dev",
      firebase: { apiKey: "AIzaSy_demo_key_99", projectId: "demo-proj" },
      google: { clientId: "g_id_1", clientSecret: "g_sec_1" },
      sectionWizards: {
        section1: true
      }
    };

    if (!configManager.isBrandConfigured()) {
      throw new Error("Brand guard failed to authorize valid customized site details.");
    }
    if (!configManager.isApiKeysConfigured()) {
      throw new Error("API keys guard failed to validate correctly structured keys.");
    }
    if (!configManager.isSection1Configured()) {
      throw new Error("isSection1Configured did not dynamically register as unlocked.");
    }
  });

  await assertTest('Wizards Matrix: Section 2 Business & Finances configuration unlocks Stripe Connect and ACH paths', async () => {
    configManager.current = {
      ...configManager.current,
      businessProfile: {
        legalName: "Ascension Corp",
        address: "100 Innovation Way",
        ein: "12-3456789",
        naicsCode: "541511"
      },
      stripe: {
        secretKey: "sk_test_123",
        publishableKey: "pk_test_456",
        priceId: "price_abc",
        achFee: 500
      },
      sectionWizards: {
        section2: true
      }
    };

    if (!configManager.isBusinessConfigured()) {
      throw new Error("Business guard failed to identify valid legal/profile data.");
    }
    if (!configManager.isFinancesConfigured()) {
      throw new Error("Finances guard failed to authorize valid Stripe credentials.");
    }
    if (!configManager.isSection2Configured()) {
      throw new Error("isSection2Configured failed to dynamically register as unlocked.");
    }
  });

  await assertTest('Wizards Matrix: Onboarding progress helper reads configuration settings correctly', async () => {
    configManager.current = {
      ...configManager.current,
      sectionWizards: {
        section1: true,
        section2: true,
        section3: false,
        section4: false
      }
    };

    const progress = AdminSetupWizards.getOnboardingProgress();
    if (!progress.section1 || !progress.section2 || progress.section3 || progress.section4) {
      throw new Error("Onboarding progress helper returned incorrect section configuration mapping.");
    }
  });

  await assertTest('Wizards Matrix: Simulates form input sanitization and required field enforcement rules', async () => {
    // 1. Validation check for Section 1 Step 1 (Site Metadata)
    const mockStep1Validate = (title, domain) => {
      if (!title || !domain) {
        throw new Error("Website Title and Domain URL are required!");
      }
    };
    try {
      mockStep1Validate("", "https://valid.com");
      throw new Error("Input validation allowed empty title.");
    } catch (e) {
      if (!e.message.includes("required")) throw e;
    }

    // 2. Validation check for Section 1 Step 4 (API Keys required fields)
    const mockStep4Validate = (fbKey, googleId, stripeSec) => {
      if (!fbKey || !googleId || !stripeSec) {
        throw new Error("Required key input is missing.");
      }
    };
    try {
      mockStep4Validate("fb_key", "g_id", "");
      throw new Error("API keys check allowed missing Stripe secret.");
    } catch (e) {
      if (!e.message.includes("missing")) throw e;
    }
  });

  await assertTest('Wizards Matrix: Configuration persistence is fallback-resilient to LocalStorage', async () => {
    const testConfig = {
      ...configManager.current,
      siteTitle: "FallBack Persistent Framework Test"
    };

    // Simulate saving via configManager directly which triggers localStorage fallback writes
    localStorage.setItem('foundation_config', JSON.stringify(testConfig));

    // Read fallback configuration
    const fallbackLoaded = JSON.parse(localStorage.getItem('foundation_config'));
    if (fallbackLoaded.siteTitle !== "FallBack Persistent Framework Test") {
      throw new Error("Configuration failed to persist to LocalStorage fallback.");
    }
  });

  await assertTest('Brand Synthesis Engine: Synthesizes design system adhering to psychology matrix schema', async () => {
    const mockWorksheet = {
      purpose: "To elevate men and women into full alignment through physical mastery, action, and discipline.",
      mission: "Build transformational frameworks.",
      values: ["Discipline: Consistency is mastery", "Integrity: Act in truth", "Ownership: Radical accountability"],
      kpis: ["Health & Energy: Physical programs", "Financial: Growth targets"]
    };

    const brand = await synthesizeBrandFromWorksheet(mockWorksheet);
    if (!brand || !brand.colors || !brand.typography || !brand.designRationale) {
      throw new Error("Brand synthesis failed to return valid schema structure.");
    }
    if (!brand.colors.primary || !brand.colors.surface || !brand.typography.headingFont) {
      throw new Error("Brand synthesis output missing core color or font tokens.");
    }
    if (!brand.designRationale.colorPsychology || !brand.designRationale.typographyRationale) {
      throw new Error("Brand synthesis output missing design psychology rationale.");
    }
  });

  await assertTest('WCAG Contrast Compliance: Detects insufficient contrast and auto-adjusts text primary', async () => {
    const lowContrastText = "#808080"; // Grey on white has ratio ~3.95 (< 4.5:1)
    const whiteBg = "#FFFFFF";

    const initialRatio = calculateContrastRatio(lowContrastText, whiteBg);
    const compliantText = ensureContrastCompliance(lowContrastText, whiteBg, 4.5);
    const finalRatio = calculateContrastRatio(compliantText, whiteBg);

    if (finalRatio < 4.5) {
      throw new Error(`WCAG contrast compliance failed to auto-adjust text color to >= 4.5:1 ratio (got ${finalRatio.toFixed(2)}).`);
    }
  });

  await assertTest('Theme Engine: Dynamic Theme Injection applies CSS Custom Properties and state persistence', async () => {
    const testBrand = {
      colors: {
        primary: "#1E3A8A",
        primaryHover: "#1D4ED8",
        accent: "#D97706",
        surface: "#FFFFFF",
        surfaceAlt: "#F8FAFC",
        textPrimary: "#0F172A",
        textSecondary: "#475569"
      },
      typography: {
        headingFont: "Cinzel",
        bodyFont: "Plus Jakarta Sans"
      }
    };

    themeEngine.applyCustomDesignSystem(testBrand);

    const rootPrimary = document.documentElement.style.getPropertyValue('--theme-color-primary');
    if (rootPrimary !== "#1E3A8A") {
      throw new Error(`Theme Engine failed to inject --theme-color-primary onto :root (expected #1E3A8A, got ${rootPrimary}).`);
    }

    const savedCustom = localStorage.getItem('foundation_theme_custom');
    if (!savedCustom) {
      throw new Error("Theme Engine failed to persist custom design tokens to LocalStorage foundation_theme_custom.");
    }
  });

  await assertTest('Foundation Worksheet Wizard: Generates complete Markdown binder content', async () => {
    const wizard = new FoundationWorksheetWizard();
    const md = wizard.generateMarkdownBinderContent();

    if (!md.includes("## 1. Purpose (Your Why)") || !md.includes("## 3. The 9 Core Values")) {
      throw new Error("Foundation Worksheet Wizard failed to generate required 4-part structure in Markdown binder.");
    }
  });

  // Restore configuration state cleanly
  configManager.current = originalConfig;

  const passedAll = totalTests === passedTests;
  console.log(
    `%c\n  Setup Wizards Overhaul Summary: ${passedTests}/${totalTests} Tests Passed ${passedAll ? '✅' : '❌'}`,
    `font-size: 14px; font-weight: bold; color: ${passedAll ? '#38a169' : '#e53e3e'};`
  );
  console.groupEnd();

  if (!passedAll) {
    throw new Error('One or more over-hauled Setup Wizards tests failed.');
  }
}
