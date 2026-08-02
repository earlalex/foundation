// utils/inventory.js - Thread-Safe Stock Management Engine
import { contentDB } from '../core/db.js';
import { toast } from './toast.js';

// Simple client-side Mutex lock to guarantee thread-safe stock operations (prevents race conditions)
class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      nextResolve();
    } else {
      this.locked = false;
    }
  }
}

const inventoryMutex = new Mutex();

/**
 * Get all current inventory reservations
 * @returns {Object}
 */
export function getReservations() {
  try {
    return JSON.parse(localStorage.getItem('foundation_inventory_reservations') || '{}');
  } catch (e) {
    return {};
  }
}

/**
 * Save inventory reservations
 * @param {Object} reservations
 */
export function saveReservations(reservations) {
  localStorage.setItem('foundation_inventory_reservations', JSON.stringify(reservations));
}

/**
 * Reserves item stock during cart checkout.
 * Reserves are held for 15 minutes before expiring.
 * @param {string} productId
 * @param {string} variantId - Optional specific selected variant identifier (e.g. "Color:Matte Black|Size:12 oz")
 * @param {number} qty
 * @returns {Promise<boolean>} True if stock is successfully reserved, false if insufficient stock
 */
export async function reserveStock(productId, variantId = 'default', qty = 1) {
  await inventoryMutex.acquire();
  try {
    const product = await contentDB.getContentById(productId);
    if (!product || !product.inventory) {
      console.warn(`[Inventory]: Product ${productId} does not support stock tracking.`);
      return false;
    }

    const inv = product.inventory;
    if (!inv.trackInventory) {
      return true; // Infinite stock, always available
    }

    // Calculate current reservations
    const reservations = getReservations();
    const now = Date.now();
    let totalReserved = 0;

    // Prune expired reservations (older than 15 minutes)
    for (const [key, res] of Object.entries(reservations)) {
      if (now - res.timestamp > 15 * 60 * 1000) {
        delete reservations[key];
      } else if (res.productId === productId && res.variantId === variantId) {
        totalReserved += res.qty;
      }
    }

    const availableStock = inv.stockQuantity - totalReserved;

    if (availableStock < qty && !inv.allowBackorders) {
      console.warn(`[Inventory]: Insufficient stock for ${productId} (${variantId}). Requested: ${qty}, Available: ${availableStock}`);
      return false;
    }

    // Create new reservation
    const reserveKey = `${productId}_${variantId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    reservations[reserveKey] = {
      productId,
      variantId,
      qty,
      timestamp: now
    };

    saveReservations(reservations);
    console.log(`[Inventory]: Reserved ${qty} unit(s) of ${productId} (${variantId})`);
    return true;
  } finally {
    inventoryMutex.release();
  }
}

/**
 * Deducts stock immediately upon successful payment (Stripe, Crypto, or Wise checkout).
 * This will also clear any matching reservations for the buyer/product.
 * @param {string} productId
 * @param {string} variantId
 * @param {number} qty
 * @returns {Promise<boolean>}
 */
export async function decrementStock(productId, variantId = 'default', qty = 1) {
  await inventoryMutex.acquire();
  try {
    const product = await contentDB.getContentById(productId);
    if (!product || !product.inventory) {
      return false;
    }

    const inv = product.inventory;
    if (!inv.trackInventory) {
      return true;
    }

    // Deduct stock
    const originalStock = inv.stockQuantity;
    inv.stockQuantity = Math.max(0, originalStock - qty);
    product.inventory = inv;

    // Save product back to Firestore/LocalStorage
    await contentDB.saveContent(product);
    console.log(`[Inventory]: Stock decremented for ${productId} (${variantId}). Original: ${originalStock}, New: ${inv.stockQuantity}`);

    // Clear matching reservations (pruning any that correspond to this product/variant)
    const reservations = getReservations();
    let clearedCount = 0;
    for (const [key, res] of Object.entries(reservations)) {
      if (res.productId === productId && res.variantId === variantId && clearedCount < qty) {
        const toClear = Math.min(res.qty, qty - clearedCount);
        res.qty -= toClear;
        clearedCount += toClear;
        if (res.qty <= 0) {
          delete reservations[key];
        }
      }
    }
    saveReservations(reservations);

    // Trigger low stock checks after decrement
    await checkLowStockAlerts();

    return true;
  } catch (err) {
    console.error(`[Inventory]: Failed to decrement stock for ${productId}:`, err);
    return false;
  } finally {
    inventoryMutex.release();
  }
}

/**
 * Automatically flags items reaching lowStockThreshold and generates an Admin alert notification.
 * Alerts are stored under localStorage 'foundation_low_stock_alerts' to render on the Admin dashboard.
 * @returns {Promise<Array>} List of low-stock alert records
 */
export async function checkLowStockAlerts() {
  try {
    const products = await contentDB.getContentByType('product');
    const alerts = [];

    products.forEach(product => {
      const inv = product.inventory;
      if (inv && inv.trackInventory) {
        if (inv.stockQuantity <= inv.lowStockThreshold) {
          alerts.push({
            productId: product.id,
            productTitle: product.title,
            sku: product.sku || 'N/A',
            stockQuantity: inv.stockQuantity,
            threshold: inv.lowStockThreshold,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    localStorage.setItem('foundation_low_stock_alerts', JSON.stringify(alerts));

    if (alerts.length > 0) {
      console.warn(`[Inventory Low Stock Warning]: ${alerts.length} item(s) are running low!`);
    }

    return alerts;
  } catch (err) {
    console.error('[Inventory]: Error checking low stock alerts:', err);
    return [];
  }
}

/**
 * Get summary of all products, stock levels, and low stock count
 * @returns {Promise<Object>}
 */
export async function getInventorySummary() {
  try {
    const products = await contentDB.getContentByType('product') || [];
    let totalProducts = products.length;
    let lowStockCount = 0;
    let totalStock = 0;

    products.forEach(p => {
      const inv = p.inventory;
      if (inv) {
        if (inv.trackInventory) {
          totalStock += (inv.stockQuantity || 0);
          if ((inv.stockQuantity || 0) <= (inv.lowStockThreshold || 0)) {
            lowStockCount++;
          }
        }
      }
    });

    return {
      totalProducts,
      totalStock,
      lowStockCount,
      hasLowStockAlerts: lowStockCount > 0
    };
  } catch (err) {
    console.warn('[Inventory Summary]: Failed to calculate inventory summary:', err.message);
    return {
      totalProducts: 0,
      totalStock: 0,
      lowStockCount: 0,
      hasLowStockAlerts: false
    };
  }
}

/**
 * Simple in-memory or localStorage stock counter for Spark COO monitoring
 */
let memoryInventoryCounts = {
  "Handmade Wooden Coaster": 10,
  "Physical Product Unit": 25
};

export function getInventoryCounts() {
  try {
    const stored = localStorage.getItem('foundation_spark_inventory');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {}
  return { ...memoryInventoryCounts };
}

export function updateInventoryCount(itemName, count) {
  const current = getInventoryCounts();
  current[itemName] = count;
  try {
    localStorage.setItem('foundation_spark_inventory', JSON.stringify(current));
  } catch (e) {}
  memoryInventoryCounts[itemName] = count;
}

/**
 * Get cached low-stock alerts
 * @returns {Array}
 */
export function getCachedLowStockAlerts() {
  try {
    return JSON.parse(localStorage.getItem('foundation_low_stock_alerts') || '[]');
  } catch (e) {
    return [];
  }
}
