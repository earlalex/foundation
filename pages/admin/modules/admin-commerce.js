// pages/admin/modules/admin-commerce.js
import { initProductsTab } from '../admin-products.js';
import { initFinancesTab } from '../admin-finances.js';

export function initAdminCommerce() {
  initProductsTab();
  initFinancesTab();
}
