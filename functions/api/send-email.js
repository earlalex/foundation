// functions/api/send-email.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const { to, subject, html, text, fromName, fromEmail } = await request.json();

  const senderEmail = fromEmail || env.ADMIN_EMAIL || `noreply@${new URL(request.url).hostname}`;
  const senderName = fromName || env.SITE_TITLE || 'Foundation System';

  const mailchannelsPayload = {
    personalizations: [
      { to: [{ email: to }] }
    ],
    from: { email: senderEmail, name: senderName },
    subject: subject,
    content: [
      { type: 'text/html', value: html || `<p>${text || ''}</p>` }
    ]
  };

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mailchannelsPayload)
    });

    if (response.ok) {
      return new Response(JSON.stringify({ success: true, provider: 'MailChannels' }), { status: 200 });
    } else {
      throw new Error(await response.text());
    }
  } catch (err) {
    console.warn('[send-email Worker]: MailChannels API failed. Attempting failover to Google Workspace/Gmail API...', err);
    // Failover to Google Workspace / Gmail API if configured
    if (env.GOOGLE_SERVICE_ACCOUNT_TOKEN) {
      const gmailSuccess = await sendViaGmailApi(env.GOOGLE_SERVICE_ACCOUNT_TOKEN, to, subject, html || text);
      if (gmailSuccess) {
        return new Response(JSON.stringify({ success: true, provider: 'Google Workspace Fallback' }), { status: 200 });
      }
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

async function sendViaGmailApi(token, to, subject, bodyContent) {
  try {
    const isHtml = bodyContent.trim().startsWith('<') || bodyContent.trim().toLowerCase().includes('<html>') || bodyContent.trim().toLowerCase().includes('<div') || bodyContent.trim().toLowerCase().includes('<p>');
    const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';

    const rawEmail = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${contentType}`,
      '',
      bodyContent
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedEmail })
    });
    return res.ok;
  } catch (err) {
    console.error('[Gmail Fallback Error]:', err);
    return false;
  }
}
