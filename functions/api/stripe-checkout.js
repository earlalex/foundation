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
      customerEmail,
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
      cancelUrl,
      items,
      lineItems: requestLineItems
    } = body;

    const domain = new URL(request.url).origin;

    if (action === 'portal') {
      // Create Customer Portal Link
      try {
        const params = new URLSearchParams();
        const targetEmail = customerEmail || userEmail || email;
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

    const targetEmail = customerEmail || userEmail || email;
    if (targetEmail) {
      params.append('customer_email', targetEmail);
    }

    // Process items or lineItems payload from request (prioritize requestLineItems which includes calculated tax/fees)
    const rawItems = (Array.isArray(requestLineItems) && requestLineItems.length > 0)
      ? requestLineItems
      : (Array.isArray(items) && items.length > 0)
        ? items
        : null;

    if (rawItems) {
      // Optional Catalog Lookup for Server-Side Price Verification against Firestore
      const firebaseProjectId = env.FIREBASE_PROJECT_ID;
      const firestoreApiKey = env.FIRESTORE_API_KEY;
      let catalogEventsMap = {};

      if (firebaseProjectId && firestoreApiKey) {
        try {
          const eventsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/events?key=${firestoreApiKey}&pageSize=100`);
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            if (eventsData.documents) {
              eventsData.documents.forEach(doc => {
                const docId = doc.name.split('/').pop();
                const fields = doc.fields || {};
                catalogEventsMap[docId] = fields;
              });
            }
          }
        } catch (catErr) {
          console.warn('[Stripe Checkout]: Catalog price verification query failed, continuing with request price validation:', catErr);
        }
      }

      rawItems.forEach((item, index) => {
        const itemPriceId = item.stripePriceId || item.priceId || null;
        const itemQty = String(item.quantity || 1);

        if (itemPriceId) {
          params.append(`line_items[${index}][price]`, itemPriceId);
          params.append(`line_items[${index}][quantity]`, itemQty);
        } else {
          let calculatedPrice = item.price !== undefined ? Number(item.price) : (item.amount ? Number(item.amount) / 100 : 0);

          // If catalog data exists for event item, verify server price
          if (item.eventId && catalogEventsMap[item.eventId]) {
            const evtFields = catalogEventsMap[item.eventId];
            const tickets = evtFields.ticketTypes?.arrayValue?.values || [];
            const vendors = evtFields.vendorPackages?.arrayValue?.values || [];
            const sponsors = evtFields.sponsorshipPackages?.arrayValue?.values || [];

            let foundCatalogPrice = null;
            const searchArray = (arr) => {
              for (const v of arr) {
                const m = v.mapValue?.fields || {};
                const name = m.name?.stringValue || m.tier?.stringValue || '';
                const id = m.id?.stringValue || '';
                if ((id && id === item.id) || (name && item.name && name.toLowerCase() === item.name.toLowerCase())) {
                  const p = m.price?.doubleValue ?? m.price?.integerValue ?? m.price?.stringValue;
                  if (p !== undefined) return Number(p);
                }
              }
              return null;
            };

            foundCatalogPrice = searchArray(tickets) ?? searchArray(vendors) ?? searchArray(sponsors);
            if (foundCatalogPrice !== null && !isNaN(foundCatalogPrice) && foundCatalogPrice > 0) {
              // Strictly enforce catalog price if submitted price is lower than server record
              if (calculatedPrice < foundCatalogPrice) {
                console.warn(`[Stripe Checkout]: Submitted price ($${calculatedPrice}) is lower than catalog price ($${foundCatalogPrice}) for item ${item.name}. Overriding with catalog price.`);
                calculatedPrice = foundCatalogPrice;
              }
            }
          }

          let unitAmountCents = item.price !== undefined
            ? Math.round(calculatedPrice * 100)
            : Math.round(Number(item.amount) || 0);

          // Prevent negative or zero unit amounts unless explicitly free
          if (isNaN(unitAmountCents) || unitAmountCents < 0) {
            unitAmountCents = 0;
          }

          const itemCurrency = (item.currency || currency || 'USD').toLowerCase();
          const itemName = item.name || productId || 'Purchased Item';

          params.append(`line_items[${index}][price_data][unit_amount]`, String(unitAmountCents));
          params.append(`line_items[${index}][price_data][currency]`, itemCurrency);
          params.append(`line_items[${index}][price_data][product_data][name]`, itemName);
          params.append(`line_items[${index}][quantity]`, itemQty);
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
      const fallbackPriceId = env.STRIPE_PRICE_ID || env.STRIPE_MEMBERSHIP_PRICE_ID;
      if (fallbackPriceId) {
        params.append('line_items[0][price]', fallbackPriceId);
        params.append('line_items[0][quantity]', '1');
      } else {
        // Default inline subscription pricing: 2700 ($27.00/mo in cents)
        params.append('line_items[0][price_data][unit_amount]', '2700');
        params.append('line_items[0][price_data][currency]', 'usd');
        params.append('line_items[0][price_data][product_data][name]', 'Platform Monthly Membership');
        params.append('line_items[0][price_data][recurring][interval]', 'month');
        params.append('line_items[0][quantity]', '1');
      }
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
