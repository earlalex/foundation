// functions/api/adsense.js

const mockPlacements = {
  "home-top": { slot: "1111111111", format: "auto", style: "display:block;" },
  "blog-sidebar": { slot: "2222222222", format: "rectangle", style: "display:inline-block;width:300px;height:250px;" },
  "article-mid": { slot: "3333333333", format: "horizontal", style: "display:block;text-align:center;" },
  "article-end": { slot: "4444444444", format: "auto", style: "display:block;" }
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const publisherId = url.searchParams.get("publisherId") || context.env.ADSENSE_PUBLISHER_ID || "ca-pub-1234567890123456";

    // Validate Publisher ID
    const isValid = /^ca-pub-\d{16}$/.test(publisherId);

    // Mock telemetry metrics
    const telemetry = {
      impressions: 12450,
      clicks: 342,
      ctr: 2.75, // %
      estimatedEarnings: 84.50, // USD
      currency: "USD"
    };

    return new Response(JSON.stringify({
      success: true,
      publisherId,
      isValid,
      adsTxtDeclaration: `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`,
      placements: mockPlacements,
      telemetry: telemetry
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    console.error("[AdSense Proxy]: Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
