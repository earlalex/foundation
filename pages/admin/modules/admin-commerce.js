// pages/admin/modules/admin-commerce.js - Orders Fulfillment Engine & State Compliance Alerts
import { initProductsTab } from '../admin-products.js';
import { initFinancesTab } from '../admin-finances.js';
import { contentDB } from '../../../core/db.js';
import { toast } from '../../../utils/toast.js';

export function initAdminCommerce() {
  // 1. Initialize original sub-tabs (Products & Services list, Finances tracker)
  initProductsTab();
  initFinancesTab();

  // 2. Inject Fulfillment & Orders Sub-tab & State Compliance alerts
  injectOrdersSubtabAndCompliance();
}

/**
 * Dynamically injects a third sub-tab ("Fulfillment & Orders") into #tab-products
 * and checks for State Compliance filing deadlines to display real-time warning banners.
 */
async function injectOrdersSubtabAndCompliance() {
  // --- Part A: State Obligations Warnings ---
  const tabProducts = document.getElementById('tab-products');
  if (tabProducts) {
    try {
      const compliance = await contentDB.getStateCompliance();
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const checkDeadline = (dateStr, name) => {
        if (!dateStr) return null;
        const dueDate = new Date(dateStr);
        dueDate.setHours(0, 0, 0, 0);
        const timeDiff = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (diffDays === 60 || diffDays === 30 || diffDays === 7 || (diffDays > 0 && diffDays <= 60)) {
          let urgency = 'warning';
          let bgColor = '#fffaf0';
          let borderColor = '#fbd38d';
          let textColor = '#c05621';

          if (diffDays <= 7) {
            urgency = 'critical';
            bgColor = '#fff5f5';
            borderColor = '#fed7d7';
            textColor = '#9b2c2c';
          } else if (diffDays <= 30) {
            urgency = 'urgent';
            bgColor = '#fffff0';
            borderColor = '#e2e8f0';
            textColor = '#b7791f';
          }

          return {
            name,
            days: diffDays,
            dueDate: dateStr,
            bgColor,
            borderColor,
            textColor,
            urgency
          };
        }
        return null;
      };

      const reportAlert = checkDeadline(compliance.annualReportDueDate, 'Annual Corporate Report');
      const taxAlert = checkDeadline(compliance.franchiseTaxDueDate, 'Franchise Tax Filing');

      const alerts = [reportAlert, taxAlert].filter(Boolean);

      // Remove existing warning banner if any
      const existingBanners = tabProducts.querySelectorAll('.state-compliance-warning-banner');
      existingBanners.forEach(b => b.remove());

      if (alerts.length > 0) {
        alerts.forEach(alert => {
          const banner = document.createElement('div');
          banner.className = 'state-compliance-warning-banner';
          banner.style.cssText = `
            background: ${alert.bgColor};
            border: 2px solid ${alert.borderColor};
            color: ${alert.textColor};
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            font-weight: bold;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
          `;
          banner.innerHTML = `
            <span>⚠️ [State Compliance Alert - ${alert.urgency.toUpperCase()}] Your state regulatory filing ${alert.name} is due in ${alert.days} days (Due Date: ${alert.dueDate}). Status: ${compliance.stateFilingStatus || 'Active'}.</span>
            <button class="btn-primary" id="btn-resolve-compliance" style="padding: 4px 10px; font-size: 0.8rem; background: ${alert.textColor}; border: none; color: white; cursor: pointer; border-radius: 4px;">Update Filing Status</button>
          `;
          tabProducts.insertBefore(banner, tabProducts.firstChild);

          // Wire resolve button to pop up status update
          banner.querySelector('#btn-resolve-compliance').onclick = async () => {
            const newStatus = prompt('Enter updated State Filing Status:', compliance.stateFilingStatus || 'Good Standing');
            if (newStatus) {
              await contentDB.saveStateCompliance({
                ...compliance,
                stateFilingStatus: newStatus
              });
              toast.success('State Compliance Standing updated successfully!');
              injectOrdersSubtabAndCompliance(); // reload alerts
            }
          };
        });
      }
    } catch (e) {
      console.warn('[Compliance Warnings Engine] Failed to process alerts:', e);
    }
  }

  // --- Part B: Fulfillment & Orders Sub-tab Injection ---
  const subtabContainer = document.querySelector('#tab-products > div > div:first-child');
  if (subtabContainer && !document.getElementById('btn-subtab-orders')) {
    const ordersBtn = document.createElement('button');
    ordersBtn.id = 'btn-subtab-orders';
    ordersBtn.style.cssText = `
      background: transparent;
      color: var(--theme-color-text-secondary, #4a5568);
      padding: 8px 16px;
      font-size: 0.9rem;
      border-radius: var(--theme-layout-border-radius, 8px);
      cursor: pointer;
      border: 1px solid transparent;
      font-weight: bold;
    `;
    ordersBtn.textContent = 'Fulfillment & Orders';
    subtabContainer.appendChild(ordersBtn);

    // Create panel container for orders
    const panelProducts = document.getElementById('panel-subtab-products');
    const panelCourses = document.getElementById('panel-subtab-courses');
    const panelOrders = document.createElement('div');
    panelOrders.id = 'panel-subtab-orders';
    panelOrders.style.cssText = `
      display: none;
      background: var(--theme-color-surface, #ffffff);
      border: 1px solid var(--theme-color-border, #e2e8f0);
      padding: 1.5rem;
      border-radius: var(--theme-layout-border-radius, 8px);
    `;

    panelOrders.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="background: #e6fffa; border: 1px solid #b2f5ea; padding: 1.5rem; border-radius: 8px;">
          <h2 style="margin-top: 0; font-size: 1.25rem; color: #319795;">Handmade Order Fulfillment & Shipping Board</h2>
          <p style="margin: 0; font-size: 0.9rem; color: #234e52;">
            Track the status of all physical, artisanal, and handmade purchases. Manage tracking numbers, select shipment carriers, and notify buyers automatically on status transition events.
          </p>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid var(--theme-color-border, #e2e8f0); text-align: left; font-size: 0.85rem;">
                <th style="padding: 10px;">Order ID & Date</th>
                <th style="padding: 10px;">Product & Variant</th>
                <th style="padding: 10px;">Buyer Email</th>
                <th style="padding: 10px;">Fulfillment Status</th>
                <th style="padding: 10px;">Shipping Details</th>
                <th style="padding: 10px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="orders-tbody">
              <!-- Orders load here dynamically -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Insert orders panel after panel-subtab-courses
    if (panelCourses) {
      panelCourses.parentNode.insertBefore(panelOrders, panelCourses.nextSibling);
    }

    // Add click events to switch sub-tabs
    const btnProducts = document.getElementById('btn-subtab-products');
    const btnCourses = document.getElementById('btn-subtab-courses');

    const switchSubtab = (activeTab) => {
      [btnProducts, btnCourses, ordersBtn].forEach(btn => {
        if (!btn) return;
        if (btn.id === `btn-subtab-${activeTab}`) {
          btn.className = 'btn-primary';
          btn.style.background = 'var(--theme-color-primary, #2b6cb0)';
          btn.style.color = 'white';
          btn.style.border = 'none';
        } else {
          btn.className = '';
          btn.style.background = 'transparent';
          btn.style.color = 'var(--theme-color-text-secondary, #4a5568)';
          btn.style.border = '1px solid transparent';
        }
      });

      [panelProducts, panelCourses, panelOrders].forEach(panel => {
        if (!panel) return;
        panel.style.display = panel.id === `panel-subtab-${activeTab}` ? 'block' : 'none';
      });

      if (activeTab === 'orders') {
        loadFulfillmentOrders();
      }
    };

    ordersBtn.addEventListener('click', () => switchSubtab('orders'));
    btnProducts?.addEventListener('click', () => switchSubtab('products'));
    btnCourses?.addEventListener('click', () => switchSubtab('courses'));
  }
}

/**
 * Loads all orders from local/fallback storage and renders them in the fulfillment board.
 */
export function loadFulfillmentOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  // Retrieve orders
  const orders = getLocalOrders();

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--theme-color-text-secondary, #a0aec0); padding: 1.5rem;">No orders registered in the system. Make a purchase via storefront first.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const carrier = order.shippingDetails?.carrier || '';
    const tracking = order.shippingDetails?.trackingNumber || '';
    const date = new Date(order.createdAt).toLocaleDateString();

    const statusOptions = ['Pending Production', 'Processing', 'Shipped', 'Ready for Pickup', 'Delivered'];
    const carrierOptions = ['USPS', 'UPS', 'FedEx', 'DHL'];

    const statusDropdown = `
      <select class="order-status-select" data-order-id="${order.id}" style="padding: 4px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;">
        ${statusOptions.map(opt => `<option value="${opt}" ${order.fulfillmentStatus === opt ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>
    `;

    const carrierDropdown = `
      <select class="order-carrier-select" data-order-id="${order.id}" style="padding: 4px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem;">
        <option value="">-- Carrier --</option>
        ${carrierOptions.map(opt => `<option value="${opt}" ${carrier === opt ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>
    `;

    const trackingInput = `
      <input type="text" class="order-tracking-input" data-order-id="${order.id}" value="${tracking}" placeholder="Tracking #" style="padding: 4px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem; width: 110px;" />
    `;

    return `
      <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0);">
        <td style="padding: 10px; font-size: 0.85rem;">
          <strong style="color: var(--theme-color-text-primary, #1a202c);">${order.id}</strong>
          <div style="font-size: 0.75rem; color: #a0aec0;">Date: ${date}</div>
        </td>
        <td style="padding: 10px; font-size: 0.85rem;">
          <strong>${order.productTitle}</strong>
          <div style="font-size: 0.75rem; color: #718096;">Variant: ${order.variantId || 'Default'}</div>
          <div style="font-size: 0.75rem; color: #718096;">Qty: ${order.qty || 1}</div>
        </td>
        <td style="padding: 10px; font-size: 0.85rem; color: var(--theme-color-text-secondary, #4a5568);">${order.buyerEmail || 'N/A'}</td>
        <td style="padding: 10px;">${statusDropdown}</td>
        <td style="padding: 10px; display: flex; flex-direction: column; gap: 4px;">
          ${carrierDropdown}
          ${trackingInput}
        </td>
        <td style="padding: 10px; text-align: right;">
          <button class="btn-update-fulfillment btn-primary" data-order-id="${order.id}" style="padding: 6px 10px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; cursor: pointer;">
            Update & Notify
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach handlers to update buttons
  tbody.querySelectorAll('.btn-update-fulfillment').forEach(btn => {
    btn.onclick = async () => {
      const orderId = btn.dataset.orderId;
      const statusSelect = tbody.querySelector(`.order-status-select[data-order-id="${orderId}"]`);
      const carrierSelect = tbody.querySelector(`.order-carrier-select[data-order-id="${orderId}"]`);
      const trackingInput = tbody.querySelector(`.order-tracking-input[data-order-id="${orderId}"]`);

      const status = statusSelect.value;
      const carrier = carrierSelect.value;
      const tracking = trackingInput.value.trim();

      const orders = JSON.parse(localStorage.getItem('foundation_local_orders') || '{}');
      const order = orders[orderId];

      if (order) {
        order.fulfillmentStatus = status;
        order.shippingDetails = {
          carrier,
          trackingNumber: tracking,
          shippedAt: status === 'Shipped' ? new Date().toISOString() : (order.shippingDetails?.shippedAt || '')
        };
        order.updatedAt = new Date().toISOString();

        // Save order back
        orders[orderId] = order;
        localStorage.setItem('foundation_local_orders', JSON.stringify(orders));

        // Mock automated email notification dispatch
        mockFulfillmentEmailNotification(order);

        toast.success(`Order ${orderId} fulfillment updated to "${status}" and buyer has been notified!`);
        loadFulfillmentOrders();
      }
    };
  });
}

/**
 * Simulates dispatch of an email notification to the buyer during status transitions.
 * @param {Object} order
 */
function mockFulfillmentEmailNotification(order) {
  const buyerEmail = order.buyerEmail || 'buyer@example.com';
  const status = order.fulfillmentStatus;
  const carrier = order.shippingDetails?.carrier || 'Standard';
  const tracking = order.shippingDetails?.trackingNumber || 'N/A';

  const subject = `[Fulfillment Update] Your order ${order.id} status: ${status}`;
  const body = `
    Hello,

    Thank you for purchasing our handmade products!
    The fulfillment status of your order of "${order.productTitle}" has been updated:

    New Status: ${status}
    Shipping Carrier: ${carrier}
    Tracking Number: ${tracking}

    You can track your package directly on the carrier's official portal.

    Warm regards,
    Foundation Backoffice
  `;

  console.log(`[AUTOMATED EMAIL TO ${buyerEmail}]:\nSubject: ${subject}\nBody: ${body}`);
}

/**
 * Retrieve local orders dictionary
 * @returns {Array} List of orders sorted newest first
 */
function getLocalOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem('foundation_local_orders') || '{}');

    // Seed sample order if empty to let admin test the board easily!
    if (Object.keys(orders).length === 0) {
      const sampleOrder = {
        id: 'order_123_sample',
        type: 'order',
        productId: 'handmade-artisan-mug',
        productTitle: 'Handmade Artisan Mug',
        variantId: 'Color:Matte Black|Size:12 oz',
        qty: 1,
        paymentMethod: 'Stripe Credit Card',
        paymentStatus: 'Paid',
        fulfillmentStatus: 'Pending Production',
        shippingDetails: {
          carrier: '',
          trackingNumber: '',
          shippedAt: ''
        },
        buyerEmail: 'buyer_artisan@earlalex.com',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
      };
      orders[sampleOrder.id] = sampleOrder;
      localStorage.setItem('foundation_local_orders', JSON.stringify(orders));
    }

    return Object.values(orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (e) {
    return [];
  }
}
