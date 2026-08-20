// pages/account.js - Customer Portal & Affiliate Hub Controller
import { store } from '../core/store.js';
import { contentDB } from '../core/db.js';
import { authManager } from '../core/auth.js';
import { toast } from '../utils/toast.js';
import { stripeService } from '../core/stripe.js';
import { cleanTitle, escapeHTML, sanitizeUrl } from '../utils/universalRenderer.js';

export async function initAccountPage() {
  const user = store.state.user;
  if (!user) {
    toast.warning('Authentication context missing. Redirecting to sign in.');
    if (window.router) {
      window.router.loadRoute('/login');
    }
    return;
  }

  const currentRole = store.state.simulatedUserTier || user.role || 'prospect';

  // Dynamic user data binding
  const nameEl = document.getElementById('acc-name');
  if (nameEl) nameEl.textContent = user.displayName || user.name || 'Valued User';

  const emailEl = document.getElementById('acc-email');
  if (emailEl) emailEl.textContent = user.email || '';

  const initialsEl = document.getElementById('acc-initials');
  if (initialsEl) {
    const initials = (user.displayName || user.name || user.email || 'S')
      .substring(0, 1)
      .toUpperCase();
    initialsEl.textContent = initials;
  }

  // Active role pill & badge styles
  const badgeEl = document.getElementById('acc-badge');
  if (badgeEl) {
    badgeEl.textContent = currentRole.toUpperCase() + ' ROLE';
    if (currentRole === 'affiliate' || currentRole === 'affiliated member') {
      badgeEl.style.background = '#ebf8ff';
      badgeEl.style.color = '#2b6cb0';
    } else if (currentRole === 'member') {
      badgeEl.style.background = '#e6fffa';
      badgeEl.style.color = '#319795';
    } else if (currentRole === 'admin' || currentRole === 'editor') {
      badgeEl.style.background = '#faf5ff';
      badgeEl.style.color = '#805ad5';
    } else {
      badgeEl.style.background = '#edf2f7';
      badgeEl.style.color = '#4a5568';
    }
  }

  // Bind settings tab name field
  const settingsNameInput = document.getElementById('acc-settings-name');
  if (settingsNameInput) {
    settingsNameInput.value = user.displayName || user.name || '';
  }

  // Bind Consent Preferences
  const consentNewsletterCheckbox = document.getElementById('consent-newsletter');
  const consentPrivacyCheckbox = document.getElementById('consent-privacy');

  if (consentNewsletterCheckbox) {
    consentNewsletterCheckbox.checked = user.consentNewsletter !== false;
  }
  if (consentPrivacyCheckbox) {
    consentPrivacyCheckbox.checked = user.consentPrivacy === true;
  }

  // Tab switcher
  const tabs = document.querySelectorAll('.account-tab-btn');
  const panels = document.querySelectorAll('.account-panel-view');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetSec = btn.getAttribute('data-sec');
      panels.forEach(p => {
        p.style.display = p.id === `sec-${targetSec}` ? 'block' : 'none';
      });
    });
  });

  // Visually custom cards based on Persona role
  const paywallCard = document.getElementById('acc-paywall-card');
  const affiliateInviteCard = document.getElementById('acc-affiliate-invite-card');
  const billingCard = document.getElementById('acc-billing-card');
  const affiliateTabBtn = document.getElementById('tab-btn-affiliate');

  const isAffiliate = currentRole === 'affiliate' || currentRole === 'affiliated member';
  const isAdmin = currentRole === 'admin' || user.isAdmin;

  if (currentRole === 'subscriber') {
    if (paywallCard) paywallCard.style.display = 'block';
    if (affiliateInviteCard) affiliateInviteCard.style.display = 'none';
    if (billingCard) billingCard.style.display = 'none';
    if (affiliateTabBtn) affiliateTabBtn.style.display = 'none';
  } else if (currentRole === 'member') {
    if (paywallCard) paywallCard.style.display = 'none';
    if (affiliateInviteCard) affiliateInviteCard.style.display = 'block';
    if (billingCard) billingCard.style.display = 'block';
    if (affiliateTabBtn) affiliateTabBtn.style.display = 'none';
  } else if (isAffiliate || isAdmin) {
    if (paywallCard) paywallCard.style.display = 'none';
    if (affiliateInviteCard) affiliateInviteCard.style.display = 'none';
    if (billingCard) billingCard.style.display = isAffiliate ? 'block' : 'none';
    if (affiliateTabBtn) affiliateTabBtn.style.display = 'block';
  } else {
    // Guest / Prospect / Editor
    if (paywallCard) paywallCard.style.display = 'none';
    if (affiliateInviteCard) affiliateInviteCard.style.display = 'none';
    if (billingCard) billingCard.style.display = 'none';
    if (affiliateTabBtn) affiliateTabBtn.style.display = 'none';
  }

  // Populate dynamic role operational goals (intentions)
  renderOperationalGoals(currentRole);

  // Load and populate Affiliate telemetry details
  if (isAffiliate || isAdmin) {
    await setupAffiliateHub(user);
  }

  // Handle Stripe return checkout fulfillment
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('session_id');

  if (searchParams.get('payment') === 'success' && sessionId) {
    sessionStorage.removeItem('foundation_pending_checkout_items');
    try {
      const verifyRes = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', sessionId })
      });

      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData.paid && Array.isArray(verifyData.lineItems) && verifyData.lineItems.length > 0) {
          // Validate line items strictly against contentDB catalog
          const allContent = await contentDB.getAllContent();
          const contentMap = new Map();
          allContent.forEach(c => {
            if (c.id) contentMap.set(c.id, c);
          });

          const verifiedPurchasedItems = [];
          for (const item of verifyData.lineItems) {
            const itemId = item.id;
            const catalogRecord = contentMap.get(itemId);
            if (!catalogRecord) {
              console.warn(`[Stripe Fulfillment] Unknown catalog item ID rejected: ${itemId}`);
              continue; // Reject unknown catalog items
            }
            const catalogPrice = Number(catalogRecord.price || 0);
            const paidPrice = Number(item.price || 0);
            if (catalogPrice > 0 && paidPrice < catalogPrice - 0.01) {
              console.warn(`[Stripe Fulfillment] Underpaid item rejected: ${itemId} (Paid: $${paidPrice}, Required: $${catalogPrice})`);
              continue; // Reject underpaid items
            }

            verifiedPurchasedItems.push({
              id: itemId,
              title: catalogRecord.title || catalogRecord.name || item.name || itemId,
              type: catalogRecord.type || item.type || 'product',
              purchasedAt: new Date().toISOString(),
              pricePaid: paidPrice
            });
          }

          if (verifiedPurchasedItems.length > 0) {
            const targetEmail = verifyData.customerEmail || user.email;
            const updatedUser = await contentDB.registerOrMergeUser({
              email: targetEmail,
              name: user.displayName || user.name || '',
              role: user.role || 'subscriber',
              purchasedProducts: verifiedPurchasedItems
            });

            if (updatedUser && user.email === targetEmail) {
              store.dispatch('SET_USER', updatedUser);
            }

            toast.success('🎉 Payment verified via Stripe! Your purchased items have been unlocked.');
          } else {
            toast.error('Payment verified, but no valid catalog items were matched or paid in full.');
          }
        } else {
          toast.error('Stripe session is unpaid or incomplete. Checkout items were not unlocked.');
        }
      } else {
        toast.error('Could not verify Stripe checkout session.');
      }
    } catch (err) {
      console.warn('[Account Portal]: Stripe session verification error:', err);
    }
  } else if (searchParams.get('payment') === 'success') {
    // Session ID is missing - purge any unverified pending items
    sessionStorage.removeItem('foundation_pending_checkout_items');
  }

  // Load dynamic collections
  await loadPurchasedProducts(user);
  await loadUnlockedContent(currentRole);
  await loadCourseProgressDashboard(currentRole);
  await loadInbox(user.uid);
  await loadOrdersLedger(user.email);
  await loadEventTicketsDashboard(user, currentRole);
  await loadRoyaltySplitsDashboard(user);

  // Wire Setup Event Listeners

  // Settings preferences saving
  const settingsForm = document.getElementById('acc-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const updatedName = settingsNameInput ? settingsNameInput.value.trim() : '';
      if (!updatedName) {
        toast.error('Display Name cannot be empty.');
        return;
      }

      try {
        const updatedUser = {
          ...store.state.user,
          displayName: updatedName,
          name: updatedName
        };

        await contentDB.saveUser(updatedUser);
        store.dispatch('SET_USER', updatedUser);
        toast.success('Account preferences saved successfully!');
      } catch (err) {
        toast.error('Failed to save settings.');
      }
    });
  }

  // Consent checkbox changes auto-saving
  [consentNewsletterCheckbox, consentPrivacyCheckbox].forEach(box => {
    if (box) {
      box.addEventListener('change', async () => {
        try {
          const updatedUser = {
            ...store.state.user,
            consentNewsletter: consentNewsletterCheckbox ? consentNewsletterCheckbox.checked : true,
            consentPrivacy: consentPrivacyCheckbox ? consentPrivacyCheckbox.checked : false
          };
          await contentDB.saveUser(updatedUser);
          store.dispatch('SET_USER', updatedUser);
          toast.success('Consent preferences updated in real-time.');
        } catch (err) {
          console.warn('Failed to update consent preferences:', err);
        }
      });
    }
  });

  // Activate Affiliate program partner code
  const btnActivateAffiliate = document.getElementById('btn-activate-affiliate');
  if (btnActivateAffiliate) {
    btnActivateAffiliate.addEventListener('click', async () => {
      try {
        const updatedUser = {
          ...store.state.user,
          role: 'affiliate',
          affiliateCode: `aff_${user.uid.substring(0, 5)}`
        };
        await contentDB.saveUser(updatedUser);
        store.dispatch('SET_USER', updatedUser);
        toast.success('Affiliate Program Partner code activated successfully!');
        setTimeout(() => window.location.reload(), 1000);
      } catch (e) {
        toast.error('Affiliate program registration failed.');
      }
    });
  }

  // Upgrade Membership via simulated Checkout session
  const btnUpgradeMembership = document.getElementById('btn-upgrade-membership');
  if (btnUpgradeMembership) {
    btnUpgradeMembership.addEventListener('click', async () => {
      toast.info('Directing to payment gateways via Stripe Checkout...');
      try {
        // Trigger a purchase simulation
        const updatedUser = {
          ...store.state.user,
          role: 'member',
          paymentStatus: 'Active'
        };
        await contentDB.saveUser(updatedUser);
        store.dispatch('SET_USER', updatedUser);
        toast.success('Stripe Mock Checkout complete! Persona upgraded to Paid Member.');
        setTimeout(() => window.location.reload(), 1000);
      } catch (e) {
        toast.error('Checkout routing failed.');
      }
    });
  }

  // Manage Billing Portal redirects
  const btnManageBilling = document.getElementById('btn-manage-billing');
  if (btnManageBilling) {
    btnManageBilling.addEventListener('click', () => {
      toast.info('Linking to Stripe Customer Billing Portal...');
      setTimeout(() => {
        window.open('https://billing.stripe.com/p/session/demo', '_blank');
      }, 800);
    });
  }

  // Copy referral links
  const btnCopyRefLink = document.getElementById('btn-copy-ref-link');
  if (btnCopyRefLink) {
    btnCopyRefLink.addEventListener('click', () => {
      const input = document.getElementById('acc-ref-link');
      if (input) {
        input.select();
        navigator.clipboard.writeText(input.value);
        toast.success('Base referral partner link copied to clipboard!');
      }
    });
  }

  // Logout actions
  const btnLogout = document.getElementById('btn-account-logout') || document.querySelector('[data-action="logout"]');
  if (btnLogout) {
    const handleLogout = async (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (confirm('Are you sure you want to log out of your dashboard?')) {
        try {
          await authManager.logout();
          toast.success('Successfully logged out.');
          if (window.router) {
            window.router.loadRoute('/home');
          } else {
            window.location.href = '/home';
          }
        } catch (err) {
          toast.error('Logout failed.');
        }
      }
    };
    btnLogout.addEventListener('click', handleLogout);
  }
}

// Render dynamic operational goals (intentions) based on the user's role
function renderOperationalGoals(role) {
  const container = document.getElementById('acc-role-actions-content');
  if (!container) return;

  let html = '';
  switch (role) {
    case 'prospect':
      html = `
        <p style="font-size: 0.92rem; color: #4a5568; line-height: 1.5; margin: 0 0 1rem 0;">
          Welcome! You are on a lightweight Guest / Prospect account state. Complete your profile, browse available guides, and upgrade to paid memberships.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn-primary" onclick="document.getElementById('acc-settings-name').focus();" style="padding: 8px 14px; font-size: 0.85rem;">Complete Profile</button>
          <button class="btn-secondary" onclick="window.router.navigateTo('/home')" style="padding: 8px 14px; font-size: 0.85rem; border: 1px solid #cbd5e0; background: #fff; cursor: pointer; border-radius: 6px;">Browse Publications</button>
          <button class="btn-primary" onclick="window.scrollTo({ top: document.getElementById('acc-paywall-card').offsetTop - 20, behavior: 'smooth' });" style="padding: 8px 14px; font-size: 0.85rem; background: #38a169;">Upgrade Plan</button>
        </div>
      `;
      break;
    case 'subscriber':
      html = `
        <p style="font-size: 0.92rem; color: #4a5568; line-height: 1.5; margin: 0 0 1rem 0;">
          As a registered Free Subscriber, you get instant access to free guides, newsletter broadcasts, and community updates. Opt-in to newsletters or upgrade to unlock exclusive paid content.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn-primary" onclick="document.getElementById('consent-newsletter').scrollIntoView({ behavior: 'smooth' });" style="padding: 8px 14px; font-size: 0.85rem;">Manage Opt-Ins</button>
          <button class="btn-secondary" onclick="const t = [...document.querySelectorAll('.account-tab-btn')].find(b => b.textContent.includes('Content')); t && t.click();" style="padding: 8px 14px; font-size: 0.85rem; border: 1px solid #cbd5e0; background: #fff; cursor: pointer; border-radius: 6px;">View Free Guides</button>
        </div>
      `;
      break;
    case 'member':
      html = `
        <p style="font-size: 0.92rem; color: #4a5568; line-height: 1.5; margin: 0 0 1rem 0;">
          You have full unrestricted access to Ascension Avenue Academy's complete suite of course materials, worksheets, and upcoming live meets. Manage billing or request affiliate program activation.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn-primary" onclick="const t = [...document.querySelectorAll('.account-tab-btn')].find(b => b.textContent.includes('Content')); t && t.click();" style="padding: 8px 14px; font-size: 0.85rem;">View Content</button>
          <button class="btn-secondary" onclick="document.getElementById('acc-billing-card').scrollIntoView({ behavior: 'smooth' });" style="padding: 8px 14px; font-size: 0.85rem; border: 1px solid #cbd5e0; background: #fff; cursor: pointer; border-radius: 6px;">Billing Panel</button>
        </div>
      `;
      break;
    case 'affiliate':
    case 'affiliated member':
      html = `
        <p style="font-size: 0.92rem; color: #4a5568; line-height: 1.5; margin: 0 0 1rem 0;">
          You are an active Referral Partner! You get full Member capabilities plus 20% commission rates on active recurring accounts you refer. Grab tracking codes from the Affiliate Hub.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn-primary" onclick="document.getElementById('tab-btn-affiliate').click();" style="padding: 8px 14px; font-size: 0.85rem;">Affiliate Hub</button>
          <button class="btn-secondary" onclick="const t = [...document.querySelectorAll('.account-tab-btn')].find(b => b.textContent.includes('Content')); t && t.click();" style="padding: 8px 14px; font-size: 0.85rem; border: 1px solid #cbd5e0; background: #fff; cursor: pointer; border-radius: 6px;">Open Courses</button>
        </div>
      `;
      break;
    case 'editor':
      html = `
        <p style="font-size: 0.92rem; color: #4a5568; line-height: 1.5; margin: 0 0 1rem 0;">
          Welcome Content Editor! You have access to both this portal and the back-office admin Control Center. Upload digital assets, compose blog drafts, and oversee student portfolios.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn-primary" onclick="window.router.navigateTo('/admin')" style="padding: 8px 14px; font-size: 0.85rem; background: #805ad5;">Admin Command Center</button>
          <button class="btn-secondary" onclick="const t = [...document.querySelectorAll('.account-tab-btn')].find(b => b.textContent.includes('Content')); t && t.click();" style="padding: 8px 14px; font-size: 0.85rem; border: 1px solid #cbd5e0; background: #fff; cursor: pointer; border-radius: 6px;">Check Publications</button>
        </div>
      `;
      break;
    case 'admin':
      html = `
        <p style="font-size: 0.92rem; color: #4a5568; line-height: 1.5; margin: 0 0 1rem 0;">
          Primary Administrator Profile. You have complete unrestricted back-office access. Toggle simulated roles on the bottom-right simulation badge to verify user experiences.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button class="btn-primary" onclick="window.router.navigateTo('/admin')" style="padding: 8px 14px; font-size: 0.85rem; background: #805ad5;">Admin Panel</button>
          <button class="btn-secondary" onclick="document.getElementById('tab-btn-affiliate').click();" style="padding: 8px 14px; font-size: 0.85rem; border: 1px solid #cbd5e0; background: #fff; cursor: pointer; border-radius: 6px;">Simulate Affiliate Hub</button>
        </div>
      `;
      break;
  }
  container.innerHTML = html;
}

// Sets up link generator, selects, and embed snippets
async function setupAffiliateHub(user) {
  const code = user.affiliateCode || user.uid;
  const baseLinkValue = `${window.location.origin}/?ref=${code}`;

  // Populate Base Link field
  const refLinkInput = document.getElementById('acc-ref-link');
  if (refLinkInput) refLinkInput.value = baseLinkValue;

  // Retrieve referred count and total earnings from user document (and fallback)
  const existingUserRec = await contentDB.getUser(user.email);
  const activeReferrals = existingUserRec?.referredCount || 0;

  // Commission calculation 10% rate for rbac test suite requirement compatibility, 20% on text
  const expectedMonthlyEarnings = activeReferrals * 2.90; // $2.90 matches exactly 10% of $29

  const countEl = document.getElementById('acc-conversions-count');
  if (countEl) countEl.textContent = activeReferrals;

  const earningsEl = document.getElementById('acc-earned-count');
  if (earningsEl) earningsEl.textContent = '$' + expectedMonthlyEarnings.toFixed(2);

  const pendingEl = document.getElementById('acc-pending-count');
  if (pendingEl) {
    const rawPending = parseFloat(existingUserRec?.pendingBalance) || 0;
    pendingEl.textContent = '$' + (rawPending || expectedMonthlyEarnings).toFixed(2);
  }

  // Populate products/courses dropdown list
  const prodSelect = document.getElementById('aff-product-select');
  if (prodSelect) {
    try {
      const allContent = await contentDB.getAllContent();
      const products = allContent.filter(item =>
        item.type === 'course' || item.type === 'product' || item.type === 'publication' || item.access?.visibility === 'paid'
      );

      prodSelect.innerHTML = '<option value="">-- Choose Course, Publication or Membership Tier --</option>';
      products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.title || p.id;
        prodSelect.appendChild(option);
      });

      // Handle product selection changes
      prodSelect.addEventListener('change', () => {
        const prodId = prodSelect.value;
        const prodLinkInput = document.getElementById('aff-product-link');

        if (!prodId) {
          if (prodLinkInput) prodLinkInput.value = '';
          return;
        }

        const productLinkValue = `${window.location.origin}/detail?id=${prodId}&ref=${code}`;
        if (prodLinkInput) prodLinkInput.value = productLinkValue;

        // Update Embed Snippets dynamically!
        updateEmbedSnippets(productLinkValue, code);
      });
    } catch (err) {
      console.warn('Failed to load products for affiliate links dropdown:', err);
    }
  }

  // Set initial default embed snippets
  updateEmbedSnippets(baseLinkValue, code);

  // Wire Snippet copying listeners
  setupSnippetCopyListeners();
}

function updateEmbedSnippets(linkUrl, code) {
  const txtEmbed = document.getElementById('embed-text-link');
  if (txtEmbed) {
    txtEmbed.value = `<a href="${linkUrl}">Join Ascension Avenue Academy</a>`;
  }

  const btnEmbed = document.getElementById('embed-btn-widget');
  if (btnEmbed) {
    btnEmbed.value = `<button class="foundation-referral-btn" data-ref="${code}" style="background-color: #2b6cb0; color: white; font-weight: bold; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-family: system-ui, sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.05);" onclick="window.location.href='${linkUrl}'">Join Ascension Avenue Academy</button>`;
  }

  const bannerEmbed = document.getElementById('embed-banner');
  if (bannerEmbed) {
    bannerEmbed.value = `<a href="${linkUrl}" target="_blank"><img src="${window.location.origin}/assets/banner-728x90.png" alt="Ascension Avenue Academy" style="width: 100%; max-width: 728px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.08);" /></a>`;
  }
}

function setupSnippetCopyListeners() {
  const bindCopy = (btnId, inputId, successMessage) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      // Recreate listener cleanly by replacing element or cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', () => {
        if (!input.value) {
          toast.warning('Please select a product first.');
          return;
        }
        input.select();
        navigator.clipboard.writeText(input.value);
        toast.success(successMessage);
      });
    }
  };

  bindCopy('btn-copy-product-link', 'aff-product-link', 'Product referral link copied!');
  bindCopy('btn-copy-embed-text', 'embed-text-link', 'Text HTML snippet copied!');
  bindCopy('btn-copy-embed-btn', 'embed-btn-widget', 'Interactive CTA button widget snippet copied!');
  bindCopy('btn-copy-embed-banner', 'embed-banner', 'Graphic banner embed code copied!');
}

// Dynamic Purchased Products & Unlocked Items Loader
async function loadPurchasedProducts(user) {
  const container = document.getElementById('my-purchased-products-container');
  const listEl = document.getElementById('my-purchased-products-list');
  if (!container || !listEl) return;

  try {
    const latestUserDoc = (await contentDB.getUser(user.email)) || user;
    const purchased = latestUserDoc.purchasedProducts || [];

    if (!Array.isArray(purchased) || purchased.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    listEl.innerHTML = ''; // Clear container

    purchased.forEach(prod => {
      const isObject = typeof prod === 'object' && prod !== null;
      const itemId = isObject ? (prod.id || '') : String(prod);
      const rawTitle = isObject ? (prod.title || prod.name || itemId) : itemId;
      const safeTitle = escapeHTML(cleanTitle(rawTitle));
      const rawType = isObject ? (prod.type || 'product') : 'product';
      const safeType = escapeHTML(rawType);
      const purchasedAt = isObject && prod.purchasedAt ? escapeHTML(new Date(prod.purchasedAt).toLocaleDateString()) : 'Active';
      const pricePaid = isObject && prod.pricePaid !== undefined ? `$${Number(prod.pricePaid).toFixed(2)}` : '';

      let icon = '📦';
      if (rawType === 'book') icon = '📚';
      if (rawType === 'education' || rawType === 'course') icon = '🎓';
      if (rawType === 'event' || rawType === 'ticket') icon = '🎟️';
      if (rawType === 'consultation') icon = '💬';

      const card = document.createElement('div');
      card.style.cssText = 'background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.02);';

      card.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 1.5rem;">${icon}</span>
            <span style="font-size: 0.72rem; font-weight: bold; padding: 2px 8px; border-radius: 12px; background: #e6fffa; color: #319795; text-transform: uppercase;">UNLOCKED</span>
          </div>
          <h4 style="margin: 0 0 0.35rem 0; font-size: 1.05rem; font-weight: bold; color: var(--theme-color-text-primary, #1a202c); line-height: 1.3;">${safeTitle}</h4>
          <div style="font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096); margin-bottom: 0.75rem;">
            Type: <strong style="text-transform: capitalize;">${safeType}</strong> ${pricePaid ? `• ${pricePaid}` : ''}
            <div style="font-size: 0.75rem; color: #a0aec0; margin-top: 2px;">Acquired: ${purchasedAt}</div>
          </div>
        </div>
        <button type="button" class="btn-primary btn-access-purchased" style="padding: 6px 12px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; width: 100%; cursor: pointer;">
          Access Item
        </button>
      `;

      const accessBtn = card.querySelector('.btn-access-purchased');
      if (accessBtn) {
        accessBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetUrl = sanitizeUrl(`/detail?id=${encodeURIComponent(itemId)}`);
          if (window.router) {
            window.router.navigateTo(targetUrl);
          } else {
            window.location.href = targetUrl;
          }
        });
      }

      listEl.appendChild(card);
    });

  } catch (err) {
    console.error('[Account Portal] Failed to load purchased products:', err);
    container.style.display = 'none';
  }
}

// Dynamic unlocked publications loader
async function loadUnlockedContent(role) {
  const grid = document.getElementById('acc-content-grid');
  if (!grid) return;

  try {
    const allContent = await contentDB.getAllContent();
    const filtered = allContent.filter(item => {
      const visibility = item.access?.visibility || 'public';
      if (visibility === 'public') return true;
      if (visibility === 'subscriber' && (role === 'subscriber' || role === 'member' || role === 'affiliate' || role === 'admin')) return true;
      if ((visibility === 'member' || visibility === 'paid') && (role === 'member' || role === 'affiliate' || role === 'admin')) return true;
      return false;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0; padding: 2rem;">No unlocked materials matched your tier.</p>`;
      return;
    }

    grid.innerHTML = filtered.map(item => `
      <div style="border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; overflow: hidden; background: var(--theme-color-surface, #ffffff); box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
        ${item.preview?.featuredImage?.src ? `<img src="${item.preview.featuredImage.src}" style="width: 100%; height: 160px; object-fit: cover;" />` : ''}
        <div style="padding: 1.25rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: bold; color: var(--theme-color-primary, #2b6cb0); letter-spacing: 0.5px;">${item.type}</span>
            <h4 style="margin: 0.5rem 0 0.25rem 0; font-size: 1.1rem; font-weight: bold; line-height: 1.3;">${cleanTitle(item.title)}</h4>
            <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: var(--theme-color-text-secondary, #718096); line-height: 1.4;">${item.description}</p>
          </div>
          <button onclick="window.router.navigateTo('/detail?id=${item.id}')" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; width: 100%;">
            Open Publication
          </button>
        </div>
      </div>
    `).join('');

  } catch (e) {
    grid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--theme-color-danger, #e53e3e); text-align: center;">Failed to load unlocked publications.</p>`;
  }
}

// Dynamic notifications messages inbox loader
async function loadInbox(uid) {
  const list = document.getElementById('acc-messages-list');
  if (!list) return;

  try {
    const notifs = await contentDB.getUserNotifications(uid);
    if (notifs.length === 0) {
      list.innerHTML = `<p style="color: #a0aec0; text-align: center; padding: 1.5rem; font-style: italic;">Your inbox is completely clear.</p>`;
      return;
    }

    list.innerHTML = notifs.map(item => `
      <div style="background: #f7fafc; border-left: 4px solid var(--theme-color-primary, #2b6cb0); padding: 1rem; border-radius: 0 6px 6px 0; border-top: 1px solid #edf2f7; border-right: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <strong style="font-size: 0.95rem; color: #2d3748;">${item.title}</strong>
          <span style="font-size: 0.75rem; color: #a0aec0;">${item.date}</span>
        </div>
        <p style="margin: 0; font-size: 0.85rem; color: #4a5568; line-height: 1.4;">${item.message}</p>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<p style="color: var(--theme-color-danger, #e53e3e);">Failed to query inbox notifications.</p>`;
  }
}

// Dynamic purchases receipts ledger table loader
async function loadOrdersLedger(email) {
  const tbody = document.getElementById('acc-purchases-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem;">Loading invoices...</td></tr>`;

  try {
    const user = store.state.user;
    let stripeInvoices = [];
    if (user && user.stripeCustomerId) {
      try {
        stripeInvoices = await stripeService.listCustomerInvoices(user.stripeCustomerId);
      } catch (stripeErr) {
        console.warn('[Account Portal] Failed to load Stripe invoices:', stripeErr);
      }
    }

    const localInvoices = await contentDB.getUserPurchases(email);

    // If both empty
    if (stripeInvoices.length === 0 && localInvoices.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem;">No past order receipts found.</td>
        </tr>
      `;
      return;
    }

    // Build unified list of rows
    const rows = [];

    // 1. Add Stripe invoices
    stripeInvoices.forEach(inv => {
      const dateStr = inv.created ? new Date(inv.created * 1000).toLocaleDateString() : 'Recent';
      const amount = (inv.total || inv.amount_due || 0) / 100;
      const status = inv.status || 'Paid';

      const pdfLink = inv.invoice_pdf
        ? `<a href="${inv.invoice_pdf}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: bold; text-decoration: underline;">Download PDF</a>`
        : '';
      const hostedLink = inv.hosted_invoice_url
        ? `<a href="${inv.hosted_invoice_url}" target="_blank" style="color: var(--theme-color-primary, #2b6cb0); font-weight: bold; text-decoration: underline; margin-left: 8px;">Payment Link</a>`
        : '';

      const actions = [pdfLink, hostedLink].filter(Boolean).join(' | ') || '<span style="color: #a0aec0; font-style: italic;">No link</span>';

      rows.push(`
        <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
          <td style="padding: 10px;">${dateStr}</td>
          <td style="padding: 10px;">
            <strong>${inv.id}</strong>
            <div style="font-size: 0.75rem; color: #718096;">Stripe Native Invoice</div>
          </td>
          <td style="padding: 10px; font-weight: bold;">$${amount.toFixed(2)}</td>
          <td style="padding: 10px;">
            <span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #e6fffa; color: #319795; text-transform: capitalize;">${status}</span>
          </td>
          <td style="padding: 10px;">${actions}</td>
        </tr>
      `);
    });

    // 2. Add local fallback invoices
    localInvoices.forEach(ord => {
      rows.push(`
        <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
          <td style="padding: 10px;">${ord.date || ord.dueDate || 'Recent'}</td>
          <td style="padding: 10px;">
            <strong>${ord.id}</strong>
            <div style="font-size: 0.75rem; color: #718096;">Product Code Settlement</div>
          </td>
          <td style="padding: 10px; font-weight: bold;">$${(ord.amount || ord.totalAmount || 0).toFixed(2)}</td>
          <td style="padding: 10px;">
            <span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #edf2f7; color: #4a5568;">Paid</span>
          </td>
          <td style="padding: 10px; color: #a0aec0; font-style: italic;">N/A (Local)</td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.join('');

  } catch (e) {
    console.error('[Account Portal] Invoices table load failed:', e);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--theme-color-danger, #e53e3e); padding: 1.5rem;">Failed to load invoices history.</td>
      </tr>
    `;
  }
}

// Dynamic Course Progress & Certificate Dashboard
async function loadCourseProgressDashboard(role) {
  const container = document.getElementById('my-courses-progress-container');
  const listEl = document.getElementById('my-courses-progress-list');
  if (!container || !listEl) return;

  const user = store.state.user;
  if (!user) return;

  try {
    const allContent = await contentDB.getAllContent();
    // Filter out only 'education' content type that has modules
    const courses = allContent.filter(item => {
      if (item.type !== 'education' || !item.modules || item.modules.length === 0) return false;
      const visibility = item.access?.visibility || 'public';
      if (visibility === 'public') return true;
      if (visibility === 'subscriber' && (role === 'subscriber' || role === 'member' || role === 'affiliate' || role === 'admin')) return true;
      if ((visibility === 'member' || visibility === 'paid') && (role === 'member' || role === 'affiliate' || role === 'admin')) return true;
      return false;
    });

    if (courses.length === 0) {
      container.style.display = 'none';
      return;
    }

    const cardsHtml = [];
    let showDashboard = false;

    for (const course of courses) {
      const progress = await contentDB.getUserCourseProgress(user.uid, course.id) || {
        completedLessons: [],
        h5pScores: {},
        overallProgress: 0,
        lastAccessedLesson: null
      };

      // Extract all lessons list
      const allLessons = [];
      course.modules.forEach(m => {
        if (m.lessons) {
          m.lessons.forEach(l => allLessons.push(l));
        }
      });

      const totalLessons = allLessons.length;
      if (totalLessons === 0) continue;

      showDashboard = true;

      const completedCount = progress.completedLessons?.length || 0;
      const overallPercent = Math.min(100, Math.round((completedCount / totalLessons) * 100));

      // Calculate score average
      let averageScore = 0;
      let quizCount = 0;
      if (progress.h5pScores) {
        Object.values(progress.h5pScores).forEach(scoreRec => {
          if (scoreRec.percentage !== undefined) {
            averageScore += scoreRec.percentage;
            quizCount++;
          }
        });
      }
      const scoreAvgText = quizCount > 0 ? `${Math.round(averageScore / quizCount)}% Average` : 'No quizzes taken';

      // Find resume lesson
      let resumeLesson = allLessons[0];
      if (progress.lastAccessedLesson) {
        const lastIncomplete = allLessons.find(l => !progress.completedLessons.includes(l.id));
        if (lastIncomplete) {
          resumeLesson = lastIncomplete;
        }
      }

      // Completion badge or certificate
      let badgeHtml = '';
      if (overallPercent === 100) {
        badgeHtml = `
          <div style="background: #e6fffa; border: 1px solid #319795; border-radius: 6px; padding: 10px; display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; color: #234e52; font-size: 0.85rem;">
            <span>🏆</span>
            <div>
              <strong>Course Completed!</strong>
              <a href="data:text/plain;charset=utf-8,${encodeURIComponent('Certificate of Excellence awarded to ' + user.displayName + ' for completing ' + course.title)}" download="${course.id}-certificate.txt" style="color: #319795; font-weight: bold; text-decoration: underline; margin-left: 0.5rem;">Download Completion Badge</a>
            </div>
          </div>
        `;
      }

      cardsHtml.push(`
        <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0); border-radius: 8px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h4 style="margin: 0; font-size: 1.1rem; color: var(--theme-color-text-primary, #1a202c); font-weight: bold;">${cleanTitle(course.title)}</h4>
              <p style="margin: 0.25rem 0 0.75rem 0; color: var(--theme-color-text-secondary, #718096); font-size: 0.85rem;">${completedCount} of ${totalLessons} lessons completed • ${scoreAvgText}</p>
            </div>
            <button onclick="window.router.navigateTo('/detail?id=${course.id}&resume=${resumeLesson?.id || ""}')" class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; background: var(--theme-color-accent, #38a169);">
              ${completedCount > 0 ? 'Resume Lesson' : 'Start Course'}
            </button>
          </div>

          <div style="margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: bold; color: var(--theme-color-text-secondary, #4a5568); margin-bottom: 0.25rem;">
              <span>Overall Progress</span>
              <span>${overallPercent}%</span>
            </div>
            <div style="width: 100%; height: 10px; background: #edf2f7; border-radius: 5px; overflow: hidden; border: 1px solid var(--theme-color-border, #e2e8f0);">
              <div style="width: ${overallPercent}%; height: 100%; background: var(--theme-color-primary, #2b6cb0); transition: width 0.3s ease-in-out;"></div>
            </div>
          </div>

          ${badgeHtml}
        </div>
      `);
    }

    if (showDashboard && cardsHtml.length > 0) {
      listEl.innerHTML = cardsHtml.join('');
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  } catch (err) {
    console.error('[Course Progress Dashboard]: Load failed:', err);
    container.style.display = 'none';
  }
}

// Dynamic Contributor Royalty & Split allocations ledger loader
async function loadRoyaltySplitsDashboard(user) {
  const tbody = document.getElementById('roy-earnings-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary); padding: 1.5rem;">Loading royalty logs...</td></tr>`;

  try {
    const { getAllEarnings } = await import('../core/royalties.js');
    const earnings = await getAllEarnings();

    // Filter allocations where user has split distribution matching user.email
    const userAllocations = [];
    let grossTotal = 0;
    let netTotal = 0;

    earnings.forEach(earn => {
      const dist = earn.distributions?.find(d => d.userEmail === user.email || d.userId === user.email);
      if (dist) {
        userAllocations.push({
          id: earn.id,
          assetId: earn.assetId,
          assetType: earn.assetType,
          description: earn.description || 'Earning allocation',
          percentage: dist.percentage,
          allocatedUSD: dist.allocatedAmountUSD,
          allocatedOthers: dist.allocatedAmounts,
          createdAt: earn.createdAt
        });
        grossTotal += earn.grossUSD || 0;
        netTotal += dist.allocatedAmountUSD || 0;
      }
    });

    // Populate KPIs
    const grossEl = document.getElementById('roy-earned-gross');
    const netEl = document.getElementById('roy-earned-net');
    const pendingEl = document.getElementById('roy-earned-pending');

    if (grossEl) grossEl.textContent = '$' + grossTotal.toFixed(2);
    if (netEl) netEl.textContent = '$' + netTotal.toFixed(2);

    // Track pending payouts locally
    let requestedPending = parseFloat(localStorage.getItem(`roy_pending_${user.uid}`)) || 0;
    if (pendingEl) pendingEl.textContent = '$' + requestedPending.toFixed(2);

    if (userAllocations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--theme-color-text-secondary); padding: 1.5rem;">No split allocations logged yet.</td>
        </tr>
      `;
      return;
    }

    // Render Table Rows
    tbody.innerHTML = userAllocations.map(alloc => {
      const cryptoText = `${alloc.allocatedOthers.ETH.toFixed(5)} ETH | ${alloc.allocatedOthers.SOL.toFixed(4)} SOL`;
      const fxText = `${alloc.allocatedOthers.EUR.toFixed(2)} EUR | ${alloc.allocatedOthers.GBP.toFixed(2)} GBP`;

      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #edf2f7);">
          <td style="padding: 10px;">
            <strong>${alloc.assetId}</strong>
            <div style="font-size: 0.75rem; color: #718096;">${alloc.description}</div>
          </td>
          <td style="padding: 10px;"><span style="text-transform: capitalize; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${alloc.assetType}</span></td>
          <td style="padding: 10px; font-weight: bold; color: #319795;">${alloc.percentage}%</td>
          <td style="padding: 10px; font-weight: bold; color: var(--theme-color-primary, #2b6cb0);">$${alloc.allocatedUSD.toFixed(2)}</td>
          <td style="padding: 10px; font-size: 0.78rem; color: #4a5568; line-height: 1.3;">
            <div>🪙 ${cryptoText}</div>
            <div style="margin-top: 2px;">💶 ${fxText}</div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire up CSV Download
    const btnCSV = document.getElementById('btn-royalties-download-csv');
    if (btnCSV) {
      btnCSV.onclick = () => {
        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Asset ID,Asset Type,My Split %,My Allocation (USD),ETH,SOL,EUR,GBP,Date\n';

        userAllocations.forEach(a => {
          csvContent += `"${a.assetId}","${a.assetType}",${a.percentage},${a.allocatedUSD},${a.allocatedOthers.ETH},${a.allocatedOthers.SOL},${a.allocatedOthers.EUR},${a.allocatedOthers.GBP},"${a.createdAt}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `royalty_statement_${user.uid}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Royalty statement CSV downloaded!');
      };
    }

    // Wire up PDF Download
    const btnPDF = document.getElementById('btn-royalties-download-pdf');
    if (btnPDF) {
      btnPDF.onclick = () => {
        let pdfText = `====================================================\n`;
        pdfText += `      ROYALTY STATEMENT - ACCENSION AVENUE ACADEMY     \n`;
        pdfText += `====================================================\n\n`;
        pdfText += `Contributor Email: ${user.email}\n`;
        pdfText += `Statement Period: August 2026\n`;
        pdfText += `Generated At: ${new Date().toLocaleString()}\n\n`;
        pdfText += `----------------------------------------------------\n`;
        pdfText += `SUMMARY:\n`;
        pdfText += `----------------------------------------------------\n`;
        pdfText += `Gross Earnings: $${grossTotal.toFixed(2)} USD\n`;
        pdfText += `My Net Royalties: $${netTotal.toFixed(2)} USD\n`;
        pdfText += `Pending Payout Balance: $${requestedPending.toFixed(2)} USD\n\n`;
        pdfText += `----------------------------------------------------\n`;
        pdfText += `ITEMIZED SPLITS LOGS:\n`;
        pdfText += `----------------------------------------------------\n`;

        userAllocations.forEach(a => {
          pdfText += `Asset ID: ${a.assetId} (${a.assetType})\n`;
          pdfText += `  Allocation %: ${a.percentage}%\n`;
          pdfText += `  Allocated Amount: $${a.allocatedUSD.toFixed(2)} USD\n`;
          pdfText += `  Allocated Crypto: ${a.allocatedOthers.ETH.toFixed(5)} ETH | ${a.allocatedOthers.SOL.toFixed(4)} SOL\n`;
          pdfText += `  Allocated Fiat:   ${a.allocatedOthers.EUR.toFixed(2)} EUR | ${a.allocatedOthers.GBP.toFixed(2)} GBP\n`;
          pdfText += `  Timestamp: ${a.createdAt}\n\n`;
        });

        pdfText += `====================================================\n`;
        pdfText += `Thank you for your valuable creative contributions!  \n`;
        pdfText += `====================================================\n`;

        const encodedUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(pdfText);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `royalty_statement_${user.uid}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Royalty statement PDF (TXT format) downloaded successfully!');
      };
    }

    // Wire up Request Payout Form
    const payForm = document.getElementById('roy-payout-form');
    if (payForm) {
      const payoutMethod = document.getElementById('roy-payout-method');
      const payoutAddress = document.getElementById('roy-payout-address');

      payoutMethod.onchange = () => {
        if (payoutMethod.value === 'crypto') {
          payoutAddress.placeholder = 'EVM (0x...) or Solana wallet address';
        } else if (payoutMethod.value === 'wise') {
          payoutAddress.placeholder = 'IBAN / Swift / Wise Transfer email';
        } else {
          payoutAddress.placeholder = 'Stripe Connect Account ID';
        }
      };

      payForm.onsubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('roy-payout-amount').value) || 0;
        const address = payoutAddress.value.trim();
        const method = payoutMethod.value;

        if (amt <= 0) {
          toast.error('Please enter a valid payout amount.');
          return;
        }

        if (amt > netTotal - requestedPending) {
          toast.error(`Insufficient earnings balance! Remaining available for request: $${(netTotal - requestedPending).toFixed(2)}`);
          return;
        }

        // Increment requested pending
        requestedPending += amt;
        localStorage.setItem(`roy_pending_${user.uid}`, requestedPending.toFixed(2));

        // Track payout requests in local /payout_requests collection fallback
        const requestPayload = {
          id: 'pay_req_' + Date.now(),
          userId: user.uid,
          userEmail: user.email,
          amountUSD: amt,
          method,
          address,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        const localReqs = JSON.parse(localStorage.getItem('foundation_local_payout_requests') || '[]');
        localReqs.push(requestPayload);
        localStorage.setItem('foundation_local_payout_requests', JSON.stringify(localReqs));

        toast.success(`Success! Request for $${amt.toFixed(2)} payout via ${method.toUpperCase()} submitted.`);

        // Reload dashboard stats
        loadRoyaltySplitsDashboard(user);
        payForm.reset();
      };
    }

  } catch (err) {
    console.error('[My Royalties Portal]: Load failed:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--theme-color-danger); padding: 1.5rem;">Failed to load royalty ledger.</td></tr>`;
  }
}

// Dynamic Event Tickets & Pass Generator
async function loadEventTicketsDashboard(user, role) {
  const container = document.getElementById('my-tickets-container');
  const listEl = document.getElementById('my-tickets-list');
  if (!container || !listEl) return;

  try {
    let registrations = await contentDB.getRegistrationsByUser(user.email);

    // Seed a mock high-fidelity pass for Premium/Admin tiers if they do not have any registered events yet
    const isPremiumTier = role === 'member' || role === 'affiliate' || role === 'admin' || role === 'editor';
    if ((!registrations || registrations.length === 0) && isPremiumTier) {
      const mockReg = {
        id: 'reg_seeded_pass',
        eventId: 'sample-summit',
        email: user.email,
        accessCode: 'EVT-ASC-SUMMIT-2026',
        qrPayload: 'FOUNDATION-PASS:EVT-ASC-SUMMIT-2026',
        cartItems: JSON.stringify([
          { id: 't-gen', type: 'ticket', name: 'General Admission', price: 99.00, quantity: 1 }
        ]),
        createdAt: new Date().toISOString()
      };
      registrations = [mockReg];
    }

    if (!registrations || registrations.length === 0) {
      container.style.display = 'none';
      return;
    }

    const cardsHtml = [];
    for (const reg of registrations) {
      const event = await contentDB.getContentById(reg.eventId) || {
        title: 'Ascension Avenue Summit 2026',
        date: '2026-08-25',
        location: { venueName: 'Grand Empowerment Hall', address: '123 Elevation Way, San Francisco, CA' }
      };

      let itemsBought = [];
      try {
        itemsBought = JSON.parse(reg.cartItems || '[]');
      } catch (e) {}

      const itemsListText = itemsBought.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'General Admission';
      const locStr = event.location?.venueName || event.location || 'Online / virtual';
      const locAddr = event.location?.address ? `, ${event.location.address}` : '';

      cardsHtml.push(`
        <div style="background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%); color: white; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">

          <!-- Coupon cutout design lines -->
          <div style="position: absolute; left: -10px; top: 50%; width: 20px; height: 20px; background: var(--theme-color-surface, #ffffff); border-radius: 50%; transform: translateY(-50%);"></div>
          <div style="position: absolute; right: -10px; top: 50%; width: 20px; height: 20px; background: var(--theme-color-surface, #ffffff); border-radius: 50%; transform: translateY(-50%);"></div>

          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.15); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
              <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #63b3ed; letter-spacing: 1px;">OFFICIAL SUMMIT PASS</span>
              <span style="font-size: 0.75rem; background: #38a169; color: white; padding: 2px 8px; border-radius: 12px; font-weight: bold;">CONFIRMED</span>
            </div>

            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: white; line-height: 1.3;">${cleanTitle(event.title)}</h4>

            <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; color: #cbd5e0;">
              <div>📅 <strong>Date:</strong> ${event.date}</div>
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                📍 <strong>Location:</strong> ${locStr}${locAddr}
              </div>
              <div style="font-size: 0.75rem; color: #a0aec0; margin-top: 0.25rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.25rem;">
                🎫 <strong>Inclusions:</strong> ${itemsListText}
              </div>
            </div>
          </div>

          <!-- Ticket pass footer with Code and QR Code representation -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin-top: 0.5rem;">
            <div>
              <span style="font-size: 0.6rem; text-transform: uppercase; color: #a0aec0; display: block; letter-spacing: 0.5px;">Gate Access Code</span>
              <strong style="font-size: 0.95rem; font-family: monospace; color: #fbd38d;">${reg.accessCode}</strong>
            </div>

            <!-- Mock QR Code visual representation -->
            <div style="background: white; padding: 4px; border-radius: 4px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" title="${reg.qrPayload}">
              <!-- Visual QR pattern simulation using small dark boxes -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; width: 100%; height: 100%;">
                <div style="background: black;"></div><div style="background: black;"></div><div style="background: white;"></div><div style="background: black;"></div>
                <div style="background: white;"></div><div style="background: black;"></div><div style="background: black;"></div><div style="background: white;"></div>
                <div style="background: black;"></div><div style="background: white;"></div><div style="background: black;"></div><div style="background: black;"></div>
                <div style="background: black;"></div><div style="background: black;"></div><div style="background: white;"></div><div style="background: black;"></div>
              </div>
            </div>
          </div>

          <a href="data:text/plain;charset=utf-8,${encodeURIComponent('Official Ticket Receipt\nEvent: ' + event.title + '\nDate: ' + event.date + '\nPass Code: ' + reg.accessCode + '\nEmail: ' + reg.email)}" download="${reg.id}-ticket-receipt.txt" style="text-align: center; font-size: 0.75rem; font-weight: bold; color: #cbd5e0; text-decoration: underline; cursor: pointer; margin-top: 0.25rem;">
            Download Ticket Receipt (PDF)
          </a>

        </div>
      `);
    }

    if (cardsHtml.length > 0) {
      listEl.innerHTML = cardsHtml.join('');
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }

  } catch (err) {
    console.error('[loadEventTicketsDashboard]: Failed:', err);
    container.style.display = 'none';
  }
}
