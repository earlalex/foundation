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

    const geminiKey = context.env.GEMINI_API_KEY;
    const openAiKey = context.env.OPENAI_API_KEY;

    if (!geminiKey && !openAiKey) {
      return new Response("Missing API key environment bindings (GEMINI_API_KEY or OPENAI_API_KEY).", { status: 500 });
    }

    // Default initial support greeting response if no voice transcription exists yet
    let responseSpeech = "Hello! Thanks for calling. We are analyzing your request. How can I help you today?";
    const voiceSystemPrompt = "You are a customer voice assistant replying over a telephone. Keep answers extremely short, friendly, and conversational.";

    if (callText) {
      // 2. Query dynamic AI Engine (Gemini with OpenAI fallback)
      if (geminiKey) {
        // Query Google AI Studio Gemini API
        const modelName = context.env.GEMINI_VOICE_MODEL || "gemini-2.5-flash";
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: callText }]
            }],
            systemInstruction: {
              parts: [{ text: voiceSystemPrompt }]
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          responseSpeech = data.candidates?.[0]?.content?.parts?.[0]?.text || responseSpeech;
        } else {
          // Fallback to gemini-2.5-flash-lite
          const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`;
          const fallbackRes = await fetch(fallbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{ text: callText }]
              }],
              systemInstruction: {
                parts: [{ text: voiceSystemPrompt }]
              }
            })
          });

          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            responseSpeech = data.candidates?.[0]?.content?.parts?.[0]?.text || responseSpeech;
          }
        }
      } else if (openAiKey) {
        // Query GPT-4o-mini
        const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: voiceSystemPrompt },
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
    }

    // 3. Perform Google Workspace Integrations dynamically using context helper credentials
    const serviceToken = context.env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
    if (serviceToken && callText) {
      try {
        const { uploadCommunicationLogToDrive, syncGoogleContactCommunication, sendCommunicationSummaryEmail } = await import('../../utils/backend-google.js');

        // Create Transcript Markdown
        const siteName = "Foundation Framework";
        const fileName = `voice_log_session_${Date.now()}.md`;
        const mdTranscript = `## Voice Telephony Session\n\n- **Date**: ${new Date().toLocaleString()}\n\n### Transcription Transcript:\n- **User**: ${callText}\n- **AI**: ${responseSpeech}`;

        // Save Transcript to Google Drive
        await uploadCommunicationLogToDrive(serviceToken, siteName, fileName, mdTranscript);

        // Record interaction under Google Contacts
        await syncGoogleContactCommunication({
          phone: "Voice session",
          name: "Voice Call Customer",
          type: "voice",
          timestamp: new Date().toISOString(),
          token: serviceToken
        });

        // Query Gemini/OpenAI to get a brief 1-sentence summary of the conversation
        let summaryText = "Voice support conversation session completed.";
        if (geminiKey) {
          const summaryResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [{ text: `Summarize this 1-turn voice call in exactly 1 brief sentence:\nUser said: ${callText}\nAI answered: ${responseSpeech}` }]
              }]
            })
          });
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            summaryText = summaryData.candidates?.[0]?.content?.parts?.[0]?.text || summaryText;
          }
        } else if (openAiKey) {
          const summaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: "Summarize this 1-turn interaction in exactly 1 brief sentence." },
                { role: "user", content: `User said: ${callText}\nAI answered: ${responseSpeech}` }
              ]
            })
          });
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            summaryText = summaryData.choices?.[0]?.message?.content || summaryText;
          }
        }

        // Email summary dispatch via Gmail
        const adminEmail = context.env.ADMIN_EMAIL || "admin@foundation.dev";
        await sendCommunicationSummaryEmail({
          toEmail: adminEmail,
          summary: summaryText,
          duration: "Voice call connection interaction",
          query: callText,
          response: responseSpeech,
          token: serviceToken
        });

      } catch (wsErr) {
        console.warn('[Voice Webhook]: Google Workspace background logging failed:', wsErr.message);
      }
    }

    // 4. Return response based on provider requirements. Standard XML TwiML/TeXML or JSON instructions.
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
