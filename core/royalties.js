// core/royalties.js - Universal Royalty Split Accounting Engine
import { getFirestoreDB, doc, getDoc, setDoc, collection, getDocs } from './db-shared.js';
import { toast } from '../utils/toast.js';

/**
 * Universal content/product types supported by the Royalty Splits engine
 */
export const ROYALTY_ASSET_TYPES = [
  'music', 'video', 'podcast', 'article', 'merchandise', 'event_ticket', 'digital_download'
];

/**
 * Default fallback admin split allocation (100% Admin)
 */
export const DEFAULT_ADMIN_SPLIT = [
  {
    userId: 'admin',
    userEmail: 'admin@earlalex.com',
    role: 'Admin / Publisher',
    percentage: 100
  }
];

/**
 * Retrieves splits for a specific asset, defaulting to 100% admin split for backward compatibility.
 * @param {string} assetId
 * @returns {Promise<Array>} Array of allocations [{ userId, userEmail, role, percentage }]
 */
export async function getAssetSplits(assetId) {
  if (!assetId) return DEFAULT_ADMIN_SPLIT;

  try {
    const db = getFirestoreDB();
    if (db) {
      const docRef = doc(db, 'splits', assetId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.splits && data.splits.length > 0) {
          return data.splits;
        }
      }
    }
  } catch (err) {
    console.warn('[Royalties]: Firestore splits read failed, loading LocalStorage fallback.', err.message);
  }

  // LocalStorage Fallback
  try {
    const local = JSON.parse(localStorage.getItem('foundation_local_splits') || '{}');
    if (local[assetId] && local[assetId].splits) {
      return local[assetId].splits;
    }
  } catch (e) {
    console.warn('[Royalties]: LocalStorage splits read failed.', e);
  }

  return DEFAULT_ADMIN_SPLIT;
}

/**
 * Saves/overwrites splits for a specific asset.
 * Validates that percentages sum to exactly 100%.
 * @param {string} assetId
 * @param {string} assetType - must be one of ROYALTY_ASSET_TYPES
 * @param {Array} splits - Array of { userId, userEmail, role, percentage }
 * @returns {Promise<boolean>} Success confirmation
 */
export async function saveAssetSplits(assetId, assetType, splits) {
  if (!assetId || !assetType) {
    throw new Error('[Royalties]: assetId and assetType are required.');
  }

  // Sum validator
  const totalPercentage = splits.reduce((sum, item) => sum + parseFloat(item.percentage || 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`[Royalties]: Splits total percentage must equal exactly 100%. Calculated: ${totalPercentage}%`);
  }

  const payload = {
    assetId,
    assetType,
    splits,
    updatedAt: new Date().toISOString()
  };

  // 1. Save to Firestore
  try {
    const db = getFirestoreDB();
    if (db) {
      const docRef = doc(db, 'splits', assetId);
      await setDoc(docRef, payload, { merge: true });
    }
  } catch (err) {
    console.warn('[Royalties]: Firestore splits write failed, syncing to LocalStorage fallback.', err.message);
  }

  // 2. LocalStorage Fallback
  try {
    const local = JSON.parse(localStorage.getItem('foundation_local_splits') || '{}');
    local[assetId] = payload;
    localStorage.setItem('foundation_local_splits', JSON.stringify(local));
  } catch (e) {
    console.warn('[Royalties]: LocalStorage splits write failed.', e);
  }

  return true;
}

/**
 * Fetches daily exchange rates from settings/fx_rates Firestore collection.
 * Fallbacks to standard static rates if unconfigured.
 */
export async function getExchangeRates() {
  const defaultRates = {
    USD: 1.0,
    GBP: 0.78,
    EUR: 0.92,
    ETH: 0.0003,
    SOL: 0.006,
    USDC: 1.0
  };

  try {
    const db = getFirestoreDB();
    if (db) {
      const docRef = doc(db, 'settings', 'fx_rates');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().rates || defaultRates;
      }
    }
  } catch (err) {
    console.warn('[Royalties]: Could not retrieve exchange rates from database, using static fallbacks.', err.message);
  }

  // Local storage cache fallback
  try {
    const cached = localStorage.getItem('foundation_fx_rates');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  return defaultRates;
}

/**
 * Logs a gross earning event, converts currency histories, and allocates splits to contributors.
 * @param {string} assetId
 * @param {string} assetType
 * @param {number} amountUSD - Gross USD amount received
 * @param {string} description - Order or transaction details
 * @returns {Promise<Object>} Processed Earning record
 */
export async function logRoyaltyEarning(assetId, assetType, amountUSD, description = 'Product checkout allocation') {
  const rates = await getExchangeRates();

  // Model conversion histories: USD, GBP, EUR, ETH, SOL, USDC
  const conversionHistories = {
    USD: Number(amountUSD),
    GBP: Number((amountUSD * (rates.GBP || 0.78)).toFixed(2)),
    EUR: Number((amountUSD * (rates.EUR || 0.92)).toFixed(2)),
    ETH: Number((amountUSD * (rates.ETH || 0.0003)).toFixed(6)),
    SOL: Number((amountUSD * (rates.SOL || 0.006)).toFixed(6)),
    USDC: Number((amountUSD * (rates.USDC || 1.0)).toFixed(2))
  };

  const splits = await getAssetSplits(assetId);

  // Distribute allocations
  const distributions = splits.map(split => {
    const pct = parseFloat(split.percentage || 0) / 100;
    return {
      userId: split.userId,
      userEmail: split.userEmail,
      role: split.role,
      percentage: split.percentage,
      allocatedAmountUSD: Number((amountUSD * pct).toFixed(2)),
      allocatedAmounts: {
        USD: Number((conversionHistories.USD * pct).toFixed(2)),
        GBP: Number((conversionHistories.GBP * pct).toFixed(2)),
        EUR: Number((conversionHistories.EUR * pct).toFixed(2)),
        ETH: Number((conversionHistories.ETH * pct).toFixed(6)),
        SOL: Number((conversionHistories.SOL * pct).toFixed(6)),
        USDC: Number((conversionHistories.USDC * pct).toFixed(2))
      }
    };
  });

  const earningRecord = {
    id: 'earn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    assetId,
    assetType,
    grossUSD: Number(amountUSD),
    conversions: conversionHistories,
    distributions,
    description,
    createdAt: new Date().toISOString()
  };

  // 1. Save to Firestore `/earnings` collection
  try {
    const db = getFirestoreDB();
    if (db) {
      const docRef = doc(db, 'earnings', earningRecord.id);
      await setDoc(docRef, earningRecord);
    }
  } catch (err) {
    console.warn('[Royalties]: Firestore earning log failed, caching to LocalStorage fallback.', err.message);
  }

  // 2. LocalStorage Fallback
  try {
    const local = JSON.parse(localStorage.getItem('foundation_local_earnings') || '[]');
    local.push(earningRecord);
    localStorage.setItem('foundation_local_earnings', JSON.stringify(local));
  } catch (e) {
    console.warn('[Royalties]: LocalStorage earning log cache failed.', e);
  }

  return earningRecord;
}

/**
 * Retrieves all earnings records.
 */
export async function getAllEarnings() {
  const results = [];
  try {
    const db = getFirestoreDB();
    if (db) {
      const querySnapshot = await getDocs(collection(db, 'earnings'));
      querySnapshot.forEach(docSnap => {
        results.push(docSnap.data());
      });
      if (results.length > 0) return results;
    }
  } catch (e) {
    console.warn('[Royalties]: Firestore earnings fetch bypassed, utilizing LocalStorage fallback.', e);
  }

  // Local storage fallback
  try {
    return JSON.parse(localStorage.getItem('foundation_local_earnings') || '[]');
  } catch (e) {
    return [];
  }
}
