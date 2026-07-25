// functions/api/download.js

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');
  const userEmail = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  if (!fileId || !userEmail || !token) {
    return new Response('Invalid or missing download parameters.', { status: 400 });
  }

  const firebaseProjectId = env.FIREBASE_PROJECT_ID;
  const firestoreApiKey = env.FIREBASE_API_KEY;

  try {
    // 1. Fetch file directly from Google Drive API
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${env.GOOGLE_SERVICE_ACCOUNT_TOKEN}` }
    });

    if (!driveRes.ok) {
      return new Response('Download link expired or file unavailable.', { status: 403 });
    }

    // 2. Audit Trail: Log completed download event in Firestore
    const docId = `dl_${fileId}_${userEmail.replace(/[@.]/g, '_')}`;
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/downloads/${docId}?key=${firestoreApiKey}`;

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

    // 3. Auto-Revoke: Strips specific user permission from Drive file
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions/user:${encodeURIComponent(userEmail)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${env.GOOGLE_SERVICE_ACCOUNT_TOKEN}` }
    });

    // 4. Force browser auto-download via Content-Disposition header
    const responseHeaders = new Headers(driveRes.headers);
    responseHeaders.set('Content-Disposition', `attachment; filename="downloaded-asset"`);

    return new Response(driveRes.body, {
      status: 200,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(`Fulfillment Error: ${err.message}`, { status: 500 });
  }
}