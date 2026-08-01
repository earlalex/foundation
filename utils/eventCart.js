// utils/eventCart.js
import { store } from '../core/store.js';

class EventCart {
  constructor() {
    this.storageKey = 'foundation_event_cart';
    this.cart = this.loadCart();
  }

  loadCart() {
    try {
      const data = sessionStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[EventCart]: Failed to load cart from sessionStorage', e);
    }
    return {
      eventId: null,
      items: []
    };
  }

  saveCart() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.cart));
      // Sync with global store state
      store.dispatch('SET_CART', { ...this.cart });
      // Trigger custom window event for other active views
      window.dispatchEvent(new CustomEvent('cart_updated', { detail: this.cart }));
    } catch (e) {
      console.error('[EventCart]: Failed to save cart', e);
    }
  }

  addItem(eventId, itemType, itemId, quantity = 1, price = 0, name = '', stripePriceId = null) {
    // Check if mixing items from different events, clear previous cart if different eventId
    if (this.cart.eventId && this.cart.eventId !== eventId) {
      this.clearCart();
    }

    this.cart.eventId = eventId;

    const existing = this.cart.items.find(i => i.id === itemId && i.type === itemType);
    if (existing) {
      existing.quantity += quantity;
      if (stripePriceId) {
        existing.stripePriceId = stripePriceId;
      }
    } else {
      this.cart.items.push({
        id: itemId,
        type: itemType,
        name,
        price: Number(price),
        quantity: Number(quantity),
        stripePriceId: stripePriceId || null
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
    const taxRate = 0.0825; // 8.25% event tax
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

export const eventCart = new EventCart();
