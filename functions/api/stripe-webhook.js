// functions/api/stripe-webhook.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const signature = request.headers.get('stripe-signature');
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
    const event = JSON.parse(rawBody); // Standard JSON event payload

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
      
      const deliveryType = session.metadata?.deliveryType || 'secure_link'; // 'attachment' or 'secure_link'
      const fileId = session.metadata?.fileId;
      const fileName = session.metadata?.fileName || 'Digital-Product.pdf';

      if (!fileId) return; // Skip fulfillment logic if no file attached

      const baseUrl = new URL(request.url).origin;

      try {
        if (deliveryType === 'attachment') {
          // STRATEGY A: Small File Direct Email Attachment via Gmail API
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
          // STRATEGY B: Large/High-Value File Tracked Proxy Link
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
        const assignedRole = session.metadata?.role || 'member';
        const affiliateId = session.metadata?.affiliateId;
        const amountPaid = (session.amount_total || 2900) / 100;

        // 1. Update Firestore Profile
        const userPatch = {
          role: assignedRole,
          paymentStatus: 'Active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
        };
        if (affiliateId) {
          userPatch.referredBy = affiliateId;
        }

        await updateFirestoreUser(customerEmail, userPatch);
        console.log(`[Stripe Webhook]: Upgraded ${customerEmail} to ${assignedRole}`);

        // Credit Affiliate
        if (affiliateId) {
          await creditAffiliate(affiliateId, amountPaid);
        }

        // 2. Process Digital Fulfillment (if file exists)
        await handleFulfillment(session);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerEmail = invoice.customer_email;

        // Late dues downgrade account to Subscriber
        await updateFirestoreUser(customerEmail, {
          role: 'subscriber',
          paymentStatus: 'Past Due / Delinquent',
          lastPaymentFailure: new Date().toISOString()
        });
        console.log(`[Stripe Webhook]: Downgraded ${customerEmail} to subscriber due to failed payment.`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerEmail = sub.metadata?.email;

        await updateFirestoreUser(customerEmail, {
          role: 'subscriber',
          paymentStatus: 'Canceled'
        });
        console.log(`[Stripe Webhook]: Subscription canceled for ${customerEmail}.`);
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