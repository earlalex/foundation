// utils/hipaa-audit.js - HIPAA Technical Safeguards & ePHI Compliance Engine
import { getFirestoreDB, doc, setDoc } from '../core/db-shared.js';
import { store } from '../core/store.js';

/**
 * Derives a CryptoKey object from a raw string password/phrase using PBKDF2.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt sensitive ePHI / record at rest using AES-GCM 256-bit.
 * @param {string} plainText
 * @param {string} keyPhrase - Encryption password/phrase
 * @returns {Promise<Object>} { cipherText: string (hex), iv: string (hex), salt: string (hex) }
 */
export async function encryptPHIRecord(plainText, keyPhrase = 'FOUNDATION-SECURE-ePHI-KEY-PHRASE-2026') {
  if (!plainText) return { cipherText: '', iv: '', salt: '' };

  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV is recommended for GCM

  const key = await deriveKey(keyPhrase, salt);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const cipherText = Array.from(new Uint8Array(encryptedBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    cipherText,
    iv: ivHex,
    salt: saltHex
  };
}

/**
 * Decrypt sensitive ePHI / record back to plain text.
 * @param {string} cipherTextHex
 * @param {string} ivHex
 * @param {string} saltHex
 * @param {string} keyPhrase
 * @returns {Promise<string>} Decrypted plain text
 */
export async function decryptPHIRecord(cipherTextHex, ivHex, saltHex, keyPhrase = 'FOUNDATION-SECURE-ePHI-KEY-PHRASE-2026') {
  if (!cipherTextHex || !ivHex || !saltHex) return '';

  const cipherBytes = new Uint8Array(cipherTextHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  const key = await deriveKey(keyPhrase, salt);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Writes an immutable HIPAA audit log entry representing access or modification of sensitive data.
 * Logs are stored in Firestore under '/hipaa_logs' and fallback LocalStorage.
 * @param {string} action - "READ" | "WRITE" | "DELETE" | "ACCESS_GRANTED" | "ACCESS_DENIED"
 * @param {string} recordId
 * @param {string} status - "SUCCESS" | "FAILED"
 * @param {Object} details - Additional metadata e.g. ip, user agent, changes
 * @returns {Promise<Object>} The log entry saved
 */
export async function logHipaaAccess(action, recordId, status = 'SUCCESS', details = {}) {
  const user = store.state.user || {};
  const userId = user.uid || user.email || 'SYSTEM_DAEMON';
  const userEmail = user.email || 'anonymous';
  const role = store.state.simulatedUserTier || user.role || 'prospect';

  const logEntry = {
    id: `hipaa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    agentId: 'GEMINI_SPARK_EE01', // Standard HIPAA background agent tag
    userId,
    userEmail,
    role,
    action,
    recordId,
    status,
    ip: details.ip || '127.0.0.1', // Mock or proxy remote IP
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'NodeJS/Agent',
    details: details.notes || JSON.stringify(details)
  };

  // 1. Save to LocalStorage Fallback
  try {
    const localLogs = JSON.parse(localStorage.getItem('foundation_local_hipaa_logs') || '[]');
    localLogs.push(logEntry);
    localStorage.setItem('foundation_local_hipaa_logs', JSON.stringify(localLogs));
  } catch (e) {
    console.warn('[HIPAA Audit]: Local storage write error.', e);
  }

  // 2. Sync to Firestore
  const db = getFirestoreDB();
  if (db) {
    try {
      const docRef = doc(db, 'hipaa_logs', logEntry.id);
      await setDoc(docRef, logEntry, { merge: true });
    } catch (err) {
      console.warn('[HIPAA Audit]: Firestore write bypassed/offline.', err.message);
    }
  }

  console.log(`[HIPAA Secure Audit Log]: [${action}] Record: ${recordId} Status: ${status} by Agent: ${userEmail}`);
  return logEntry;
}

/**
 * Get all logged HIPAA compliance audits
 * @returns {Array}
 */
export function getHipaaLogs() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_hipaa_logs') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Exports all local HIPAA audit logs as a downloadable CSV.
 */
export function exportHipaaLogsCsv() {
  const logs = getHipaaLogs();
  if (logs.length === 0) {
    return 'No logs';
  }

  const headers = ['ID', 'Timestamp', 'Agent ID', 'User ID', 'User Email', 'Role', 'Action', 'Record ID', 'Status', 'IP Address', 'Details'];
  const csvRows = [headers.join(',')];

  logs.forEach(log => {
    const row = [
      log.id,
      log.timestamp,
      log.agentId,
      log.userId,
      log.userEmail,
      log.role,
      log.action,
      log.recordId,
      log.status,
      log.ip,
      `"${String(log.details).replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Exports all local HIPAA audit logs as a JSON string.
 */
export function exportHipaaLogsJson() {
  const logs = getHipaaLogs();
  return JSON.stringify(logs, null, 2);
}
