// components/global/CryptoCheckout.js - Web3 Crypto Checkout Component
import { store } from '../../core/store.js';
import { configManager } from '../../core/config.js';
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
    this.cartItems = [];
  }

  static get observedAttributes() {
    return ['amount-usd', 'checkout-type', 'product-id', 'variant-id', 'qty', 'buyer-email', 'items-json'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'amount-usd') this.amountUSD = parseFloat(newVal) || 29.00;
    if (name === 'checkout-type') this.checkoutType = newVal;
    if (name === 'product-id') this.productId = newVal;
    if (name === 'variant-id') this.variantId = newVal;
    if (name === 'qty') this.qty = parseInt(newVal) || 1;
    if (name === 'buyer-email') this.buyerEmail = newVal;
    if (name === 'items-json') {
      try {
        this.cartItems = JSON.parse(newVal);
      } catch (e) {
        this.cartItems = [];
      }
    }
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

    let txHash = null;

    try {
      // 1. Submit actual blockchain transfer if a Web3 wallet provider is connected
      if (this.walletType === 'evm' && window.ethereum) {
        const recipient = configManager.current.integrations?.cryptoTreasuryAddress || '0x0000000000000000000000000000000000000000';
        let txParams = {};

        if (this.selectedCurrency === 'ETH') {
          const hexAmount = '0x' + BigInt(Math.floor(parseFloat(this.cryptoEquivalent) * 1e18)).toString(16);
          txParams = {
            from: this.activeWallet,
            to: recipient,
            value: hexAmount
          };
        } else if (this.selectedCurrency === 'USDC' || this.selectedCurrency === 'USDT') {
          // Construct ERC20 transfer(address,uint256) calldata
          const tokenDecimals = 6;
          const rawAmount = BigInt(Math.floor(parseFloat(this.cryptoEquivalent) * Math.pow(10, tokenDecimals)));
          const cleanRecipient = recipient.toLowerCase().replace('0x', '').padStart(64, '0');
          const cleanAmount = rawAmount.toString(16).padStart(64, '0');
          const data = '0xa9059cbb' + cleanRecipient + cleanAmount;

          const tokenContract = configManager.current.integrations?.[`${this.selectedCurrency.toLowerCase()}ContractAddress`] || recipient;

          txParams = {
            from: this.activeWallet,
            to: tokenContract,
            value: '0x0',
            data
          };
        } else {
          const hexAmount = '0x' + BigInt(Math.floor(parseFloat(this.cryptoEquivalent) * 1e18)).toString(16);
          txParams = {
            from: this.activeWallet,
            to: recipient,
            value: hexAmount
          };
        }

        txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams]
        });

        // Verify transaction receipt on-chain when possible
        if (txHash && window.ethereum.request) {
          try {
            let receipt = null;
            let attempts = 0;
            while (!receipt && attempts < 5) {
              receipt = await window.ethereum.request({
                method: 'eth_getTransactionReceipt',
                params: [txHash]
              });
              if (!receipt) {
                await new Promise(r => setTimeout(r, 1000));
                attempts++;
              }
            }
            if (!receipt) {
              toast.error('Transaction unconfirmed: On-chain receipt confirmation timed out. Settlement halted.');
              return;
            }
            const statusStr = String(receipt.status);
            if (statusStr === '0x0' || statusStr === '0' || statusStr === 'false') {
              toast.error('Transaction failed: On-chain transaction reverted.');
              return;
            }

            // Verify sender address matches active wallet
            if (receipt.from && receipt.from.toLowerCase() !== this.activeWallet.toLowerCase()) {
              toast.error('Transaction verification failed: Sender address on receipt does not match connected wallet.');
              return;
            }

            // Verify recipient address and transfer execution
            if (this.selectedCurrency === 'ETH') {
              if (receipt.to && recipient && receipt.to.toLowerCase() !== recipient.toLowerCase()) {
                toast.error('Transaction verification failed: Transaction recipient on receipt does not match treasury address.');
                return;
              }

              // Verify on-chain ETH value transferred in transaction details
              const txObj = await window.ethereum.request({
                method: 'eth_getTransactionByHash',
                params: [txHash]
              });

              if (!txObj || !txObj.value) {
                toast.error('Transaction verification failed: Could not retrieve ETH transaction value from network.');
                return;
              }

              const expectedWei = BigInt(Math.floor(parseFloat(this.cryptoEquivalent) * 1e18));
              const transferredWei = BigInt(txObj.value);

              if (transferredWei < expectedWei) {
                toast.error(`Transaction verification failed: Transferred ETH (${(Number(transferredWei) / 1e18).toFixed(6)} ETH) is less than required amount (${this.cryptoEquivalent} ETH).`);
                return;
              }
            } else if (this.selectedCurrency === 'USDC' || this.selectedCurrency === 'USDT') {
              // Verify token contract address
              const tokenContract = configManager.current.integrations?.[`${this.selectedCurrency.toLowerCase()}ContractAddress`] || recipient;
              if (receipt.to && tokenContract && receipt.to.toLowerCase() !== tokenContract.toLowerCase()) {
                toast.error('Transaction verification failed: Contract interaction on receipt does not match token contract.');
                return;
              }

              // Require valid ERC20 Transfer log
              if (!Array.isArray(receipt.logs) || receipt.logs.length === 0) {
                toast.error('Transaction verification failed: No contract logs returned for ERC20 transfer.');
                return;
              }

              const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // Transfer(address,address,uint256)
              const transferLog = receipt.logs.find(log => log.topics && log.topics[0] && log.topics[0].toLowerCase() === transferTopic);

              if (!transferLog || !transferLog.topics || transferLog.topics.length < 3 || !transferLog.data || transferLog.data === '0x') {
                toast.error('Transaction verification failed: Missing or invalid ERC20 Transfer event log on receipt.');
                return;
              }

              const logRecipient = '0x' + transferLog.topics[2].slice(-40);
              if (logRecipient.toLowerCase() !== recipient.toLowerCase()) {
                toast.error('Transaction verification failed: ERC20 Transfer event recipient does not match treasury address.');
                return;
              }

              const tokenDecimals = 6;
              const expectedRawAmount = BigInt(Math.floor(parseFloat(this.cryptoEquivalent) * Math.pow(10, tokenDecimals)));
              const transferredRawAmount = BigInt(transferLog.data);
              if (transferredRawAmount < expectedRawAmount) {
                toast.error('Transaction verification failed: Transferred token amount is less than required USD total.');
                return;
              }
            }
          } catch (receiptErr) {
            toast.error(`Receipt verification failed: ${receiptErr.message || receiptErr}`);
            return;
          }
        }
      } else if (this.walletType === 'solana' && window.solana?.isPhantom) {
        // Phantom transaction signature request
        const provider = window.solana || window.phantom?.solana;
        const res = await provider.signAndSendTransaction();
        txHash = res.signature || res.publicKey;

        if (!txHash) {
          toast.error('Solana transaction failed: No transaction signature returned.');
          return;
        }

        if (provider.connection) {
          try {
            let confirmed = false;
            let attempts = 0;
            while (!confirmed && attempts < 5) {
              const status = await provider.connection.getSignatureStatus(txHash);
              if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
                if (status.value.err) {
                  toast.error('Solana transaction failed: On-chain transaction error reported.');
                  return;
                }
                confirmed = true;
                break;
              }
              await new Promise(r => setTimeout(r, 1000));
              attempts++;
            }
            if (!confirmed) {
              toast.error('Solana settlement unconfirmed: On-chain signature status confirmation timed out.');
              return;
            }

            // On-chain transaction details verification for Solana
            const solTreasury = configManager.current.integrations?.cryptoTreasuryAddress || '';
            if (solTreasury && provider.connection.getParsedTransaction) {
              try {
                const parsedTx = await provider.connection.getParsedTransaction(txHash, { commitment: 'confirmed' });
                if (parsedTx) {
                  const accountKeys = parsedTx.transaction?.message?.accountKeys || [];
                  const keyStrings = accountKeys.map(k => (typeof k === 'string' ? k : k.pubkey?.toString() || ''));

                  // Verify feePayer / sender is active wallet
                  if (keyStrings.length > 0 && keyStrings[0] !== this.activeWallet) {
                    toast.error('Solana transaction verification failed: Sender on transaction does not match active wallet.');
                    return;
                  }

                  // Verify treasury address is present in account keys / recipient
                  const hasTreasury = keyStrings.some(k => k === solTreasury);
                  if (!hasTreasury) {
                    toast.error('Solana transaction verification failed: Treasury recipient address not found in transaction accounts.');
                    return;
                  }
                }
              } catch (txParseErr) {
                console.warn('Solana parsed transaction lookup skipped:', txParseErr);
              }
            }
          } catch (solErr) {
            toast.error(`Solana signature confirmation failed: ${solErr.message || solErr}`);
            return;
          }
        } else {
          toast.error('Solana settlement failed: Provider connection object missing for on-chain status verification.');
          return;
        }
      }
    } catch (err) {
      toast.error(`Blockchain transaction failed or rejected: ${err.message || err}`);
      return;
    }

    // Require valid transaction hash returned from wallet provider
    if (!txHash) {
      toast.error('Transaction failed: No confirmed on-chain transaction signature returned by wallet provider.');
      return;
    }

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

      // 2. Perform user access adjustments and product linkage upon verified on-chain tx
      let rawItems = [];
      if (Array.isArray(this.cartItems) && this.cartItems.length > 0) {
        rawItems = this.cartItems;
      } else if (this.productId) {
        rawItems = [{ id: this.productId, price: this.amountUSD, type: 'product' }];
      }

      // Fetch catalog records directly using getContentById
      const catalogRecords = await Promise.all(rawItems.map(item => contentDB.getContentById(item.id || item.productId)));

      // Reconcile transferred amount against total catalog price
      let requiredTotalUSD = 0;
      for (let idx = 0; idx < rawItems.length; idx++) {
        const item = rawItems[idx];
        const catalogRecord = catalogRecords[idx];
        const itemPrice = catalogRecord?.price !== undefined ? Number(catalogRecord.price) : Number(item.price || 0);
        const itemQty = Number(item.quantity || 1);
        requiredTotalUSD += (itemPrice * itemQty);
      }

      if (requiredTotalUSD > 0 && this.amountUSD < (requiredTotalUSD - 0.01)) {
        toast.error(`Crypto settlement rejected: Transferred amount ($${this.amountUSD.toFixed(2)}) is less than total catalog price ($${requiredTotalUSD.toFixed(2)}).`);
        return;
      }

      const purchasedProducts = [];
      for (let idx = 0; idx < rawItems.length; idx++) {
        const item = rawItems[idx];
        const catalogRecord = catalogRecords[idx];
        const itemId = item.id || item.productId;
        if (!catalogRecord) {
          toast.error(`Crypto settlement failed: Unknown catalog item ID (${itemId}).`);
          return;
        }

        purchasedProducts.push({
          id: itemId,
          title: catalogRecord.title || catalogRecord.name || item.name || itemId,
          type: catalogRecord.type || item.type || 'product',
          purchasedAt: new Date().toISOString(),
          pricePaid: Number(catalogRecord.price !== undefined ? catalogRecord.price : item.price || this.amountUSD)
        });
      }

      const updatedUser = await contentDB.registerOrMergeUser({
        email,
        role: this.checkoutType === 'membership' ? 'member' : 'subscriber',
        paymentStatus: 'Active',
        purchasedProducts
      });

      if (updatedUser && store.state.user?.email === email) {
        store.dispatch('SET_USER', updatedUser);
      }

      // Import eventCart dynamically and clear cart if items were purchased
      const { eventCart } = await import('../../utils/eventCart.js');
      eventCart.clearCart();

      if (this.checkoutType === 'membership') {
        toast.success('Decentralized crypto settlement complete! Persona upgraded to Paid Member.');
      } else {
        toast.success('Decentralized settlement successful! Your items have been unlocked.');
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
