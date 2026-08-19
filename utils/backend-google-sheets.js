// utils/backend-google-sheets.js - Google Sheets CMS Synchronization Engine
import { errorHandler } from '../core/error-handler.js';

export const CMS_TAB_SCHEMAS = {
  Site_Config: ['Key', 'Value', 'Category'],
  Pages_Layouts: ['slug', 'title', 'editorType', 'compiledHtml', 'compiledCss', 'projectDataJson', 'visibility'],
  Content_Articles: ['id', 'type', 'title', 'headline', 'description', 'bodyParagraphs', 'author', 'date', 'access'],
  Products_Catalog: ['id', 'title', 'description', 'category', 'priceUsd', 'stockQty', 'enableNftCounterpart'],
  Media_Assets: ['id', 'filename', 'category', 'driveCdnUrl', 'altText', 'aspectRatio', 'uploadedAt'],
  SEO_Metadata: ['path', 'metaTitle', 'metaDescription', 'canonicalUrl', 'ogImage']
};

/**
 * Ensures master Google Sheets CMS Workbook exists or creates it in Google Drive.
 * Title: "[Site Name] - Foundation CMS Workbook"
 * @param {string} token - Google OAuth Access Token
 * @param {string} siteName - Site Title / Enterprise Name
 * @returns {Promise<string|null>} Spreadsheet ID
 */
export async function ensureCmsWorkbook(token, siteName = 'Foundation Framework') {
  if (!token) {
    console.warn('[Google Sheets CMS]: No access token available. Skipping workbook provision.');
    return null;
  }

  const title = `${siteName} - Foundation CMS Workbook`;

  try {
    // 1. Search for existing spreadsheet in Drive
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(title)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        console.log('[Google Sheets CMS]: Found existing CMS Workbook ID:', searchData.files[0].id);
        return searchData.files[0].id;
      }
    }

    // 2. Create Spreadsheet via Google Sheets API if not found
    const createPayload = {
      properties: {
        title: title
      },
      sheets: Object.entries(CMS_TAB_SCHEMAS).map(([tabName, headers]) => ({
        properties: { title: tabName },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: headers.map(h => ({
              userEnteredValue: { stringValue: h },
              userEnteredFormat: { textFormat: { bold: true } }
            }))
          }]
        }]
      }))
    };

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createPayload)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.warn('[Google Sheets CMS]: Spreadsheet creation API error:', errText);
      return null;
    }

    const createdData = await createRes.json();
    console.log('[Google Sheets CMS]: Created new CMS Workbook ID:', createdData.spreadsheetId);
    return createdData.spreadsheetId;
  } catch (err) {
    errorHandler.handleError(err, 'Google Sheets CMS Workbook Provisioning');
    return null;
  }
}

/**
 * Reads all rows from a specific worksheet tab
 * @param {string} token - Google OAuth Token
 * @param {string} spreadsheetId - Google Sheets ID
 * @param {string} tabName - Name of worksheet tab
 * @returns {Promise<Array<Object>>} Array of row objects mapped by header
 */
export async function readCmsTab(token, spreadsheetId, tabName) {
  if (!token || !spreadsheetId || !tabName) return [];

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z500`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      console.warn(`[Google Sheets CMS]: Could not fetch tab "${tabName}". Status: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rows = data.values || [];
    if (rows.length <= 1) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] !== undefined ? row[idx] : '';
      });
      return obj;
    });
  } catch (err) {
    console.warn(`[Google Sheets CMS]: Error reading tab "${tabName}":`, err.message);
    return [];
  }
}

/**
 * Overwrites/Updates a specific tab in the CMS Workbook with fresh rows
 * @param {string} token - Google OAuth Access Token
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} tabName - Name of worksheet tab
 * @param {Array<Object>|Array<Array<any>>} data - Rows to overwrite
 * @returns {Promise<boolean>} Success status
 */
export async function writeCmsTab(token, spreadsheetId, tabName, data) {
  if (!token || !spreadsheetId || !tabName) return false;

  const headers = CMS_TAB_SCHEMAS[tabName] || [];
  let values = [headers];

  if (Array.isArray(data) && data.length > 0) {
    if (Array.isArray(data[0])) {
      values = [headers, ...data];
    } else if (typeof data[0] === 'object') {
      const mappedRows = data.map(item => {
        return headers.map(h => {
          const val = item[h];
          if (val === undefined || val === null) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        });
      });
      values = [headers, ...mappedRows];
    }
  }

  try {
    // Clear existing tab contents first
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z500:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {});

    // Update tab with new values
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1?valueInputOption=USER_ENTERED`;
    const res = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });

    if (res.ok) {
      console.log(`[Google Sheets CMS]: Successfully updated tab "${tabName}" with ${values.length - 1} data rows.`);
      return true;
    } else {
      const errTxt = await res.text();
      console.warn(`[Google Sheets CMS]: Failed to update tab "${tabName}":`, errTxt);
      return false;
    }
  } catch (err) {
    console.warn(`[Google Sheets CMS]: Error writing tab "${tabName}":`, err.message);
    return false;
  }
}

/**
 * High-level helper: Reads entire CMS workbook from Google Sheets
 * @param {string} token - Google OAuth Token
 * @param {string} spreadsheetId - Master Sheets ID
 * @returns {Promise<Object>} Entire CMS object dictionary by tab
 */
export async function readFullCmsWorkbook(token, spreadsheetId) {
  if (!token || !spreadsheetId) return null;

  try {
    const result = {};
    for (const tabName of Object.keys(CMS_TAB_SCHEMAS)) {
      result[tabName] = await readCmsTab(token, spreadsheetId, tabName);
    }
    return result;
  } catch (err) {
    console.warn('[Google Sheets CMS]: Failed to read full workbook:', err.message);
    return null;
  }
}
