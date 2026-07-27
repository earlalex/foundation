// utils/backend-google.js

/**
 * Uploads a transcript or communication log to Google Drive from Cloudflare Pages Environment:
 * [Site Name] / Communication Logs / YYYY / MM /
 */
export async function uploadCommunicationLogToDrive(token, siteName, fileName, content) {
  if (!token) return null;

  try {
    // 1. Search or create the Root siteName folder
    let folderId = null;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(siteName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: siteName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      const folderData = await createRes.json();
      folderId = folderData.id;
    }

    // 2. Search or create "Communication Logs" child folder
    let logsFolderId = null;
    const logsSearchUrl = `https://www.googleapis.com/drive/v3/files?q=name='Communication Logs' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const logsSearchRes = await fetch(logsSearchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const logsSearchData = await logsSearchRes.json();

    if (logsSearchData.files && logsSearchData.files.length > 0) {
      logsFolderId = logsSearchData.files[0].id;
    } else {
      const createLogsRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Communication Logs',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId]
        })
      });
      const logsFolderData = await createLogsRes.json();
      logsFolderId = logsFolderData.id;
    }

    // 3. Search or create "YYYY" year child folder
    const year = String(new Date().getFullYear());
    let yearFolderId = null;
    const yearSearchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${year}' and '${logsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const yearSearchRes = await fetch(yearSearchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const yearSearchData = await yearSearchRes.json();

    if (yearSearchData.files && yearSearchData.files.length > 0) {
      yearFolderId = yearSearchData.files[0].id;
    } else {
      const createYearRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: year,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [logsFolderId]
        })
      });
      const yearFolderData = await createYearRes.json();
      yearFolderId = yearFolderData.id;
    }

    // 4. Search or create "MM" month child folder
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    let monthFolderId = null;
    const monthSearchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${month}' and '${yearFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const monthSearchRes = await fetch(monthSearchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const monthSearchData = await monthSearchRes.json();

    if (monthSearchData.files && monthSearchData.files.length > 0) {
      monthFolderId = monthSearchData.files[0].id;
    } else {
      const createMonthRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: month,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [yearFolderId]
        })
      });
      const monthFolderData = await createMonthRes.json();
      monthFolderId = monthFolderData.id;
    }

    // 5. Upload the transcript file itself (Private by default)
    const metadata = {
      name: fileName,
      mimeType: fileName.endsWith('.md') ? 'text/markdown' : 'application/json',
      parents: [monthFolderId]
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([content], { type: metadata.mimeType }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    return await response.json();
  } catch (err) {
    console.warn('[Drive Engine]: Communication Log Upload failed:', err.message);
    return null;
  }
}

/**
 * Creates or updates Google Contacts during communication interactions
 */
export async function syncGoogleContactCommunication({ phone, name, type, timestamp, token }) {
  if (!token || !phone) return false;

  try {
    const searchRes = await fetch(`https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(phone)}&readMask=names,phoneNumbers,userDefined`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const searchData = await searchRes.json();
    const existingPerson = searchData.results?.[0]?.person;

    if (existingPerson) {
      const resourceName = existingPerson.resourceName;
      const etag = existingPerson.etag;
      const userDefined = existingPerson.userDefined || [];

      // Update interaction fields
      const dateStr = new Date(timestamp).toLocaleString();
      const lastContactIdx = userDefined.findIndex(u => u.key === 'LastInteraction');
      if (lastContactIdx >= 0) {
        userDefined[lastContactIdx].value = `${type.toUpperCase()} on ${dateStr}`;
      } else {
        userDefined.push({ key: 'LastInteraction', value: `${type.toUpperCase()} on ${dateStr}` });
      }

      await fetch(`https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=userDefined`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ etag, userDefined })
      });
    } else {
      // Create new contact
      const contactPayload = {
        names: [{ givenName: name || `Customer (${phone})` }],
        phoneNumbers: [{ value: phone }],
        userDefined: [
          { key: 'UserRole', value: 'Subscriber' },
          { key: 'LastInteraction', value: `${type.toUpperCase()} on ${new Date(timestamp).toLocaleString()}` }
        ]
      };

      await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactPayload)
      });
    }
    return true;
  } catch (err) {
    console.warn('[Google Services]: Contacts communication sync failed:', err.message);
    return false;
  }
}

/**
 * Dispatch automated summary email via Gmail API
 */
export async function sendCommunicationSummaryEmail({ toEmail, summary, duration, query, response, token }) {
  if (!token || !toEmail) return false;

  const subject = `[AI Telephony Log] Summary: ${summary.substring(0, 50)}...`;
  const messageBody = [
    `AI Telephony Interaction Log`,
    `=============================`,
    `Summary: ${summary}`,
    `Duration/Session: ${duration || 'N/A'}`,
    `User Query: ${query}`,
    `AI Response: ${response}`,
    `Timestamp: ${new Date().toLocaleString()}`,
    `=============================`,
    `Delivered automatically by Foundation System Support.`
  ].join('\r\n');

  const rawEmail = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    messageBody
  ].join('\r\n');

  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedEmail })
    });
    return true;
  } catch (err) {
    console.warn('[Google Services]: Failed to dispatch Gmail summary notification:', err.message);
    return false;
  }
}
