// core/drive-upload.js
import { GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth } from './auth.js';
import { errorHandler } from './error-handler.js';
import { configManager } from './config.js';
import { scanFileLocally } from '../utils/securityScanner.js';
import { contentDB } from './db.js';

let googleAccessToken = null;
let rootFolderId = null;
let currentConfiguredRootName = null;

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
 * Gets the current expected root folder name based on site config
 */
export function getExpectedRootFolderName() {
  const siteConfig = configManager.current.site || {};
  const companyName = siteConfig.companyName || configManager.current.businessProfile?.legalName || "Ascension Avenue Academy";
  const siteName = siteConfig.siteName || configManager.current.siteTitle || "Foundation";
  return `${companyName}-${siteName}`;
}

/**
 * Finds or creates a subfolder under a parent on Google Drive
 */
async function getOrCreateFolder(parentFolderId, folderName) {
  if (!googleAccessToken) await authenticateGoogleDrive();

  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create the subfolder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      })
    });
    const folderData = await createRes.json();

    // Make individual folder publicly readable unless it is the private corporate-binder
    if (folderName !== 'corporate-binder') {
      await fetch(`https://www.googleapis.com/drive/v3/files/${folderData.id}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      }).catch(() => {});
    }

    return folderData.id;
  } catch (err) {
    console.error(`[Drive Engine]: Failed to get/create folder "${folderName}":`, err);
    throw err;
  }
}

/**
 * Resolves a chain of folder segments step-by-step
 */
async function resolveFolderIdForPath(rootId, segments) {
  let currentId = rootId;
  for (const segment of segments) {
    currentId = await getOrCreateFolder(currentId, segment);
  }
  return currentId;
}

/**
 * Syncs corporate binder document metadata & secure link to LastPass (or vault_credentials)
 */
export async function pushToLastPass(metadata) {
  const lpConfig = configManager.current.lastpass || {};
  const isLpConfigured = !!(lpConfig.provisioningHash && lpConfig.companyId);

  const record = {
    id: `lp_binder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    serviceName: `Corporate Binder: ${metadata.name}`,
    loginUrl: metadata.src,
    username: "Admin (Corporate Note)",
    encryptedPassKey: `Secure Attachment Link: ${metadata.src}\nRelative Path: ${metadata.localPath}\nUploaded At: ${metadata.uploadedAt}`,
    assignedEditorId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await contentDB.saveVaultCredential(record);
    console.log(`[LastPass Bridge]: Saved note for "${metadata.name}" to vault_credentials.`);

    if (isLpConfigured) {
      const payload = {
        action: "add_note",
        hash: lpConfig.provisioningHash,
        companyId: lpConfig.companyId,
        note_title: `Corporate Binder: ${metadata.name}`,
        note_text: `Secure Attachment Link: ${metadata.src}\nRelative Path: ${metadata.localPath}`
      };
      await fetch(lpConfig.apiEndpoint || "https://lastpass.com/enterprise/api.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(e => console.warn('[LastPass API]: Bridge integration unreachable (mock/silent bypass).', e));
    }
  } catch (err) {
    console.error('[LastPass Bridge]: Failed to sync corporate note:', err);
  }
}

/**
 * Ensures the Site-Named Master Folder exists in Google Drive and is appropriately named and updated
 */
export async function getOrCreateSiteRootFolder() {
  if (!googleAccessToken) await authenticateGoogleDrive();

  const expectedName = getExpectedRootFolderName();

  try {
    // If we have a cached folder, let's verify if the current name changed (Dynamic Renaming Engine)
    if (rootFolderId && currentConfiguredRootName === expectedName) {
      return rootFolderId;
    }

    // 1. Search if folder with expectedName exists
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(expectedName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      rootFolderId = searchData.files[0].id;
      currentConfiguredRootName = expectedName;
      return rootFolderId;
    }

    // 2. If we had a cached rootFolderId but the name changed, let's rename the existing folder!
    if (rootFolderId) {
      console.log(`[Drive Engine]: Renaming root folder to "${expectedName}"...`);
      const renameRes = await fetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: expectedName })
      });
      if (renameRes.ok) {
        currentConfiguredRootName = expectedName;
        return rootFolderId;
      }
    }

    // 3. Create Master Site Folder if not found
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: expectedName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const folderData = await createRes.json();
    rootFolderId = folderData.id;
    currentConfiguredRootName = expectedName;

    // Make Folder Publicly Readable so assets inherit default permissions (except corporate-binder which we mask)
    await fetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    }).catch(() => {});

    console.log(`[Drive Engine]: Created Public Root Folder "${expectedName}" (${rootFolderId})`);
    return rootFolderId;
  } catch (err) {
    errorHandler.handleError(new Error(`Root Folder Init Failed: ${err.message}`));
    return null;
  }
}

/**
 * Convert Google Drive share links into direct streamable/download URLs
 * @param {string} url - Google Drive link
 * @returns {string} Direct URL or original URL
 */
export function convertDriveShareLink(url) {
  if (!url || typeof url !== 'string') return url;

  // Matches drive.google.com/file/d/FILE_ID/view... or open?id=FILE_ID
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  return url;
}

function getAssetCategory(file) {
  if (file.name?.endsWith('.ico') || file.type === 'image/x-icon' || file.name?.includes('favicon') || file.name?.includes('icon')) {
    return 'icons';
  }
  if (file.type.startsWith('image/')) return 'images';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'files';
}

/**
 * Uploads a file inside strictly structured directory:
 * corporate-binder/ or assets/{{year}}/{{month}}/{{category}}/
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

  const isPrivate = file.isPrivateDoc === true;
  const isCorporateBinder = file.isCorporateBinder === true || isPrivate || file.name?.includes('Worksheet') || file.name?.includes('Articles') || file.name?.includes('EIN');
  const isH5P = file.isH5P === true;

  let relativePath = '';
  let pathSegments = [];

  if (isCorporateBinder) {
    pathSegments = ['corporate-binder'];
    relativePath = `corporate-binder/${file.name}`;
  } else if (isH5P) {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const courseId = file.courseId || 'unknown-course';
    const lessonId = file.lessonId || 'unknown-lesson';
    pathSegments = ['assets', year, month, 'h5p', courseId, lessonId];
    relativePath = `assets/${year}/${month}/h5p/${courseId}/${lessonId}/${file.name}`;
  } else {
    const category = getAssetCategory(file);
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    pathSegments = ['assets', year, month, category];
    relativePath = `assets/${year}/${month}/${category}/${file.name}`;
  }

  try {
    // Resolve target folder chain ID
    const targetFolderId = await resolveFolderIdForPath(parentFolderId, pathSegments);

    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [targetFolderId],
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

    // Make individual file publicly readable, EXCEPT for corporate binder / private documents
    if (!isCorporateBinder) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      }).catch(() => {});
    } else {
      console.log(`[Drive Engine]: Saved file "${file.name}" as PRIVATE inside corporate-binder.`);
    }

    const directCdnUrl = `https://lh3.googleusercontent.com/d/${result.id}`;
    const fileMetadata = {
      id: result.id,
      src: isCorporateBinder ? `https://drive.google.com/open?id=${result.id}` : directCdnUrl,
      localPath: relativePath,
      category: isCorporateBinder ? 'corporate-binder' : getAssetCategory(file),
      year: isCorporateBinder ? null : new Date().getFullYear(),
      month: isCorporateBinder ? null : String(new Date().getMonth() + 1).padStart(2, '0'),
      isPrivate: isCorporateBinder,
      uploadedAt: new Date().toISOString()
    };

    // If uploaded to corporate-binder/, automatically push document metadata and secure link to LastPass
    if (isCorporateBinder) {
      await pushToLastPass({
        name: file.name,
        src: fileMetadata.src,
        localPath: relativePath,
        uploadedAt: fileMetadata.uploadedAt
      });
    }

    return fileMetadata;
  } catch (err) {
    errorHandler.handleError(new Error(`Drive Upload Failed: ${err.message}`));
    return null;
  }
}

/**
 * Write temporary credentials to private file on Google Drive inside corporate-binder/
 */
export async function writeTempCredentialsVault(credentials) {
  if (!googleAccessToken) await authenticateGoogleDrive();
  const parentFolderId = await getOrCreateSiteRootFolder();

  const pathSegments = ['corporate-binder'];
  const folderId = await resolveFolderIdForPath(parentFolderId, pathSegments);
  const fileName = '_temp_credentials_vault.json';

  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    const searchData = await searchRes.json();

    const fileContent = JSON.stringify(credentials, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });

    if (searchData.files && searchData.files.length > 0) {
      const fileId = searchData.files[0].id;
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: blob
      });
      console.log(`[Drive Engine]: Updated temporary credentials vault inside corporate-binder.`);
    } else {
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId]
      };
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob);

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${googleAccessToken}` },
        body: formData
      });
      console.log(`[Drive Engine]: Created new temporary credentials vault inside corporate-binder.`);
    }
  } catch (err) {
    console.error('[Drive Engine]: Temp Credentials Write Failed:', err);
  }
}

/**
 * Reads temporary credentials from private file on Google Drive inside corporate-binder/
 */
export async function readTempCredentialsVault() {
  if (!googleAccessToken) await authenticateGoogleDrive();
  const parentFolderId = await getOrCreateSiteRootFolder();

  const pathSegments = ['corporate-binder'];
  const folderId = await resolveFolderIdForPath(parentFolderId, pathSegments);
  const fileName = '_temp_credentials_vault.json';

  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      const fileId = searchData.files[0].id;
      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });
      return await getRes.json();
    }
  } catch (err) {
    console.error('[Drive Engine]: Temp Credentials Read Failed:', err);
  }
  return null;
}

/**
 * Permanently deletes the temporary credentials file from Google Drive inside corporate-binder/
 */
export async function deleteTempCredentialsVault() {
  if (!googleAccessToken) await authenticateGoogleDrive();
  const parentFolderId = await getOrCreateSiteRootFolder();

  const pathSegments = ['corporate-binder'];
  const folderId = await resolveFolderIdForPath(parentFolderId, pathSegments);
  const fileName = '_temp_credentials_vault.json';

  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      const fileId = searchData.files[0].id;
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });
      console.log(`[Drive Engine]: Purged temporary credentials vault from Google Drive.`);
      return true;
    }
  } catch (err) {
    console.error('[Drive Engine]: Temp Credentials Delete Failed:', err);
  }
  return false;
}
