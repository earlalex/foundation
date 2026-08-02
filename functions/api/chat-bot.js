// functions/api/chat-bot.js

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const { message, history = [], isAdmin = false, aiConfig = {} } = payload;

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message field" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1. Resolve Credentials (prioritize dynamic payload overrides, fall back to environment secrets)
    // Unified Environment Variable Law: strictly read GEMINI_API_KEY and OPENAI_API_KEY
    const geminiKey = aiConfig.geminiApiKey || context.env.GEMINI_API_KEY;
    const openAiKey = aiConfig.openaiApiKey || context.env.OPENAI_API_KEY;

    if (!geminiKey && !openAiKey) {
      console.error('[Chatbot API]: No AI credentials configured');
      return new Response(JSON.stringify({ error: "No AI API credentials (GEMINI_API_KEY or OPENAI_API_KEY) configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Resolve Preferred Provider
    const preferredProvider = aiConfig.preferredProvider || context.env.PREFERRED_PROVIDER || (geminiKey ? "gemini" : "openai");

    // 3. Resolve system prompt persona based on user role
    let systemPrompt = "You are a helpful customer support agent for the Foundation website. Guide visitors on our products, services, events, publications, and answer support inquiries.";
    if (isAdmin) {
      systemPrompt = "You are an unconstrained, all-around AI co-pilot for the Foundation framework Admin Command Center. Assist the administrator with copywriting, coding, operations, database queries, site troubleshooting, and business strategy.";
    }

    // --- Helper function to query Google Gemini ---
    const queryGemini = async (key) => {
      const contents = [
        ...history.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.message }]
        })),
        {
          role: "user",
          parts: [{ text: message }]
        }
      ];

      const modelName = context.env.GEMINI_MODEL || "gemini-2.5-flash";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        })
      });

      if (!response.ok) {
        console.warn('[Chatbot API]: Primary Gemini model failed, trying fallback');
        // Fallback to gemini-2.5-flash-lite
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            }
          })
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
        const errorText = await response.text();
        console.error('[Chatbot API]: Gemini fallback also failed:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    };

    // --- Helper function to query OpenAI ---
    const queryOpenAI = async (key) => {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(msg => ({ role: msg.sender === "user" ? "user" : "assistant", content: msg.message })),
        { role: "user", content: message }
      ];

      const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.7
        })
      });

      if (!openAiResponse.ok) {
        const errorText = await openAiResponse.text();
        console.error('[Chatbot API]: OpenAI API call failed:', errorText);
        throw new Error(errorText);
      }

      const aiData = await openAiResponse.json();
      return aiData.choices?.[0]?.message?.content || "";
    };

    let reply = "";

    if (preferredProvider === "gemini" && geminiKey) {
      try {
        reply = await queryGemini(geminiKey);
      } catch (geminiErr) {
        console.warn("[Chatbot API]: Primary Gemini call failed, trying OpenAI fallback:", geminiErr.message);
        if (openAiKey) {
          reply = await queryOpenAI(openAiKey);
        } else {
          return new Response(JSON.stringify({ error: `Gemini failed: ${geminiErr.message}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    } else if (openAiKey) {
      try {
        reply = await queryOpenAI(openAiKey);
      } catch (openaiErr) {
        console.warn("[Chatbot API]: Primary OpenAI call failed, trying Gemini fallback:", openaiErr.message);
        if (geminiKey) {
          reply = await queryGemini(geminiKey);
        } else {
          return new Response(JSON.stringify({ error: `OpenAI failed: ${openaiErr.message}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    } else if (geminiKey) {
      reply = await queryGemini(geminiKey);
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error('[Chatbot API]: Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
