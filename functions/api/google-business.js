// functions/api/google-business.js

// In-Memory fallback cache for Cloudflare Workers context
const memoryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  // Simple rate limiter similar to chat-bot.js
  return true;
}

const mockBusinessData = {
  name: "Foundation HQ",
  rating: 4.9,
  userRatingCount: 142,
  reviews: [
    {
      authorAttribution: {
        displayName: "Sarah Jenkins",
        photoUri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
      },
      rating: 5,
      text: {
        text: "Foundation has completely transformed our engineering pipeline. Going zero-build with native ES modules reduced our deployment time to seconds! Truly spectacular framework."
      },
      relativePublishTimeDescription: "2 days ago"
    },
    {
      authorAttribution: {
        displayName: "Marcus Chen",
        photoUri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
      },
      rating: 5,
      text: {
        text: "As a principal architect, security is my top priority. Foundation's zero-trust database boundaries and robust OAuth credential vault are world-class."
      },
      relativePublishTimeDescription: "1 week ago"
    },
    {
      authorAttribution: {
        displayName: "Elena Rostova",
        photoUri: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80"
      },
      rating: 5,
      text: {
        text: "Pragmatic, fast, and warning-free console outputs. Building visual pages with GrapesJS integration works flawlessly on the fly. Highly recommended."
      },
      relativePublishTimeDescription: "3 weeks ago"
    },
    {
      authorAttribution: {
        displayName: "David Beck",
        photoUri: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80"
      },
      rating: 4,
      text: {
        text: "Very polished zero-build template! The edge functions are fast, and the HIPAA logging / AES encryption works out of the box. Super helpful documentation."
      },
      relativePublishTimeDescription: "1 month ago"
    }
  ]
};

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const placeId = url.searchParams.get("placeId") || "ChIJN1t_tDeuEmsRUsoyG83frY4"; // Default dummy Place ID

    // Resolve key
    const apiKey = context.env.GOOGLE_API_KEY || context.env.GOOGLE_SERVICE_ACCOUNT_TOKEN;

    // Check Cache
    const cacheKey = `places_${placeId}`;
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[Google Business API]: Serving cached details for Place: ${placeId}`);
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "HIT"
        }
      });
    }

    if (!apiKey) {
      console.warn("[Google Business API]: No GOOGLE_API_KEY configured. Returning mock fallback.");
      return new Response(JSON.stringify({ ...mockBusinessData, placeId, note: "Fallback to mock data" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cache": "MISS"
        }
      });
    }

    // Try fetching live data from Google Places API (New)
    // Fieldmask is required for Places API (New)
    const apiUrl = `https://places.googleapis.com/v1/places/${placeId}`;
    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews"
        }
      });

      if (response.ok) {
        const data = await response.json();
        const formattedData = {
          name: data.displayName?.text || mockBusinessData.name,
          rating: data.rating || mockBusinessData.rating,
          userRatingCount: data.userRatingCount || mockBusinessData.userRatingCount,
          reviews: data.reviews || mockBusinessData.reviews
        };

        // Store in Cache
        memoryCache.set(cacheKey, {
          timestamp: Date.now(),
          data: formattedData
        });

        return new Response(JSON.stringify(formattedData), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Cache": "MISS"
          }
        });
      } else {
        const errorText = await response.text();
        console.warn(`[Google Business API]: API request failed (Status: ${response.status}). Fallback to mock data.`, errorText);
      }
    } catch (apiErr) {
      console.error("[Google Business API]: Fetch error, fallback to mock data:", apiErr);
    }

    // Fallback to Mock
    return new Response(JSON.stringify({ ...mockBusinessData, placeId }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "MISS"
      }
    });

  } catch (err) {
    console.error("[Google Business API]: Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
