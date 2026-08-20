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
      // Sync with global store state (copying items array to prevent DeepFreeze immutability errors)
      const clonedCart = {
        ...this.cart,
        items: this.cart.items.map(item => ({ ...item }))
      };
      store.dispatch('SET_CART', clonedCart);
      // Trigger custom window event for active views
      window.dispatchEvent(new CustomEvent('cart_updated', { detail: this.cart }));
    } catch (e) {
      console.error('[UniversalCart]: Failed to save cart', e);
    }
  }

  updateItemQuantity(...args) {
    let itemId, quantity, eventId, itemType;
    if (args.length === 2) {
      [itemId, quantity] = args;
      // Two-argument mode: find first item matching id only
      // Callers should pass full identity or use removeItem for precise targeting
    } else if (args.length >= 3) {
      [eventId, itemType, itemId, quantity] = args;
    }

    const newQty = Number(quantity);
    if (isNaN(newQty) || newQty <= 0) {
      this.removeItem(itemId, itemType, eventId);
      return;
    }

    const item = this.cart.items.find(i =>
      i.id === itemId &&
      (args.length === 2 || !itemType || i.type === itemType) &&
      (args.length === 2 || eventId === undefined || i.eventId === eventId)
    );

    if (item) {
      item.quantity = newQty;
      this.saveCart();
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

  removeItem(itemId, itemType = null, eventId = undefined) {
    this.cart.items = this.cart.items.filter(i => {
      if (i.id !== itemId) return true;
      if (itemType && i.type !== itemType) return true;
      if (eventId !== undefined && i.eventId !== eventId) return true;
      return false;
    });
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
