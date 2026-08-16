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
        const items = Array.isArray(parsed.items) ? parsed.items.map(i => ({ ...i })) : [];
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
      // Sync with global store state (creating a fresh mutable copy before DeepFreeze)
      store.dispatch('SET_CART', {
        eventId: this.cart.eventId,
        eventIds: [...(this.cart.eventIds || [])],
        items: this.cart.items.map(i => ({ ...i }))
      });
      // Trigger custom window event for active views
      window.dispatchEvent(new CustomEvent('cart_updated', { detail: this.cart }));
    } catch (e) {
      console.error('[UniversalCart]: Failed to save cart', e);
    }
  }

  addItem(eventId, itemType, itemId, quantity = 1, price = 0, name = '', stripePriceId = null, image = null) {
    const validTypes = ['product', 'book', 'education', 'event', 'ticket', 'vendor_booth', 'sponsorship', 'consultation'];

    let resolvedEventId = null;
    let resolvedType = 'product';
    let resolvedId = null;
    let resolvedQty = 1;
    let resolvedPrice = 0;
    let resolvedName = '';
    let resolvedStripePriceId = null;
    let resolvedImage = null;

    if (typeof eventId === 'object' && eventId !== null) {
      // Object parameter payload style
      const opts = eventId;
      resolvedId = opts.id || opts.itemId;
      resolvedType = validTypes.includes(opts.type) ? opts.type : 'product';
      resolvedQty = Number(opts.quantity) || 1;
      resolvedPrice = Number(opts.price) || 0;
      resolvedName = opts.name || '';
      resolvedStripePriceId = opts.stripePriceId || null;
      resolvedImage = opts.image || null;
      resolvedEventId = opts.eventId || null;
    } else if (validTypes.includes(eventId)) {
      // First arg is itemType (e.g., addItem('product', id, name, price, qty, ...))
      resolvedType = eventId;
      resolvedId = itemType;
      resolvedName = itemId || '';
      resolvedPrice = Number(quantity) || 0;
      resolvedQty = Number(price) || 1;
      resolvedStripePriceId = name || null;
      resolvedImage = stripePriceId || null;
      resolvedEventId = null;
    } else {
      // Standard positional arguments: (eventId, itemType, itemId, quantity, price, name, stripePriceId, image)
      resolvedEventId = eventId || null;
      resolvedType = validTypes.includes(itemType) ? itemType : 'product';
      resolvedId = itemId;
      resolvedQty = Number(quantity) || 1;
      resolvedPrice = Number(price) || 0;
      resolvedName = name || '';
      resolvedStripePriceId = stripePriceId || null;
      resolvedImage = image || null;
    }

    if (!resolvedId) return;

    // Ensure mutable array of mutable objects
    this.cart.items = this.cart.items.map(i => ({ ...i }));

    const existing = this.cart.items.find(i =>
      i.id === resolvedId &&
      i.type === resolvedType &&
      (i.eventId || null) === (resolvedEventId || null)
    );
    if (existing) {
      existing.quantity += Number(resolvedQty);
      if (resolvedStripePriceId) existing.stripePriceId = resolvedStripePriceId;
      if (resolvedImage) existing.image = resolvedImage;
    } else {
      this.cart.items.push({
        id: resolvedId,
        type: resolvedType,
        name: resolvedName,
        price: Number(resolvedPrice),
        quantity: Number(resolvedQty),
        stripePriceId: resolvedStripePriceId,
        image: resolvedImage,
        eventId: resolvedEventId
      });
    }

    const eventIds = [...new Set(this.cart.items.map(i => i.eventId).filter(Boolean))];
    this.cart.eventId = eventIds.length > 0 ? eventIds[0] : null;
    this.cart.eventIds = eventIds;

    this.saveCart();
  }

  updateItemQuantity(itemId, itemType, newQuantity, eventId = null) {
    const qty = Number(newQuantity);
    if (isNaN(qty) || qty <= 0) {
      this.removeItem(itemId, itemType, eventId);
      return;
    }

    this.cart.items = this.cart.items.map(i => ({ ...i }));
    const item = this.cart.items.find(i =>
      i.id === itemId &&
      (!itemType || i.type === itemType) &&
      (eventId === null || (i.eventId || null) === (eventId || null))
    );
    if (item) {
      item.quantity = qty;
      const eventIds = [...new Set(this.cart.items.map(i => i.eventId).filter(Boolean))];
      this.cart.eventId = eventIds.length > 0 ? eventIds[0] : null;
      this.cart.eventIds = eventIds;
      this.saveCart();
    }
  }

  removeItem(itemId, itemType, eventId = null) {
    this.cart.items = this.cart.items.filter(i => {
      if (i.id !== itemId) return true;
      if (itemType && i.type !== itemType) return true;
      if (eventId !== null && (i.eventId || null) !== (eventId || null)) return true;
      return false;
    });
    const eventIds = [...new Set(this.cart.items.map(i => i.eventId).filter(Boolean))];
    this.cart.eventId = eventIds.length > 0 ? eventIds[0] : null;
    this.cart.eventIds = eventIds;
    this.saveCart();
  }

  getCartSummary() {
    let subtotal = 0;
    let taxableSubtotal = 0;
    let serviceFee = 0;

    const eventTypes = ['event', 'ticket', 'vendor_booth', 'sponsorship'];
    const taxableTypes = ['product', 'event', 'ticket', 'vendor_booth', 'sponsorship', 'book'];

    for (const item of this.cart.items) {
      const lineSubtotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
      subtotal += lineSubtotal;

      // Service fee ($1.50) applied only to event items
      if (eventTypes.includes(item.type)) {
        serviceFee += 1.50 * (Number(item.quantity) || 1);
      }

      // Estimated tax (8.25%) applied to taxable items (product, event, book)
      if (taxableTypes.includes(item.type)) {
        taxableSubtotal += lineSubtotal;
      }
    }

    const tax = taxableSubtotal * 0.0825;
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
