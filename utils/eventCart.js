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
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const eventIds = [...new Set(items.map(i => i.eventId).filter(Boolean))];
        return {
          eventId: eventIds.length > 0 ? eventIds[0] : (parsed.eventId || null),
          eventIds,
          items
        };
      }
    } catch (e) {
      console.error('[UniversalCart]: Failed to load cart from sessionStorage', e);
    }
    return {
      eventId: null,
      eventIds: [],
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
    const validTypes = ['product', 'book', 'education', 'event', 'ticket', 'vendor_booth', 'sponsorship', 'consultation'];
    const resolvedType = validTypes.includes(itemType) ? itemType : 'product';
    const resolvedEventId = eventId || null;

    const existing = this.cart.items.find(i => i.id === itemId && i.type === resolvedType && i.eventId === resolvedEventId);
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
        eventId: resolvedEventId
      });
    }

    const eventIds = [...new Set(this.cart.items.map(i => i.eventId).filter(Boolean))];
    this.cart.eventId = eventIds.length > 0 ? eventIds[0] : null;
    this.cart.eventIds = eventIds;

    this.saveCart();
  }

  removeItem(itemId) {
    this.cart.items = this.cart.items.filter(i => i.id !== itemId);
    const eventIds = [...new Set(this.cart.items.map(i => i.eventId).filter(Boolean))];
    this.cart.eventId = eventIds.length > 0 ? eventIds[0] : null;
    this.cart.eventIds = eventIds;
    this.saveCart();
  }

  getCartSummary() {
    const subtotal = this.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = 0.0825; // 8.25% tax
    const serviceFeePerItem = 1.50; // $1.50 service fee per item
    const serviceFee = this.cart.items.reduce((sum, item) => sum + (serviceFeePerItem * item.quantity), 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax + serviceFee;

    const eventIds = [...new Set(this.cart.items.map(i => i.eventId).filter(Boolean))];

    return {
      eventId: eventIds.length > 0 ? eventIds[0] : null,
      eventIds,
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
      eventIds: [],
      items: []
    };
    this.saveCart();
  }
}

export const universalCart = new UniversalCart();
export const eventCart = universalCart;
export default universalCart;
