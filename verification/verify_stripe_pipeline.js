// verification/verify_stripe_pipeline.js
import { onRequestPost as checkoutHandler } from '../functions/api/stripe-checkout.js';
import { onRequestPost as webhookHandler } from '../functions/api/stripe-webhook.js';
import { onRequestPost as proxyHandler } from '../functions/api/stripe-proxy.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== Stripe Payment Pipeline Verification Suite ===\n');

  // Test 1: Stripe Checkout Session Creation
  try {
    const mockEnv = { STRIPE_SECRET_KEY: 'sk_test_simulated123', STRIPE_PRICE_ID: 'price_test_456' };
    const request = new Request('https://example.com/api/stripe-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.1'
      },
      body: JSON.stringify({
        userEmail: 'subscriber@example.com',
        userId: 'uid_subscriber_001',
        mode: 'subscription',
        priceId: 'price_test_456',
        successUrl: 'https://example.com/account?session_id={CHECKOUT_SESSION_ID}&payment=success',
        cancelUrl: 'https://example.com/account?payment=cancelled'
      })
    });

    // Mock global fetch for api.stripe.com
    const originalFetch = globalThis.fetch;
    let stripeFetchUrl = '';
    let stripeFetchBody = '';

    globalThis.fetch = async (url, options) => {
      stripeFetchUrl = url.toString();
      stripeFetchBody = options?.body?.toString() || '';
      return new Response(JSON.stringify({ id: 'cs_test_session_123', url: 'https://checkout.stripe.com/c/pay/cs_test_session_123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const response = await checkoutHandler({ request, env: mockEnv });
    const data = await response.json();

    assert(response.status === 200, 'Checkout endpoint returned 200 OK');
    assert(data.url && data.url.includes('cs_test_session_123'), 'Checkout URL returned correctly');
    assert(stripeFetchUrl === 'https://api.stripe.com/v1/checkout/sessions', 'Requested Stripe Checkout Sessions API');

    const params = new URLSearchParams(stripeFetchBody);
    assert(params.get('mode') === 'subscription', 'Payload contains mode=subscription');
    assert(params.get('payment_method_types[0]') === 'card', 'Payload contains payment_method_types[0]=card');
    assert(params.get('line_items[0][price]') === 'price_test_456', 'Payload contains correct line_items price');
    assert(params.get('customer_email') === 'subscriber@example.com', 'Payload contains customer_email');
    assert(params.get('metadata[userUid]') === 'uid_subscriber_001', 'Payload contains metadata[userUid]');
    assert(params.get('success_url').includes('payment=success'), 'Payload contains success_url');
    assert(params.get('cancel_url').includes('payment=cancelled'), 'Payload contains cancel_url');

    globalThis.fetch = originalFetch;
  } catch (err) {
    assert(false, 'Checkout session creation test threw exception: ' + err.message);
  }

  // Test 2: Unconfigured Stripe Secret Key Handling in Checkout
  try {
    const mockEnv = {}; // missing STRIPE_SECRET_KEY
    const request = new Request('https://example.com/api/stripe-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.2'
      },
      body: JSON.stringify({ userEmail: 'user@example.com' })
    });

    const response = await checkoutHandler({ request, env: mockEnv });
    const data = await response.json();

    assert(response.status === 400, 'Unconfigured Stripe key returns status 400');
    assert(data.error && data.error.includes('Stripe Secret Key is not configured'), 'Returns clear user-facing error message');
  } catch (err) {
    assert(false, 'Unconfigured key checkout test threw exception: ' + err.message);
  }

  // Test 3: Stripe Webhook Signature Verification & Role Elevation
  try {
    const secret = 'whsec_test_secret_123';
    const timestamp = Math.floor(Date.now() / 1000);
    const eventPayload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_completed_789',
          customer_email: 'user_upgrade@example.com',
          customer: 'cus_789',
          subscription: 'sub_789',
          amount_total: 2900,
          metadata: { role: 'member', userUid: 'uid_999' }
        }
      }
    });

    // Compute valid HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${eventPayload}`));
    const actualSig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
    const signatureHeader = `t=${timestamp},v1=${actualSig}`;

    const mockEnv = {
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: secret,
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_API_KEY: 'test-api-key'
    };

    let patchedFirestoreUrl = '';
    let patchedFirestoreBody = {};

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      const u = url.toString();
      if (u.includes('firestore.googleapis.com')) {
        patchedFirestoreUrl = u;
        patchedFirestoreBody = JSON.parse(options.body);
        return new Response(JSON.stringify({ name: 'updated' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const request = new Request('https://example.com/api/stripe-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signatureHeader
      },
      body: eventPayload
    });

    const response = await webhookHandler({ request, env: mockEnv });
    const data = await response.json();

    assert(response.status === 200 && data.received === true, 'Webhook verified signature and accepted event');
    assert(patchedFirestoreUrl.includes('users/user_upgrade_example_com'), 'Updated user document in Firestore');
    assert(patchedFirestoreBody.fields?.role?.stringValue === 'member', 'Auto-elevated user role to member');
    assert(patchedFirestoreBody.fields?.paymentStatus?.stringValue === 'Active', 'Set paymentStatus to Active');
    assert(patchedFirestoreBody.fields?.isAdmin?.stringValue === 'false', 'Set isAdmin accordingly');

    globalThis.fetch = originalFetch;
  } catch (err) {
    assert(false, 'Webhook test threw exception: ' + err.message);
  }

  // Test 4: Webhook Event - Invoice Payment Failed
  try {
    const eventPayload = JSON.stringify({
      type: 'invoice.payment_failed',
      data: {
        object: {
          customer_email: 'user_failed@example.com'
        }
      }
    });

    const mockEnv = {
      STRIPE_SECRET_KEY: 'sk_test_123',
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_API_KEY: 'test-api-key'
    };

    let patchedFirestoreBody = {};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('firestore.googleapis.com')) {
        patchedFirestoreBody = JSON.parse(options.body);
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const request = new Request('https://example.com/api/stripe-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: eventPayload
    });

    const response = await webhookHandler({ request, env: mockEnv });
    assert(response.status === 200, 'invoice.payment_failed handled with 200 OK');
    assert(patchedFirestoreBody.fields?.paymentStatus?.stringValue === 'past_due', 'Marked paymentStatus as past_due without revoking access');

    globalThis.fetch = originalFetch;
  } catch (err) {
    assert(false, 'Payment failed webhook test threw exception: ' + err.message);
  }

  // Test 5: Webhook Event - Customer Subscription Deleted
  try {
    const eventPayload = JSON.stringify({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          metadata: { email: 'user_canceled@example.com' }
        }
      }
    });

    const mockEnv = {
      STRIPE_SECRET_KEY: 'sk_test_123',
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_API_KEY: 'test-api-key'
    };

    let patchedFirestoreBody = {};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('firestore.googleapis.com')) {
        patchedFirestoreBody = JSON.parse(options.body);
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const request = new Request('https://example.com/api/stripe-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: eventPayload
    });

    const response = await webhookHandler({ request, env: mockEnv });
    assert(response.status === 200, 'customer.subscription.deleted handled with 200 OK');
    assert(patchedFirestoreBody.fields?.role?.stringValue === 'subscriber', 'Downgraded user role back to subscriber');
    assert(patchedFirestoreBody.fields?.paymentStatus?.stringValue === 'canceled', 'Marked paymentStatus as canceled');

    globalThis.fetch = originalFetch;
  } catch (err) {
    assert(false, 'Subscription deleted webhook test threw exception: ' + err.message);
  }

  // Test 6: Admin Stripe Connection Test Button Handler (/api/stripe-proxy action: test_connection)
  try {
    const mockEnv = { STRIPE_SECRET_KEY: 'sk_test_simulated_key' };
    const request = new Request('https://example.com/api/stripe-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_admin_admin@example.com'
      },
      body: JSON.stringify({
        action: 'test_connection',
        secretKey: 'sk_test_simulated_key'
      })
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (url.toString().includes('api.stripe.com/v1/balance')) {
        return new Response(JSON.stringify({ object: 'balance', available: [{ amount: 1000, currency: 'usd' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const response = await proxyHandler({ request, env: mockEnv });
    const data = await response.json();

    assert(response.status === 200 && data.verified === true, 'Test connection endpoint returned success verified');

    globalThis.fetch = originalFetch;
  } catch (err) {
    assert(false, 'Stripe connection test endpoint threw exception: ' + err.message);
  }

  // Test 7: Admin Stripe Connection Test - Invalid Key
  try {
    const mockEnv = { STRIPE_SECRET_KEY: 'sk_test_simulated_key' };
    const request = new Request('https://example.com/api/stripe-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_admin_admin@example.com'
      },
      body: JSON.stringify({
        action: 'test_connection',
        secretKey: 'invalid'
      })
    });

    const response = await proxyHandler({ request, env: mockEnv });
    const data = await response.json();

    assert(response.status === 400, 'Invalid key returns 400 Bad Request');
    assert(data.error === 'Invalid Stripe API Key', 'Returns exact Invalid Stripe API Key error string');
  } catch (err) {
    assert(false, 'Invalid key test threw exception: ' + err.message);
  }

  // Test 8: Security - Prevent Privilege Escalation via Checkout Role & Webhook Metadata
  try {
    // 8a: Checkout payload requesting role: "admin"
    const mockEnv = { STRIPE_SECRET_KEY: 'sk_test_simulated123', STRIPE_PRICE_ID: 'price_test_456' };
    const checkoutRequest = new Request('https://example.com/api/stripe-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '10.0.0.8'
      },
      body: JSON.stringify({
        userEmail: 'attacker@example.com',
        role: 'admin',
        metadata: { role: 'admin' }
      })
    });

    const originalFetch = globalThis.fetch;
    let stripeFetchBody = '';

    globalThis.fetch = async (url, options) => {
      stripeFetchBody = options?.body?.toString() || '';
      return new Response(JSON.stringify({ id: 'cs_test_admin_attempt', url: 'https://checkout.stripe.com/c/pay/cs_test_admin_attempt' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    await checkoutHandler({ request: checkoutRequest, env: mockEnv });
    const params = new URLSearchParams(stripeFetchBody);
    assert(params.get('metadata[role]') === 'member', 'Checkout payload sanitized role: "admin" to "member"');

    // 8b: Webhook payload containing metadata[role] = "admin"
    const webhookPayload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_attacker_789',
          customer_email: 'attacker@example.com',
          amount_total: 2900,
          metadata: { role: 'admin' }
        }
      }
    });

    const webhookEnv = {
      STRIPE_SECRET_KEY: 'sk_test_123',
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_API_KEY: 'test-api-key'
    };

    let patchedFirestoreBody = {};
    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('firestore.googleapis.com')) {
        patchedFirestoreBody = JSON.parse(options.body);
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const webhookRequest = new Request('https://example.com/api/stripe-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: webhookPayload
    });

    await webhookHandler({ request: webhookRequest, env: webhookEnv });
    assert(patchedFirestoreBody.fields?.role?.stringValue === 'member', 'Webhook sanitized assignedRole "admin" to "member"');
    assert(patchedFirestoreBody.fields?.isAdmin?.stringValue === 'false', 'Webhook set isAdmin to "false" regardless of metadata');

    globalThis.fetch = originalFetch;
  } catch (err) {
    assert(false, 'Privilege escalation prevention test threw exception: ' + err.message);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
