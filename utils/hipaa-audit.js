// utils/hipaa-audit.js - HIPAA Compliance Security Auditing & ePHI Encryption Engine
import { getFirestoreDB, doc, setDoc } from '../core/db-shared.js';

// AES-GCM 256-bit key generation/import helper
async function getCryptoKey(password) {
  const enc = new TextEncoder();
  // Ensure exactly 32 bytes for a 256-bit AES key
  const rawKey = enc.encode(password.padEnd(32, '0').substring(0, 32));
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Enforces AES-GCM 256-bit encryption on sensitive health/ePHI data.
 * @param {string} plainText
 * @param {string} password
 * @returns {Promise<string>} Base64 encoded string containing the encrypted payload
 */
export async function encryptPHI(plainText, password = 'SparkDefaultHIPAAPassword101!') {
  if (!plainText) return '';
  const enc = new TextEncoder();
  const key = await getCryptoKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

  const ciphertextBytes = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );

  const combined = new Uint8Array(iv.length + ciphertextBytes.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBytes), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts AES-GCM 256-bit encrypted health/ePHI data.
 * @param {string} base64Ciphertext
 * @param {string} password
 * @returns {Promise<string>} Plaintext decrypted string
 */
export async function decryptPHI(base64Ciphertext, password = 'SparkDefaultHIPAAPassword101!') {
  if (!base64Ciphertext) return '';
  const key = await getCryptoKey(password);
  const combined = new Uint8Array(atob(base64Ciphertext).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const ciphertextBytes = combined.slice(12);

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertextBytes
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBytes);
}

/**
 * Logs every action initiated by human or AI agents for HIPAA Compliance Auditing.
 * @param {string} action - e.g. "READ", "WRITE", "DELETE", "DECRYPT"
 * @param {string} resource - e.g. "ephi_patient_summary", "billing_data"
 * @param {string} details - Additional context
 * @param {boolean} isSuccess
 * @param {string} agentId - Always defaults to Gemini Spark's employee ID
 */
export async function logHipaaAudit(action, resource, details = '', isSuccess = true, agentId = 'GEMINI_SPARK_EE01') {
  const payload = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    agentId,
    action,
    resource,
    details,
    isSuccess
  };

  // Local storage backup
  try {
    const logs = JSON.parse(localStorage.getItem('foundation_local_hipaa_logs') || '[]');
    logs.push(payload);
    // Maintain last 500 audit logs locally
    localStorage.setItem('foundation_local_hipaa_logs', JSON.stringify(logs.slice(-500)));
  } catch (e) {
    console.warn('[HIPAA Audit]: Failed to write log to LocalStorage', e);
  }

  // Firestore sync
  const db = getFirestoreDB();
  if (!db) {
    return payload;
  }

  try {
    const docRef = doc(db, 'hipaa_logs', payload.id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[HIPAA Audit]: Firestore logging error.', err.message);
    return payload;
  }
}

/**
 * Retrieves audit logs.
 */
export function getLocalHipaaLogs() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_hipaa_logs') || '[]');
  } catch (e) {
    return [];
  }
}
