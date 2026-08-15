// functions/api/stripe-webhook.js

async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, val] = part.trim().split('=');
    if (key && val) acc[key] = val;
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;

  const timestamp = parts.t;
  const expectedSig = parts.v1;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify', 'sign']
  );
  const payload = encoder.encode(`${timestamp}.${rawBody}`);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, payload);
  const hashArray = Array.from(new Uint8Array(signatureBytes));
  const actualSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return actualSig === expectedSig;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const signature = request.headers.get('stripe-signature');
  // Unified Environment Variable Law: strictly read STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error('[Stripe Webhook]: Stripe API key not configured');
    return new Response(
      JSON.stringify({ error: 'STRIPE_SECRET_KEY binding missing' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const rawBody = await request.text();

    // Verify Stripe Webhook Signature if secret is configured
    if (webhookSecret) {
      const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('[Stripe Webhook]: Signature verification failed');
        return new Response(
          JSON.stringify({ error: 'Webhook signature verification failed' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.warn('[Stripe Webhook]: STRIPE_WEBHOOK_SECRET missing; skipping HMAC signature check in test environment.');
    }

    const event = JSON.parse(rawBody); // Standard JSON event payload

    // Unified Environment Variable Law: strictly read FIREBASE_PROJECT_ID and FIREBASE_API_KEY
    const firebaseProjectId = env.FIREBASE_PROJECT_ID;
    const firestoreApiKey = env.FIREBASE_API_KEY;

    if (!firebaseProjectId || !firestoreApiKey) {
      console.error('[Stripe Webhook]: Firebase configuration missing');
    }

    // Helper to update user document directly via Firestore REST API at the Edge
    async function updateFirestoreUser(userEmail, patchPayload) {
      if (!firebaseProjectId || !userEmail) return;
      const docId = userEmail.replace(/[@.]/g, '_');
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${docId}?key=${firestoreApiKey}`;

      const fields = {};
      for (const [key, value] of Object.entries(patchPayload)) {
        fields[key] = { stringValue: String(value) };
      }

      try {
        await fetch(firestoreUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields })
        });
      } catch (firestoreErr) {
        console.error('[Stripe Webhook]: Firestore update failed for user:', userEmail, firestoreErr);
      }
    }

    // Helper to log payment receipt to Google Drive: [Site Name] / Reports / YYYY / MM /
    async function logReceiptToDrive(session) {
      const googleToken = env.GOOGLE_SERVICE_ACCOUNT_TOKEN || env.GOOGLE_ACCESS_TOKEN;
      if (!googleToken) return;
      try {
        const { uploadReportToDrive } = await import('../../utils/backend-google-serverless.js');
        const siteName = env.SITE_NAME || 'Foundation Framework';
        const customerEmail = session.customer_email || session.customer_details?.email || 'unknown';
        const fileName = `Receipt_${session.id || Date.now()}.html`;
        const amountPaid = ((session.amount_total || 2900) / 100).toFixed(2);

        const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Receipt ${session.id}</title></head>
<body>
  <h2>Payment Receipt</h2>
  <p><strong>Customer:</strong> ${customerEmail}</p>
  <p><strong>Amount Paid:</strong> $${amountPaid}</p>
  <p><strong>Session ID:</strong> ${session.id}</p>
  <p><strong>Status:</strong> Completed / Active</p>
  <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
</body>
</html>`;

        await uploadReportToDrive(googleToken, siteName, fileName, htmlContent);
        console.log(`[Stripe Webhook]: Saved receipt for ${customerEmail} to Google Drive.`);
      } catch (err) {
        console.error('[Stripe Webhook]: Google Drive receipt logging failed:', err);
      }
    }

    // Helper to credit affiliate with 10% commission on the purchase price
    async function creditAffiliate(affiliateId, amountPaid) {
      if (!firebaseProjectId || !affiliateId) return;

      const commissionRate = 0.10;
      const commissionAmount = amountPaid * commissionRate;
      const docId = affiliateId.includes('@') ? affiliateId.replace(/[@.]/g, '_') : affiliateId;
      const userUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${docId}?key=${firestoreApiKey}`;

      try {
        const res = await fetch(userUrl);
        let currentPending = 0;
        let currentEarned = 0;
        let referredCount = 0;

        if (res.ok) {
          const userData = await res.json();
          const fields = userData.fields || {};
          currentPending = parseFloat(fields.pendingBalance?.stringValue || fields.pendingBalance?.doubleValue || '0') || 0;
          currentEarned = parseFloat(fields.totalEarned?.stringValue || fields.totalEarned?.doubleValue || '0') || 0;
          referredCount = parseInt(fields.referredCount?.stringValue || fields.referredCount?.integerValue || '0') || 0;
        }

        const newPending = currentPending + commissionAmount;
        const newEarned = currentEarned + commissionAmount;
        const newReferred = referredCount + 1;

        const patchFields = {
          pendingBalance: { stringValue: String(newPending.toFixed(2)) },
          totalEarned: { stringValue: String(newEarned.toFixed(2)) },
          referredCount: { stringValue: String(newReferred) }
        };

        const updateUrl = `${userUrl}&updateMask.fieldPaths=pendingBalance&updateMask.fieldPaths=totalEarned&updateMask.fieldPaths=referredCount`;
        await fetch(updateUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: patchFields })
        });

        // Record commission log
        const commissionUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/affiliate_commissions?key=${firestoreApiKey}`;
        await fetch(commissionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              affiliateId: { stringValue: affiliateId },
              amountPaid: { stringValue: String(amountPaid.toFixed(2)) },
              commissionAmount: { stringValue: String(commissionAmount.toFixed(2)) },
              timestamp: { stringValue: new Date().toISOString() }
            }
          })
        });

        console.log(`[Stripe Webhook]: Credited affiliate ${affiliateId} with commission $${commissionAmount.toFixed(2)}`);
      } catch (err) {
        console.error('[Stripe Webhook]: Failed to credit affiliate:', affiliateId, err);
      }
    }

    // Helper to trigger post-checkout digital asset delivery
    async function handleFulfillment(session) {
      const customerEmail = session.customer_email || session.customer_details?.email;
      const customerName = session.customer_details?.name || 'Valued Member';
      
      const deliveryType = session.metadata?.deliveryType || 'secure_link';
      const fileId = session.metadata?.fileId;
      const fileName = session.metadata?.fileName || 'Digital-Product.pdf';

      if (!fileId) return;

      const baseUrl = new URL(request.url).origin;

      try {
        if (deliveryType === 'attachment') {
          await fetch(`${baseUrl}/api/send-fulfillment-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: customerEmail,
              name: customerName,
              fileId,
              fileName,
              mode: 'ATTACHMENT'
            })
          });
        } else {
          const token = crypto.randomUUID();
          const downloadUrl = `${baseUrl}/api/download?fileId=${fileId}&email=${encodeURIComponent(customerEmail)}&token=${token}`;

          await fetch(`${baseUrl}/api/send-fulfillment-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: customerEmail,
              name: customerName,
              downloadUrl,
              mode: 'TRACKED_LINK'
            })
          });
        }
      } catch (fulfillmentErr) {
        console.error('[Stripe Webhook]: Fulfillment failed for session:', session.id, fulfillmentErr);
      }
    }

    // Handle Webhook Events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_email || session.customer_details?.email;
        let assignedRole = session.metadata?.role || 'member';
        if (assignedRole === 'subscriber') {
          assignedRole = 'member';
        }
        const affiliateId = session.metadata?.affiliateId;
        const amountPaid = (session.amount_total || 2900) / 100;

        if (session.metadata?.type === 'event_registration') {
          // Event Registration Flow
          const { handleEventFulfillment } = await import('./stripe-webhook-helpers.js').catch(() => ({}));
          if (handleEventFulfillment) {
            await handleEventFulfillment(session, firebaseProjectId, firestoreApiKey, request.url);
          }
        } else {
          // 1. Auto-elevate user role from subscriber to member in Firestore/contentDB & set isAdmin accordingly
          const isAdminValue = assignedRole === 'admin' ? 'true' : 'false';
          const userPatch = {
            role: assignedRole,
            paymentStatus: 'Active',
            isAdmin: isAdminValue,
            stripeCustomerId: session.customer || '',
            stripeSubscriptionId: session.subscription || ''
          };
          if (affiliateId) {
            userPatch.referredBy = affiliateId;
          }

          await updateFirestoreUser(customerEmail, userPatch);
          console.log(`[Stripe Webhook]: Auto-elevated ${customerEmail} to role: ${assignedRole} (isAdmin: ${isAdminValue})`);

          // 2. Log payment receipt in Google Drive ([Site Name] / Reports / YYYY / MM /)
          await logReceiptToDrive(session);

          // 3. Credit Affiliate if applicable
          if (affiliateId) {
            await creditAffiliate(affiliateId, amountPaid);
          }

          // 4. Process Digital Fulfillment if file attached
          await handleFulfillment(session);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerEmail = invoice.customer_email || invoice.customer_name;

        // Mark user payment status as past_due without instantly revoking access or downgrading role
        await updateFirestoreUser(customerEmail, {
          paymentStatus: 'past_due',
          lastPaymentFailure: new Date().toISOString()
        });
        console.log(`[Stripe Webhook]: Marked ${customerEmail} payment status as past_due.`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerEmail = sub.metadata?.email || sub.customer_email;

        // Downgrade user role back to subscriber
        await updateFirestoreUser(customerEmail, {
          role: 'subscriber',
          isAdmin: 'false',
          paymentStatus: 'canceled'
        });
        console.log(`[Stripe Webhook]: Downgraded ${customerEmail} back to subscriber due to canceled subscription.`);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error('[Stripe Webhook]: Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
