// pages/admin/admin-products.js - Products & Services management + Education Course Builder
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { FormValidator } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { stripeService } from '../../core/stripe.js';
import { getAssetSplits, saveAssetSplits, DEFAULT_ADMIN_SPLIT } from '../../core/royalties.js';

let selectedCourse = null;
let grapesLessonEditor = null;
let editingProductId = null;

export function initProductsTab() {
  const productForm = document.getElementById('product-form');
  const productsTbody = document.getElementById('products-tbody');
  const paymentTypeSelect = document.getElementById('product-payment-type');
  const retainerFields = document.getElementById('retainer-fields');

  // Subtab Elements
  const btnSubtabProducts = document.getElementById('btn-subtab-products');
  const btnSubtabCourses = document.getElementById('btn-subtab-courses');
  const panelSubtabProducts = document.getElementById('panel-subtab-products');
  const panelSubtabCourses = document.getElementById('panel-subtab-courses');

  // --- Subtab Switching Logic ---
  if (btnSubtabProducts && btnSubtabCourses && panelSubtabProducts && panelSubtabCourses) {
    btnSubtabProducts.addEventListener('click', () => {
      btnSubtabProducts.className = 'btn-primary';
      btnSubtabProducts.style.background = 'var(--theme-color-primary, #2b6cb0)';
      btnSubtabProducts.style.color = 'white';
      btnSubtabProducts.style.border = 'none';

      btnSubtabCourses.className = '';
      btnSubtabCourses.style.background = 'transparent';
      btnSubtabCourses.style.color = 'var(--theme-color-text-secondary, #4a5568)';
      btnSubtabCourses.style.border = '1px solid transparent';

      panelSubtabProducts.style.display = 'block';
      panelSubtabCourses.style.display = 'none';
    });

    btnSubtabCourses.addEventListener('click', () => {
      btnSubtabCourses.className = 'btn-primary';
      btnSubtabCourses.style.background = 'var(--theme-color-primary, #2b6cb0)';
      btnSubtabCourses.style.color = 'white';
      btnSubtabCourses.style.border = 'none';

      btnSubtabProducts.className = '';
      btnSubtabProducts.style.background = 'transparent';
      btnSubtabProducts.style.color = 'var(--theme-color-text-secondary, #4a5568)';
      btnSubtabProducts.style.border = '1px solid transparent';

      panelSubtabProducts.style.display = 'none';
      panelSubtabCourses.style.display = 'block';

      // Load courses on tab switch
      loadCourses();
    });
  }

  // Inject Product Royalty splits card
  if (productForm && !document.getElementById('product-splits-card')) {
    injectProductSplitsCard(productForm);
  }

  // Handle payment type change to show/hide retainer fields
  paymentTypeSelect?.addEventListener('change', () => {
    if (paymentTypeSelect.value === 'retainer_invoice') {
      retainerFields.style.display = 'block';
    } else {
      retainerFields.style.display = 'none';
    }
  });

  // Form validation for product
  let productValidator = null;
  if (productForm) {
    productValidator = new FormValidator(productForm, {
      'product-title': [(value) => value && value.trim().length > 0 ? null : 'Product title is required'],
      'product-category': [(value) => value && value.trim().length > 0 ? null : 'Category is required'],
      'product-price': [(value) => value && !isNaN(value) && parseFloat(value) > 0 ? null : 'Valid price is required'],
      'product-currency': [(value) => value ? null : 'Currency is required'],
      'product-payment-type': [(value) => value ? null : 'Payment type is required']
    });
  }

  // Load existing products
  async function loadProducts() {
    if (!productsTbody) return;
    
    try {
      const products = await contentDB.getContentByType('product');
      
      if (products.length === 0) {
        productsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1rem;">No products created yet.</td></tr>';
        return;
      }

      productsTbody.innerHTML = products.map(product => {
        const paymentTypeLabels = {
          'full_upfront': 'Full Upfront',
          'retainer_invoice': 'Retainer + Invoice',
          'invoice_only': 'Invoice Only'
        };
        const paymentTypeLabel = paymentTypeLabels[product.pricing?.paymentType] || product.pricing?.paymentType;
        const achBadge = product.stripe?.enableAch
          ? `<span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; background: #e6fffa; color: #319795; margin-left: 4px;">ACH Enabled</span>`
          : '';

        const stripeInfo = product.stripe?.priceId
          ? `<div style="font-size: 0.75rem; color: var(--theme-color-text-secondary, #718096); margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
               <span>Stripe ID: <code>${product.stripe.priceId}</code></span>
               <button class="btn-copy-stripe-id" data-copy="${product.stripe.priceId}" style="padding: 1px 5px; font-size: 0.7rem; border: 1px solid #cbd5e0; border-radius: 3px; background: white; cursor: pointer;">[ Copy Stripe ID ]</button>
               <a href="https://dashboard.stripe.com/test/products/${product.stripe.productId}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: bold; text-decoration: underline;">View</a>
             </div>`
          : '<div style="font-size: 0.75rem; color: #a0aec0; margin-top: 4px;">No Stripe Sync</div>';
        
        return `
          <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
            <td style="padding: 12px;">
              <div style="font-weight: 600; color: var(--theme-color-text-primary, #1a202c);">${product.title}</div>
              <div style="font-size: 0.8rem; color: var(--theme-color-text-secondary, #4a5568);">${product.description?.substring(0, 50)}...</div>
              ${stripeInfo}
            </td>
            <td style="padding: 12px;">${product.category}</td>
            <td style="padding: 12px;">${product.pricing?.currency || 'USD'} $${(product.pricing?.basePrice / 100).toFixed(2)}</td>
            <td style="padding: 12px;">
              <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; background: #ebf8ff; color: #2b6cb0;">${paymentTypeLabel}</span>
              ${achBadge}
            </td>
            <td style="padding: 12px;">
              <button class="btn-edit-product" data-product-id="${product.id}" style="padding: 6px 12px; background: #2b6cb0; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; margin-right: 4px;">Edit</button>
              <button class="btn-delete-product" data-product-id="${product.id}" style="padding: 6px 12px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Delete</button>
            </td>
          </tr>
        `;
      }).join('');

      // Attach event handlers
      attachProductHandlers();
    } catch (err) {
      errorHandler.handleError(err, 'Admin Products - Load Products');
      console.error('Failed to load products:', err);
      productsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #e53e3e; padding: 1rem;">Error loading products.</td></tr>';
    }
  }

  function attachProductHandlers() {
    productsTbody.querySelectorAll('.btn-copy-stripe-id').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const copyText = btn.getAttribute('data-copy');
        navigator.clipboard.writeText(copyText);
        toast.success(`Copied Stripe Price ID: ${copyText}`);
      });
    });

    productsTbody.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', async () => {
        const productId = btn.dataset.productId;
        if (confirm('Are you sure you want to delete this product?')) {
          try {
            await contentDB.deleteContent(productId);
            toast.success('Product deleted successfully.');
            loadProducts();
          } catch (err) {
            errorHandler.handleError(err, 'Admin Products - Delete Product');
            toast.error(`Failed to delete product: ${err.message}`);
          }
        }
      });
    });

    productsTbody.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', async () => {
        const productId = btn.dataset.productId;
        try {
          const products = await contentDB.getContentByType('product');
          const product = products.find(p => p.id === productId);
          if (!product) return;

          editingProductId = productId;

          // Populate inputs
          document.getElementById('product-title').value = product.title || '';
          document.getElementById('product-category').value = product.category || '';
          document.getElementById('product-description').value = product.description || '';
          document.getElementById('product-price').value = ((product.pricing?.basePrice || 0) / 100).toFixed(2);
          document.getElementById('product-currency').value = product.pricing?.currency || 'USD';
          document.getElementById('product-payment-type').value = product.pricing?.paymentType || 'full_upfront';

          if (product.pricing?.paymentType === 'retainer_invoice') {
            document.getElementById('retainer-fields').style.display = 'block';
            document.getElementById('product-retainer-amount').value = ((product.pricing?.retainerAmount || 0) / 100).toFixed(2);
            document.getElementById('product-retainer-percentage').value = product.pricing?.retainerPercentage || '';
          } else {
            document.getElementById('retainer-fields').style.display = 'none';
          }

          if (document.getElementById('product-stripe-id')) {
            document.getElementById('product-stripe-id').value = product.stripe?.productId || '';
          }
          if (document.getElementById('product-stripe-price-id')) {
            document.getElementById('product-stripe-price-id').value = product.stripe?.priceId || '';
          }
          if (document.getElementById('product-enable-ach')) {
            document.getElementById('product-enable-ach').checked = !!product.stripe?.enableAch;
          }
          if (document.getElementById('product-invoice-days')) {
            document.getElementById('product-invoice-days').value = product.invoiceSettings?.invoiceDueDays || 30;
          }
          if (document.getElementById('product-google-contact')) {
            document.getElementById('product-google-contact').value = product.invoiceSettings?.googleContactLink || '';
          }
          if (document.getElementById('product-payment-terms')) {
            document.getElementById('product-payment-terms').value = product.invoiceSettings?.paymentTerms || 'Net 30 days';
          }
          if (document.getElementById('product-image-url')) {
            document.getElementById('product-image-url').value = product.image || '';
          }

          // Load Royalty splits
          const splits = await getAssetSplits(productId);
          await loadSplitsIntoProductForm(splits);

          // Change submit button label
          const submitBtn = productForm.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.textContent = 'Update Product Entry';
          }

          productForm.scrollIntoView({ behavior: 'smooth' });
          toast.info(`Loaded product "${product.title}" details & royalty splits for editing.`);

        } catch (err) {
          toast.error(`Failed to load product: ${err.message}`);
        }
      });
    });
  }

  // Handle product form submission
  productForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (productValidator && !productValidator.validateAll()) {
      toast.error('Please fix the validation errors before creating the product.');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Product...';
    }

    try {
      // 1. Validate Product Royalty Splits if custom splits exist
      const rows = productForm.querySelectorAll('.product-split-row');
      let splits = [];
      if (rows.length > 0) {
        let sum = 0;
        rows.forEach(row => {
          sum += parseFloat(row.querySelector('.product-split-pct').value || 0);
        });

        if (Math.abs(sum - 100) > 0.01) {
          toast.error(`Product splits total percentage must equal exactly 100%! Current sum: ${sum}%`);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
          return;
        }

        rows.forEach(row => {
          const userEmail = row.querySelector('.product-split-user').value;
          splits.push({
            userId: userEmail,
            userEmail: userEmail,
            role: row.querySelector('.product-split-role').value,
            percentage: parseFloat(row.querySelector('.product-split-pct').value || 0)
          });
        });
      }

      const title = document.getElementById('product-title').value;
      const category = document.getElementById('product-category').value;
      const description = document.getElementById('product-description').value;
      const price = parseFloat(document.getElementById('product-price').value);
      const currency = document.getElementById('product-currency').value;
      const paymentType = document.getElementById('product-payment-type').value;
      const retainerAmount = document.getElementById('product-retainer-amount').value;
      const retainerPercentage = document.getElementById('product-retainer-percentage').value;
      let stripeProductId = document.getElementById('product-stripe-id').value;
      let stripePriceId = document.getElementById('product-stripe-price-id').value;
      const enableAch = document.getElementById('product-enable-ach')?.checked || false;
      const invoiceDays = parseInt(document.getElementById('product-invoice-days').value) || 30;
      const googleContact = document.getElementById('product-google-contact').value;
      const paymentTerms = document.getElementById('product-payment-terms').value;
      const imageUrl = document.getElementById('product-image-url')?.value || '';

      // Convert price to cents for Stripe compatibility
      const basePrice = Math.round(price * 100);

      // Auto-register Stripe product if empty
      if (!stripeProductId || !stripePriceId) {
        toast.info('Auto-syncing product with Stripe...');
        const stripeRes = await stripeService.registerStripeProduct(
          title,
          description || `${category} - ${title}`,
          basePrice,
          currency,
          false
        );
        stripeProductId = stripeRes.productId;
        stripePriceId = stripeRes.priceId;
      }

      const productId = editingProductId || 'product_' + Date.now();

      const productData = {
        type: 'product',
        id: productId,
        title,
        category,
        description,
        image: imageUrl,
        longFormText: description ? [description] : [],
        pricing: {
          basePrice,
          currency,
          paymentType,
          ...(paymentType === 'retainer_invoice' && {
            retainerAmount: retainerAmount ? Math.round(parseFloat(retainerAmount) * 100) : undefined,
            retainerPercentage: retainerPercentage ? parseFloat(retainerPercentage) : undefined
          })
        },
        stripe: {
          productId: stripeProductId || null,
          priceId: stripePriceId || null,
          enableAch: enableAch
        },
        invoiceSettings: {
          autoGenerateInvoice: paymentType !== 'full_upfront',
          invoiceDueDays: invoiceDays,
          paymentTerms: paymentTerms || 'Net 30 days',
          googleContactLink: googleContact || null
        }
      };

      await contentDB.saveContent(productData);

      // Save splits if configured, or revert to default admin split if all contributor rows were removed
      const splitsToSave = splits.length > 0 ? splits : DEFAULT_ADMIN_SPLIT;
      await saveAssetSplits(productId, 'merchandise', splitsToSave);

      toast.success(editingProductId ? 'Product details & royalty splits updated successfully!' : 'Product created successfully and synced with Stripe!');
      
      // Reset form
      productForm.reset();
      if (document.getElementById('product-image-url')) {
        document.getElementById('product-image-url').value = '';
      }
      editingProductId = null;
      retainerFields.style.display = 'none';
      if (submitBtn) {
        submitBtn.textContent = 'Create New Product/Service';
      }

      // Clear splits rows
      const rowsContainer = document.getElementById('product-splits-rows-container');
      if (rowsContainer) rowsContainer.innerHTML = '';
      const totalDisp = document.getElementById('product-splits-total-display');
      if (totalDisp) {
        totalDisp.textContent = 'Total Split: 0%';
        totalDisp.style.color = '#718096';
      }
      
      // Reload products list
      loadProducts();
    } catch (err) {
      errorHandler.handleError(err, 'Admin Products - Create Product');
      toast.error(`Failed to create product: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });

  // ==========================================
  // --- EDUCATION COURSE BUILDER CONTROLLER ---
  // ==========================================

  const courseForm = document.getElementById('course-form');
  const coursesTbody = document.getElementById('courses-tbody');
  const curriculumWorkspaceCard = document.getElementById('curriculum-workspace-card');
  const courseModulesContainer = document.getElementById('course-modules-container');
  const lessonEditorCard = document.getElementById('lesson-editor-card');
  const lessonForm = document.getElementById('lesson-form');

  // Course management methods
  async function loadCourses() {
    if (!coursesTbody) return;
    try {
      const courses = await contentDB.getContentByType('education');
      if (courses.length === 0) {
        coursesTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem;">No courses built yet.</td></tr>';
        return;
      }

      coursesTbody.innerHTML = courses.map(course => {
        const moduleCount = course.modules?.length || 0;
        return `
          <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
            <td style="padding: 10px; font-weight: bold; color: var(--theme-color-text-primary, #2d3748);">${course.title}</td>
            <td style="padding: 10px;">${moduleCount} Modules</td>
            <td style="padding: 10px; text-transform: capitalize;">${course.access?.visibility || 'public'}</td>
            <td style="padding: 10px; text-align: right;">
              <button class="btn-manage-course" data-course-id="${course.id}" style="padding: 4px 8px; background: var(--theme-color-primary, #2b6cb0); color: white; border-radius: 4px; font-size: 0.75rem; border: none; cursor: pointer; font-weight: bold; margin-right: 4px;">Manage</button>
              <button class="btn-delete-course" data-course-id="${course.id}" style="padding: 4px 8px; background: #e53e3e; color: white; border-radius: 4px; font-size: 0.75rem; border: none; cursor: pointer; font-weight: bold;">Delete</button>
            </td>
          </tr>
        `;
      }).join('');

      attachCourseListHandlers();
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  }

  function attachCourseListHandlers() {
    coursesTbody.querySelectorAll('.btn-manage-course').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.courseId;
        const courses = await contentDB.getContentByType('education');
        selectedCourse = courses.find(c => c.id === id);
        if (selectedCourse) {
          openCourseWorkspace();
        }
      };
    });

    coursesTbody.querySelectorAll('.btn-delete-course').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.courseId;
        if (confirm('Are you sure you want to permanently delete this course and all its modules/lessons?')) {
          await contentDB.deleteContent(id);
          toast.success('Course deleted successfully.');
          selectedCourse = null;
          if (curriculumWorkspaceCard) curriculumWorkspaceCard.style.display = 'none';
          if (lessonEditorCard) lessonEditorCard.style.display = 'none';
          loadCourses();
        }
      };
    });
  }

  // Course Form Saving
  courseForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('course-id').value;
    const title = document.getElementById('course-title').value.trim();
    const desc = document.getElementById('course-description').value.trim();
    const visibility = document.getElementById('course-visibility').value;

    try {
      let courseData = {};
      if (idInput) {
        // Edit existing course
        const courses = await contentDB.getContentByType('education');
        const existing = courses.find(c => c.id === idInput);
        courseData = {
          ...existing,
          title,
          description: desc,
          access: { visibility }
        };
      } else {
        // Create new course
        courseData = {
          type: 'education',
          id: 'course_' + Date.now(),
          title,
          description: desc,
          access: { visibility },
          modules: []
        };
      }

      await contentDB.saveContent(courseData);
      toast.success(idInput ? 'Course updated successfully!' : 'Course created successfully!');
      courseForm.reset();
      document.getElementById('course-id').value = '';
      document.getElementById('course-form-title').textContent = 'Create New Course';
      document.getElementById('btn-reset-course-form').style.display = 'none';

      loadCourses();
      if (selectedCourse && selectedCourse.id === courseData.id) {
        selectedCourse = courseData;
        openCourseWorkspace();
      }
    } catch (err) {
      toast.error(`Failed to save course: ${err.message}`);
    }
  });

  document.getElementById('btn-reset-course-form')?.addEventListener('click', () => {
    courseForm.reset();
    document.getElementById('course-id').value = '';
    document.getElementById('course-form-title').textContent = 'Create New Course';
    document.getElementById('btn-reset-course-form').style.display = 'none';
  });

  // Curriculum Modules & Lessons builder UI rendering
  function openCourseWorkspace() {
    if (!curriculumWorkspaceCard || !selectedCourse) return;

    curriculumWorkspaceCard.style.display = 'block';
    document.getElementById('workspace-course-title').textContent = selectedCourse.title;

    renderModules();
    curriculumWorkspaceCard.scrollIntoView({ behavior: 'smooth' });
  }

  function renderModules() {
    if (!courseModulesContainer || !selectedCourse) return;

    const modules = selectedCourse.modules || [];
    if (modules.length === 0) {
      courseModulesContainer.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-style: italic; text-align: center; padding: 2rem;">No modules added to this course curriculum yet. Click "+ Add Module" to begin.</p>';
      return;
    }

    courseModulesContainer.innerHTML = modules.map((mod, modIndex) => {
      const lessons = mod.lessons || [];
      const lessonsHtml = lessons.map(lesson => {
        const typeBadge = `<span style="display:inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold; background: #e2e8f0; color: #4a5568; margin-left: 0.5rem; text-transform: uppercase;">${lesson.contentType}</span>`;
        const roleBadge = `<span style="display:inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold; background: #ebf8ff; color: #2b6cb0; margin-left: 0.5rem; text-transform: capitalize;">${lesson.requiredRole}</span>`;
        const prereqText = lesson.prerequisiteLessonId ? `<span style="font-size:0.75rem; color: #e53e3e; margin-left: 0.5rem;">🔒 Pre: ${lesson.prerequisiteLessonId}</span>` : '';

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: white; border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 6px; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
              <strong style="color: var(--theme-color-text-primary, #1a202c);">${lesson.title}</strong>
              <code style="font-size: 0.75rem; color:#718096;">(${lesson.id})</code>
              ${typeBadge}
              ${roleBadge}
              ${prereqText}
            </div>
            <div>
              <button class="btn-edit-lesson" data-module-id="${mod.id}" data-lesson-id="${lesson.id}" style="padding: 2px 6px; background: var(--theme-color-primary, #2b6cb0); color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; margin-right: 4px;">Edit</button>
              <button class="btn-delete-lesson" data-module-id="${mod.id}" data-lesson-id="${lesson.id}" style="padding: 2px 6px; background: #e53e3e; color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">Delete</button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="background: var(--theme-color-background, #f7fafc); border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 8px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--theme-color-border, #edf2f7); padding-bottom: 0.5rem;">
            <h4 style="margin: 0; font-size: 1.05rem; font-weight: bold; color: var(--theme-color-primary, #2b6cb0);">
              Module ${modIndex + 1}: ${mod.title}
            </h4>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn-trigger-add-lesson" data-module-id="${mod.id}" style="padding: 4px 10px; background: var(--theme-color-accent, #38a169); color: white; border-radius: 4px; font-size: 0.8rem; border: none; cursor: pointer; font-weight: bold;">+ Add Lesson</button>
              <button class="btn-delete-module" data-module-id="${mod.id}" style="padding: 4px 10px; background: transparent; color: #e53e3e; border: 1px solid #e53e3e; border-radius: 4px; font-size: 0.8rem; cursor: pointer; font-weight: bold;">Delete Module</button>
            </div>
          </div>
          <div>
            ${lessons.length === 0 ? '<p style="font-size: 0.85rem; color: var(--theme-color-text-secondary, #a0aec0); font-style: italic; margin: 0;">No lessons added to this module yet.</p>' : lessonsHtml}
          </div>
        </div>
      `;
    }).join('');

    attachCurriculumHandlers();
  }

  function attachCurriculumHandlers() {
    // Add Module Handler
    const addModuleBtn = document.getElementById('btn-add-module');
    if (addModuleBtn) {
      addModuleBtn.onclick = async () => {
        const title = prompt('Enter Module Title:');
        if (title && title.trim()) {
          const modules = selectedCourse.modules || [];
          modules.push({
            id: 'module_' + Date.now(),
            title: title.trim(),
            lessons: []
          });
          selectedCourse.modules = modules;
          await contentDB.saveContent(selectedCourse);
          toast.success('Module added successfully!');
          renderModules();
        }
      };
    }

    // Delete Module Handler
    courseModulesContainer.querySelectorAll('.btn-delete-module').forEach(btn => {
      btn.onclick = async () => {
        const modId = btn.dataset.moduleId;
        if (confirm('Are you sure you want to delete this module and all its associated lessons?')) {
          selectedCourse.modules = selectedCourse.modules.filter(m => m.id !== modId);
          await contentDB.saveContent(selectedCourse);
          toast.success('Module deleted successfully.');
          renderModules();
        }
      };
    });

    // Add Lesson Trigger Handler
    courseModulesContainer.querySelectorAll('.btn-trigger-add-lesson').forEach(btn => {
      btn.onclick = () => {
        const modId = btn.dataset.moduleId;
        openLessonForm(modId, null);
      };
    });

    // Edit Lesson Handler
    courseModulesContainer.querySelectorAll('.btn-edit-lesson').forEach(btn => {
      btn.onclick = () => {
        const modId = btn.dataset.moduleId;
        const lessonId = btn.dataset.lessonId;
        openLessonForm(modId, lessonId);
      };
    });

    // Delete Lesson Handler
    courseModulesContainer.querySelectorAll('.btn-delete-lesson').forEach(btn => {
      btn.onclick = async () => {
        const modId = btn.dataset.moduleId;
        const lessonId = btn.dataset.lessonId;
        if (confirm('Are you sure you want to delete this lesson?')) {
          const mod = selectedCourse.modules.find(m => m.id === modId);
          if (mod) {
            mod.lessons = mod.lessons.filter(l => l.id !== lessonId);
            await contentDB.saveContent(selectedCourse);
            toast.success('Lesson deleted successfully.');
            renderModules();
          }
        }
      };
    });
  }

  // --- Lesson Editor Handling ---

  const lessonContentTypeSelect = document.getElementById('lesson-content-type');
  const lessonContentBlocks = document.querySelectorAll('.lesson-content-block');

  lessonContentTypeSelect?.addEventListener('change', () => {
    const activeType = lessonContentTypeSelect.value;
    lessonContentBlocks.forEach(block => {
      block.style.display = block.id === `lesson-content-${activeType}` ? 'block' : 'none';
    });
  });

  // Populate prerequisite options from all existing lessons in selectedCourse
  function populatePrerequisiteDropdown(currentLessonId = null) {
    const select = document.getElementById('lesson-prerequisite');
    if (!select || !selectedCourse) return;

    select.innerHTML = '<option value="">None (Always Unlocked)</option>';
    const modules = selectedCourse.modules || [];
    modules.forEach(mod => {
      const lessons = mod.lessons || [];
      lessons.forEach(l => {
        if (l.id !== currentLessonId) {
          const opt = document.createElement('option');
          opt.value = l.id;
          opt.textContent = `${l.title} (${l.id})`;
          select.appendChild(opt);
        }
      });
    });
  }

  function openLessonForm(moduleId, lessonId = null) {
    if (!lessonEditorCard) return;

    lessonForm.reset();
    document.getElementById('lesson-module-id').value = moduleId;
    document.getElementById('lesson-id').value = lessonId || '';

    // Clear dynamic blocks values
    document.getElementById('lesson-gjs-html').value = '';
    document.getElementById('lesson-gjs-css').value = '';
    document.getElementById('lesson-gjs-project').value = '';

    populatePrerequisiteDropdown(lessonId);

    if (lessonId) {
      // Editing
      document.getElementById('lesson-editor-title').textContent = 'Edit Lesson Node';
      const mod = selectedCourse.modules.find(m => m.id === moduleId);
      const lesson = mod?.lessons?.find(l => l.id === lessonId);
      if (lesson) {
        document.getElementById('lesson-title').value = lesson.title || '';
        document.getElementById('lesson-code').value = lesson.id || '';
        document.getElementById('lesson-content-type').value = lesson.contentType || 'rich-text';
        document.getElementById('lesson-role').value = lesson.requiredRole || 'subscriber';
        document.getElementById('lesson-prerequisite').value = lesson.prerequisiteLessonId || '';
        document.getElementById('lesson-passing-score').value = lesson.passingScore || 80;

        document.getElementById('lesson-body').value = lesson.body || '';
        document.getElementById('lesson-video-url').value = lesson.videoUrl || '';
        document.getElementById('lesson-h5p-path').value = lesson.h5pPath || '';

        // Restore GrapesJS values
        document.getElementById('lesson-gjs-html').value = lesson.compiledHtml || '';
        document.getElementById('lesson-gjs-css').value = lesson.compiledCss || '';
        document.getElementById('lesson-gjs-project').value = lesson.projectData ? JSON.stringify(lesson.projectData) : '';
      }
    } else {
      // Creating new
      document.getElementById('lesson-editor-title').textContent = 'Add New Lesson Node';
      document.getElementById('lesson-code').value = 'lesson-' + Date.now();
    }

    // Trigger contentType block change layout update
    lessonContentTypeSelect.dispatchEvent(new Event('change'));

    lessonEditorCard.style.display = 'block';
    lessonEditorCard.scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('btn-close-lesson-editor')?.addEventListener('click', () => {
    lessonEditorCard.style.display = 'none';
  });

  document.getElementById('btn-cancel-lesson')?.addEventListener('click', () => {
    lessonEditorCard.style.display = 'none';
  });

  // H5P File Upload Direct Drive Org Setup
  document.getElementById('btn-upload-h5p')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('lesson-h5p-file');
    const pathInput = document.getElementById('lesson-h5p-path');
    const statusDiv = document.getElementById('h5p-upload-status');

    if (!fileInput || fileInput.files.length === 0) {
      toast.warning('Please select a .h5p or .zip package file first.');
      return;
    }

    const file = fileInput.files[0];
    const lessonCode = document.getElementById('lesson-code').value.trim();

    if (!lessonCode) {
      toast.warning('Please enter a unique Lesson Code/ID first to structure the directory.');
      return;
    }

    // Assign custom fields to direct Drive Organizer Routing inside drive-upload.js
    file.isH5P = true;
    file.courseId = selectedCourse.id;
    file.lessonId = lessonCode;

    if (statusDiv) statusDiv.textContent = 'Uploading H5P archive to secure Site Folder...';

    try {
      const res = await uploadFileToDrive(file);
      if (res && res.src) {
        // Strip out direct CDN thumbnail, provide dynamic directory location path for stand-alone player setup options
        const cdnDir = res.src.substring(0, res.src.lastIndexOf('/')) + '/';
        pathInput.value = cdnDir;
        if (statusDiv) statusDiv.textContent = `Safe Upload. Directory locked: ${res.localPath}`;
        toast.success(`H5P Asset "${file.name}" uploaded and structured in corporate binder directory.`);
      }
    } catch (err) {
      toast.error(`H5P Direct upload failed: ${err.message}`);
    }
  });

  // GrapesJS Lesson Visual Builder Modal Workspace Trigger
  document.getElementById('btn-launch-lesson-grapes')?.addEventListener('click', () => {
    const modal = document.getElementById('lesson-grapesjs-modal');
    if (!modal) return;

    modal.style.display = 'flex';

    if (!grapesLessonEditor && window.grapesjs) {
      grapesLessonEditor = window.grapesjs.init({
        container: '#grapesjs-lesson-canvas',
        fromElement: true,
        height: '100%',
        width: 'auto',
        storageManager: false,
        plugins: ['gjs-preset-webpage'],
        pluginsOpts: {
          'gjs-preset-webpage': {}
        }
      });
    }

    // Restore existing GrapesJS template data if edit
    const projectJsonStr = document.getElementById('lesson-gjs-project').value;
    if (grapesLessonEditor && projectJsonStr) {
      try {
        grapesLessonEditor.loadProjectData(JSON.parse(projectJsonStr));
      } catch (e) {
        console.warn('Could not restore GrapesJS template:', e);
      }
    } else if (grapesLessonEditor) {
      grapesLessonEditor.DomComponents.clear();
    }
  });

  document.getElementById('btn-close-lesson-grapes')?.addEventListener('click', () => {
    document.getElementById('lesson-grapesjs-modal').style.display = 'none';
  });

  document.getElementById('btn-save-grapes-content')?.addEventListener('click', () => {
    if (grapesLessonEditor) {
      const html = grapesLessonEditor.getHtml();
      const css = grapesLessonEditor.getCss();
      const project = grapesLessonEditor.getProjectData();

      document.getElementById('lesson-gjs-html').value = html;
      document.getElementById('lesson-gjs-css').value = css;
      document.getElementById('lesson-gjs-project').value = JSON.stringify(project);

      toast.success('Visual lesson layouts compiled to state hidden slots.');
      document.getElementById('lesson-grapesjs-modal').style.display = 'none';
    }
  });

  // Submit Lesson Node Form
  lessonForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const moduleId = document.getElementById('lesson-module-id').value;
    const originalLessonId = document.getElementById('lesson-id').value;

    const title = document.getElementById('lesson-title').value.trim();
    const code = document.getElementById('lesson-code').value.trim();
    const contentType = document.getElementById('lesson-content-type').value;
    const requiredRole = document.getElementById('lesson-role').value;
    const prerequisite = document.getElementById('lesson-prerequisite').value || undefined;
    const passingScore = parseInt(document.getElementById('lesson-passing-score').value) || undefined;

    const body = document.getElementById('lesson-body').value || undefined;
    const videoUrl = document.getElementById('lesson-video-url').value || undefined;
    const h5pPath = document.getElementById('lesson-h5p-path').value || undefined;

    const compiledHtml = document.getElementById('lesson-gjs-html').value || undefined;
    const compiledCss = document.getElementById('lesson-gjs-css').value || undefined;
    const projectDataStr = document.getElementById('lesson-gjs-project').value;
    const projectData = projectDataStr ? JSON.parse(projectDataStr) : undefined;

    try {
      const mod = selectedCourse.modules.find(m => m.id === moduleId);
      if (!mod) {
        toast.error('Parent module not found.');
        return;
      }

      const lessonData = {
        id: code,
        title,
        contentType,
        requiredRole,
        ...(prerequisite && { prerequisiteLessonId: prerequisite }),
        ...(passingScore !== undefined && { passingScore }),
        ...(body && { body }),
        ...(videoUrl && { videoUrl }),
        ...(h5pPath && { h5pPath }),
        ...(compiledHtml && { compiledHtml }),
        ...(compiledCss && { compiledCss }),
        ...(projectData && { projectData })
      };

      if (originalLessonId) {
        // Edit existing lesson
        const idx = mod.lessons.findIndex(l => l.id === originalLessonId);
        if (idx !== -1) {
          mod.lessons[idx] = lessonData;
        } else {
          mod.lessons.push(lessonData);
        }
      } else {
        // Add new lesson
        if (mod.lessons.some(l => l.id === code)) {
          toast.error(`Lesson ID/Code "${code}" already exists in this course! Please use a unique ID.`);
          return;
        }
        mod.lessons.push(lessonData);
      }

      await contentDB.saveContent(selectedCourse);
      toast.success(originalLessonId ? 'Lesson node updated successfully!' : 'Lesson node added successfully!');

      lessonEditorCard.style.display = 'none';
      renderModules();
    } catch (err) {
      toast.error(`Failed to save lesson: ${err.message}`);
    }
  });

  // Initial load
  loadProducts();

  // --- GOOGLE IMAGEN 3 API BUTTON INTEGRATION ---
  const btnProductGenerate = document.getElementById('btn-product-generate-media');
  if (btnProductGenerate) {
    btnProductGenerate.onclick = async (e) => {
      e.preventDefault();
      if (configManager.current.features?.imagenAiGenerator === false) {
        toast.error("Imagen AI Generator feature is disabled in Site Settings.");
        return;
      }
      const titleInput = document.getElementById('product-title');
      const categoryInput = document.getElementById('product-category');
      const title = titleInput ? titleInput.value.trim() : '';
      const category = categoryInput ? categoryInput.value.trim() : '';

      if (!title) {
        toast.warning("Please enter a Product Title first to tailor the mockup.");
        return;
      }

      btnProductGenerate.disabled = true;
      btnProductGenerate.textContent = "Generating...";
      try {
        const { generateProductMockup } = await import('../../utils/ai-imagen.js');
        const imgUrl = await generateProductMockup(title, category || 'Product');
        const urlInput = document.getElementById('product-image-url');
        if (urlInput) {
          urlInput.value = imgUrl;
          toast.success("Successfully generated product mockup image!");
        }
      } catch (err) {
        console.error("[Imagen Product Mockup Error]:", err);
        toast.error("Failed to generate product mockup.");
      } finally {
        btnProductGenerate.disabled = false;
        btnProductGenerate.textContent = "✨ Generate AI Visual Asset with Imagen";
      }
    };
  }

  // --- AI TEST PRODUCTS GENERATOR INTEGRATION ---
  const btnGenTestProducts = document.getElementById('btn-generate-ai-test-products');
  if (btnGenTestProducts) {
    btnGenTestProducts.onclick = async (e) => {
      e.preventDefault();
      if (configManager.current.features?.imagenAiGenerator === false) {
        toast.error("Imagen AI Generator feature is disabled in Site Settings.");
        return;
      }

      btnGenTestProducts.disabled = true;
      btnGenTestProducts.textContent = "Generating AI Products...";
      try {
        const { generateProductMockup } = await import('../../utils/ai-imagen.js');

        const sampleProducts = [
          { title: "Premium Ceramic Flask", category: "Apothecary", price: 3500 },
          { title: "Sovereign Cotton Tote", category: "Artisanal Merch", price: 2000 },
          { title: "Zero-Build Blueprint Hoodie", category: "Apparel", price: 7500 }
        ];

        for (const p of sampleProducts) {
          const imgUrl = await generateProductMockup(p.title, p.category);
          const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, '').substring(0, 12)
            : Date.now() + '_' + Math.random().toString(36).substring(2, 9);
          const productId = 'product_test_' + uniqueId;

          await contentDB.saveContent({
            type: 'product',
            id: productId,
            title: p.title,
            category: p.category,
            description: `Auto-generated premium ${p.title} crafted using secure zero-build standards.`,
            image: imgUrl,
            pricing: {
              basePrice: p.price,
              currency: 'USD',
              paymentType: 'full_upfront'
            },
            inventory: {
              stockQuantity: 15,
              lowStockThreshold: 3,
              trackInventory: true
            },
            tags: ["Zero-Build", "Sovereignty", "AI-Generated"],
            rating: 4.9,
            date: new Date().toISOString().split('T')[0]
          });
        }

        toast.success("Successfully generated 3 unique AI Test Products with Imagen Mockups!");
        loadProducts(); // Reload products list cleanly
      } catch (err) {
        console.error("[Gen Test Products Error]:", err);
        toast.error("Failed to generate AI test products.");
      } finally {
        btnGenTestProducts.disabled = false;
        btnGenTestProducts.textContent = "✨ Generate AI Test Products";
      }
    };
  }
}

/**
 * Injects the "Product Royalty & Merch Splits" accordion card right into the #product-form.
 */
function injectProductSplitsCard(form) {
  const splitsCard = document.createElement('div');
  splitsCard.id = 'product-splits-card';
  splitsCard.style.cssText = `
    background: var(--theme-color-surface-alt, #f8fafc);
    border: 1px solid var(--theme-color-border, #cbd5e0);
    border-radius: var(--theme-layout-border-radius, 8px);
    padding: 1.25rem;
    margin-top: 1rem;
    margin-bottom: 1rem;
  `;

  splitsCard.innerHTML = `
    <h3 style="margin: 0; font-size: 1rem; color: var(--theme-color-primary, #2b6cb0); cursor: pointer; display: flex; align-items: center; justify-content: space-between;" id="product-splits-header">
      <span>🤝 Product Royalty & Merch Splits</span>
      <span id="product-splits-toggle-arrow">▶</span>
    </h3>
    <div id="product-splits-body" style="display: none; margin-top: 1rem; border-top: 1px dashed #cbd5e0; padding-top: 1rem;">
      <p style="font-size: 0.82rem; color: var(--theme-color-text-secondary, #718096); margin-bottom: 1rem; line-height: 1.4;">
        Configure royalty split allocations for designers, suppliers, artists, or brand partners. The total percentage must sum up to exactly 100%. Unconfigured assets default to 100% Admin allocation.
      </p>
      <div id="product-splits-rows-container" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;"></div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <button type="button" id="btn-product-add-split" class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem; background: #319795; border: none; cursor: pointer;">
          + Add Contributor Row
        </button>
        <div id="product-splits-total-display" style="font-weight: bold; font-size: 0.95rem; color: #718096;">
          Total Split: 0%
        </div>
      </div>
    </div>
  `;

  // Insert before the submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    form.insertBefore(splitsCard, submitBtn);
  } else {
    form.appendChild(splitsCard);
  }

  // Accordion toggle
  const header = splitsCard.querySelector('#product-splits-header');
  const body = splitsCard.querySelector('#product-splits-body');
  const arrow = splitsCard.querySelector('#product-splits-toggle-arrow');
  if (header && body && arrow) {
    header.onclick = () => {
      if (body.style.display === 'none') {
        body.style.display = 'block';
        arrow.textContent = '▼';
      } else {
        body.style.display = 'none';
        arrow.textContent = '▶';
      }
    };
  }

  // Add Row Handler
  const addBtn = splitsCard.querySelector('#btn-product-add-split');
  if (addBtn) {
    addBtn.onclick = () => {
      addProductSplitRow();
    };
  }
}

/**
 * Appends a new contributor split row to the product splits rows container.
 */
async function addProductSplitRow(initialData = null) {
  const container = document.getElementById('product-splits-rows-container');
  if (!container) return;

  // Retrieve existing users to auto-populate select dropdown
  let usersList = [];
  try {
    usersList = await contentDB.getAllUsers();
  } catch (err) {}

  const fallbackEmails = [
    'admin@earlalex.com',
    'editor@earlalex.com',
    'director@earlalex.com',
    'writer@earlalex.com',
    'designer@earlalex.com',
    'supplier@earlalex.com'
  ];

  const uniqueEmails = Array.from(new Set([
    ...usersList.map(u => u.email).filter(Boolean),
    ...fallbackEmails
  ]));

  const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);

  const rowDiv = document.createElement('div');
  rowDiv.id = rowId;
  rowDiv.className = 'product-split-row';
  rowDiv.style.cssText = `
    display: grid;
    grid-template-columns: 2fr 1fr 1fr auto;
    gap: 0.5rem;
    align-items: center;
    background: white;
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  `;

  const userOptions = uniqueEmails.map(email => {
    const isSelected = initialData && initialData.userEmail === email ? 'selected' : '';
    return `<option value="${email}" ${isSelected}>${email}</option>`;
  }).join('');

  const roles = ['Designer', 'Supplier', 'Artist', 'Brand Partner', 'Publisher', 'Editor'];
  const roleOptions = roles.map(r => {
    const isSelected = initialData && initialData.role === r ? 'selected' : '';
    return `<option value="${r}" ${isSelected}>${r}</option>`;
  }).join('');

  const initialPct = initialData ? initialData.percentage : 0;

  rowDiv.innerHTML = `
    <select class="product-split-user" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;">
      ${userOptions}
    </select>
    <select class="product-split-role" style="padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;">
      ${roleOptions}
    </select>
    <div style="display: flex; align-items: center; gap: 4px;">
      <input type="number" class="product-split-pct" min="0" max="100" step="1" value="${initialPct}" style="width: 100%; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;" />
      <span style="font-size: 0.85rem; font-weight: bold; color: #4a5568;">%</span>
    </div>
    <button type="button" class="btn-product-delete-split-row" style="background: none; border: none; color: #e53e3e; cursor: pointer; font-size: 1.1rem; padding: 4px;" title="Delete Row">✕</button>
  `;

  container.appendChild(rowDiv);

  // Wire up real-time percentage change validator
  const pctInput = rowDiv.querySelector('.product-split-pct');
  pctInput.addEventListener('input', () => validateProductSplitsTotal());

  // Wire delete row
  rowDiv.querySelector('.btn-product-delete-split-row').onclick = () => {
    rowDiv.remove();
    validateProductSplitsTotal();
  };

  validateProductSplitsTotal();
}

/**
 * Validates real-time split totals, updating the display text and colors accordingly.
 */
function validateProductSplitsTotal() {
  const rows = document.querySelectorAll('.product-split-row');
  let sum = 0;
  rows.forEach(row => {
    sum += parseFloat(row.querySelector('.product-split-pct').value || 0);
  });

  const display = document.getElementById('product-splits-total-display');
  if (display) {
    display.textContent = `Total Split: ${sum}%`;
    if (Math.abs(sum - 100) < 0.01) {
      display.style.color = '#38a169'; // Green if valid 100%
    } else {
      display.style.color = '#e53e3e'; // Red if invalid
    }
  }
}

/**
 * Loads configured splits into the product form fields.
 */
export async function loadSplitsIntoProductForm(splits) {
  const container = document.getElementById('product-splits-rows-container');
  if (!container) return;

  container.innerHTML = '';

  if (splits && splits.length > 0) {
    // Open accordion body
    const body = document.getElementById('product-splits-body');
    const arrow = document.getElementById('product-splits-toggle-arrow');
    if (body && arrow) {
      body.style.display = 'block';
      arrow.textContent = '▼';
    }

    for (const split of splits) {
      await addProductSplitRow(split);
    }
  }
}
