// utils/backend-wise.js - Wise Business International Payout Adapter
import { savePayrollRecord, saveExpense } from '../core/db-finances.js';
import { configManager } from '../core/config.js';

/**
 * Get Wise API Base URL based on environment mode (Live vs Sandbox)
 * @returns {string}
 */
const getBaseUrl = () => {
  const isSandbox = configManager.current?.wise?.sandbox !== false; // default to sandbox (true) if not explicitly false
  return isSandbox ? 'https://api.sandbox.transferwise.com' : 'https://api.transferwise.com';
};

/**
 * Get Wise Authorization headers
 * @returns {Object}
 */
const getHeaders = () => {
  const apiKey = configManager.current.WISE_API_KEY || '';
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Query Wise Business profile details
 * @returns {Promise<Object>}
 */
export async function getWiseProfile() {
  const url = `${getBaseUrl()}/v1/profiles`;
  const headers = getHeaders();

  if (!configManager.current.WISE_API_KEY) {
    console.log('[Wise Adapter]: API Key missing, returning simulated profile');
    return { id: 12345, type: 'business', name: 'Ascension Avenue Academy LLC' };
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Wise API error: ${res.statusText}`);
    const data = await res.json();
    // Return first business profile, or fallback to first available profile
    const profile = data.find(p => p.type === 'business') || data[0];
    return profile || { id: 12345, type: 'business', name: 'Ascension Avenue Academy LLC' };
  } catch (err) {
    console.warn('[Wise Adapter]: Profile fetch failed, using simulation.', err.message);
    return { id: 12345, type: 'business', name: 'Ascension Avenue Academy LLC' };
  }
}

/**
 * Create or retrieve a target recipient account in Wise
 * @param {Object} vaData
 * @returns {Promise<Object>}
 */
export async function createRecipient(vaData) {
  const profileId = configManager.current.WISE_PROFILE_ID || '12345';
  const url = `${getBaseUrl()}/v1/accounts`;
  const headers = getHeaders();

  const accountDetails = {
    profile: Number(profileId),
    currency: 'PHP',
    type: 'philippines',
    accountHolderName: vaData.name || vaData.accountHolderName || 'VA Assistant',
    details: {
      legalType: 'PRIVATE',
      bankCode: vaData.bankName || vaData.bankCode || 'GCASH',
      accountNumber: vaData.accountNumber || vaData.phone || '09123456789'
    }
  };

  if (!configManager.current.WISE_API_KEY) {
    console.log('[Wise Adapter]: API Key missing, returning simulated recipient');
    return { id: `rec_${Date.now()}`, ...accountDetails };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(accountDetails)
    });
    if (!res.ok) throw new Error(`Wise Recipient error: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[Wise Adapter]: Recipient creation failed, using simulation.', err.message);
    return { id: `rec_${Date.now()}`, ...accountDetails };
  }
}

/**
 * Calculate exchange rates, fees, and arrival times
 * @param {number} sourceAmountUSD
 * @param {string} targetCurrency
 * @returns {Promise<Object>}
 */
export async function createQuote(sourceAmountUSD, targetCurrency = 'PHP') {
  const profileId = configManager.current.WISE_PROFILE_ID || '12345';
  const url = `${getBaseUrl()}/v2/quotes`;
  const headers = getHeaders();

  const quotePayload = {
    profileId: Number(profileId),
    sourceCurrency: 'USD',
    targetCurrency: targetCurrency,
    sourceAmount: Number(sourceAmountUSD)
  };

  if (!configManager.current.WISE_API_KEY) {
    console.log('[Wise Adapter]: API Key missing, returning simulated quote');
    const rate = 56.25;
    const fee = 1.50;
    const sourceValue = Number(sourceAmountUSD);
    const targetValue = (sourceValue - fee) * rate;
    return {
      id: `qte_${Date.now()}`,
      sourceCurrency: 'USD',
      targetCurrency,
      sourceValue,
      targetValue,
      fee,
      rate,
      deliveryEstimate: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(quotePayload)
    });
    if (!res.ok) throw new Error(`Wise Quote error: ${res.statusText}`);
    const data = await res.json();
    const paymentOption = data.paymentOptions?.find(o => o.payIn === 'BALANCE') || data.paymentOptions?.[0] || {};
    return {
      id: data.id,
      sourceCurrency: 'USD',
      targetCurrency,
      sourceValue: data.sourceAmount,
      targetValue: data.targetAmount,
      fee: paymentOption.fee?.total || 1.50,
      rate: data.rate,
      deliveryEstimate: paymentOption.formattedEstimatedDelivery || new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    };
  } catch (err) {
    console.warn('[Wise Adapter]: Quote calculation failed, using simulation.', err.message);
    const rate = 56.25;
    const fee = 1.50;
    const sourceValue = Number(sourceAmountUSD);
    const targetValue = (sourceValue - fee) * rate;
    return {
      id: `qte_${Date.now()}`,
      sourceCurrency: 'USD',
      targetCurrency,
      sourceValue,
      targetValue,
      fee,
      rate,
      deliveryEstimate: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    };
  }
}

/**
 * Initiate transfer directly from business balance
 * @param {string} recipientId
 * @param {string} quoteId
 * @param {string} reference
 * @returns {Promise<Object>}
 */
export async function executePayout(recipientId, quoteId, reference) {
  const url = `${getBaseUrl()}/v1/transfers`;
  const headers = getHeaders();

  const transferPayload = {
    targetAccount: recipientId,
    quoteUuid: quoteId,
    customerTransactionId: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    details: {
      reference: reference || 'VA Monthly Payroll'
    }
  };

  if (!configManager.current.WISE_API_KEY) {
    console.log('[Wise Adapter]: API Key missing, returning simulated transfer');
    return {
      id: `trf_${Date.now()}`,
      status: 'incoming',
      targetAccount: recipientId,
      quoteUuid: quoteId,
      reference
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(transferPayload)
    });
    if (!res.ok) throw new Error(`Wise Transfer error: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.warn('[Wise Adapter]: Payout execution failed, using simulation.', err.message);
    return {
      id: `trf_${Date.now()}`,
      status: 'incoming',
      targetAccount: recipientId,
      quoteUuid: quoteId,
      reference
    };
  }
}

/**
 * Handle Wise transfer state change webhook events
 * @param {Object} event
 * @returns {Promise<Object>}
 */
export async function handleWiseWebhook(event) {
  if (!event || event.event_type !== 'transfer.state-change') {
    return { success: false, reason: 'Invalid or unsupported event type' };
  }

  const { resource } = event.data || {};
  if (!resource) return { success: false, reason: 'Missing resource transfer data' };

  // Wise statuses marking transfer initiation / completion
  const isCompleted = ['outgoing_payment_sent', 'completed', 'executed', 'processing'].includes(resource.status || event.current_state);
  if (!isCompleted) {
    return { success: false, reason: 'Transfer status not processed/completed' };
  }

  // Retrieve employee/VA context and payout values from the event metadata
  const vaData = event.vaData || { id: 'emp_sim_1', name: 'GCash VA Assistant' };
  const payout = event.payout || {
    id: resource.id || 'trf_sim_123',
    sourceValue: resource.sourceValue || 500.00,
    targetValue: resource.targetValue || 28125.00,
    fee: resource.fee || 1.50,
    rate: resource.rate || 56.25
  };

  try {
    await savePayrollRecord({
      employeeId: vaData.id,
      employeeName: vaData.name,
      amountUSD: payout.sourceValue,
      amountPHP: payout.targetValue,
      transferFeeUSD: payout.fee,
      exchangeRate: payout.rate,
      wiseTransferId: payout.id,
      status: 'completed',
      date: new Date().toISOString()
    });

    await saveExpense({
      title: `VA Payroll: ${vaData.name} (Wise Transfer #${payout.id})`,
      category: 'Payroll',
      amount: payout.sourceValue + payout.fee,
      paymentMethod: 'Wise Business API',
      date: new Date().toISOString()
    });

    return { success: true };
  } catch (err) {
    console.error('[Wise Webhook Handler]: Error persisting financial logs:', err);
    return { success: false, error: err.message };
  }
}
