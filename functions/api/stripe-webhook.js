// functions/api/stripe-webhook.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY binding missing' }), { status: 500 });
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

    // Handle Subscription Events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_email || session.details?.email;
        const assignedRole = session.metadata?.role || 'member';

        await updateFirestoreUser(customerEmail, {
          role: assignedRole,
          paymentStatus: 'Active',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
        });
        console.log(`[Stripe Webhook]: Upgraded ${customerEmail} to ${assignedRole}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerEmail = invoice.customer_email;

        // AUTOMATIC CONVERSION: Late dues downgrade account to Subscriber
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

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
}