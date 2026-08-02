// functions/api/stripe-webhook.js

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

    // Helper to decrement event inventory
    async function decrementEventInventory(firebaseProjectId, firestoreApiKey, eventId, cartItems) {
      if (!firebaseProjectId || !firestoreApiKey || !eventId || !cartItems) return;
      const eventUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/content/${eventId}?key=${firestoreApiKey}`;

      try {
        const res = await fetch(eventUrl);
        if (!res.ok) return;

        const doc = await res.json();
        const fields = doc.fields || {};

        let eventUpdated = false;

        if (fields.ticketTypes && fields.ticketTypes.arrayValue && fields.ticketTypes.arrayValue.values) {
          const tValues = fields.ticketTypes.arrayValue.values;
          for (const item of cartItems) {
            if (item.type === 'ticket') {
              const match = tValues.find(v => {
                const f = v.mapValue?.fields || {};
                return f.id?.stringValue === item.id;
              });
              if (match) {
                const f = match.mapValue.fields;
                const currentSold = parseInt(f.sold?.integerValue || f.sold?.stringValue || '0', 10);
                f.sold = { integerValue: String(currentSold + item.quantity) };
                eventUpdated = true;
              }
            }
          }
        }

        if (fields.vendorPackages && fields.vendorPackages.arrayValue && fields.vendorPackages.arrayValue.values) {
          const vValues = fields.vendorPackages.arrayValue.values;
          for (const item of cartItems) {
            if (item.type === 'vendor_booth') {
              const match = vValues.find(v => {
                const f = v.mapValue?.fields || {};
                return f.id?.stringValue === item.id;
              });
              if (match) {
                const f = match.mapValue.fields;
                const currentCapacity = parseInt(f.capacity?.integerValue || f.capacity?.stringValue || '0', 10);
                const currentSold = parseInt(f.sold?.integerValue || f.sold?.stringValue || '0', 10);
                f.capacity = { integerValue: String(Math.max(0, currentCapacity - item.quantity)) };
                f.sold = { integerValue: String(currentSold + item.quantity) };
                eventUpdated = true;
              }
            }
          }
        }

        if (fields.sponsorshipPackages && fields.sponsorshipPackages.arrayValue && fields.sponsorshipPackages.arrayValue.values) {
          const sValues = fields.sponsorshipPackages.arrayValue.values;
          for (const item of cartItems) {
            if (item.type === 'sponsorship') {
              const match = sValues.find(v => {
                const f = v.mapValue?.fields || {};
                return f.id?.stringValue === item.id;
              });
              if (match) {
                const f = match.mapValue.fields;
                const currentCapacity = parseInt(f.capacity?.integerValue || f.capacity?.stringValue || '0', 10);
                const currentSold = parseInt(f.sold?.integerValue || f.sold?.stringValue || '0', 10);
                f.capacity = { integerValue: String(Math.max(0, currentCapacity - item.quantity)) };
                f.sold = { integerValue: String(currentSold + item.quantity) };
                eventUpdated = true;
              }
            }
          }
        }

        if (eventUpdated) {
          const patchUrl = `${eventUrl}&updateMask.fieldPaths=ticketTypes&updateMask.fieldPaths=vendorPackages&updateMask.fieldPaths=sponsorshipPackages`;
          await fetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
          });
          console.log(`[Stripe Webhook]: Decremented inventory for event ${eventId}`);
        }
      } catch (err) {
        console.error('[Stripe Webhook]: Failed to decrement event inventory:', err);
      }
    }

    // Helper to fulfill event registration
    async function handleEventFulfillment(session) {
      const customerEmail = session.customer_email || session.customer_details?.email;
      const eventId = session.metadata?.eventId;
      const userId = session.metadata?.userId || 'guest';
      const cartItemsStr = session.metadata?.cartItems;

      if (!eventId || !cartItemsStr) return;

      let cartItems = [];
      try {
        cartItems = JSON.parse(cartItemsStr);
      } catch (e) {
        console.error('[Stripe Webhook]: Failed to parse cart items', e);
        return;
      }

      if (!firebaseProjectId || !firestoreApiKey) return;

      // 1. Create digital registration record
      const regId = 'reg_' + crypto.randomUUID().substring(0, 8);
      const regUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/registrations/${regId}?key=${firestoreApiKey}`;
      const accessCode = 'EVT-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const regFields = {
        id: { stringValue: regId },
        eventId: { stringValue: eventId },
        userId: { stringValue: userId },
        email: { stringValue: customerEmail },
        accessCode: { stringValue: accessCode },
        qrPayload: { stringValue: `FOUNDATION-PASS:${accessCode}` },
        cartItems: { stringValue: cartItemsStr },
        status: { stringValue: 'Confirmed' },
        createdAt: { stringValue: new Date().toISOString() }
      };

      try {
        await fetch(regUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: regFields })
        });
        console.log(`[Stripe Webhook]: Saved event registration ${regId} for ${customerEmail}`);
      } catch (err) {
        console.error('[Stripe Webhook]: Failed to save event registration:', err);
      }

      // 2. Decrement inventory
      await decrementEventInventory(firebaseProjectId, firestoreApiKey, eventId, cartItems);

      // 3. Lead Score Boost (+50)
      try {
        const userDocUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${customerEmail.replace(/[@.]/g, '_')}?key=${firestoreApiKey}`;
        const userRes = await fetch(userDocUrl);
        let currentLeadScore = 0;
        if (userRes.ok) {
          const userData = await userRes.json();
          currentLeadScore = parseInt(userData.fields?.leadScore?.stringValue || userData.fields?.leadScore?.integerValue || '0', 10);
        }
        await updateFirestoreUser(customerEmail, { leadScore: String(currentLeadScore + 50) });
        console.log(`[Stripe Webhook]: Boosted lead score for ${customerEmail} to ${currentLeadScore + 50}`);
      } catch (scoreErr) {
        console.warn('[Stripe Webhook]: Failed to boost lead score:', scoreErr);
      }

      // 4. Trigger Email and pre-event drip sequences via Serverless Workflow trigger API
      try {
        const baseUrl = new URL(request.url).origin;
        await fetch(`${baseUrl}/api/workflow-trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'marketing_workflow',
            triggerType: 'event_registered',
            userData: {
              email: customerEmail,
              eventId: eventId,
              accessCode: accessCode,
              cartItems: cartItems
            }
          })
        });
      } catch (workflowErr) {
        console.warn('[Stripe Webhook]: Failed to dispatch event marketing trigger:', workflowErr);
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

        // Check if event registration
        if (session.metadata?.type === 'event_registration') {
          await handleEventFulfillment(session);
        } else {
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
        }
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