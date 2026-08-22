// functions/api/stripe-product-create.js
// Cloudflare Pages Serverless Endpoint for Secure Stripe Product/Price Creation

/**
 * Verify Firebase ID token signature and claims using Web Crypto API
 * @param {string} token - JWT token to verify
 * @param {string} projectId - Firebase project ID
 * @returns {Promise<{valid: boolean, email?: string}>}
 */
async function verifyFirebaseToken(token, projectId) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false };
    }

    // Decode header to get 'kid' (key ID)
    const headerB64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const header = JSON.parse(atob(headerB64));
    const kid = header.kid;
    if (!kid) {
      return { valid: false };
    }

    // Decode payload to check claims
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadB64));

    // Verify standard claims
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      console.error('[Token Verify] Token expired');
      return { valid: false };
    }
    if (!payload.iat || payload.iat > now) {
      console.error('[Token Verify] Invalid iat claim');
      return { valid: false };
    }
    if (payload.aud !== projectId) {
      console.error('[Token Verify] Audience mismatch');
      return { valid: false };
    }
    const expectedIssuer = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIssuer) {
      console.error('[Token Verify] Issuer mismatch');
      return { valid: false };
    }
    if (!payload.sub || !payload.email) {
      console.error('[Token Verify] Missing sub or email claim');
      return { valid: false };
    }

    // Fetch Google's public keys for Firebase
    const certsRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!certsRes.ok) {
      console.error('[Token Verify] Failed to fetch Google public certs');
      return { valid: false };
    }
    const certs = await certsRes.json();
    const certPem = certs[kid];
    if (!certPem) {
      console.error('[Token Verify] No matching cert for kid:', kid);
      return { valid: false };
    }

    // Extract SPKI from PEM certificate and import public key
    const pemBody = certPem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
    const certDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

    // Parse X.509 certificate to extract SubjectPublicKeyInfo (SPKI)
    // Simple DER parsing: locate SPKI sequence within certificate
    const spkiDer = extractSPKIFromCert(certDer);
    if (!spkiDer) {
      console.error('[Token Verify] Failed to extract SPKI from certificate');
      return { valid: false };
    }

    const publicKey = await crypto.subtle.importKey(
      'spki',
      spkiDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature
    const signatureB64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature,
      data
    );

    if (!isValid) {
      console.error('[Token Verify] Signature verification failed');
      return { valid: false };
    }

    return { valid: true, email: payload.email };
  } catch (err) {
    console.error('[Token Verify] Exception:', err);
    return { valid: false };
  }
}

/**
 * Extract SubjectPublicKeyInfo (SPKI) from X.509 certificate DER
 * Simplified DER parser for X.509 TBSCertificate structure
 */
function extractSPKIFromCert(certDer) {
  try {
    // X.509 Certificate structure (simplified):
    // SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
    // tbsCertificate SEQUENCE { version, serial, signature, issuer, validity, subject, subjectPublicKeyInfo, ... }
    // We need to locate the subjectPublicKeyInfo SEQUENCE

    let pos = 0;
    // Skip outer SEQUENCE tag and length
    if (certDer[pos++] !== 0x30) return null; // SEQUENCE
    pos += getLengthBytes(certDer, pos);

    // Skip tbsCertificate SEQUENCE tag
    if (certDer[pos++] !== 0x30) return null; // SEQUENCE
    const tbsLength = getLength(certDer, pos);
    const tbsLengthBytes = getLengthBytes(certDer, pos);
    pos += tbsLengthBytes;
    const tbsStart = pos;

    // Navigate through tbsCertificate fields to find subjectPublicKeyInfo
    // Skip: version (optional context [0]), serialNumber, signature, issuer, validity, subject
    // Then we reach subjectPublicKeyInfo

    // Version (optional, context-specific [0])
    if (certDer[pos] === 0xa0) {
      pos++; // tag
      const versionLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + versionLen;
    }

    // SerialNumber (INTEGER)
    if (certDer[pos] === 0x02) {
      pos++; // tag
      const serialLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + serialLen;
    }

    // Signature (SEQUENCE)
    if (certDer[pos] === 0x30) {
      pos++; // tag
      const sigLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + sigLen;
    }

    // Issuer (SEQUENCE)
    if (certDer[pos] === 0x30) {
      pos++; // tag
      const issuerLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + issuerLen;
    }

    // Validity (SEQUENCE)
    if (certDer[pos] === 0x30) {
      pos++; // tag
      const validityLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + validityLen;
    }

    // Subject (SEQUENCE)
    if (certDer[pos] === 0x30) {
      pos++; // tag
      const subjectLen = getLength(certDer, pos);
      pos += getLengthBytes(certDer, pos) + subjectLen;
    }

    // SubjectPublicKeyInfo (SEQUENCE) - this is what we want
    if (certDer[pos] === 0x30) {
      const spkiStart = pos;
      pos++; // tag
      const spkiLen = getLength(certDer, pos);
      const spkiLenBytes = getLengthBytes(certDer, pos);
      const spkiEnd = spkiStart + 1 + spkiLenBytes + spkiLen;
      return certDer.slice(spkiStart, spkiEnd);
    }

    return null;
  } catch (err) {
    console.error('[SPKI Extract] Error:', err);
    return null;
  }
}

function getLength(der, pos) {
  const firstByte = der[pos];
  if (firstByte < 0x80) {
    return firstByte;
  }
  const numBytes = firstByte & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | der[pos + 1 + i];
  }
  return length;
}

function getLengthBytes(der, pos) {
  const firstByte = der[pos];
  if (firstByte < 0x80) {
    return 1;
  }
  return 1 + (firstByte & 0x7f);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  // Unified Environment Variable Law: strictly read STRIPE_SECRET_KEY
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  // Security: Guard endpoint against unauthorized callers creating product/price catalog entries
  const authHeader = request.headers.get("Authorization") || request.headers.get("X-Admin-Token") || "";
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const expectedAdminToken = env.ADMIN_TOKEN || env.ADMIN_API_KEY || env.FOUNDATION_ADMIN_KEY;
  let isAuthorized = false;

  if (expectedAdminToken && token === expectedAdminToken) {
    isAuthorized = true;
  } else if (token) {
    // 1. In Simulation Mode without active Stripe key, allow explicit mock admin/editor tokens
    if ((!stripeSecretKey || stripeSecretKey === 'sk_test_placeholder') && (token.startsWith('mock_admin') || token.startsWith('mock_editor'))) {
      isAuthorized = true;
    } else {
      // 2. Verify JWT Bearer token signature and claims, then check role against Firestore
      const firebaseProjectId = env.FIREBASE_PROJECT_ID;
      const firestoreApiKey = env.FIREBASE_API_KEY;

      if (firebaseProjectId) {
        // Verify token signature and standard claims
        const verifyResult = await verifyFirebaseToken(token, firebaseProjectId);

        if (verifyResult.valid && firestoreApiKey) {
          const uid = verifyResult.uid;
          const userEmail = verifyResult.email;

          // Token is valid, now check Firestore role with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          try {
            let role = '';
            // 1. Query by UID first
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
            console.error('[Stripe Product Create] Auth DB check failed:', dbErr);
          } finally {
            clearTimeout(timeoutId);
          }
        }
      }
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Forbidden: Insufficient privileges' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { name, description, amount, currency, recurring } = body;

    if (!name || !amount) {
      return new Response(JSON.stringify({ error: 'Product name and amount are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Graceful Simulation Mode if Stripe Secret Key is missing or unconfigured
    if (!stripeSecretKey || stripeSecretKey === 'sk_test_placeholder') {
      console.warn('[Stripe Product Create]: STRIPE_SECRET_KEY is missing. Returning simulated IDs.');
      const mockId = Date.now();
      return new Response(JSON.stringify({
        productId: `prod_sim_${mockId}`,
        priceId: `price_sim_${mockId}`,
        simulated: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Stripe API - Create Product
    const productParams = new URLSearchParams();
    productParams.append('name', name);
    if (description) {
      productParams.append('description', description);
    }

    const productRes = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: productParams
    });

    if (!productRes.ok) {
      const errorData = await productRes.json();
      console.error('[Stripe Product Create]: Stripe Product creation failed:', errorData);
      return new Response(JSON.stringify({ error: errorData.error?.message || 'Failed to create Stripe product' }), {
        status: productRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stripeProduct = await productRes.json();
    const productId = stripeProduct.id;

    // 3. Stripe API - Create Price for that Product
    const priceParams = new URLSearchParams();
    priceParams.append('product', productId);
    priceParams.append('unit_amount', String(amount));
    priceParams.append('currency', (currency || 'usd').toLowerCase());

    if (recurring) {
      priceParams.append('recurring[interval]', 'month');
    }

    const priceRes = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: priceParams
    });

    if (!priceRes.ok) {
      const errorData = await priceRes.json();
      console.error('[Stripe Product Create]: Stripe Price creation failed:', errorData);
      // Clean up product if price creation fails, or simply return the error
      return new Response(JSON.stringify({ error: errorData.error?.message || 'Failed to create Stripe price' }), {
        status: priceRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stripePrice = await priceRes.json();
    const priceId = stripePrice.id;

    return new Response(JSON.stringify({
      productId,
      priceId,
      simulated: false
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[Stripe Product Create Server Exception]:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
