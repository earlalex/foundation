// pages/admin/admin-products.js - Products & Services management
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { FormValidator } from '../../utils/validation.js';
import { errorHandler } from '../../core/error-handler.js';

export function initProductsTab() {
  const productForm = document.getElementById('product-form');
  const productsTbody = document.getElementById('products-tbody');
  const paymentTypeSelect = document.getElementById('product-payment-type');
  const retainerFields = document.getElementById('retainer-fields');

  // Handle payment type change to show/hide retainer fields
  paymentTypeSelect?.addEventListener('change', () => {
    if (paymentTypeSelect.value === 'retainer_invoice') {
      retainerFields.style.display = 'block';
    } else {
      retainerFields.style.display = 'none';
    }
  });

  // Form validation
  const productValidator = new FormValidator(productForm, {
    'product-title': [(value) => value && value.trim().length > 0 ? null : 'Product title is required'],
    'product-category': [(value) => value && value.trim().length > 0 ? null : 'Category is required'],
    'product-price': [(value) => value && !isNaN(value) && parseFloat(value) > 0 ? null : 'Valid price is required'],
    'product-currency': [(value) => value ? null : 'Currency is required'],
    'product-payment-type': [(value) => value ? null : 'Payment type is required']
  });

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
        
        return `
          <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
            <td style="padding: 12px;">
              <div style="font-weight: 600; color: var(--theme-color-text-primary, #1a202c);">${product.title}</div>
              <div style="font-size: 0.8rem; color: var(--theme-color-text-secondary, #4a5568);">${product.description?.substring(0, 50)}...</div>
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
      btn.addEventListener('click', () => {
        toast.info('Edit functionality coming soon.');
      });
    });
  }

  // Handle product form submission
  productForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!productValidator.validateAll()) {
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
      const title = document.getElementById('product-title').value;
      const category = document.getElementById('product-category').value;
      const description = document.getElementById('product-description').value;
      const price = parseFloat(document.getElementById('product-price').value);
      const currency = document.getElementById('product-currency').value;
      const paymentType = document.getElementById('product-payment-type').value;
      const retainerAmount = document.getElementById('product-retainer-amount').value;
      const retainerPercentage = document.getElementById('product-retainer-percentage').value;
      const stripeProductId = document.getElementById('product-stripe-id').value;
      const stripePriceId = document.getElementById('product-stripe-price-id').value;
      const enableAch = document.getElementById('product-enable-ach')?.checked || false;
      const invoiceDays = parseInt(document.getElementById('product-invoice-days').value) || 30;
      const googleContact = document.getElementById('product-google-contact').value;
      const paymentTerms = document.getElementById('product-payment-terms').value;

      // Convert price to cents for Stripe compatibility
      const basePrice = Math.round(price * 100);

      const productData = {
        type: 'product',
        id: 'product_' + Date.now(),
        title,
        category,
        description,
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
      toast.success('Product created successfully!');
      
      // Reset form
      productForm.reset();
      retainerFields.style.display = 'none';
      
      // Reload products list
      loadProducts();
    } catch (err) {
      errorHandler.handleError(err, 'Admin Products - Create Product');
      toast.error(`Failed to create product: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  // Initial load
  loadProducts();
}
