// pages/admin/admin-business-profile.js - Business & Legal profile management
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';
import { FormValidator, adminFormRules } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';

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

  // Document status divs
  const docArticlesStatus = document.getElementById('biz-doc-articles-status');
  const docOperatingStatus = document.getElementById('biz-doc-operating-status');
  const docEinStatus = document.getElementById('biz-doc-ein-status');

  // Load existing values
  if (bizLegalNameInput) bizLegalNameInput.value = bizProfile.legalName || '';
  if (bizDbaInput) bizDbaInput.value = bizProfile.dba || '';
  if (bizEinInput) bizEinInput.value = bizProfile.ein || '';
  if (bizEntityTypeInput) bizEntityTypeInput.value = bizProfile.entityType || 'llc';
  if (bizAddressInput) bizAddressInput.value = bizProfile.address || '';
  if (bizCityInput) bizCityInput.value = bizProfile.city || '';
  if (bizStateInput) bizStateInput.value = bizProfile.state || '';
  if (bizZipInput) bizZipInput.value = bizProfile.zip || '';
  if (bizCountryInput) bizCountryInput.value = bizProfile.country || '';
  if (bizEmailInput) bizEmailInput.value = bizProfile.email || '';
  if (bizSupportEmailInput) bizSupportEmailInput.value = bizProfile.supportEmail || '';
  if (bizPhoneInput) bizPhoneInput.value = bizProfile.phone || '';
  if (bizPrivacyUrlInput) bizPrivacyUrlInput.value = bizProfile.privacyUrl || '/privacy';
  if (bizTermsUrlInput) bizTermsUrlInput.value = bizProfile.termsUrl || '/terms';
  if (bizRefundUrlInput) bizRefundUrlInput.value = bizProfile.refundUrl || '/refunds';

  if (bizDunsInput) bizDunsInput.value = bizProfile.duns || '';
  if (bizBankNameInput) bizBankNameInput.value = bizProfile.bankName || '';
  if (bizBankRoutingInput) bizBankRoutingInput.value = bizProfile.bankRouting || '';
  if (bizBankAccountInput) bizBankAccountInput.value = bizProfile.bankAccount || '';

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
}
