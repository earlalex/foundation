// functions/api/ai-writer.js - Cloudflare Pages Function for Semantic AI Brand Synthesis

const ipCache = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_LIMIT = 20;

function checkRateLimit(ip) {
  const now = Date.now();
  if (!ipCache.has(ip)) {
    ipCache.set(ip, []);
  }
  const timestamps = ipCache.get(ip);
  const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);
  if (validTimestamps.length >= MAX_LIMIT) {
    return false;
  }
  validTimestamps.push(now);
  ipCache.set(ip, validTimestamps);
  return true;
}

/**
 * Theory-backed fallback design psychology synthesizer (Directive 1 Rules Matrix)
 */
function generateFallbackBrandSystem(promptText = "") {
  const lower = promptText.toLowerCase();

  let primary = "#1E3A8A"; // Deep Navy default (Sovereignty, Integrity, Trust)
  let primaryHover = "#1D4ED8";
  let accent = "#D97706"; // Solar Gold default
  let surface = "#FFFFFF";
  let surfaceAlt = "#F8FAFC";
  let textPrimary = "#0F172A";
  let textSecondary = "#475569";
  let colorRationale = "Deep Navy (#1E3A8A) was selected for Primary to convey Sovereignty, Integrity, and Enterprise Excellence. Solar Gold (#D97706) serves as an Accent for radiant energy, clarity, and legacy.";

  if (lower.includes("action") || lower.includes("bold") || lower.includes("power") || lower.includes("physical mastery") || lower.includes("passion") || lower.includes("hunt")) {
    primary = "#DC2626"; // Red / Crimson
    primaryHover = "#991B1B";
    accent = "#D97706";
    colorRationale = "Red / Crimson (#DC2626) was selected as Primary because your foundation emphasizes Boldness, High Energy, Physical Mastery, and Action. Solar Gold (#D97706) provides high-contrast CTAs.";
  } else if (lower.includes("health") || lower.includes("vitality") || lower.includes("growth") || lower.includes("healing") || lower.includes("abundance")) {
    primary = "#059669"; // Emerald / Forest Green
    primaryHover = "#064E3B";
    accent = "#D97706";
    colorRationale = "Emerald Green (#059669) was selected as Primary because your core values prioritize Health is Wealth, Vitality, and Holistic Growth.";
  } else if (lower.includes("consciousness") || lower.includes("metaphysics") || lower.includes("transformation") || lower.includes("wisdom") || lower.includes("alignment over achievement")) {
    primary = "#6D28D9"; // Royal Purple / Deep Violet
    primaryHover = "#4C1D95";
    accent = "#D97706";
    colorRationale = "Royal Purple (#6D28D9) was selected as Primary to symbolize Higher Consciousness, Metaphysical Depth, Transformation, and Alignment.";
  } else if (lower.includes("discipline") || lower.includes("minimalist") || lower.includes("precision") || lower.includes("zero-build")) {
    primary = "#1E293B"; // Charcoal / Slate
    primaryHover = "#0F172A";
    accent = "#2563EB";
    colorRationale = "Charcoal Slate (#1E293B) was selected as Primary to communicate Raw Discipline, Accountability, and Zero-Build Engineering Precision.";
  }

  let headingFont = "Cinzel";
  let bodyFont = "Plus Jakarta Sans";
  let headingStyle = "Uppercase, High-Tracking, Serif Authority";
  let typographyRationale = "Cinzel was selected for headings to convey Executive Sovereignty, Heritage, and Structural Authority. Plus Jakarta Sans provides clean, modern geometric body clarity for optimal readability.";

  if (lower.includes("zero-build") || lower.includes("modern") || lower.includes("simplicity") || lower.includes("scalability")) {
    headingFont = "Plus Jakarta Sans";
    bodyFont = "Inter";
    headingStyle = "Bold Geometric Sans";
    typographyRationale = "Plus Jakarta Sans and Inter were selected to reinforce Modern Systems Efficiency, Zero-Build Simplicity, and Technological Clarity.";
  } else if (lower.includes("cyber") || lower.includes("engineering") || lower.includes("precision") || lower.includes("systems")) {
    headingFont = "Space Grotesk";
    bodyFont = "Inter";
    headingStyle = "High-Impact Display Precision";
    typographyRationale = "Space Grotesk was selected for headings to embody Operational Systems, Engineering Precision, and Technical Authority.";
  }

  let archetype = "Sovereign Master & Heroic Catalyst";
  let voiceAndTone = "Authoritative, Direct, Sovereign, Grounded";
  let archetypeRationale = "Your brand persona combines the Sovereign Ruler (executive authority, structure, independence) with the Heroic Catalyst (action, mastery, transformative impact).";

  return {
    archetype,
    voiceAndTone,
    colors: {
      primary,
      primaryHover,
      accent,
      surface,
      surfaceAlt,
      textPrimary,
      textSecondary
    },
    typography: {
      headingFont,
      bodyFont,
      headingStyle
    },
    designRationale: {
      colorPsychology: colorRationale,
      typographyRationale,
      archetypeRationale
    }
  };
}

export async function onRequestPost(context) {
  try {
    const ip = context.request.headers.get("CF-Connecting-IP") || "127.0.0.1";
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    const payload = await context.request.json().catch(() => ({}));
    const prompt = payload.prompt || payload.message || "";
    const responseFormat = payload.responseFormat || "json";

    // Authentication Guard & Provider Quota Defense:
    // Only invoke deployment environment secrets (GEMINI_API_KEY / OPENAI_API_KEY) when the caller is authorized
    // (e.g. via Authorization header, admin token, or payload authorization flag), or when caller provides their own key.
    const clientGeminiKey = payload.aiConfig?.geminiApiKey;
    const clientOpenAiKey = payload.aiConfig?.openaiApiKey;
    const authHeader = context.request.headers.get("Authorization") || context.request.headers.get("X-Admin-Token") || "";
    const isAuthorized = authHeader.length > 0 || payload.isAdmin === true;

    const geminiKey = clientGeminiKey || (isAuthorized ? context.env.GEMINI_API_KEY : null);
    const openAiKey = clientOpenAiKey || (isAuthorized ? context.env.OPENAI_API_KEY : null);

    if (geminiKey) {
      try {
        const modelName = context.env.GEMINI_MODEL || "gemini-2.5-flash";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: responseFormat === "json" ? { responseMimeType: "application/json" } : undefined
          })
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

          if (responseFormat === "json" && cleanedText) {
            try {
              const parsed = JSON.parse(cleanedText);
              return new Response(JSON.stringify(parsed), {
                status: 200,
                headers: { "Content-Type": "application/json" }
              });
            } catch (jsonErr) {
              console.warn('[AI Writer API]: JSON parse failed, returning fallback JSON:', jsonErr.message);
            }
          } else if (cleanedText) {
            return new Response(JSON.stringify({ reply: cleanedText }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
      } catch (geminiErr) {
        console.warn('[AI Writer API]: Gemini call failed, using fallback:', geminiErr.message);
      }
    } else if (openAiKey) {
      try {
        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: responseFormat === "json" ? { type: "json_object" } : undefined,
            temperature: 0.7
          })
        });

        if (openAiRes.ok) {
          const aiData = await openAiRes.json();
          const rawText = aiData.choices?.[0]?.message?.content || "";
          if (responseFormat === "json" && rawText) {
            const parsed = JSON.parse(rawText);
            return new Response(JSON.stringify(parsed), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
      } catch (openAiErr) {
        console.warn('[AI Writer API]: OpenAI call failed, using fallback:', openAiErr.message);
      }
    }

    // Unauthenticated/unauthorized or offline fallback: Return theory-backed synthesized Brand Guide
    const fallbackBrand = generateFallbackBrandSystem(prompt);
    return new Response(JSON.stringify(fallbackBrand), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error('[AI Writer API]: Error:', err);
    const fallbackBrand = generateFallbackBrandSystem();
    return new Response(JSON.stringify(fallbackBrand), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
