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

    // 3. Perform Google Workspace Integrations dynamically using context helper credentials
    // Note: We use environmental GOOGLE_SERVICE_ACCOUNT_TOKEN or secure OAuth configurations when available.
    const serviceToken = context.env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
    const fromPhone = "Voice Call"; // Placeholder, can be parsed from incoming headers/parameters when available
    if (serviceToken && callText) {
      try {
        const { uploadCommunicationLogToDrive, syncGoogleContactCommunication, sendCommunicationSummaryEmail } = await import('../../utils/backend-google.js');

        // Create Transcript Markdown
        const siteName = "Foundation Framework";
        const fileName = `voice_log_session_${Date.now()}.md`;
        const mdTranscript = `## Voice Telephony Session\n\n- **Date**: ${new Date().toLocaleString()}\n\n### Transcription Transcript:\n- **User**: ${callText}\n- **AI**: ${responseSpeech}`;

        // Save Transcript to Google Drive
        await uploadCommunicationLogToDrive(serviceToken, siteName, fileName, mdTranscript);

        // Record interaction under Google Contacts if a phone was present
        await syncGoogleContactCommunication({
          phone: "Voice session",
          name: "Voice Call Customer",
          type: "voice",
          timestamp: new Date().toISOString(),
          token: serviceToken
        });

        // Query GPT-4o-mini to get a brief 1-sentence summary of the conversation
        let summaryText = "Voice support conversation session completed.";
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
