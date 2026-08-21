// functions/api/stripe-product-create.js
// Cloudflare Pages Serverless Endpoint for Secure Stripe Product/Price Creation

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
      // 2. Decode JWT Bearer token and verify caller role against Firestore
      let userEmail = '';
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          userEmail = payload.email || '';
        }
      } catch (_) {}

      const firebaseProjectId = env.FIREBASE_PROJECT_ID;
      const firestoreApiKey = env.FIREBASE_API_KEY;

      if (userEmail && firebaseProjectId && firestoreApiKey) {
        try {
          const docId = userEmail.replace(/[@.]/g, '_');
          const userRes = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/users/${docId}?key=${firestoreApiKey}`);
          if (userRes.ok) {
            const userData = await userRes.json();
            const role = userData.fields?.role?.stringValue || '';
            if (role === 'admin' || role === 'editor') {
              isAuthorized = true;
            }
          }
        } catch (dbErr) {
          console.error('[Stripe Product Create] Auth DB check failed:', dbErr);
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
