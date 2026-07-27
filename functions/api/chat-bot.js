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

    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured in Cloudflare Pages." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const systemPrompt = systemPromptOverride || "You are a helpful customer support agent.";

    // Assemble messages payload
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(msg => ({ role: msg.sender === "user" ? "user" : "assistant", content: msg.message })),
      { role: "user", content: message }
    ];

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
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
