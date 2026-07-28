// functions/api/virustotal-scan.js
export async function onRequestPost(context) {
  try {
    const contentType = context.request.headers.get("content-type") || "";
    let hashHex = null;
    let domain = null;

    if (contentType.includes("application/json")) {
      const body = await context.request.json();
      if (body.hash) {
        hashHex = body.hash;
      } else if (body.domain) {
        domain = body.domain;
      }
    } else {
      // Direct binary payload
      const arrayBuffer = await context.request.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

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

    if (domain) {
      const response = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
        method: 'GET',
        headers: { 'x-apikey': vtApiKey }
      });
      const data = await response.json();
      return new Response(JSON.stringify({
        success: response.ok,
        domain: domain,
        results: data
      }), {
        status: response.ok ? 200 : response.status,
        headers: { "Content-Type": "application/json" }
      });
    } else if (hashHex) {
      const response = await fetch(`https://www.virustotal.com/api/v3/files/${hashHex}`, {
        method: 'GET',
        headers: { 'x-apikey': vtApiKey }
      });

      const status = response.status;
      const data = await response.json();

      if (status === 404) {
        return new Response(JSON.stringify({
          success: false,
          notFound: true,
          hash: hashHex,
          message: "File signature not found in VirusTotal database."
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (!response.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: data.error?.message || "Failed to query VirusTotal",
          hash: hashHex
        }), {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Extract last_analysis_results and highlight ClamAV
      const results = data.data?.attributes?.last_analysis_results || {};
      const stats = data.data?.attributes?.last_analysis_stats || {};
      const clamav = results.ClamAV || null;

      return new Response(JSON.stringify({
        success: true,
        hash: hashHex,
        stats: stats,
        clamav: clamav,
        results: results // include full breakdown
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid request payload. Must provide domain, hash, or binary payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
