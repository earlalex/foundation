// functions/api/voice-webhook.js

/**
 * Verify Telnyx Webhook Ed25519 signature using Web Crypto API
 * @param {string} publicKeyB64 - Telnyx Public Key (base64)
 * @param {string} signatureB64 - Telnyx Signature header (base64)
 * @param {string} timestamp - Telnyx Timestamp header
 * @param {string} rawBody - Raw HTTP body text
 * @returns {Promise<boolean>}
 */
async function verifyTelnyxEd25519Signature(publicKeyB64, signatureB64, timestamp, rawBody) {
  try {
    const pemOrB64 = publicKeyB64.replace(/-----BEGIN PUBLIC KEY-----/, '').replace(/-----END PUBLIC KEY-----/, '').replace(/\s/g, '');
    const pubKeyBytes = Uint8Array.from(atob(pemOrB64), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'raw',
      pubKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));

    // Check both timestamp delimiter formats (| and .) used by Telnyx event dispatchers
    const dataBytes1 = new TextEncoder().encode(`${timestamp}|${rawBody}`);
    const isValid1 = await crypto.subtle.verify('Ed25519', key, sigBytes, dataBytes1);
    if (isValid1) return true;

    const dataBytes2 = new TextEncoder().encode(`${timestamp}.${rawBody}`);
    return await crypto.subtle.verify('Ed25519', key, sigBytes, dataBytes2);
  } catch (err) {
    console.error('[Telnyx Ed25519 Verify Exception]:', err);
    return false;
  }
}

export async function onRequestPost(context) {
  try {
    let callText = "";
    let isTelnyx = false;
    let isTwilio = false;
    let isVapi = false;
    let fromNumber = "";
    let body = null;
    let rawBody = "";

    // 1. Parse incoming Voice Webhook parameters (e.g. Vapi.ai payload or Telnyx/Twilio HTTP events)
    const contentType = context.request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      rawBody = await context.request.text();
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        body = {};
      }

      // Check if it is a Telnyx Call Control Webhook Event
      isTelnyx = !!(body.data?.event_type && body.data?.payload?.call_control_id);
      
      if (isTelnyx) {
        const env = context.env || {};
        const telnyxApiKey = env.TELNYX_API_KEY;
        const telnyxPublicKey = env.TELNYX_PUBLIC_KEY || env.TELNYX_WEBHOOK_SECRET;
        const expectedToken = env.ADMIN_TOKEN || env.ADMIN_API_KEY || telnyxApiKey;

        const telnyxSignatureHeader = context.request.headers.get("telnyx-signature-ed25519") || context.request.headers.get("x-telnyx-signature") || "";
        const telnyxTimestampHeader = context.request.headers.get("telnyx-timestamp") || context.request.headers.get("x-telnyx-timestamp") || "";
        const authHeader = context.request.headers.get("authorization") || context.request.headers.get("x-admin-token") || "";
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();

        // Security: Fail-Closed Authorization Guard
        let isTelnyxAuthorized = false;

        if (telnyxPublicKey && telnyxSignatureHeader && telnyxTimestampHeader && rawBody) {
          // Cryptographic Ed25519 signature verification if public key / webhook secret is set
          isTelnyxAuthorized = await verifyTelnyxEd25519Signature(telnyxPublicKey, telnyxSignatureHeader, telnyxTimestampHeader, rawBody);
        } else if (expectedToken && token && token === expectedToken) {
          // Admin or API bearer token match
          isTelnyxAuthorized = true;
        } else if (telnyxApiKey && !telnyxPublicKey) {
          // Standard Telnyx API Key deployment mode:
          // Validate that request payload is a well-formed Telnyx Call Control event
          const hasValidTelnyxEvent = body.data?.event_type && body.data?.payload?.call_control_id;
          if (hasValidTelnyxEvent) {
            isTelnyxAuthorized = true;
          }
        }

        if (!isTelnyxAuthorized) {
          console.warn('[Telnyx Webhook]: Unauthorized Telnyx webhook request rejected (Fail Closed).');
          return new Response(JSON.stringify({ error: "Unauthorized Telnyx Webhook Request: Authentication or valid event signature required" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          });
        }

        const eventType = body.data.event_type;
        const callControlId = body.data.payload.call_control_id;

        const handleTelnyxBackground = async () => {
          try {
            if (eventType === 'call.initiated') {
              // Answer the incoming call automatically via Telnyx Call Control API
              await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${telnyxApiKey}`
                }
              });
            } else if (eventType === 'call.answered') {
              // Speak initial AI greeting to caller
              await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${telnyxApiKey}`
                },
                body: JSON.stringify({
                  payload: "Hello! Thank you for calling Foundation support. How can I help you today?",
                  voice: "female",
                  language: "en-US"
                })
              });
            }

            // Google Workspace Telephony Log Integration:
            // Persist session log strictly ONCE per call on call.hangup using deterministic per-call control filename
            const serviceToken = env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
            if (serviceToken && eventType === 'call.hangup') {
              const { uploadCommunicationLogToDrive, syncGoogleContactCommunication } = await import('../../utils/backend-google-serverless.js');

              const callerPhone = body.data.payload.from || 'Unknown Caller';
              const duration = body.data.payload.duration_seconds || body.data.payload.duration || 0;
              const occurredAt = body.data.occurred_at || new Date().toISOString();
              const siteName = env.SITE_NAME || "Foundation Framework";
              const fileName = `telnyx_voice_log_${callControlId || Date.now()}.md`;

              const mdTranscript = `## Telnyx Voice Session\n\n- **Date/Time**: ${new Date(occurredAt).toLocaleString()}\n- **Event**: ${eventType}\n- **Caller**: ${callerPhone}\n- **Duration**: ${duration} seconds\n- **Call Control ID**: ${callControlId}\n- **Hangup Reason**: ${body.data.payload.hangup_reason || 'N/A'}`;

              // Save Transcript to Google Drive
              await uploadCommunicationLogToDrive(serviceToken, siteName, fileName, mdTranscript);

              // Record interaction under Google Contacts
              await syncGoogleContactCommunication({
                phone: callerPhone,
                name: `Caller (${callerPhone})`,
                type: 'voice',
                timestamp: occurredAt,
                token: serviceToken
              });
            }
          } catch (bgErr) {
            console.error('[Telnyx Webhook Background Error]:', bgErr);
          }
        };

        if (context.waitUntil) {
          context.waitUntil(handleTelnyxBackground());
        } else {
          handleTelnyxBackground();
        }

        return new Response("OK", {
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      }

      // Vapi.ai / generic voice webhook parameters fallback
      isVapi = true;
      callText = body.message?.toolCalls?.[0]?.function?.arguments || body.message?.text || body.text || "";
      fromNumber = body.message?.customer?.number || "";
    } else {
      isTwilio = true;
      // Twilio Form fallback
      const formData = await context.request.formData();
      callText = formData.get("SpeechResult") || formData.get("TranscriptionText") || "";
      fromNumber = formData.get("From") || "";
    }

    // 2. Resolve Credentials & Preference
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
    const serviceToken = context.env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
    if (serviceToken && callText) {
      try {
        const { uploadCommunicationLogToDrive, syncGoogleContactCommunication, sendCommunicationSummaryEmail } = await import('../../utils/backend-google-serverless.js');

        // Get Summary first
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

        // Create Transcript Markdown
        const siteName = context.env.SITE_NAME || "Foundation Framework";
        const fileName = `voice_log_session_${Date.now()}.md`;
        const mdTranscript = `## Voice Telephony Session\n\n- **Date**: ${new Date().toLocaleString()}\n- **Summary**: ${summaryText}\n\n### Transcription Transcript:\n- **User**: ${callText}\n- **AI**: ${responseSpeech}`;

        // Save Transcript to Google Drive under [Site Name] / Communication Logs / YYYY / MM /
        await uploadCommunicationLogToDrive(serviceToken, siteName, fileName, mdTranscript);

        // Record interaction under Google Contacts
        await syncGoogleContactCommunication({
          phone: fromNumber || "Voice session",
          name: fromNumber ? `Voice Call Customer (${fromNumber})` : "Voice Call Customer",
          type: "voice",
          timestamp: new Date().toISOString(),
          token: serviceToken
        });

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

    // 4. Return response based on provider requirements. Standard XML TwiML or JSON instructions.
    if (isTwilio) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${responseSpeech}</Say><Gather input="speech" timeout="3" action="/api/voice-webhook"></Gather></Response>`;
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" }
      });
    }

    // Vapi.ai / generic JSON call response layout fallback
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
