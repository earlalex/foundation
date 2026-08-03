// utils/securityScanner.js
import { errorHandler } from '../core/error-handler.js';
import { getEnvVariable } from '../core/config.js';

/**
 * Retrieves the standardized VirusTotal API Key for scanning operations
 * @returns {string}
 */
export function getVirusTotalApiKey() {
  return getEnvVariable('VIRUSTOTAL_API_KEY');
}

/**
 * Calculates SHA-256 hash of a file using browser-native Web Crypto API
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
export async function calculateSHA256(buffer) {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    errorHandler.handleError(err, 'SHA-256 Calculation');
    throw err;
  }
}

/**
 * Scans text content for common malicious patterns
 * @param {string} content
 * @returns {string[]} Detected malicious patterns
 */
export function scanTextContent(content) {
  const detected = [];

  const rules = [
    {
      name: "Webshell / Backdoor",
      // Match webshell-like patterns e.g., shell_exec, system(, exec(, passthru(
      regex: /(?:shell_exec|passthru|system|exec|popen|proc_open)\s*\(/i
    },
    {
      name: "Encoded Eval Execution",
      // Match eval(base64_decode or eval(unescape or eval(atob
      regex: /eval\s*\(\s*(?:base64_decode|unescape|atob|decodeURIComponent)\b/i
    },
    {
      name: "Malicious iframe Injection",
      // Target injected phishing iframes (e.g. style with hidden display, height/width 0, absolute off-screen position)
      regex: /<iframe\s+[^>]*\b(?:style\s*=\s*['"][^'"]*display\s*:\s*none|width\s*=\s*['"]?0|height\s*=\s*['"]?0|position\s*:\s*absolute\s*;\s*left\s*:\s*-\s*\d+)/i
    },
    {
      name: "Deceptive Script Injections",
      // Malicious document.write(unescape) patterns
      regex: /document\.write\s*\(\s*(?:unescape|decodeURIComponent|atob)\b/i
    }
  ];

  for (const rule of rules) {
    if (rule.regex.test(content)) {
      detected.push(rule.name);
    }
  }

  return detected;
}

/**
 * Scans a file locally for threats
 * @param {File} file
 * @returns {Promise<{ isClean: boolean, hash: string, detectedSignatures: string[] }>}
 */
export async function scanFileLocally(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hash = await calculateSHA256(arrayBuffer);

    let detectedSignatures = [];

    // Check if file is a text-based asset
    const filename = file.name.toLowerCase();
    const isTextFile = filename.endsWith('.js') ||
                       filename.endsWith('.html') ||
                       filename.endsWith('.txt') ||
                       filename.endsWith('.json') ||
                       filename.endsWith('.md') ||
                       file.type.startsWith('text/') ||
                       file.type === 'application/json' ||
                       file.type === 'application/javascript';

    if (isTextFile) {
      const text = await file.text();
      detectedSignatures = scanTextContent(text);
    }

    return {
      isClean: detectedSignatures.length === 0,
      hash,
      detectedSignatures
    };
  } catch (err) {
    errorHandler.handleError(err, 'Local File Scan');
    return {
      isClean: true, // Fail open, but log error
      hash: '',
      detectedSignatures: []
    };
  }
}
