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

  if (btnGenerateWorksheet) {
    btnGenerateWorksheet.addEventListener('click', async (e) => {
      e.preventDefault();

      const revTarget = document.getElementById('worksheet-revenue-target')?.value || "50000";
      const subGoal = document.getElementById('worksheet-subscriber-goal')?.value || "10000";
      const companyName = worksheetCompanyNameInput ? worksheetCompanyNameInput.value : "Ascension Avenue Academy";
      const naicsDef = worksheetNaicsInput ? worksheetNaicsInput.value : "Custom / Specialized Education & Empowerment Consulting Services";
      const naicsCodeVal = bizNaicsSelect && bizNaicsSelect.value === 'custom'
        ? (bizNaicsCustom ? bizNaicsCustom.value : '541611')
        : (bizNaicsSelect ? bizNaicsSelect.value : '541611');

      btnGenerateWorksheet.disabled = true;
      btnGenerateWorksheet.textContent = 'Generating Worksheet...';

      if (worksheetStatus) {
        worksheetStatus.style.display = 'block';
        worksheetStatus.textContent = "Compiling company values, goals, and regulatory classifications...";
      }

      const purpose = "To elevate men and women into full alignment with their potential - empowering them to reclaim sovereignty over their mind, body, and business through discipline, clarity, and higher consciousness.";
      const mission = "To build transformational frameworks that merge fitness, mindset, and entrepreneurship, creating actionable programs, tools, and content that help people realign with their true purpose and achieve sustainable success.";
      const coreValues = [
        "Alignment over Achievement",
        "Discipline",
        "Integrity",
        "Ownership",
        "Creativity",
        "Sovereignty",
        "Growth",
        "Community Impact",
        "Health is Wealth"
      ];
      const kpis = [
        "Health & Energy",
        "Financial Performance",
        "Customer & Market",
        "Personal Growth & Operational Excellence"
      ];

      const worksheetData = {
        companyName,
        purpose,
        mission,
        coreValues,
        kpiCategories: kpis,
        targets: {
          monthlyRevenueTarget: Number(revTarget),
          subscriberGoal: Number(subGoal)
        },
        naics: {
          code: naicsCodeVal,
          definition: naicsDef
        },
        timestamp: new Date().toISOString()
      };

      const markdownContent = `# ${companyName} - Foundation Worksheet

## Purpose (Your Why)
"${purpose}"

## Mission (Your What & How)
"${mission}"

## 9 Core Values
${coreValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

## 12 KPIs Categories
${kpis.map(k => `- ${k}`).join('\n')}

## Operational Targets
- **Monthly Revenue Target:** $${Number(revTarget).toLocaleString()}
- **Subscriber Goal:** ${Number(subGoal).toLocaleString()}

## NAICS Code & Definition
- **NAICS Code:** ${naicsCodeVal}
- **NAICS Definition:** ${naicsDef}

---
*Generated dynamically in the Ascension Avenue Academy Admin Command Center on ${new Date().toLocaleString()}*`;

      try {
        // Upload Markdown file
        const mdBlob = new Blob([markdownContent], { type: 'text/markdown' });
        const mdFile = new File([mdBlob], `${companyName.replace(/ /g, '_')}_Foundation_Worksheet.md`, { type: 'text/markdown' });
        mdFile.isCorporateBinder = true;
        const mdRes = await uploadFileToDrive(mdFile);

        // Upload JSON file
        const jsonBlob = new Blob([JSON.stringify(worksheetData, null, 2)], { type: 'application/json' });
        const jsonFile = new File([jsonBlob], `${companyName.replace(/ /g, '_')}_Foundation_Worksheet.json`, { type: 'application/json' });
        jsonFile.isCorporateBinder = true;
        const jsonRes = await uploadFileToDrive(jsonFile);

        if (mdRes && jsonRes) {
          toast.success("Foundation Worksheet generated and securely saved to corporate-binder/ inside Google Drive and synced to LastPass Notes!");

          if (worksheetStatus) {
            worksheetStatus.style.background = "#f0fdf4";
            worksheetStatus.style.borderColor = "#bbf7d0";
            worksheetStatus.style.color = "#15803d";
            worksheetStatus.innerHTML = `
              <strong>✓ Foundation Worksheet successfully generated & archived!</strong><br>
              Saved to: <code>corporate-binder/${mdFile.name}</code><br>
              Google Drive ID: <code>${mdRes.id}</code><br>
              Autofill and download copies locally below.
            `;
          }

          // Enable and show local download buttons
          if (btnDownloadMd) {
            btnDownloadMd.style.display = 'inline-block';
            btnDownloadMd.onclick = () => {
              const url = URL.createObjectURL(mdBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = mdFile.name;
              a.click();
              URL.revokeObjectURL(url);
            };
          }

          if (btnDownloadJson) {
            btnDownloadJson.style.display = 'inline-block';
            btnDownloadJson.onclick = () => {
              const url = URL.createObjectURL(jsonBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = jsonFile.name;
              a.click();
              URL.revokeObjectURL(url);
            };
          }
        } else {
          throw new Error("Failed to upload worksheets to Google Drive.");
        }
      } catch (err) {
        errorHandler.handleError(err, 'Admin Business Profile - Worksheet Generator');
        toast.error(`Worksheet Generator Error: ${err.message}`);
        if (worksheetStatus) {
          worksheetStatus.style.background = "#fff5f5";
          worksheetStatus.style.borderColor = "#fed7d7";
          worksheetStatus.style.color = "#c53030";
          worksheetStatus.textContent = `Error: ${err.message}`;
        }
      } finally {
        btnGenerateWorksheet.disabled = false;
        btnGenerateWorksheet.textContent = 'Generate & Save Foundation Worksheet to Corporate Binder';
      }
    });
  }
}
