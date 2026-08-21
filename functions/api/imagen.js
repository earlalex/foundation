// functions/api/imagen.js

// Simple in-memory rate limiting map for Cloudflare Worker isolate instance
const ipRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per IP per minute

export async function onRequestPost(context) {
  try {
    const clientIp = context.request.headers.get('cf-connecting-ip') ||
                     context.request.headers.get('x-forwarded-for') ||
                     'unknown-client';

    // 1. Enforce simple rate limiting per client IP with map pruning & size bounding
    const now = Date.now();

    // Periodically prune expired entries to prevent memory leak in worker isolate
    if (ipRateLimitMap.size > 50) {
      for (const [ip, record] of ipRateLimitMap.entries()) {
        if (now > record.resetTime) {
          ipRateLimitMap.delete(ip);
        }
      }
    }
    // Hard bound map capacity
    if (ipRateLimitMap.size > 1000) {
      ipRateLimitMap.clear();
    }

    const clientUsage = ipRateLimitMap.get(clientIp) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    if (now > clientUsage.resetTime) {
      clientUsage.count = 0;
      clientUsage.resetTime = now + RATE_LIMIT_WINDOW_MS;
    }
    clientUsage.count += 1;
    ipRateLimitMap.set(clientIp, clientUsage);

    if (clientUsage.count > MAX_REQUESTS_PER_WINDOW) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute before making more image generation requests.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
      });
    }

    const { prompt, aspectRatio = '1:1', numberOfImages = 1 } = await context.request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Strictly clamp numberOfImages to prevent quota exhaustion attacks
    const sanitizedCount = Math.min(Math.max(1, parseInt(numberOfImages, 10) || 1), 4);

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
          sampleCount: sanitizedCount,
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
          numberOfImages: sanitizedCount,
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

    // Try to upload the generated image bytes to durable Google Drive storage if token is present
    let durableUrl = `data:${mimeType};base64,${base64}`;
    const serviceToken = context.env.GOOGLE_SERVICE_ACCOUNT_TOKEN || context.env.GOOGLE_ACCESS_TOKEN;

    if (serviceToken) {
      try {
        const uploadedFile = await uploadImageBytesToDrive(serviceToken, context.env.SITE_NAME || 'Foundation Framework', base64, mimeType);
        if (uploadedFile && uploadedFile.id) {
          durableUrl = `https://lh3.googleusercontent.com/d/${uploadedFile.id}`;
        } else if (uploadedFile && uploadedFile.webViewLink) {
          durableUrl = uploadedFile.webViewLink;
        }
      } catch (uploadErr) {
        console.warn("[Imagen API]: Failed to upload generated image to Drive storage, using data URL fallback:", uploadErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      images: [
        {
          url: durableUrl
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
 * Uploads generated base64 image bytes to Google Drive asset storage
 */
async function uploadImageBytesToDrive(token, siteName, base64Data, mimeType) {
  try {
    // Convert base64 to Uint8Array
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 1. Search or create Root siteName folder
    let folderId = null;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(siteName)}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: siteName, mimeType: 'application/vnd.google-apps.folder' })
      });
      const folderData = await createRes.json();
      folderId = folderData.id;
    }

    // 2. Search or create "Media Assets" subfolder
    let assetsFolderId = null;
    const assetsSearchUrl = `https://www.googleapis.com/drive/v3/files?q=name='Media Assets' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const assetsRes = await fetch(assetsSearchUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const assetsData = await assetsRes.json();

    if (assetsData.files && assetsData.files.length > 0) {
      assetsFolderId = assetsData.files[0].id;
    } else {
      const createAssetsRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Media Assets', mimeType: 'application/vnd.google-apps.folder', parents: [folderId] })
      });
      const assetsFolderData = await createAssetsRes.json();
      assetsFolderId = assetsFolderData.id;
    }

    // 3. Upload image file
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `generated_${Date.now()}.${ext}`;
    const metadata = { name: fileName, mimeType: mimeType, parents: [assetsFolderId] };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([bytes], { type: mimeType }));

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const fileData = await uploadRes.json();

    // 4. Make file publicly readable for CDN serving
    if (fileData.id) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      }).catch(() => {});
    }

    return fileData;
  } catch (err) {
    console.warn('[Drive Image Upload Error]:', err.message);
    return null;
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
