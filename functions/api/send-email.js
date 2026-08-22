// functions/api/send-email.js

/**
 * Verify Firebase ID token signature and standard claims using Web Crypto API
 * @param {string} token - JWT token to verify
 * @param {string} projectId - Firebase project ID
 * @returns {Promise<{valid: boolean, email?: string, uid?: string, role?: string, admin?: boolean}>}
 */
async function verifyFirebaseToken(token, projectId) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false };
    }

    const headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const header = JSON.parse(atob(headerB64));
    const kid = header.kid;
    if (!kid) {
      return { valid: false };
    }

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadB64));

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) return { valid: false };
    if (!payload.iat || payload.iat > now) return { valid: false };
    if (payload.aud !== projectId) return { valid: false };

    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) return { valid: false };
    if (!payload.sub || !payload.email) return { valid: false };

    const certsRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!certsRes.ok) return { valid: false };
    const certs = await certsRes.json();
    const certPem = certs[kid];
    if (!certPem) return { valid: false };

    const pemBody = certPem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
    const certDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

    const spkiDer = extractSPKIFromCert(certDer);
    if (!spkiDer) return { valid: false };

    const publicKey = await crypto.subtle.importKey(
      'spki',
      spkiDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureB64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature,
      data
    );

    if (!isValid) return { valid: false };

    return {
      valid: true,
      email: payload.email,
      uid: payload.sub || payload.uid,
      role: payload.role || (payload.claims?.role),
      admin: payload.admin === true || payload.role === 'admin'
    };
  } catch (err) {
    return { valid: false };
  }
}

function extractSPKIFromCert(certDer) {
  try {
    let pos = 0;
    if (certDer[pos++] !== 0x30) return null;
    pos += getLengthBytes(certDer, pos);

    if (certDer[pos++] !== 0x30) return null;
    const tbsLength = getLength(certDer, pos);
    const tbsLengthBytes = getLengthBytes(certDer, pos);
    pos += tbsLengthBytes;

    if (certDer[pos] === 0xa0) {
      pos++;
      const versionLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + versionLen;
    }

    if (certDer[pos] === 0x02) {
      pos++;
      const serialLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + serialLen;
    }

    if (certDer[pos] === 0x30) {
      pos++;
      const sigLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + sigLen;
    }

    if (certDer[pos] === 0x30) {
      pos++;
      const issuerLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + issuerLen;
    }

    if (certDer[pos] === 0x30) {
      pos++;
      const validityLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + validityLen;
    }

    if (certDer[pos] === 0x30) {
      pos++;
      const subjectLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + subjectLen;
    }

    if (certDer[pos] === 0x30) {
      const spkiStart = pos;
      pos++;
      const spkiLen = getLength(certDer, pos);
      const spkiLenBytes = getLengthBytes(certDer, pos);
      const spkiEnd = spkiStart + 1 + spkiLenBytes + spkiLen;
      return certDer.slice(spkiStart, spkiEnd);
    }

    return null;
  } catch (err) {
    return null;
  }
}

function getLength(der, pos) {
  const firstByte = der[pos];
  if (firstByte < 0x80) return firstByte;
  const numBytes = firstByte & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | der[pos + 1 + i];
  }
  return length;
}

function getLengthBytes(der, pos) {
  const firstByte = der[pos];
  if (firstByte < 0x80) return 1;
  return 1 + (firstByte & 0x7f);
}

/**
 * Exchange Google Service Account credentials for OAuth 2.0 access token with domain-wide delegation
 * @param {object} serviceAccount - Service account credentials object
 * @param {string} impersonateEmail - Email to impersonate for domain-wide delegation
 * @returns {Promise<string>} - OAuth 2.0 access token
 */
async function getGoogleAccessToken(serviceAccount, impersonateEmail) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id
  };

  const claimSet = {
    iss: serviceAccount.client_email,
    sub: impersonateEmail,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const claimSetB64 = btoa(JSON.stringify(claimSet)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signatureInput = `${headerB64}.${claimSetB64}`;

  // Import private key for signing
  const privateKeyPem = serviceAccount.private_key;
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth token exchange failed: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Strict Fail-Closed Authorization Guard requiring Admin/Editor Privilege
  const authHeader = request.headers.get("Authorization") || request.headers.get("X-Admin-Token") || "";
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const expectedAdminToken = env.ADMIN_TOKEN || env.ADMIN_API_KEY || env.FOUNDATION_ADMIN_KEY;
  let isAuthorized = false;

  if (expectedAdminToken && token === expectedAdminToken) {
    isAuthorized = true;
  } else if (token) {
    const firebaseProjectId = env.FIREBASE_PROJECT_ID;
    const firestoreApiKey = env.FIREBASE_API_KEY;

    if (firebaseProjectId) {
      const verifyResult = await verifyFirebaseToken(token, firebaseProjectId);
      if (verifyResult.valid) {
        if (verifyResult.role === 'admin' || verifyResult.role === 'editor' || verifyResult.admin === true) {
          isAuthorized = true;
        } else if ((verifyResult.uid || verifyResult.email) && firestoreApiKey) {
          const uid = verifyResult.uid;
          const userEmail = verifyResult.email;

          // Verify user role in Firestore with Bearer token authentication header
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          try {
            let role = '';
            // 1. Query by UID first (Firebase Auth UID key) with Bearer token
            if (uid) {
              const uidRes = await fetch(
                `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${uid}?key=${firestoreApiKey}`,
                {
                  headers: { 'Authorization': `Bearer ${token}` },
                  signal: controller.signal
                }
              );
              if (uidRes.ok) {
                const userData = await uidRes.json();
                role = userData.fields?.role?.stringValue || '';
              }
            }

            // 2. Query by normalized email document ID if role was not found by UID
            if (!role && userEmail) {
              const docId = userEmail.replace(/[@.]/g, '_');
              const emailRes = await fetch(
                `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${docId}?key=${firestoreApiKey}`,
                {
                  headers: { 'Authorization': `Bearer ${token}` },
                  signal: controller.signal
                }
              );
              if (emailRes.ok) {
                const userData = await emailRes.json();
                role = userData.fields?.role?.stringValue || '';
              }
            }

            if (role === 'admin' || role === 'editor') {
              isAuthorized = true;
            }
          } catch (dbErr) {
            console.error('[send-email] Role verification failed:', dbErr);
          } finally {
            clearTimeout(timeoutId);
          }
        }
      }
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Forbidden: Admin or Editor authorization required for email relay' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { to, subject, html, text, fromName, fromEmail, primaryProvider: reqPrimaryProvider } = body;

  // 2. Address & Payload Input Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || typeof to !== 'string' || !emailRegex.test(to.trim())) {
    return new Response(JSON.stringify({ error: 'Invalid recipient email address' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate subject, html, and text are strings
  if (subject !== undefined && typeof subject !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid subject: must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (html !== undefined && typeof html !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid html: must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (text !== undefined && typeof text !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid text: must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Reject subject values containing CR or LF characters to prevent header injection
  if (subject && /[\r\n]/.test(subject)) {
    return new Response(JSON.stringify({ error: 'Invalid subject: carriage-return or line-feed characters not allowed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create sanitized subject for use in email dispatch
  const safeSubject = subject || 'Notification';

  const defaultSender = env.ADMIN_EMAIL || `noreply@${new URL(request.url).hostname}`;
  const senderEmail = (fromEmail && emailRegex.test(fromEmail.trim())) ? fromEmail.trim() : defaultSender;
  const senderName = fromName || env.SITE_TITLE || 'Foundation System';

  // 3. Determine Provider Order
  const primaryProvider = (reqPrimaryProvider || env.PRIMARY_EMAIL_PROVIDER || '').toLowerCase();
  const prefersGmail = primaryProvider.includes('google') || primaryProvider.includes('gmail');

  const dispatchMailChannels = async () => {
    const mailchannelsPayload = {
      personalizations: [
        { to: [{ email: to.trim() }] }
      ],
      from: { email: senderEmail, name: senderName },
      subject: safeSubject,
      content: [
        { type: 'text/html', value: html || `<p>${text || ''}</p>` }
      ]
    };

    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mailchannelsPayload),
      signal: AbortSignal.timeout(10000)
    });

    const responseBody = await response.text();
    console.log('[MailChannels Provider Response]:', responseBody);

    if (response.ok) {
      return new Response(JSON.stringify({ success: true, provider: 'MailChannels' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error('MailChannels provider failed to send email');
  };

  const dispatchGmail = async () => {
    if (!env.GOOGLE_SERVICE_ACCOUNT_TOKEN) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_TOKEN unconfigured for Gmail API dispatch.');
    }

    // Obtain current OAuth 2.0 access token with JWT exchange if service account credentials are provided
    let accessToken = env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
    try {
      const tokenConfig = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_TOKEN);
      if (tokenConfig.type === 'service_account' && tokenConfig.private_key && tokenConfig.client_email) {
        // Implement JWT exchange for domain-wide delegation
        accessToken = await getGoogleAccessToken(tokenConfig, env.ADMIN_EMAIL || tokenConfig.client_email);
      }
    } catch (parseErr) {
      // Token is not JSON, assume it's already an access token
    }

    const gmailSuccess = await sendViaGmailApi(accessToken, to.trim(), safeSubject, html || text || '');
    if (gmailSuccess) {
      return new Response(JSON.stringify({ success: true, provider: 'Google Workspace / Gmail API' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error('Gmail API send returned failure.');
  };

  if (prefersGmail) {
    try {
      return await dispatchGmail();
    } catch (err) {
      console.warn('[send-email Worker]: Gmail API primary provider failed. Falling back to MailChannels...', err);
      try {
        return await dispatchMailChannels();
      } catch (mcErr) {
        return new Response(JSON.stringify({ error: `Gmail primary and MailChannels fallback both failed: ${mcErr.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  } else {
    try {
      return await dispatchMailChannels();
    } catch (err) {
      console.warn('[send-email Worker]: MailChannels primary provider failed. Falling back to Gmail API...', err);
      try {
        return await dispatchGmail();
      } catch (gmailErr) {
        return new Response(JSON.stringify({ error: `MailChannels primary and Gmail fallback both failed: ${gmailErr.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
}

async function sendViaGmailApi(token, to, subject, bodyContent) {
  try {
    const isHtml = bodyContent.trim().startsWith('<') || bodyContent.trim().toLowerCase().includes('<html>') || bodyContent.trim().toLowerCase().includes('<div') || bodyContent.trim().toLowerCase().includes('<p>');
    const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';

    const rawEmail = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${contentType}`,
      '',
      bodyContent
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedEmail })
    });
    return res.ok;
  } catch (err) {
    console.error('[Gmail Fallback Error]:', err);
    return false;
  }
}
