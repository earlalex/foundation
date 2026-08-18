// pages/admin/admin-business-profile.js - Business & Legal profile management
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { FormValidator, adminFormRules } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';
import { renderDriveDirectoriesHub } from './admin-site-settings.js';
import { AdminSetupWizards } from './components/AdminSetupWizards.js';

export function initBusinessProfileTab() {
  const currentCfg = configManager.current || {};
  const bizProfile = currentCfg.businessProfile || {};
  
  // Form elements
  const bizLegalNameInput = document.getElementById('biz-legal-name');
  const bizDbaInput = document.getElementById('biz-dba');
  const bizEinInput = document.getElementById('biz-ein');
  const bizEntityTypeInput = document.getElementById('biz-entity-type');
  const bizAddressInput = document.getElementById('biz-address');
  const bizCityInput = document.getElementById('biz-city');
  const bizStateInput = document.getElementById('biz-state');
  const bizZipInput = document.getElementById('biz-zip');
  const bizCountryInput = document.getElementById('biz-country');
  const bizEmailInput = document.getElementById('biz-email');
  const bizSupportEmailInput = document.getElementById('biz-support-email');
  const bizPhoneInput = document.getElementById('biz-phone');
  const bizPrivacyUrlInput = document.getElementById('biz-privacy-url');
  const bizTermsUrlInput = document.getElementById('biz-terms-url');
  const bizRefundUrlInput = document.getElementById('biz-refund-url');

  // Financial & regulatory
  const bizDunsInput = document.getElementById('biz-duns');
  const bizBankNameInput = document.getElementById('biz-bank-name');
  const bizBankRoutingInput = document.getElementById('biz-bank-routing');
  const bizBankAccountInput = document.getElementById('biz-bank-account');

  // NAICS Elements
  const bizNaicsSelect = document.getElementById('biz-naics-select');
  const bizNaicsCustom = document.getElementById('biz-naics-custom');
  const bizNaicsDefinition = document.getElementById('biz-naics-definition');

  // Document status divs
  const docArticlesStatus = document.getElementById('biz-doc-articles-status');
  const docOperatingStatus = document.getElementById('biz-doc-operating-status');
  const docEinStatus = document.getElementById('biz-doc-ein-status');

  const naicsDefinitions = {
    '541511': 'Custom Computer Programming Services',
    '541512': 'Computer Systems Design Services',
    '541611': 'Administrative Management Consulting',
    '454110': 'Electronic Shopping and Mail-Order Houses'
  };

  // Load existing values
  if (bizLegalNameInput) bizLegalNameInput.value = bizProfile.legalName || 'Ascension Avenue Academy';
  if (bizDbaInput) bizDbaInput.value = bizProfile.dba || 'Ascension Avenue Academy';
  if (bizEinInput) bizEinInput.value = bizProfile.ein || '';
  if (bizEntityTypeInput) bizEntityTypeInput.value = bizProfile.entityType || 'llc';
  if (bizAddressInput) bizAddressInput.value = bizProfile.address || '';
  if (bizCityInput) bizCityInput.value = bizProfile.city || '';
  if (bizStateInput) bizStateInput.value = bizProfile.state || '';
  if (bizZipInput) bizZipInput.value = bizProfile.zip || '';
  if (bizCountryInput) bizCountryInput.value = bizProfile.country || '';
  if (bizEmailInput) bizEmailInput.value = bizProfile.email || 'contact@ascensionavenue.com';
  if (bizSupportEmailInput) bizSupportEmailInput.value = bizProfile.supportEmail || 'support@ascensionavenue.com';
  if (bizPhoneInput) bizPhoneInput.value = bizProfile.phone || '';
  if (bizPrivacyUrlInput) bizPrivacyUrlInput.value = bizProfile.privacyUrl || '/privacy';
  if (bizTermsUrlInput) bizTermsUrlInput.value = bizProfile.termsUrl || '/terms';
  if (bizRefundUrlInput) bizRefundUrlInput.value = bizProfile.refundUrl || '/refunds';

  if (bizDunsInput) bizDunsInput.value = bizProfile.duns || '';
  if (bizBankNameInput) bizBankNameInput.value = bizProfile.bankName || '';
  if (bizBankRoutingInput) bizBankRoutingInput.value = bizProfile.bankRouting || '';
  if (bizBankAccountInput) bizBankAccountInput.value = bizProfile.bankAccount || '';

  // Setup NAICS elements and select listeners
  if (bizNaicsSelect) {
    const savedCode = bizProfile.naicsCode || '541611';
    if (naicsDefinitions[savedCode]) {
      bizNaicsSelect.value = savedCode;
    } else if (savedCode) {
      bizNaicsSelect.value = 'custom';
      if (bizNaicsCustom) {
        bizNaicsCustom.value = savedCode;
        bizNaicsCustom.disabled = false;
      }
    }

    if (bizNaicsDefinition) {
      bizNaicsDefinition.value = bizProfile.naicsDefinition || 'Custom / Specialized Education & Empowerment Consulting Services';
    }

    bizNaicsSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'custom') {
        if (bizNaicsCustom) {
          bizNaicsCustom.disabled = false;
          bizNaicsCustom.value = '';
        }
        if (bizNaicsDefinition) {
          bizNaicsDefinition.value = '';
        }
      } else if (val) {
        if (bizNaicsCustom) {
          bizNaicsCustom.disabled = true;
          bizNaicsCustom.value = '';
        }
        if (bizNaicsDefinition) {
          bizNaicsDefinition.value = naicsDefinitions[val] || '';
        }
      } else {
        if (bizNaicsCustom) {
          bizNaicsCustom.disabled = true;
          bizNaicsCustom.value = '';
        }
        if (bizNaicsDefinition) {
          bizNaicsDefinition.value = '';
        }
      }
    });
  }

  // Show verified presence for existing documents
  if (docArticlesStatus && bizProfile.articlesDocId) {
    docArticlesStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${bizProfile.articlesDocId}</code>)`;
  }
  if (docOperatingStatus && bizProfile.operatingDocId) {
    docOperatingStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${bizProfile.operatingDocId}</code>)`;
  }
  if (docEinStatus && bizProfile.einDocId) {
    docEinStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${bizProfile.einDocId}</code>)`;
  }

  // Initialize form validator
  const businessProfileForm = document.getElementById('business-profile-form');
  let businessProfileValidator = null;
  if (businessProfileForm) {
    businessProfileValidator = new FormValidator(businessProfileForm, adminFormRules.businessProfile);
  }

  document.getElementById('business-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (businessProfileValidator && !businessProfileValidator.validateAll()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const articlesFile = document.getElementById('biz-doc-articles')?.files[0];
      const operatingFile = document.getElementById('biz-doc-operating')?.files[0];
      const einFile = document.getElementById('biz-doc-ein')?.files[0];

      let articlesDocId = bizProfile.articlesDocId || null;
      let operatingDocId = bizProfile.operatingDocId || null;
      let einDocId = bizProfile.einDocId || null;

      if (articlesFile) {
        articlesFile.isPrivateDoc = true;
        const res = await uploadFileToDrive(articlesFile);
        if (res) {
          articlesDocId = res.id;
          if (docArticlesStatus) docArticlesStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${res.id}</code>)`;
        }
      }
      if (operatingFile) {
        operatingFile.isPrivateDoc = true;
        const res = await uploadFileToDrive(operatingFile);
        if (res) {
          operatingDocId = res.id;
          if (docOperatingStatus) docOperatingStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${res.id}</code>)`;
        }
      }
      if (einFile) {
        einFile.isPrivateDoc = true;
        const res = await uploadFileToDrive(einFile);
        if (res) {
          einDocId = res.id;
          if (docEinStatus) docEinStatus.innerHTML = `Presence Verified ✅ (Drive ID: <code>${res.id}</code>)`;
        }
      }

      const naicsCodeVal = bizNaicsSelect && bizNaicsSelect.value === 'custom'
        ? (bizNaicsCustom ? bizNaicsCustom.value : '')
        : (bizNaicsSelect ? bizNaicsSelect.value : '');

      const updatedBizConfig = {
        ...configManager.current,
        businessProfile: {
          legalName: bizLegalNameInput.value,
          dba: bizDbaInput.value,
          ein: bizEinInput.value,
          entityType: bizEntityTypeInput.value,
          address: bizAddressInput.value,
          city: bizCityInput.value,
          state: bizStateInput.value,
          zip: bizZipInput.value,
          country: bizCountryInput.value,
          email: bizEmailInput.value,
          supportEmail: bizSupportEmailInput.value,
          phone: bizPhoneInput.value,
          privacyUrl: bizPrivacyUrlInput.value,
          termsUrl: bizTermsUrlInput.value,
          refundUrl: bizRefundUrlInput.value,
          duns: bizDunsInput.value,
          bankName: bizBankNameInput.value,
          bankRouting: bizBankRoutingInput.value,
          bankAccount: bizBankAccountInput.value,
          naicsCode: naicsCodeVal,
          naicsDefinition: bizNaicsDefinition ? bizNaicsDefinition.value : '',
          articlesDocId,
          operatingDocId,
          einDocId
        }
      };
      const success = await configManager.saveToFirebase(updatedBizConfig);
      if (success) {
        toast.success(`Business & Legal Profile updated for "${bizLegalNameInput.value}"!`);
      } else {
        toast.error('Failed to save business profile. Please try again.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin Business Profile - Form Submission');
      toast.error(`Error saving business profile: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  // --- DIRECTIVE 3: FOUNDATION WORKSHEET GENERATOR CONTROLLER ---
  const btnGenerateWorksheet = document.getElementById('btn-generate-worksheet');
  const btnDownloadMd = document.getElementById('btn-download-worksheet-md');
  const btnDownloadJson = document.getElementById('btn-download-worksheet-json');
  const worksheetStatus = document.getElementById('worksheet-status');

  const worksheetCompanyNameInput = document.getElementById('worksheet-company-name');
  const worksheetNaicsInput = document.getElementById('worksheet-naics-selection');

  if (worksheetCompanyNameInput && bizLegalNameInput) {
    worksheetCompanyNameInput.value = bizLegalNameInput.value || "Ascension Avenue Academy";
    bizLegalNameInput.addEventListener('input', () => {
      worksheetCompanyNameInput.value = bizLegalNameInput.value || "Ascension Avenue Academy";
    });
  }

  if (worksheetNaicsInput && bizNaicsDefinition) {
    worksheetNaicsInput.value = bizNaicsDefinition.value || "Custom / Specialized Education & Empowerment Consulting Services";
    bizNaicsDefinition.addEventListener('input', () => {
      worksheetNaicsInput.value = bizNaicsDefinition.value || "Custom / Specialized Education & Empowerment Consulting Services";
    });
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return str == null ? '' : String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (btnGenerateWorksheet) {
    btnGenerateWorksheet.addEventListener('click', async (e) => {
      e.preventDefault();
      // Launch <foundation-worksheet-wizard> modal
      AdminSetupWizards.launchFoundationWorksheetWizard((brand, driveUploadRes) => {
        if (worksheetStatus) {
          worksheetStatus.style.display = 'block';
          worksheetStatus.style.background = driveUploadRes ? '#f0fdf4' : '#fffbe0';
          worksheetStatus.style.borderColor = driveUploadRes ? '#bbf7d0' : '#fef08a';
          worksheetStatus.style.color = driveUploadRes ? '#15803d' : '#854d0e';

          const safeDriveId = driveUploadRes?.id ? escapeHTML(driveUploadRes.id) : null;
          const safePrimary = escapeHTML(brand?.colors?.primary || '#1E3A8A');
          const safeHeadingFont = escapeHTML(brand?.typography?.headingFont || 'Cinzel');

          worksheetStatus.innerHTML = `
            <strong>✓ Foundation Worksheet & Semantic Brand Guide synthesized & applied!</strong><br>
            ${safeDriveId ? `Archived to Google Drive: <code>corporate-binder/Foundation_Worksheet.md</code> (ID: <code>${safeDriveId}</code>)` : `Saved locally (Google Drive upload offline or pending authentication)`}<br>
            Primary Color: <code>${safePrimary}</code> | Heading Font: <code>${safeHeadingFont}</code>
          `;
        }
      });
    });
  }

  // Google Workspace Drive Directories Hub inside Business Profile
  const tabBusiness = document.getElementById('tab-business');
  if (tabBusiness) {
    let driveCard = document.getElementById('google-drive-directories-business-card');
    if (!driveCard) {
      driveCard = document.createElement('div');
      driveCard.id = 'google-drive-directories-business-card';
      driveCard.style.cssText = `
        background: var(--theme-color-surface, #ffffff);
        border: 1px solid var(--theme-color-border, #e2e8f0);
        padding: 1.5rem;
        border-radius: var(--theme-layout-border-radius, 8px);
        margin-top: 1.5rem;
      `;
      // Append to the bottom of the tab-business panel
      tabBusiness.appendChild(driveCard);
    }
    renderDriveDirectoriesHub(driveCard);
  }
}
