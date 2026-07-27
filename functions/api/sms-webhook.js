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
      return new Response(JSON.stringify({ error: "No user message found in incoming SMS payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const openAiKey = context.env.OPENAI_API_KEY;
    if (!openAiKey) {
      return new Response("Missing OPENAI_API_KEY environment binding.", { status: 500 });
    }

    // 2. Query GPT-4o-mini to get response
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a customer helper replying via SMS. Keep replies very brief, friendly and helpful, strictly within 160 characters." },
          { role: "user", content: userMsg }
        ],
        temperature: 0.7
      })
    });

    if (!openAiResponse.ok) {
      throw new Error(`OpenAI API failed: ${await openAiResponse.text()}`);
    }

    const aiData = await openAiResponse.json();
    const replyText = aiData.choices?.[0]?.message?.content || "Thanks for your message.";

    // 3. Dispatch SMS response back
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

    // 4. Perform Google Workspace Integrations dynamically using context helper credentials
    // Note: We use environmental GOOGLE_SERVICE_ACCOUNT_TOKEN or secure OAuth configurations when available.
    const serviceToken = context.env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
    if (serviceToken) {
      try {
        const { uploadCommunicationLogToDrive, syncGoogleContactCommunication, sendCommunicationSummaryEmail } = await import('../../utils/backend-google.js');

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

        // Query GPT-4o-mini to get a brief 1-sentence summary of the conversation
        let summaryText = "SMS support conversation thread completed.";
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
        console.warn('[SMS Webhook]: Google Workspace background logging failed:', wsErr.message);
      }
    }

    // 5. Return XML or JSON success depending on provider
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
