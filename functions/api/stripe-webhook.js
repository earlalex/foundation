// functions/api/stripe-webhook.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
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

    // Helper to update user document directly via Firestore REST API at the Edge
    async function updateFirestoreUser(userEmail, patchPayload) {
      if (!firebaseProjectId || !userEmail) return;
      const docId = userEmail.replace(/[@.]/g, '_');
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${docId}?key=${firestoreApiKey}`;

      const fields = {};
      for (const [key, value] of Object.entries(patchPayload)) {
        fields[key] = { stringValue: String(value) };
      }

      await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
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
    }

    // Handle Webhook Events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const assignedRole = session.metadata?.role || 'member';

        // 1. Update Firestore Profile
        await updateFirestoreUser(customerEmail, {
          role: assignedRole,
          paymentStatus: 'Active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
        });
        console.log(`[Stripe Webhook]: Upgraded ${customerEmail} to ${assignedRole}`);

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
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}