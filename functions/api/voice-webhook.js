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

    // 2. Resolve Credentials & Preference
    // Unified Environment Variable Law: strictly read GEMINI_API_KEY and OPENAI_API_KEY
    const geminiKey = context.env.GEMINI_API_KEY;
    const openAiKey = context.env.OPENAI_API_KEY;
    const preferredProvider = context.env.PREFERRED_PROVIDER || (geminiKey ? "gemini" : "openai");

    if (!geminiKey && !openAiKey) {
      console.error('[Voice Webhook]: No AI credentials configured');
      return new Response("Missing API key environment bindings (GEMINI_API_KEY or OPENAI_API_KEY).", { status: 500 });
    }

    // Default initial support greeting response if no voice transcription exists yet
    let responseSpeech = "Hello! Thanks for calling. We are analyzing your request. How can I help you today?";
    const voiceSystemPrompt = "You are a customer voice assistant replying over a telephone. Keep answers extremely short, friendly, and conversational.";

    // --- Helper function to query Google Gemini ---
    const queryGemini = async (key, promptText) => {
      const modelName = context.env.GEMINI_VOICE_MODEL || "gemini-2.5-flash";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: promptText }]
          }],
          systemInstruction: {
            parts: [{ text: voiceSystemPrompt }]
          }
        })
      });

      if (!response.ok) {
        console.warn('[Voice Webhook]: Primary Gemini model failed, trying fallback');
        // Fallback to gemini-2.5-flash-lite
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: promptText }]
            }],
            systemInstruction: {
              parts: [{ text: voiceSystemPrompt }]
            }
          })
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
        const errorText = await response.text();
        console.error('[Voice Webhook]: Gemini fallback also failed:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    };

    // --- Helper function to query OpenAI ---
    const queryOpenAI = async (key, promptText) => {
      const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: voiceSystemPrompt },
            { role: "user", content: promptText }
          ],
          temperature: 0.6
        })
      });

      if (!openAiResponse.ok) {
        const errorText = await openAiResponse.text();
        console.error('[Voice Webhook]: OpenAI API call failed:', errorText);
        throw new Error(errorText);
      }

      const aiData = await openAiResponse.json();
      return aiData.choices?.[0]?.message?.content || "";
    };

    if (callText) {
      if (preferredProvider === "gemini" && geminiKey) {
        try {
          responseSpeech = await queryGemini(geminiKey, callText);
        } catch (err) {
          console.error('[Voice Webhook]: Gemini failed, trying OpenAI:', err);
          if (openAiKey) {
            try {
              responseSpeech = await queryOpenAI(openAiKey, callText);
            } catch (e) {
              console.error('[Voice Webhook]: OpenAI fallback also failed:', e);
            }
          }
        }
      } else if (openAiKey) {
        try {
          responseSpeech = await queryOpenAI(openAiKey, callText);
        } catch (err) {
          console.error('[Voice Webhook]: OpenAI failed, trying Gemini:', err);
          if (geminiKey) {
            try {
              responseSpeech = await queryGemini(geminiKey, callText);
            } catch (e) {
              console.error('[Voice Webhook]: Gemini fallback also failed:', e);
            }
          }
        }
      } else if (geminiKey) {
        try {
          responseSpeech = await queryGemini(geminiKey, callText);
        } catch (e) {
          console.error('[Voice Webhook]: Gemini call failed:', e);
        }
      }
    }

    // 3. Perform Google Workspace Integrations dynamically using context helper credentials
    // Unified Environment Variable Law: strictly read GOOGLE_SERVICE_ACCOUNT_TOKEN
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

        // Get Summary
        let summaryText = "Voice support conversation session completed.";
        try {
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
        } catch (e) {}

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
        console.error('[Voice Webhook]: Google Workspace background logging failed:', wsErr);
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
    console.error('[Voice Webhook]: Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
