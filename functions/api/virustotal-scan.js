// functions/api/virustotal-scan.js
export async function onRequestPost(context) {
  try {
    const { domain } = await context.request.json();
    
    // Read secret VirusTotal API key securely from Cloudflare Environment Variables
    const vtApiKey = context.env.VIRUSTOTAL_API_KEY;

    if (!vtApiKey) {
      return new Response(JSON.stringify({ 
        error: "VIRUSTOTAL_API_KEY is not configured in Cloudflare Pages Environment Variables." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const response = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      method: 'GET',
      headers: {
        'x-apikey': vtApiKey
      }
    });

    const data = await response.json();

    return new Response(JSON.stringify({
      success: true,
      domain: domain,
      results: data
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}