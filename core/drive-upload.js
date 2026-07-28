// core/drive-upload.js
import { GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth } from './auth.js';
import { errorHandler } from './error-handler.js';
import { configManager } from './config.js';
import { scanFileLocally } from '../utils/securityScanner.js';

let googleAccessToken = null;
let rootFolderId = null;

export async function authenticateGoogleDrive() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    googleAccessToken = credential.accessToken;
    console.log('[Drive]: Access token acquired.');
    return googleAccessToken;
  } catch (err) {
    errorHandler.handleError(new Error(`Drive Auth Failed: ${err.message}`));
    return null;
  }
}

/**
 * Ensures the Site-Named Master Folder exists in Google Drive and is publicly readable
 */
export async function getOrCreateSiteRootFolder() {
  if (rootFolderId) return rootFolderId;
  if (!googleAccessToken) await authenticateGoogleDrive();

  const siteName = configManager.current.siteTitle || 'Foundation Assets';

  try {
    // 1. Search if folder with siteName exists
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(siteName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      rootFolderId = searchData.files[0].id;
      return rootFolderId;
    }

    // 2. Create Master Site Folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: siteName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const folderData = await createRes.json();
    rootFolderId = folderData.id;

    // 3. Make Folder Publicly Readable so all assets inherit public URL access
    await fetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });

    console.log(`[Drive Engine]: Created Public Root Folder "${siteName}" (${rootFolderId})`);
    return rootFolderId;
  } catch (err) {
    errorHandler.handleError(new Error(`Root Folder Init Failed: ${err.message}`));
    return null;
  }
}

function getAssetCategory(file) {
  if (file.type.startsWith('image/')) return 'images';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'files';
}

/**
 * Uploads a file inside [Site Name] / assets / [category] / YYYY / MM /
 */
export async function uploadFileToDrive(file) {
  // Run Tier 1 browser-native security scan guardrail
  const scanResult = await scanFileLocally(file);
  if (!scanResult.isClean) {
    const errorMsg = `Upload blocked: Local signature scan detected malicious patterns: ${scanResult.detectedSignatures.join(', ')}`;
    console.warn(`[Security Scanner]: ${errorMsg}`);
    errorHandler.handleError(new Error(errorMsg), 'Security Block');
    return null;
  }

  if (!googleAccessToken) await authenticateGoogleDrive();
  const parentFolderId = await getOrCreateSiteRootFolder();

  const category = getAssetCategory(file);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const relativePath = `assets/${category}/${year}/${month}/${file.name}`;

  try {
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: parentFolderId ? [parentFolderId] : [],
      description: `Site Relative Path: ${relativePath}`
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink,webViewLink', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${googleAccessToken}` },
      body: formData
    });

    const result = await response.json();

    // Make individual file publicly readable, EXCEPT for private documents
    const isPrivate = file.isPrivateDoc === true;
    if (!isPrivate) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
    } else {
      console.log(`[Drive Engine]: Saved file "${file.name}" as PRIVATE (no public reader access).`);
    }

    const directCdnUrl = `https://lh3.googleusercontent.com/d/${result.id}`;

    return {
      id: result.id,
      src: isPrivate ? `https://drive.google.com/open?id=${result.id}` : directCdnUrl,
      localPath: relativePath,
      category,
      year,
      month,
      isPrivate: isPrivate,
      uploadedAt: new Date().toISOString()
    };
  } catch (err) {
    errorHandler.handleError(new Error(`Drive Upload Failed: ${err.message}`));
    return null;
  }
}
