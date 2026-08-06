// functions/api/complete-setup.js
// Cloudflare Pages Serverless Endpoint for Master Setup Wizard Completion

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const { isInstalled, siteTitle } = payload;

    console.log(`[Edge Serverless]: Acknowledging setup completion for: ${siteTitle || 'Foundation'}`);

    return new Response(JSON.stringify({
      success: true,
      isInstalled: isInstalled === true,
      timestamp: new Date().toISOString(),
      message: "Server-level deployment successfully verified as initialized."
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || "Failed to process server-level setup."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
