// core/drive-upload.js
import { GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth } from './auth.js';
import { errorHandler } from './error-handler.js';

let googleAccessToken = null;

export async function authenticateGoogleDrive() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    googleAccessToken = credential.accessToken;
    console.log('[Drive]: Access token acquired.');
  } catch (err) {
    errorHandler.handleError(new Error(`Drive Auth Failed: ${err.message}`));
  }
}

/**
 * Determines asset folder based on MIME type
 */
function getAssetCategory(file) {
  if (file.type.startsWith('image/')) return 'images';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'files'; // Default for PDFs, docs, zip, etc.
}

/**
 * Generates local & remote asset pathing: assets/{category}/{YYYY}/{MM}/{filename}
 */
export function getFormattedAssetPath(file) {
  const category = getAssetCategory(file);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // WordPress style path: assets/images/2026/07/header-photo.png
  return {
    category,
    year,
    month,
    relativePath: `assets/${category}/${year}/${month}/${file.name}`
  };
}

/**
 * Uploads a file with Google Drive metadata structured by site assets directory
 */
export async function uploadFileToDrive(file) {
  if (!googleAccessToken) {
    await authenticateGoogleDrive();
  }

  const { relativePath, category, year, month } = getFormattedAssetPath(file);

  try {
    // Description preserves local folder path inside Google Drive metadata
    const metadata = {
      name: file.name,
      mimeType: file.type,
      description: `Site Asset Path: ${relativePath}`
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink,webViewLink', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + googleAccessToken }),
      body: formData
    });

    const result = await response.json();
    console.log(`[Drive Upload]: Saved as ${relativePath}`, result);
    await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
        method: 'POST',
        headers: new Headers({
            'Authorization': 'Bearer ' + googleAccessToken,
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
        })
    });

    return {
      src: result.webViewLink || `https://lh3.googleusercontent.com/d/${result.id}`,
      localPath: relativePath,
      category,
      year,
      month
    };
  } catch (err) {
    errorHandler.handleError(new Error(`Drive Upload Failed: ${err.message}`));
    return null;
  }
}