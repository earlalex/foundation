// utils/eventCart.js
import { store } from '../core/store.js';

class UniversalCart {
  constructor() {
    this.storageKey = 'foundation_universal_cart';
    this.legacyStorageKey = 'foundation_event_cart';
    this.cart = this.loadCart();
  }

  loadCart() {
    try {
      let data = sessionStorage.getItem(this.storageKey);
      if (!data) {
        data = sessionStorage.getItem(this.legacyStorageKey);
      }
      if (data) {
        const parsed = JSON.parse(data);
        return {
          eventId: parsed.eventId || null,
          items: Array.isArray(parsed.items) ? parsed.items : []
        };
      }
    } catch (e) {
      console.error('[UniversalCart]: Failed to load cart from sessionStorage', e);
    }
    return {
      eventId: null,
      items: []
    };
  }

  saveCart() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.cart));
      sessionStorage.setItem(this.legacyStorageKey, JSON.stringify(this.cart));
      // Sync with global store state
      store.dispatch('SET_CART', { ...this.cart });
      // Trigger custom window event for active views
      window.dispatchEvent(new CustomEvent('cart_updated', { detail: this.cart }));
    } catch (e) {
      console.error('[UniversalCart]: Failed to save cart', e);
    }
  }

  addItem(eventId, itemType, itemId, quantity = 1, price = 0, name = '', stripePriceId = null) {
    if (eventId) {
      this.cart.eventId = eventId;
    }

    const validTypes = ['product', 'book', 'education', 'event', 'ticket', 'vendor_booth', 'sponsorship', 'consultation'];
    const resolvedType = validTypes.includes(itemType) ? itemType : 'product';

    const existing = this.cart.items.find(i => i.id === itemId && i.type === resolvedType);
    if (existing) {
      existing.quantity += Number(quantity);
      if (stripePriceId) {
        existing.stripePriceId = stripePriceId;
      }
    } else {
      this.cart.items.push({
        id: itemId,
        type: resolvedType,
        name,
        price: Number(price),
        quantity: Number(quantity),
        stripePriceId: stripePriceId || null,
        eventId: eventId || null
      });
    }

    this.saveCart();
  }

  removeItem(itemId) {
    this.cart.items = this.cart.items.filter(i => i.id !== itemId);
    if (this.cart.items.length === 0) {
      this.cart.eventId = null;
    }
    this.saveCart();
  }

  getCartSummary() {
    const subtotal = this.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = 0.0825; // 8.25% tax
    const serviceFeePerItem = 1.50; // $1.50 service fee per item
    const serviceFee = this.cart.items.reduce((sum, item) => sum + (serviceFeePerItem * item.quantity), 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax + serviceFee;

    return {
      eventId: this.cart.eventId,
      items: this.cart.items,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      serviceFee: Number(serviceFee.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }

  clearCart() {
    this.cart = {
      eventId: null,
      items: []
    };
    this.saveCart();
  }
}

export const universalCart = new UniversalCart();
export const eventCart = universalCart;
export default universalCart;
