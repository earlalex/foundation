// utils/zapScanner.js
// OWASP ZAP (Zaproxy) Security Extension - Core REST API Wrapper

export const zapScanner = {
  /**
   * Logs a security scan result to Firestore (/security_scans) and LocalStorage
   * @param {string} scanType
   * @param {string} targetUrl
   * @param {string} status
   * @param {Array} [findings=[]]
   * @param {Object} [details={}]
   * @returns {Promise<Object>} Saved scan log entry
   */
  async logSecurityScan(scanType, targetUrl, status, findings = [], details = {}) {
    const scanEntry = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      scanType,
      targetUrl,
      status,
      findingsCount: Array.isArray(findings) ? findings.length : 0,
      findings: Array.isArray(findings) ? findings : [],
      details
    };

    try {
      const localScans = JSON.parse(localStorage.getItem('foundation_local_security_scans') || '[]');
      localScans.unshift(scanEntry);
      localStorage.setItem('foundation_local_security_scans', JSON.stringify(localScans.slice(0, 100)));
    } catch (e) {
      console.warn('[ZAP Scanner]: Local storage write warning:', e);
    }

    try {
      const { getFirestoreDB, doc, setDoc } = await import('../core/db-shared.js');
      const db = getFirestoreDB();
      if (db) {
        const docRef = doc(db, 'security_scans', scanEntry.id);
        await setDoc(docRef, scanEntry, { merge: true });
      }
    } catch (err) {
      console.warn('[ZAP Scanner]: Firestore log skipped:', err.message);
    }

    return scanEntry;
  },

  /**
   * Starts a Spider scan on the target URL
   * @param {string} targetUrl
   * @returns {Promise<Object>} The API response containing the scan ID
   */
  async startSpiderScan(targetUrl) {
    const response = await fetch('/api/zap-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'spider', targetUrl })
    });
    if (!response.ok) {
      throw new Error(`Failed to start ZAP Spider scan: ${response.statusText}`);
    }
    const resData = await response.json();
    await this.logSecurityScan('spider', targetUrl, 'STARTED', [], { scanId: resData.scanId });
    return resData;
  },

  /**
   * Starts an Active Penetration scan on the target URL
   * @param {string} targetUrl
   * @returns {Promise<Object>} The API response containing the scan ID
   */
  async startActiveScan(targetUrl) {
    const response = await fetch('/api/zap-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'active', targetUrl })
    });
    if (!response.ok) {
      throw new Error(`Failed to start ZAP Active scan: ${response.statusText}`);
    }
    const resData = await response.json();
    await this.logSecurityScan('active', targetUrl, 'STARTED', [], { scanId: resData.scanId });
    return resData;
  },

  /**
   * Starts an Ajax Spider scan on the target URL
   * @param {string} targetUrl
   * @returns {Promise<Object>}
   */
  async startAjaxSpiderScan(targetUrl) {
    const response = await fetch('/api/zap-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ajaxSpider', targetUrl })
    });
    if (!response.ok) {
      throw new Error(`Failed to start ZAP Ajax Spider scan: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Gets the progress (0-100%) of a specific ZAP scan
   * @param {string} scanId
   * @param {string} type - 'spider' or 'active'
   * @returns {Promise<Object>} The progress data { progress: number, status: string }
   */
  async getScanProgress(scanId, type = 'active') {
    const response = await fetch('/api/zap-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'progress', scanId, scanType: type })
    });
    if (!response.ok) {
      throw new Error(`Failed to get ZAP scan progress: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Queries alerts/findings identified for the target URL
   * @param {string} targetUrl
   * @param {string} [riskLevel] - Optional filter ('High', 'Medium', 'Low', 'Informational')
   * @returns {Promise<Object>} The findings list
   */
  async getScanAlerts(targetUrl, riskLevel = '') {
    const response = await fetch('/api/zap-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'alerts', targetUrl, riskLevel })
    });
    if (!response.ok) {
      throw new Error(`Failed to retrieve ZAP scan alerts: ${response.statusText}`);
    }
    const resData = await response.json();
    const alerts = resData.alerts || resData.findings || [];
    await this.logSecurityScan('alerts_query', targetUrl, 'COMPLETED', alerts, { riskLevel });
    return resData;
  },

  /**
   * Generates a vulnerability report in the specified format
   * @param {string} format - 'HTML', 'JSON', 'XML'
   * @returns {Promise<Object>}
   */
  async generateZapReport(format = 'JSON') {
    const response = await fetch('/api/zap-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report', format })
    });
    if (!response.ok) {
      throw new Error(`Failed to generate ZAP report: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Verifies connectivity to the ZAP Daemon
   * @param {string} baseUrl
   * @param {string} apiKey
   * @returns {Promise<Object>}
   */
  async testConnection(baseUrl, apiKey) {
    const response = await fetch('/api/zap-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test-connection', baseUrl, apiKey })
    });
    if (!response.ok) {
      throw new Error(`Failed to verify ZAP API connection: ${response.statusText}`);
    }
    return response.json();
  }
};
