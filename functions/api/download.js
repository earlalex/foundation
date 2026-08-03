// functions/api/download.js

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');
  const userEmail = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  if (!fileId || !userEmail || !token) {
    console.error('[Download API]: Missing required parameters');
    return new Response('Invalid or missing download parameters.', { status: 400 });
  }

  // Unified Environment Variable Law: strictly read FIREBASE_PROJECT_ID and FIREBASE_API_KEY
  const firebaseProjectId = env.FIREBASE_PROJECT_ID;
  const firestoreApiKey = env.FIREBASE_API_KEY;

  if (!firebaseProjectId || !firestoreApiKey) {
    console.error('[Download API]: Firebase configuration missing');
    return new Response('Server configuration error.', { status: 500 });
  }

  try {
    // 1. Fetch file directly from Google Drive API
    // Unified Environment Variable Law: strictly read GOOGLE_SERVICE_ACCOUNT_TOKEN
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${env.GOOGLE_SERVICE_ACCOUNT_TOKEN}` }
    });

    if (!driveRes.ok) {
      console.error('[Download API]: Drive fetch failed:', driveRes.status);
      return new Response('Download link expired or file unavailable.', { status: 403 });
    }

    // 2. Audit Trail: Log completed download event in Firestore
    const docId = `dl_${fileId}_${userEmail.replace(/[@.]/g, '_')}`;
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/downloads/${docId}?key=${firestoreApiKey}`;

    try {
      await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            fileId: { stringValue: fileId },
            userEmail: { stringValue: userEmail },
            downloadedAt: { stringValue: new Date().toISOString() },
            status: { stringValue: 'COMPLETED_AND_REVOKED' }
          }
        })
      });
    } catch (firestoreErr) {
      console.error('[Download API]: Firestore audit log failed:', firestoreErr);
      // Continue with download even if audit fails
    }

    // 3. Auto-Revoke: Strips specific user permission from Drive file
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions/user:${encodeURIComponent(userEmail)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${env.GOOGLE_SERVICE_ACCOUNT_TOKEN}` }
      });
    } catch (revokeErr) {
      console.error('[Download API]: Permission revocation failed:', revokeErr);
      // Continue with download even if revocation fails
    }

    // 4. Force browser auto-download via Content-Disposition header
    const responseHeaders = new Headers(driveRes.headers);
    responseHeaders.set('Content-Disposition', `attachment; filename="downloaded-asset"`);

    return new Response(driveRes.body, {
      status: 200,
      headers: responseHeaders
    });
  } catch (err) {
    console.error('[Download API]: Unhandled error:', err);
    return new Response(`Fulfillment Error: ${err.message || 'Internal server error'}`, { status: 500 });
  }
}