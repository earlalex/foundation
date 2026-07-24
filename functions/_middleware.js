// functions/_middleware.js

export async function onRequest(context) {
  const response = await context.next();

  // Attach CORS and security headers for Cloudflare Edge execution
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}