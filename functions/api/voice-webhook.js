// functions/api/voice-webhook.js

export async function onRequestPost(context) {
  try {
    let callText = "";
    let provider = "unknown";

    // 1. Parse incoming Voice Webhook parameters (e.g. Vapi.ai payload or Telnyx/Twilio HTTP events)
    const contentType = context.request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await context.request.json();
      provider = "json";
      // Vapi.ai / generic voice webhook parameters
      callText = body.message?.toolCalls?.[0]?.function?.arguments || body.message?.text || body.text || "";
    } else {
      provider = "form";
      const text = await context.request.text();
      const params = new URLSearchParams(text);
      // Twilio / Telnyx voice events standard field
      callText = params.get("SpeechResult") || params.get("TranscriptionText") || "";
    }

    const openAiKey = context.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return new Response("Missing OPENAI_API_KEY environment binding.", { status: 500 });
    }

    // 2. Default initial support greeting response if no voice transcription exists yet
    let responseSpeech = "Hello! Thanks for calling. We are analyzing your request. How can I help you today?";

    if (callText) {
      // Query GPT-4o-mini to get dynamic support response for voice calls
      const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a customer voice assistant replying over a telephone. Keep answers extremely short, friendly, and conversational." },
            { role: "user", content: callText }
          ],
          temperature: 0.6
        })
      });

      if (openAiResponse.ok) {
        const aiData = await openAiResponse.json();
        responseSpeech = aiData.choices?.[0]?.message?.content || responseSpeech;
      }
    }

    // 3. Return response based on provider requirements. Standard XML TwiML/TeXML or JSON instructions.
    if (provider === "form") {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${responseSpeech}</Say><Gather input="speech" timeout="3" action="/api/voice-webhook"></Gather></Response>`;
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" }
      });
    }

    // Vapi.ai JSON call response layout
    return new Response(JSON.stringify({
      conversation: [
        { role: "assistant", content: responseSpeech }
      ],
      assistant: {
        model: {
          model: "gpt-4o-mini",
          systemPrompt: "You are a friendly customer voice assistant."
        }
      }
    }), {
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
