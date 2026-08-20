// functions/api/stripe-checkout.js

// Simple Edge-friendly In-Memory Rate Limiter to defend against Denial-of-Wallet attacks
const ipCache = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LIMIT = 20; // 20 requests per minute

function checkRateLimit(ip) {
  const now = Date.now();
  if (!ipCache.has(ip)) {
    ipCache.set(ip, []);
  }
  const timestamps = ipCache.get(ip);
  const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);
  if (validTimestamps.length >= MAX_LIMIT) {
    return false;
  }
  validTimestamps.push(now);
  ipCache.set(ip, validTimestamps);
  return true;
}

export async function onRequestPost(context) {
  const ip = context.request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a minute." }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { request, env } = context;
  // Unified Environment Variable Law: strictly read STRIPE_SECRET_KEY
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error('[Stripe Checkout]: Stripe API key not configured');
    return new Response(JSON.stringify({ error: 'Stripe Secret Key is not configured. Please enter your Stripe API key in Admin Settings.' }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const {
      email,
      userEmail,
      userId,
      userUid,
      role,
      action,
      productId,
      amount,
      currency,
      enableAch,
      priceId,
      mode,
      affiliateId,
      successUrl,
      cancelUrl
    } = body;

    const domain = new URL(request.url).origin;

    if (action === 'verify') {
      const targetSessionId = body.sessionId;
      if (!targetSessionId) {
        return new Response(JSON.stringify({ paid: false, error: 'Session ID is required' }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${targetSessionId}?expand[]=line_items&expand[]=line_items.data.price.product`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`
          }
        });

        if (res.ok) {
          const sessionData = await res.json();
          const isPaid = sessionData.payment_status === 'paid';
          const sessionCustomerEmail = (sessionData.customer_details?.email || sessionData.customer_email || '').toLowerCase().trim();

          const requestingUserEmail = (userEmail || email || '').toLowerCase().trim();
          if (!requestingUserEmail) {
            return new Response(JSON.stringify({ paid: false, error: 'Authentication required: Caller email parameter is required to verify session' }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (sessionCustomerEmail && requestingUserEmail !== sessionCustomerEmail) {
            return new Response(JSON.stringify({ paid: false, error: 'Unauthorized: Session customer email does not match caller' }), {
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }

          let lineItems = [];
          if (sessionData.line_items?.data && Array.isArray(sessionData.line_items.data)) {
            lineItems = sessionData.line_items.data.map(li => {
              const productMeta = typeof li.price?.product === 'object' ? li.price.product?.metadata : null;
              const appItemId = productMeta?.appItemId;
              const unitPrice = (li.price?.unit_amount || 0) / 100;
              const pricePaid = (li.amount_total || 0) / 100 / (li.quantity || 1);
              return {
                id: appItemId || (typeof li.price?.product === 'string' ? li.price.product : li.price?.product?.id) || li.id,
                name: li.description || 'Purchased Item',
                type: 'product',
                price: unitPrice,
                pricePaid: pricePaid
              };
            });
          }

          return new Response(JSON.stringify({
            paid: isPaid,
            customerEmail: sessionCustomerEmail,
            lineItems
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        const errData = await res.json().catch(() => ({}));
        return new Response(JSON.stringify({ paid: false, error: errData.error?.message || 'Invalid or unconfirmed session' }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      } catch (verifyErr) {
        return new Response(JSON.stringify({ paid: false, error: 'Session verification failed: ' + verifyErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (action === 'portal') {
      // Create Customer Portal Link
      try {
        const params = new URLSearchParams();
        const targetEmail = userEmail || email;
        if (targetEmail) {
          params.append('customer', targetEmail);
        }
        params.append('return_url', `${domain}/account`);

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
          return new Response(JSON.stringify({ error: errorData.error?.message || 'Failed to create portal session' }), {
            status: res.status,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        const session = await res.json();
        return new Response(JSON.stringify({ url: session.url }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (portalErr) {
        console.error('[Stripe Checkout]: Portal request error:', portalErr);
        return new Response(JSON.stringify({ error: 'Portal request failed: ' + portalErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Determine Mode & Line Items for Checkout Session
    const params = new URLSearchParams();
    const finalMode = mode || (enableAch || productId ? 'payment' : 'subscription');
    params.append('mode', finalMode);

    const targetEmail = userEmail || email;
    if (targetEmail) {
      params.append('customer_email', targetEmail);
    }

    // Process lineItems array if passed from dynamic cart
    if (body.lineItems && Array.isArray(body.lineItems) && body.lineItems.length > 0) {
      body.lineItems.forEach((item, index) => {
        if (item.priceId) {
          params.append(`line_items[${index}][price]`, item.priceId);
          params.append(`line_items[${index}][quantity]`, String(item.quantity || 1));
        } else {
          // Handle ACH processing fee specially
          if (item.id === 'ach_processing_fee') {
            params.append(`line_items[${index}][price_data][unit_amount]`, '500');
            params.append(`line_items[${index}][price_data][currency]`, 'usd');
            params.append(`line_items[${index}][price_data][product_data][name]`, 'ACH Bank Processing Fee');
            params.append(`line_items[${index}][quantity]`, '1');
          } else {
            // TODO: Server should resolve catalog pricing by item.id here
            // For now, preserve existing behavior with client-provided amount
            params.append(`line_items[${index}][price_data][unit_amount]`, String(Math.round(item.amount || 0)));
            params.append(`line_items[${index}][price_data][currency]`, (item.currency || 'USD').toLowerCase());
            params.append(`line_items[${index}][price_data][product_data][name]`, item.name || 'Event Item');
            const itemId = item.id || item.productId;
            if (itemId) {
              params.append(`line_items[${index}][price_data][product_data][metadata][appItemId]`, String(itemId));
            }
            params.append(`line_items[${index}][quantity]`, String(item.quantity || 1));
          }
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
      const fallbackPriceId = env.STRIPE_PRICE_ID || env.STRIPE_MEMBERSHIP_PRICE_ID || 'price_1234567890';
      params.append('line_items[0][price]', fallbackPriceId);
      params.append('line_items[0][quantity]', '1');
    }

    const finalSuccessUrl = successUrl || `${domain}/account?session_id={CHECKOUT_SESSION_ID}&payment=success`;
    const finalCancelUrl = cancelUrl || `${domain}/account?payment=cancelled`;
    params.append('success_url', finalSuccessUrl);
    params.append('cancel_url', finalCancelUrl);


    // Add Metadata
    const uid = userId || userUid || '';
    if (uid) {
      params.append('metadata[userUid]', uid);
    }
    // Security: Sanitize role to prevent privilege escalation to admin/editor via checkout
    let requestedRole = String(role || 'member').toLowerCase();
    if (['admin', 'editor'].includes(requestedRole)) {
      requestedRole = 'member';
    }
    params.append('metadata[role]', requestedRole);
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
        if (mKey === 'role' && ['admin', 'editor'].includes(String(mVal).toLowerCase())) {
          continue; // Block privilege escalation attempts via custom metadata object
        }
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
      return new Response(JSON.stringify({ error: errorData.error?.message || 'Failed to create checkout session' }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const session = await res.json();

    if (session.error) {
      console.error('[Stripe Checkout Error]:', session.error);
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error('[Stripe Endpoint Exception]:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
