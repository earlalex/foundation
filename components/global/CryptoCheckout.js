// components/global/CryptoCheckout.js - Web3 Crypto Checkout Component
import { store } from '../../core/store.js';
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { detectWallets, connectEVMWallet, connectSolanaWallet, signMessage, formatAddress } from '../../core/crypto.js';
import { getFirestoreDB, doc, setDoc } from '../../core/db-shared.js';

class CryptoCheckout extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.activeWallet = null;
    this.walletType = null; // 'evm' | 'solana'
    this.selectedCurrency = 'USDC';
    this.amountUSD = 29.00; // default amount (e.g. membership)
    this.checkoutType = 'membership'; // 'membership' | 'event' | 'product'
    this.productId = '';
    this.variantId = 'default';
    this.qty = 1;
    this.buyerEmail = '';
  }

  static get observedAttributes() {
    return ['amount-usd', 'checkout-type', 'product-id', 'variant-id', 'qty', 'buyer-email'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'amount-usd') this.amountUSD = parseFloat(newVal) || 29.00;
    if (name === 'checkout-type') this.checkoutType = newVal;
    if (name === 'product-id') this.productId = newVal;
    if (name === 'variant-id') this.variantId = newVal;
    if (name === 'qty') this.qty = parseInt(newVal) || 1;
    if (name === 'buyer-email') this.buyerEmail = newVal;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  async connectWallet(type) {
    try {
      if (type === 'evm') {
        const res = await connectEVMWallet('metamask');
        if (res.success) {
          this.activeWallet = res.address;
          this.walletType = 'evm';
          // auto-sign authentication challenge
          await signMessage(res.address, `Authenticate checkout session with signature: ${Date.now()}`, res.provider);
          this.render();
        }
      } else if (type === 'solana') {
        const res = await connectSolanaWallet();
        if (res.success) {
          this.activeWallet = res.address;
          this.walletType = 'solana';
          await signMessage(res.address, `Authenticate checkout session with signature: ${Date.now()}`, res.provider);
          this.render();
        }
      }
    } catch (e) {
      toast.error(`Wallet connection failed: ${e.message}`);
    }
  }

  get cryptoEquivalent() {
    // USD rates conversion (rough estimates for demo simulation purposes)
    const rates = {
      USDC: 1.0,
      USDT: 1.0,
      ETH: 0.0003,
      SOL: 0.006,
      BTC: 0.000015
    };
    const rate = rates[this.selectedCurrency] || 1.0;
    return (this.amountUSD * rate).toFixed(this.selectedCurrency === 'BTC' || this.selectedCurrency === 'ETH' ? 6 : 2);
  }

  async handleCheckout() {
    if (!this.activeWallet) {
      toast.warning('Please connect your crypto wallet first.');
      return;
    }

    const payButton = this.shadowRoot.getElementById('btn-execute-pay');
    if (payButton) {
      payButton.disabled = true;
      payButton.textContent = 'Processing Web3 Transfer...';
    }

    // Simulate blockchain transaction latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const email = this.buyerEmail || store.state.user?.email || 'web3_buyer_' + this.activeWallet.substring(2, 8) + '@example.com';
    const uid = store.state.user?.uid || 'guest_web3';

    const purchasePayload = {
      id: 'pur_' + Date.now(),
      userId: uid,
      customerEmail: email,
      amount: this.amountUSD,
      currency: 'USD',
      paymentMethod: `Crypto: ${this.selectedCurrency}`,
      cryptoCurrency: this.selectedCurrency,
      cryptoAmount: this.cryptoEquivalent,
      txHash,
      buyerAddress: this.activeWallet,
      checkoutType: this.checkoutType,
      productId: this.productId || null,
      variantId: this.variantId || 'default',
      qty: this.qty,
      date: new Date().toLocaleDateString(),
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Emit/Save purchase payload to Firestore /purchases collection
      const db = getFirestoreDB();
      if (db) {
        const purchaseDocRef = doc(db, 'purchases', purchasePayload.id);
        await setDoc(purchaseDocRef, purchasePayload);
      }

      // Also sync to local storage /purchases equivalents or local fallback
      const localPurchases = JSON.parse(localStorage.getItem('foundation_local_purchases') || '[]');
      localPurchases.push(purchasePayload);
      localStorage.setItem('foundation_local_purchases', JSON.stringify(localPurchases));

      // 2. Perform user access adjustments
      if (this.checkoutType === 'membership') {
        const updatedUser = {
          ...(store.state.user || {}),
          uid: uid,
          email: email,
          role: 'member',
          paymentStatus: 'Active'
        };
        await contentDB.saveUser(updatedUser);
        store.dispatch('SET_USER', updatedUser);
        toast.success('Decentralized crypto settlement complete! Persona upgraded to Paid Member (Ad-Free).');
      } else if (this.checkoutType === 'event') {
        // Register event ticket
        const regRecord = {
          id: 'reg_crypto_' + Date.now(),
          eventId: this.productId || 'sample-summit',
          email: email,
          accessCode: 'EVT-CRYPTO-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          qrPayload: 'FOUNDATION-PASS:EVT-CRYPTO-' + Date.now(),
          cartItems: JSON.stringify([
            { id: this.productId || 'sample-summit', type: 'ticket', name: 'General Admission', price: this.amountUSD, quantity: this.qty }
          ]),
          createdAt: new Date().toISOString()
        };
        await contentDB.saveRegistration(regRecord);
        toast.success('Crypto tickets registered successfully! Check your pass on your account dashboard.');
      } else if (this.checkoutType === 'product') {
        // Save shop order
        const orders = JSON.parse(localStorage.getItem('foundation_local_orders') || '{}');
        const orderId = 'order_crypto_' + Date.now();
        orders[orderId] = {
          id: orderId,
          type: 'order',
          productId: this.productId,
          productTitle: this.productId ? (await contentDB.getContentById(this.productId))?.title || 'Shop Product' : 'Shop Product',
          variantId: this.variantId,
          qty: this.qty,
          paymentMethod: `Crypto: ${this.selectedCurrency}`,
          paymentStatus: 'Paid',
          fulfillmentStatus: 'Pending Production',
          shippingDetails: { carrier: '', trackingNumber: '', shippedAt: '' },
          buyerEmail: email,
          createdAt: new Date().toISOString()
        };
        localStorage.setItem('foundation_local_orders', JSON.stringify(orders));

        // Decrement inventory stock
        const { decrementStock } = await import('../../utils/inventory.js');
        await decrementStock(this.productId, this.variantId, this.qty);

        toast.success('Decentralized storefront settlement successful! E-commerce order created.');
      }

      // Add to local invoices collection fallback to show up in Invoices ledger
      const invoiceRecord = {
        id: 'inv_crypto_' + Date.now(),
        userId: uid,
        customerEmail: email,
        amount: this.amountUSD,
        currency: 'USD',
        status: 'paid',
        date: new Date().toLocaleDateString(),
        dueDate: new Date().toLocaleDateString(),
        createdAt: new Date().toISOString()
      };
      await contentDB.saveInvoice(invoiceRecord);

      toast.success(`Success! Web3 tx ${this.selectedCurrency} hash: ${txHash.substring(0, 10)}... confirmed.`);

      this.dispatchEvent(new CustomEvent('crypto-payment-success', {
        detail: purchasePayload,
        bubbles: true,
        composed: true
      }));

      // Reload view or close modal
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      toast.error(`Checkout settlement failed: ${err.message}`);
    } finally {
      if (payButton) {
        payButton.disabled = false;
        payButton.textContent = `Pay ${this.cryptoEquivalent} ${this.selectedCurrency}`;
      }
    }
  }

  render() {
    const isEVMSupported = detectWallets().metaMask || detectWallets().coinbase;
    const isSolanaSupported = detectWallets().phantom;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: system-ui, sans-serif;
          background: #111827;
          color: #f9fafb;
          border-radius: 12px;
          border: 1px solid #374151;
          padding: 1.5rem;
          max-width: 420px;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
        }
        h3 {
          margin-top: 0;
          color: #818cf8;
          font-size: 1.25rem;
          font-weight: bold;
          text-align: center;
          border-bottom: 1px solid #374151;
          padding-bottom: 0.75rem;
        }
        .wallet-section {
          background: #1f2937;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.25rem;
          text-align: center;
        }
        .btn-wallet {
          width: 100%;
          background: #4f46e5;
          color: white;
          border: none;
          padding: 10px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 8px;
          font-size: 0.9rem;
          transition: background 0.2s;
        }
        .btn-wallet:hover {
          background: #4338ca;
        }
        .btn-wallet.solana {
          background: #14b8a6;
        }
        .btn-wallet.solana:hover {
          background: #0d9488;
        }
        .currency-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          margin-bottom: 1.25rem;
        }
        .currency-btn {
          background: #1f2937;
          border: 1px solid #374151;
          color: #d1d5db;
          padding: 8px 4px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: bold;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }
        .currency-btn.active {
          background: #818cf8;
          color: #111827;
          border-color: #818cf8;
        }
        .amount-display {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .amount-usd {
          font-size: 1rem;
          color: #9ca3af;
        }
        .amount-crypto {
          font-size: 2rem;
          font-weight: 800;
          color: #f9fafb;
          margin-top: 4px;
        }
        .btn-pay {
          width: 100%;
          background: #10b981;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 1.1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-pay:hover {
          background: #059669;
        }
        .btn-pay:disabled {
          background: #4b5563;
          cursor: not-allowed;
          opacity: 0.7;
        }
        .badge-verified {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #064e3b;
          color: #34d399;
          font-size: 0.75rem;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: bold;
          margin-top: 6px;
        }
      </style>

      <div>
        <h3>⛓️ Web3 Crypto Checkout Gateway</h3>

        <div class="wallet-section">
          ${this.activeWallet ? `
            <div style="font-size: 0.85rem; color: #9ca3af;">Connected Address:</div>
            <strong style="color: #60a5fa; font-family: monospace; font-size: 0.95rem; display: block; margin-top: 4px;">
              ${formatAddress(this.activeWallet)}
            </strong>
            <span class="badge-verified">✓ Signature Verified</span>
          ` : `
            <div style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 8px;">Connect Web3 Wallet to Authenticate</div>
            <button class="btn-wallet" id="btn-connect-evm">Connect MetaMask / EVM Wallet</button>
            <button class="btn-wallet solana" id="btn-connect-solana">Connect Solana Phantom</button>
          `}
        </div>

        <div style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 6px; font-weight: bold;">Select Crypto Currency:</div>
        <div class="currency-grid">
          <button class="currency-btn ${this.selectedCurrency === 'USDC' ? 'active' : ''}" data-curr="USDC">USDC</button>
          <button class="currency-btn ${this.selectedCurrency === 'USDT' ? 'active' : ''}" data-curr="USDT">USDT</button>
          <button class="currency-btn ${this.selectedCurrency === 'ETH' ? 'active' : ''}" data-curr="ETH">ETH</button>
          <button class="currency-btn ${this.selectedCurrency === 'SOL' ? 'active' : ''}" data-curr="SOL">SOL</button>
          <button class="currency-btn ${this.selectedCurrency === 'BTC' ? 'active' : ''}" data-curr="BTC">BTC</button>
        </div>

        <div class="amount-display">
          <div class="amount-usd">Total Due: $${this.amountUSD.toFixed(2)} USD</div>
          <div class="amount-crypto">${this.cryptoEquivalent} ${this.selectedCurrency}</div>
        </div>

        <button class="btn-pay" id="btn-execute-pay" ${!this.activeWallet ? 'disabled' : ''}>
          ${this.activeWallet ? `Pay ${this.cryptoEquivalent} ${this.selectedCurrency}` : 'Connect Wallet to Pay'}
        </button>
      </div>
    `;

    // Wire up listeners
    const btnConnectEVM = this.shadowRoot.getElementById('btn-connect-evm');
    if (btnConnectEVM) btnConnectEVM.onclick = () => this.connectWallet('evm');

    const btnConnectSolana = this.shadowRoot.getElementById('btn-connect-solana');
    if (btnConnectSolana) btnConnectSolana.onclick = () => this.connectWallet('solana');

    const payBtn = this.shadowRoot.getElementById('btn-execute-pay');
    if (payBtn) payBtn.onclick = () => this.handleCheckout();

    this.shadowRoot.querySelectorAll('.currency-btn').forEach(btn => {
      btn.onclick = () => {
        this.selectedCurrency = btn.dataset.curr;
        this.render();
      };
    });
  }
}

if (!customElements.get('crypto-checkout')) {
  customElements.define('crypto-checkout', CryptoCheckout);
}
export default CryptoCheckout;
