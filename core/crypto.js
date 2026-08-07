// core/crypto.js - Native Crypto Wallet Connection and Web3 Utilities
import { toast } from '../utils/toast.js';

/**
 * Detects available crypto wallets in the window context.
 * Returns both simulated presence and actual detection for metamask, coinbase, phantom, etc.
 */
export function detectWallets() {
  const result = {
    metaMask: typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
    coinbase: typeof window !== 'undefined' && !!window.ethereum?.isCoinbaseWallet,
    phantom: typeof window !== 'undefined' && (!!window.solana?.isPhantom || !!window.phantom?.solana?.isPhantom),
    // Always list simulated support for graceful developer experience
    simulated: true
  };
  return result;
}

/**
 * Formats a crypto wallet address for concise UI display (e.g., 0x1234...5678)
 * @param {string} address - Full public key address
 * @returns {string} Formatted address string
 */
export function formatAddress(address) {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Validates whether the connected EVM network matches the expected Network ID
 * @param {string|number} networkId - Active network/chain ID
 * @param {string|number} expectedNetworkId - Target network/chain ID (default 1 for Ethereum Mainnet)
 * @returns {boolean}
 */
export function validateNetworkId(networkId, expectedNetworkId = 1) {
  const current = Number(networkId);
  const expected = Number(expectedNetworkId);
  return current === expected;
}

/**
 * Connects to an EVM Wallet (MetaMask, Coinbase, etc.)
 * Fallbacks to a simulated mock session if no provider is injected.
 * @param {string} type - 'metamask' or 'coinbase'
 * @returns {Promise<{address: string, networkId: number, success: boolean}>}
 */
export async function connectEVMWallet(type = 'metamask') {
  const wallets = detectWallets();

  if (type === 'metamask' && wallets.metaMask) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const networkId = parseInt(chainIdHex, 16);
      const address = accounts[0];

      toast.success(`MetaMask Connected: ${formatAddress(address)}`);
      return { address, networkId, success: true, provider: 'metamask' };
    } catch (err) {
      toast.error(`MetaMask connection failed: ${err.message}`);
      return { error: err.message, success: false };
    }
  }

  // Simulated Mock EVM Connection for robust out-of-the-box local sandbox runs
  console.log(`[Web3] Wallet type "${type}" fallback to Simulated Mock EVM Connection.`);
  const mockAddress = type === 'coinbase'
    ? '0xCb8Db67C6534ef0368aD68165E07198C5369A27D'
    : '0x71C7656EC7ab88b098defB751B7401B5f6d1476B';
  const mockNetworkId = 1; // Mainnet

  toast.success(`Mock EVM Wallet Connected: ${formatAddress(mockAddress)}`);
  return { address: mockAddress, networkId: mockNetworkId, success: true, provider: 'simulated' };
}

/**
 * Connects to a Solana Wallet (Phantom)
 * Fallbacks to a simulated mock session if no provider is injected.
 * @returns {Promise<{address: string, provider: string, success: boolean}>}
 */
export async function connectSolanaWallet() {
  const wallets = detectWallets();

  if (wallets.phantom) {
    try {
      const provider = window.solana || window.phantom?.solana;
      const resp = await provider.connect();
      const address = resp.publicKey.toString();

      toast.success(`Solana Phantom Connected: ${formatAddress(address)}`);
      return { address, provider: 'phantom', success: true };
    } catch (err) {
      toast.error(`Phantom connection failed: ${err.message}`);
      return { error: err.message, success: false };
    }
  }

  // Simulated Mock Solana Connection
  console.log('[Web3] Solana Phantom fallback to Simulated Mock Phantom Connection.');
  const mockAddress = 'SolAnA56EC7ab88b098defB751B7401B5f6d1476Bxyz';
  toast.success(`Mock Solana Connected: ${formatAddress(mockAddress)}`);
  return { address: mockAddress, provider: 'simulated', success: true };
}

/**
 * Signs a cryptographic message for signature authentication
 * @param {string} address - Public wallet address
 * @param {string} message - Message string to sign
 * @param {string} providerType - 'metamask' | 'phantom' | 'simulated'
 * @returns {Promise<{signature: string, success: boolean}>}
 */
export async function signMessage(address, message, providerType = 'simulated') {
  if (providerType === 'metamask' && typeof window !== 'undefined' && window.ethereum) {
    try {
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });
      toast.success('Signature authenticated successfully!');
      return { signature, success: true };
    } catch (err) {
      toast.error(`Signature rejection: ${err.message}`);
      return { error: err.message, success: false };
    }
  }

  if (providerType === 'phantom' && typeof window !== 'undefined') {
    try {
      const provider = window.solana || window.phantom?.solana;
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await provider.signMessage(encodedMessage, "utf8");
      // convert signature array to hex or base64 representation
      const signature = btoa(String.fromCharCode.apply(null, signedMessage.signature));
      toast.success('Solana Signature authenticated successfully!');
      return { signature, success: true };
    } catch (err) {
      toast.error(`Phantom signing failed: ${err.message}`);
      return { error: err.message, success: false };
    }
  }

  // Simulated Signature Authentication
  console.log(`[Web3] Simulated signing on address ${address} for message: "${message}"`);
  const simulatedSignature = `sig_mock_${Math.random().toString(36).substring(2, 12)}_${btoa(address).substring(0, 10)}`;
  toast.success('Signature authenticated successfully (Simulated)!');
  return { signature: simulatedSignature, success: true };
}
