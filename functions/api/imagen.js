// functions/api/imagen.js

export async function onRequestPost(context) {
  try {
    const { prompt, aspectRatio = '1:1', numberOfImages = 1 } = await context.request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Resolve API Key from context.env
    const apiKey = context.env.GEMINI_API_KEY || context.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
      console.warn("[Imagen API]: Missing GEMINI_API_KEY / GOOGLE_GENAI_API_KEY in Cloudflare Workers environment. Using Unsplash Fallback.");
      return new Response(JSON.stringify({
        success: true,
        fallback: true,
        images: [
          {
            url: getUnsplashFallbackUrl(prompt, aspectRatio)
          }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let base64 = null;
    let mimeType = 'image/jpeg';

    // 1. Try standard :predict REST API ( Vertex AI specification format on generativelanguage.googleapis.com )
    try {
      const predictUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
      const predictBody = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: numberOfImages,
          aspectRatio: aspectRatio,
          outputMimeType: 'image/jpeg'
        }
      };

      const resp = await fetch(predictUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictBody)
      });

      if (resp.ok) {
        const result = await resp.json();
        if (result.predictions && result.predictions[0]) {
          base64 = result.predictions[0].bytesBase64Encoded;
          if (result.predictions[0].mimeType) {
            mimeType = result.predictions[0].mimeType;
          }
        }
      } else {
        const errText = await resp.text();
        console.warn(`[Imagen API]: predict style failed (Status: ${resp.status}). Body:`, errText);
      }
    } catch (err) {
      console.warn("[Imagen API]: predict style request exception:", err.message);
    }

    // 2. Try :generateImages REST API if first try did not yield an image
    if (!base64) {
      try {
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`;
        const generateBody = {
          prompt,
          numberOfImages: numberOfImages,
          aspectRatio: aspectRatio,
          outputMimeType: 'image/jpeg'
        };

        const resp = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(generateBody)
        });

        if (resp.ok) {
          const result = await resp.json();
          if (result.generatedImages && result.generatedImages[0]) {
            base64 = result.generatedImages[0].image.imageBytes;
          }
        } else {
          const errText = await resp.text();
          console.warn(`[Imagen API]: generateImages style failed (Status: ${resp.status}). Body:`, errText);
        }
      } catch (err) {
        console.warn("[Imagen API]: generateImages style request exception:", err.message);
      }
    }

    // If both failed (quota exceeded, bad key, etc.), return graceful fallback
    if (!base64) {
      console.warn("[Imagen API]: Both predict and generateImages API calls failed. Returning Unsplash Fallback.");
      return new Response(JSON.stringify({
        success: true,
        fallback: true,
        images: [
          {
            url: getUnsplashFallbackUrl(prompt, aspectRatio)
          }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      images: [
        {
          base64: base64,
          url: `data:${mimeType};base64,${base64}`
        }
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("[Imagen API Error]:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate a dynamic Unsplash fallback URL based on prompt keywords and aspect ratio
 */
function getUnsplashFallbackUrl(prompt, aspectRatio) {
  const query = encodeURIComponent(prompt.substring(0, 50).replace(/[^a-zA-Z0-9 ]/g, ''));
  if (aspectRatio === '1:1') {
    return `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80&sig=${Math.floor(Math.random() * 1000)}`;
  } else if (aspectRatio === '16:9') {
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80&sig=${Math.floor(Math.random() * 1000)}`;
  } else {
    return `https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80&sig=${Math.floor(Math.random() * 1000)}`;
  }
}
