export async function onRequest(context) {
  const publisherId = context.env.ADSENSE_PUBLISHER_ID || "ca-pub-1234567890123456";
  const content = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`;
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
