// utils/modal.js - Modal Backdrop Dismissal & Custom Promotional Pop-up Trigger System
import { contentDB } from '../core/db.js';
import { toast } from './toast.js';

// Global Modal Backdrop Click Dismissal Policy
export function initModalDismissal() {
  document.addEventListener('click', (e) => {
    const target = e.target;

    // Check if clicking a backdrop overlay
    const isBackdrop =
      target.classList.contains('modal-backdrop') ||
      target.classList.contains('overlay') ||
      target.classList.contains('modal-overlay') ||
      target.tagName.toLowerCase() === 'dialog' ||
      target.getAttribute('role') === 'dialog' ||
      target.id === 'factory-reset-modal' ||
      target.id === 'snapshot-rollback-modal' ||
      target.id === 'action-settings-modal' ||
      target.id === 'booking-modal' ||
      target.id === 'lesson-grapesjs-modal' ||
      target.id === 'promo-modal-overlay';

    if (!isBackdrop) return;

    // Strict constraint: Setup Wizards MUST NOT close on backdrop click
    const isSetupWizard =
      target.closest('.setup-wizard-modal') ||
      target.closest('master-setup-wizard') ||
      target.closest('.wizard-container') ||
      target.classList.contains('setup-wizard-modal') ||
      target.tagName.toLowerCase() === 'master-setup-wizard' ||
      target.id === 'setup-wizard-modal';

    if (isSetupWizard) {
      console.log('[Modal Policy]: Ignored backdrop click on Setup Wizard to prevent accidental data loss.');
      return;
    }

    // Otherwise, close standard modals/dialogs
    console.log('[Modal Policy]: Closing modal on backdrop click:', target);

    if (target.id === 'promo-modal-overlay') {
      dismissPromoModal(target);
      return;
    }

    if (target.tagName.toLowerCase() === 'dialog' || target.id === 'booking-modal') {
      target.style.display = 'none';
      if (typeof target.close === 'function') {
        try { target.close(); } catch (err) {}
      }
      return;
    }

    if (target.id === 'factory-reset-modal' || target.id === 'snapshot-rollback-modal') {
      target.remove();
      return;
    }

    if (target.id === 'action-settings-modal' || target.id === 'lesson-grapesjs-modal') {
      target.style.display = 'none';
      return;
    }

    // Generic fallback dismissal
    const closeBtn = target.querySelector('.btn-close, .close-btn, button[id*="close"], button[id*="cancel"], button[class*="close"], .btn-cancel-modal');
    if (closeBtn) {
      closeBtn.click();
    } else {
      if (target.parentNode) {
        if (target.id) {
          target.style.display = 'none';
        } else {
          target.remove();
        }
      } else {
        target.style.display = 'none';
      }
    }
  });
}

function dismissPromoModal(overlay) {
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.2s ease-out';
  setTimeout(() => {
    overlay.remove();
    document.body.classList.remove('modal-open');
  }, 200);
}

// Custom Promotional Pop-up Manager & Triggers
export async function triggerPagePromoModals(currentPath = window.location.pathname) {
  try {
    console.log('[Promo Manager]: Evaluating active modals for route:', currentPath);

    // Normalize path to detect target pages
    let pageFilter = 'all';
    if (currentPath === '/' || currentPath === '/home' || currentPath.endsWith('/index.html')) {
      pageFilter = 'home';
    } else if (currentPath === '/shop' || currentPath.startsWith('/shop/')) {
      pageFilter = 'shop';
    }

    const allContent = await contentDB.getAllContent();
    const activeModals = allContent.filter(item =>
      item.type === 'custom_modal' &&
      item.isActive !== false &&
      (item.targetPages === 'all' || item.targetPages === pageFilter)
    );

    if (activeModals.length === 0) {
      console.log('[Promo Manager]: No active custom promotional modals match the current page.');
      return;
    }

    // Pick the first matching promo modal that hasn't been dismissed in this session
    const modal = activeModals.find(m => !sessionStorage.getItem(`promo_dismissed_${m.id}`));
    if (!modal) {
      console.log('[Promo Manager]: All matching modals already dismissed in this session.');
      return;
    }

    const triggerType = modal.triggerType || 'immediate';
    const triggerValue = parseFloat(modal.triggerValue) || 0;

    console.log(`[Promo Manager]: Registering trigger [${triggerType}] for modal: "${modal.title}"`);

    if (triggerType === 'immediate') {
      showPromoModal(modal);
    } else if (triggerType === 'delay') {
      setTimeout(() => {
        if (!sessionStorage.getItem(`promo_dismissed_${modal.id}`)) {
          showPromoModal(modal);
        }
      }, triggerValue * 1000);
    } else if (triggerType === 'scroll') {
      const onScroll = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 100;

        if (percent >= triggerValue) {
          window.removeEventListener('scroll', onScroll);
          if (!sessionStorage.getItem(`promo_dismissed_${modal.id}`)) {
            showPromoModal(modal);
          }
        }
      };
      window.addEventListener('scroll', onScroll);
    } else if (triggerType === 'exit') {
      const onMouseOut = (e) => {
        // Detect leaving viewport (upward mouse movement)
        if (e.clientY < 50 || e.relatedTarget === null) {
          document.removeEventListener('mouseout', onMouseOut);
          if (!sessionStorage.getItem(`promo_dismissed_${modal.id}`)) {
            showPromoModal(modal);
          }
        }
      };
      document.addEventListener('mouseout', onMouseOut);
    }

  } catch (err) {
    console.warn('[Promo Manager]: Failed to evaluate custom promotional modals:', err.message);
  }
}

export function showPromoModal(modal) {
  // Guard: Ensure we don't display duplicate promo modals on screen
  if (document.getElementById('promo-modal-overlay')) return;

  console.log('[Promo Manager]: Triggering display of promotional modal:', modal.title);

  document.body.classList.add('modal-open');

  const overlay = document.createElement('div');
  overlay.id = 'promo-modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    box-sizing: border-box;
    opacity: 0;
    transition: opacity 0.25s ease-out;
  `;

  // Render modal content template based on modal type
  let specificBodyHtml = '';

  if (modal.modalType === 'newsletter') {
    specificBodyHtml = `
      <p style="margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
        ${modal.contentHtml || 'Subscribe to our exclusive mailing list to receive premium publications, technical logs, and sovereign engineering guides.'}
      </p>
      <form id="promo-newsletter-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <label for="promo-newsletter-email" class="sr-only">Email Address</label>
        <input type="email" id="promo-newsletter-email" required placeholder="Enter your email address" style="padding: 12px; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 6px; font-size: 0.9rem;" />
        <button type="submit" class="btn-primary" style="width: 100%; padding: 12px;">Subscribe & Unlock Access</button>
      </form>
    `;
  } else if (modal.modalType === 'product') {
    specificBodyHtml = `
      ${modal.imageUrl ? `<img src="${modal.imageUrl}" alt="${modal.title}" class="aspect-ratio-16-9" style="border-radius: var(--theme-layout-border-radius, 6px); margin-bottom: 1rem; width: 100%; object-fit: cover;" />` : ''}
      <p style="margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
        ${modal.contentHtml || 'Check out our featured custom products and merchandise in the storefront.'}
      </p>
      ${modal.ctaText && modal.ctaUrl ? `<a href="${modal.ctaUrl}" id="promo-cta-btn" class="btn-primary" style="width: 100%; padding: 12px; text-decoration: none; text-align: center;">${modal.ctaText}</a>` : ''}
    `;
  } else if (modal.modalType === 'announcement') {
    specificBodyHtml = `
      ${modal.imageUrl ? `<img src="${modal.imageUrl}" alt="${modal.title}" class="aspect-ratio-16-9" style="border-radius: var(--theme-layout-border-radius, 6px); margin-bottom: 1rem; width: 100%; object-fit: cover;" />` : ''}
      <p style="margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
        ${modal.contentHtml || 'A new technical podcast episode and sovereign publication have just dropped! Stay ahead with the latest updates.'}
      </p>
      ${modal.ctaText && modal.ctaUrl ? `<a href="${modal.ctaUrl}" id="promo-cta-btn" class="btn-primary" style="width: 100%; padding: 12px; text-decoration: none; text-align: center;">${modal.ctaText}</a>` : ''}
    `;
  } else if (modal.modalType === 'discount') {
    specificBodyHtml = `
      <p style="margin-bottom: 1.25rem; font-size: 0.95rem; line-height: 1.5;">
        ${modal.contentHtml || 'Use this limited-time promotional voucher code at checkout to claim your wellness product discount!'}
      </p>
      ${modal.discountCode ? `
        <div style="background: #edf2f7; border: 2px dashed var(--theme-color-primary, #2b6cb0); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 1.1rem; font-weight: bold; text-align: center; margin-bottom: 1.25rem; cursor: pointer; color: var(--theme-color-primary, #2b6cb0);" id="promo-discount-box" title="Click to copy coupon code">
          ${modal.discountCode}
        </div>
      ` : ''}
      ${modal.ctaText && modal.ctaUrl ? `<a href="${modal.ctaUrl}" id="promo-cta-btn" class="btn-primary" style="width: 100%; padding: 12px; text-decoration: none; text-align: center;">${modal.ctaText}</a>` : ''}
    `;
  }

  overlay.innerHTML = `
    <div class="modal-container" style="background: var(--theme-color-surface, #ffffff); border-radius: var(--theme-layout-border-radius, 8px); box-shadow: var(--shadow-elevation-high); width: 100%; position: relative; display: flex; flex-direction: column;">
      <!-- Header -->
      <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--theme-color-border, #e2e8f0); display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--theme-color-primary, #2b6cb0);">${modal.title}</h3>
        <button id="promo-modal-close" style="background: none; border: none; font-size: 1.5rem; font-weight: bold; cursor: pointer; color: #a0aec0; padding: 0 4px; line-height: 1;">&times;</button>
      </div>

      <!-- Body -->
      <div class="modal-body" style="padding: 1.5rem; flex: 1; overflow-y: auto;">
        ${specificBodyHtml}
      </div>

      <!-- Footer -->
      <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--theme-color-border, #e2e8f0); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--theme-color-surface-alt, #f8fafc); border-radius: 0 0 var(--theme-layout-border-radius, 8px) var(--theme-layout-border-radius, 8px);">
        <button id="promo-modal-cancel" class="btn-secondary" style="padding: 8px 16px; font-size: 0.85rem;">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger smooth enter transition
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });

  // Action listeners
  const closeBtn = overlay.querySelector('#promo-modal-close');
  const cancelBtn = overlay.querySelector('#promo-modal-cancel');

  const dismissHandler = () => {
    sessionStorage.setItem(`promo_dismissed_${modal.id}`, 'true');
    dismissPromoModal(overlay);
  };

  closeBtn?.addEventListener('click', dismissHandler);
  cancelBtn?.addEventListener('click', dismissHandler);

  // CTA Click handler
  const ctaBtn = overlay.querySelector('#promo-cta-btn');
  ctaBtn?.addEventListener('click', () => {
    dismissHandler();
  });

  // Discount copy handler
  const discountBox = overlay.querySelector('#promo-discount-box');
  if (discountBox) {
    discountBox.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(modal.discountCode);
        toast.success(`Coupon code "${modal.discountCode}" copied to clipboard!`);
      } catch (err) {
        toast.error("Failed to copy code to clipboard.");
      }
    });
  }

  // Newsletter submission handler
  const newsletterForm = overlay.querySelector('#promo-newsletter-form');
  newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = overlay.querySelector('#promo-newsletter-email');
    if (emailInput && emailInput.value.trim()) {
      toast.success(`Success! Subscribed ${emailInput.value.trim()} successfully!`);
      dismissHandler();
    }
  });
}

// Auto-boot dismissal policy
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModalDismissal);
} else {
  initModalDismissal();
}
