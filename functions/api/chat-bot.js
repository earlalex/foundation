// functions/api/chat-bot.js

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const { message, history = [], systemPromptOverride } = payload;

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message field" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const geminiKey = context.env.GEMINI_API_KEY;
    const openAiKey = context.env.OPENAI_API_KEY;

    if (!geminiKey && !openAiKey) {
      return new Response(JSON.stringify({ error: "No AI API keys (GEMINI_API_KEY or OPENAI_API_KEY) configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const systemPrompt = systemPromptOverride || "You are a helpful customer support agent.";

    // 1. Google AI Studio (Gemini API) Primary Engine Routing
    if (geminiKey) {
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
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

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
        // Fallback to gemini-2.5-flash-lite if model fails
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`;
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
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        const errText = await response.text();
        return new Response(JSON.stringify({ error: `Gemini API returned error: ${errText}` }), {
          status: response.status,
          headers: { "Content-Type": "application/json" }
        });
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. OpenAI GPT-4o-mini Fallback Engine Routing
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(msg => ({ role: msg.sender === "user" ? "user" : "assistant", content: msg.message })),
      { role: "user", content: message }
    ];

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7
      })
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      return new Response(JSON.stringify({ error: `OpenAI API returned error: ${errText}` }), {
        status: openAiResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const aiData = await openAiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ reply }), {
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
