// utils/backend-web3.js - Web3 Wallet & E-Commerce NFT Counterparts Engine
import { configManager } from '../core/config.js';
import { contentDB } from '../core/db.js';
import { decrementStock } from './inventory.js';

/**
 * Generates a mock Ethereum Web3 wallet address and private key.
 * @returns {Object} { address, privateKey }
 */
export function generateMockWeb3Wallet() {
  const hexChars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += hexChars[Math.floor(Math.random() * 16)];
  }
  let privateKey = '';
  for (let i = 0; i < 64; i++) {
    privateKey += hexChars[Math.floor(Math.random() * 16)];
  }
  return { address, privateKey };
}

/**
 * Auto-links or generates an Admin Web3 wallet if it doesn't already exist.
 * Saves the wallet configuration inside the global config.
 * @returns {Promise<string>} Admin's Web3 public wallet address
 */
export async function ensureAdminWalletLinked() {
  const currentConfig = configManager.current || {};
  if (currentConfig.web3?.adminWalletAddress) {
    return currentConfig.web3.adminWalletAddress;
  }

  // Generate new mock wallet
  const wallet = generateMockWeb3Wallet();
  const updatedConfig = {
    ...currentConfig,
    web3: {
      adminWalletAddress: wallet.address,
      adminPrivateKeyEncrypted: wallet.privateKey, // stored securely/mocked in state
      network: 'Polygon Mainnet',
      linkedAt: new Date().toISOString()
    }
  };

  await configManager.saveToFirebase(updatedConfig);
  console.log(`[Web3 Engine]: Auto-linked new Web3 wallet to Admin: ${wallet.address}`);
  return wallet.address;
}

/**
 * Simulates minting an ERC-1155 Digital Certificate of Authenticity NFT for a product buyer.
 * Writes records cleanly to localStorage 'foundation_nft_mints' / logs.
 * @param {string} buyerAddress
 * @param {Object} metadata - Product & certificate metadata
 * @returns {Promise<Object>} Minting transaction receipt details
 */
export async function mintNFTCounterpart(buyerAddress, metadata) {
  if (!buyerAddress || !buyerAddress.startsWith('0x')) {
    throw new Error('Valid ERC-20/ERC-721/1155 wallet address is required to mint certificate.');
  }

  const transactionHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
  const tokenId = Math.floor(Math.random() * 900000) + 100000;

  const receipt = {
    tokenId,
    contractStandard: 'ERC-1155',
    contractAddress: '0xa95e1e12735748950d276b5cf070ca0c088bb9d1',
    buyerAddress,
    transactionHash,
    ipfsUri: `ipfs://bafybeihd3_${tokenId}_certificate_of_authenticity`,
    mintedAt: new Date().toISOString(),
    metadata
  };

  // Persist mint history locally
  try {
    const mints = JSON.parse(localStorage.getItem('foundation_nft_mints') || '[]');
    mints.push(receipt);
    localStorage.setItem('foundation_nft_mints', JSON.stringify(mints));
  } catch (e) {
    console.warn('Failed to save NFT mint record to local storage.', e);
  }

  console.log(`[Web3 NFT Engine]: Successfully minted ERC-1155 Certificate NFT (Token ID: ${tokenId}) to ${buyerAddress}`);
  return receipt;
}

/**
 * Direct crypto payments checkout simulation.
 * Routes cryptocurrency funds to admin's wallet and executes stock management + NFT minting.
 * @param {string} productId
 * @param {string} variantId
 * @param {number} qty
 * @param {string} buyerAddress
 * @param {string} cryptoCurrency - e.g. "ETH" | "MATIC" | "USDC" | "USDT"
 * @returns {Promise<Object>} Direct checkout success confirmation receipt
 */
export async function processCryptoCheckout(productId, variantId = 'default', qty = 1, buyerAddress, cryptoCurrency = 'MATIC') {
  const adminWallet = await ensureAdminWalletLinked();
  const product = await contentDB.getContentById(productId);

  if (!product) {
    throw new Error(`Product ${productId} not found.`);
  }

  // Calculate equivalent price in crypto
  const basePriceUSD = (product.pricing?.basePrice || 0) / 100;
  const rates = { ETH: 0.0003, MATIC: 1.5, USDC: 1.0, USDT: 1.0 };
  const rate = rates[cryptoCurrency] || 1.0;
  const cryptoTotal = (basePriceUSD * qty * rate).toFixed(4);

  const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');

  console.log(`[Web3 Checkout]: Routing ${cryptoTotal} ${cryptoCurrency} from ${buyerAddress} to Admin ${adminWallet}...`);

  // Decrement stock
  const stockResult = await decrementStock(productId, variantId, qty);

  let nftReceipt = null;
  if (product.enableNftCounterpart) {
    const certMetadata = {
      productTitle: product.title,
      productId: product.id,
      sku: product.sku || 'N/A',
      purchasedQty: qty,
      certificateMessage: "Official Digital Certificate of Authenticity for " + product.title
    };
    nftReceipt = await mintNFTCounterpart(buyerAddress, certMetadata);
  }

  const orderId = 'order_crypto_' + Date.now();
  const orderRecord = {
    id: orderId,
    type: 'order',
    productId,
    productTitle: product.title,
    variantId,
    qty,
    paymentMethod: 'Crypto: ' + cryptoCurrency,
    paymentStatus: 'Paid',
    amountCrypto: cryptoTotal,
    currencyCrypto: cryptoCurrency,
    txHash,
    adminWalletAddress: adminWallet,
    buyerWalletAddress: buyerAddress,
    nftReceipt,
    fulfillmentStatus: 'Pending Production',
    shippingDetails: {
      carrier: '',
      trackingNumber: '',
      shippedAt: ''
    },
    buyerEmail: 'web3_buyer_' + buyerAddress.substring(2, 8) + '@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Save order to LocalStorage/Firestore
  try {
    const orders = JSON.parse(localStorage.getItem('foundation_local_orders') || '{}');
    orders[orderId] = orderRecord;
    localStorage.setItem('foundation_local_orders', JSON.stringify(orders));
  } catch (e) {
    console.warn('Failed to save order record locally.', e);
  }

  return {
    success: true,
    orderId,
    txHash,
    cryptoTotal,
    cryptoCurrency,
    adminWalletAddress: adminWallet,
    stockDecremented: stockResult,
    nftReceipt
  };
}

/**
 * Get all crypto-based orders
 * @returns {Array}
 */
export function getCryptoOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem('foundation_local_orders') || '{}');
    return Object.values(orders);
  } catch (e) {
    return [];
  }
}
