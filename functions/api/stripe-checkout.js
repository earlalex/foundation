// functions/api/stripe-checkout.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: 'Stripe API key unconfigured' }), { status: 500 });
  }

  try {
    const { email, role, action } = await request.json();
    const priceId = env.STRIPE_MEMBERSHIP_PRICE_ID || 'price_1234567890';
    const domain = new URL(request.url).origin;

    if (action === 'portal') {
      // Create Customer Portal Link
      const params = new URLSearchParams();
      params.append('customer', email);
      params.append('return_url', `${domain}/admin`);

      const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
      const session = await res.json();
      return new Response(JSON.stringify({ url: session.url }), { status: 200 });
    }

    // Default: Create Checkout Session
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('customer_email', email);
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${domain}/home?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${domain}/contact`);
    params.append('metadata[role]', role || 'member');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const session = await res.json();
    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}