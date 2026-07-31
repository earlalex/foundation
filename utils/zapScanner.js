// utils/zapScanner.js
// OWASP ZAP (Zaproxy) Security Extension - Core REST API Wrapper

export const zapScanner = {
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
    return response.json();
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
    return response.json();
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
    return response.json();
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
