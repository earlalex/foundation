// functions/api/stripe-checkout.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error('[Stripe Checkout]: Stripe API key not configured');
    return new Response(JSON.stringify({ error: 'Stripe API key unconfigured' }), { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      email,
      role,
      action,
      productId,
      amount,
      currency,
      enableAch,
      priceId,
      mode,
      affiliateId,
      successUrl
    } = body;

    const domain = new URL(request.url).origin;

    if (action === 'portal') {
      // Create Customer Portal Link
      try {
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
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error('[Stripe Checkout]: Portal session creation failed:', errorData);
          return new Response(JSON.stringify({ error: errorData.error?.message || 'Failed to create portal session' }), { status: res.status });
        }
        
        const session = await res.json();
        return new Response(JSON.stringify({ url: session.url }), { status: 200 });
      } catch (portalErr) {
        console.error('[Stripe Checkout]: Portal request error:', portalErr);
        return new Response(JSON.stringify({ error: 'Portal request failed' }), { status: 500 });
      }
    }

    // Determine Mode & Line Items
    const params = new URLSearchParams();
    const finalMode = mode || (enableAch || productId ? 'payment' : 'subscription');
    params.append('mode', finalMode);

    if (email) {
      params.append('customer_email', email);
    }

    // Process lineItems array if passed from dynamic cart
    if (body.lineItems && Array.isArray(body.lineItems) && body.lineItems.length > 0) {
      body.lineItems.forEach((item, index) => {
        if (item.priceId) {
          params.append(`line_items[${index}][price]`, item.priceId);
          params.append(`line_items[${index}][quantity]`, String(item.quantity || 1));
        } else {
          params.append(`line_items[${index}][price_data][unit_amount]`, String(Math.round(item.amount)));
          params.append(`line_items[${index}][price_data][currency]`, (item.currency || 'USD').toLowerCase());
          params.append(`line_items[${index}][price_data][product_data][name]`, item.name || 'Event Item');
          params.append(`line_items[${index}][quantity]`, String(item.quantity || 1));
        }
      });
    } else if (priceId) {
      params.append('line_items[0][price]', priceId);
      params.append('line_items[0][quantity]', '1');
    } else if (amount) {
      params.append('line_items[0][price_data][unit_amount]', String(amount));
      params.append('line_items[0][price_data][currency]', (currency || 'USD').toLowerCase());
      params.append('line_items[0][price_data][product_data][name]', productId || 'Product Purchase');
      params.append('line_items[0][quantity]', '1');
    } else {
      // Default: Create Checkout Session for membership price
      const fallbackPriceId = env.STRIPE_MEMBERSHIP_PRICE_ID || 'price_1234567890';
      params.append('line_items[0][price]', fallbackPriceId);
      params.append('line_items[0][quantity]', '1');
    }

    const finalSuccessUrl = successUrl || `${domain}/home?session_id={CHECKOUT_SESSION_ID}`;
    params.append('success_url', finalSuccessUrl);
    params.append('cancel_url', `${domain}/contact`);

    // Add Metadata
    params.append('metadata[role]', role || 'member');
    if (productId) {
      params.append('metadata[productId]', productId);
    }
    if (enableAch) {
      params.append('metadata[enableAch]', 'true');
    }
    if (affiliateId) {
      params.append('metadata[affiliateId]', affiliateId);
    }
    if (body.metadata && typeof body.metadata === 'object') {
      for (const [mKey, mVal] of Object.entries(body.metadata)) {
        params.append(`metadata[${mKey}]`, String(mVal));
      }
    }

    // Handle ACH Direct Debit Payment option
    if (enableAch) {
      params.append('payment_method_types[0]', 'us_bank_account');

      // Charge a flat platform application fee parameter using Stripe Connect's application_fee_amount
      if (finalMode === 'payment') {
        params.append('payment_intent_data[application_fee_amount]', '500'); // $5.00 platform fee in cents

        // Define destination connected account to pass remaining customer payment net of standard fees
        const connectedAccountId = env.STRIPE_CONNECTED_ACCOUNT_ID || 'acct_1234567890';
        params.append('payment_intent_data[transfer_data][destination]', connectedAccountId);
      }
    } else {
      // Fallback to card if ACH is not requested/enabled
      params.append('payment_method_types[0]', 'card');
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Stripe Checkout]: Session creation failed:', errorData);
      return new Response(JSON.stringify({ error: errorData.error?.message || 'Failed to create checkout session' }), { status: res.status });
    }

    const session = await res.json();

    if (session.error) {
      console.error('[Stripe Checkout Error]:', session.error);
      return new Response(JSON.stringify({ error: session.error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (err) {
    console.error('[Stripe Endpoint Exception]:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500 });
  }
}
