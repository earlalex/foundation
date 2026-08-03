// functions/api/sms-webhook.js

export async function onRequestPost(context) {
  try {
    let fromNumber = "";
    let userMsg = "";
    let provider = "unknown";

    // 1. Parse incoming payload safely. Supports Telnyx Messaging and Twilio Webhooks format.
    const contentType = context.request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await context.request.json();
      // Telnyx Messaging v2 format
      if (body.data && body.data.payload) {
        provider = "telnyx";
        fromNumber = body.data.payload.from?.phone_number || "";
        userMsg = body.data.payload.text || "";
      } else {
        // Generic json payload / Twilio optional JSON body
        provider = "twilio-json";
        fromNumber = body.From || body.from || "";
        userMsg = body.Body || body.message || "";
      }
    } else {
      // Form url-encoded (Standard Twilio Webhook default format)
      provider = "twilio-form";
      const text = await context.request.text();
      const params = new URLSearchParams(text);
      fromNumber = params.get("From") || "";
      userMsg = params.get("Body") || "";
    }

    if (!userMsg) {
      console.error('[SMS Webhook]: No user message found in payload');
      return new Response(JSON.stringify({ error: "No user message found in incoming SMS payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Resolve Credentials (prioritize environment secrets, or fallback to default values)
    // Unified Environment Variable Law: strictly read GEMINI_API_KEY and OPENAI_API_KEY
    const geminiKey = context.env.GEMINI_API_KEY;
    const openAiKey = context.env.OPENAI_API_KEY;
    const preferredProvider = context.env.PREFERRED_PROVIDER || (geminiKey ? "gemini" : "openai");

    if (!geminiKey && !openAiKey) {
      console.error('[SMS Webhook]: No AI credentials configured');
      return new Response("Missing API key environment bindings (GEMINI_API_KEY or OPENAI_API_KEY).", { status: 500 });
    }

    let replyText = "Thanks for your message.";
    const smsSystemPrompt = "You are a customer helper replying via SMS. Keep replies very brief, friendly and helpful, strictly within 160 characters.";

    // --- Helper function to query Google Gemini ---
    const queryGemini = async (key) => {
      const modelName = context.env.GEMINI_SMS_MODEL || "gemini-2.5-flash-lite"; // Preferred flash-lite for SMS latency
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: userMsg }]
          }],
          systemInstruction: {
            parts: [{ text: smsSystemPrompt }]
          }
        })
      });

      if (!response.ok) {
        console.warn('[SMS Webhook]: Primary Gemini model failed, trying fallback');
        // Fallback to gemini-2.5-flash-lite explicitly
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: userMsg }]
            }],
            systemInstruction: {
              parts: [{ text: smsSystemPrompt }]
            }
          })
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
        const errorText = await response.text();
        console.error('[SMS Webhook]: Gemini fallback also failed:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    };

    // --- Helper function to query OpenAI ---
    const queryOpenAI = async (key) => {
      const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: smsSystemPrompt },
            { role: "user", content: userMsg }
          ],
          temperature: 0.7
        })
      });

      if (!openAiResponse.ok) {
        const errorText = await openAiResponse.text();
        console.error('[SMS Webhook]: OpenAI API call failed:', errorText);
        throw new Error(errorText);
      }

      const aiData = await openAiResponse.json();
      return aiData.choices?.[0]?.message?.content || "";
    };

    // 3. Dispatch queries based on preferences
    if (preferredProvider === "gemini" && geminiKey) {
      try {
        replyText = await queryGemini(geminiKey);
      } catch (geminiErr) {
        console.error('[SMS Webhook]: Primary Gemini call failed, trying OpenAI fallback:', geminiErr);
        if (openAiKey) {
          try {
            replyText = await queryOpenAI(openAiKey);
          } catch (err) {
            console.error('[SMS Webhook]: OpenAI fallback also failed:', err);
          }
        }
      }
    } else if (openAiKey) {
      try {
        replyText = await queryOpenAI(openAiKey);
      } catch (openaiErr) {
        console.error('[SMS Webhook]: Primary OpenAI call failed, trying Gemini fallback:', openaiErr);
        if (geminiKey) {
          try {
            replyText = await queryGemini(geminiKey);
          } catch (err) {
            console.error('[SMS Webhook]: Gemini fallback also failed:', err);
          }
        }
      }
    } else if (geminiKey) {
      try {
        replyText = await queryGemini(geminiKey);
      } catch (err) {
        console.error('[SMS Webhook]: Gemini call failed:', err);
      }
    }

    // 4. Dispatch SMS response back
    const telnyxKey = context.env.TELNYX_API_KEY;
    const telnyxFrom = context.env.TELNYX_PHONE_NUMBER;

    const twilioSid = context.env.TWILIO_ACCOUNT_SID;
    const twilioToken = context.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = context.env.TWILIO_PHONE_NUMBER;

    if (telnyxKey && telnyxFrom && provider === "telnyx") {
      // Send Telnyx Messaging reply back
      await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${telnyxKey}`
        },
        body: JSON.stringify({
          from: telnyxFrom,
          to: fromNumber,
          text: replyText
        })
      });
    } else if (twilioSid && twilioToken && twilioFrom) {
      // Send Twilio Messaging reply back
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const basicAuth = btoa(`${twilioSid}:${twilioToken}`);

      const bodyParams = new URLSearchParams();
      bodyParams.set("From", twilioFrom);
      bodyParams.set("To", fromNumber);
      bodyParams.set("Body", replyText);

      await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: bodyParams
      });
    }

    // 5. Perform Google Workspace Integrations dynamically using context helper credentials
    // Unified Environment Variable Law: strictly read GOOGLE_SERVICE_ACCOUNT_TOKEN
    const serviceToken = context.env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
    if (serviceToken) {
      try {
        const { uploadCommunicationLogToDrive, syncGoogleContactCommunication, sendCommunicationSummaryEmail } = await import('../../utils/backend-google-serverless.js');

        // Create Transcript Markdown
        const siteName = "Foundation Framework";
        const fileName = `sms_log_${fromNumber.replace(/[+]/g, '') || 'unknown'}_${Date.now()}.md`;
        const mdTranscript = `## SMS Communication Thread\n\n- **From**: ${fromNumber}\n- **Date**: ${new Date().toLocaleString()}\n\n### Transcript:\n- **User**: ${userMsg}\n- **AI**: ${replyText}`;

        // Save Transcript to Google Drive
        await uploadCommunicationLogToDrive(serviceToken, siteName, fileName, mdTranscript);

        // Record interaction under Google Contacts
        await syncGoogleContactCommunication({
          phone: fromNumber,
          name: `SMS User (${fromNumber})`,
          type: "sms",
          timestamp: new Date().toISOString(),
          token: serviceToken
        });

        // Get Summary
        let summaryText = "SMS support conversation thread completed.";
        try {
          if (geminiKey) {
            const summaryResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [{ text: `Summarize this 1-turn interaction in exactly 1 brief sentence:\nUser said: ${userMsg}\nAI answered: ${replyText}` }]
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
                  { role: "user", content: `User said: ${userMsg}\nAI answered: ${replyText}` }
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
          duration: "1 Message exchange",
          query: userMsg,
          response: replyText,
          token: serviceToken
        });

      } catch (wsErr) {
        console.error('[SMS Webhook]: Google Workspace background logging failed:', wsErr);
      }
    }

    // 6. Return XML or JSON success depending on provider
    if (provider.startsWith("twilio")) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyText}</Message></Response>`;
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" }
      });
    }

    return new Response(JSON.stringify({ success: true, replyText }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error('[SMS Webhook]: Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
