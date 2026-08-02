// utils/inventory.js - Mock Physical Product Inventory Engine
export function getInventoryCounts() {
  // Returns current stock counts for various physical or handmade items
  try {
    const stored = localStorage.getItem('foundation_local_inventory');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[Inventory]: Failed to read inventory from LocalStorage', e);
  }

  const defaultInventory = {
    "Handmade Wooden Coaster": 3, // Low stock (<= 5) should trigger a drafted PO
    "Artisan Clay Mug": 12,
    "Organic Soy Candle": 2,      // Low stock (<= 5)
    "Scented Reed Diffuser": 20
  };

  try {
    localStorage.setItem('foundation_local_inventory', JSON.stringify(defaultInventory));
  } catch (e) {}

  return defaultInventory;
}

export function updateInventoryCount(item, quantity) {
  const inventory = getInventoryCounts();
  inventory[item] = Number(quantity);
  try {
    localStorage.setItem('foundation_local_inventory', JSON.stringify(inventory));
  } catch (e) {}
  return inventory;
}
