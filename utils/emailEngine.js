// utils/emailEngine.js
import { configManager } from '../core/config.js';
import { sendGmailNotification } from '../core/google-services.js';
import { store } from '../core/store.js';

/**
 * Core transactional email dispatch engine with automatic failover logic.
 * Primary: Serverless MailChannels or Google Workspace / Gmail API depending on config.
 * Failover: Secondary provider.
 */
export async function sendEmail({ to, subject, html, text, fromName, fromEmail }) {
  const emailCfg = configManager.current.email || {};
  const defaultFrom = emailCfg.defaultFromEmail || 'noreply@yourdomain.com';
  const primaryProvider = emailCfg.primaryProvider || 'MailChannels (Free Cloudflare)';

  const currentUser = store.state?.user;
  const headers = {
    'Content-Type': 'application/json'
  };

  if (currentUser?.idToken) {
    headers['Authorization'] = `Bearer ${currentUser.idToken}`;
  } else if (configManager.current?.adminToken) {
    headers['X-Admin-Token'] = configManager.current.adminToken;
  }

  const payload = {
    to,
    subject,
    html: html || `<p>${text || ''}</p>`,
    text: text || '',
    fromName: fromName || configManager.current.siteTitle || 'Foundation System',
    fromEmail: fromEmail || defaultFrom,
    primaryProvider
  };

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, provider: result.provider || 'MailChannels' };
    } else {
      const errText = await response.text();
      throw new Error(errText || 'Failed to send via server worker endpoint');
    }
  } catch (err) {
    console.warn('[emailEngine]: MailChannels worker dispatch failed. Attempting client-side Google Gmail fallback...', err);
    try {
      // client-side fallback using google-services OAuth flow
      const success = await sendGmailNotification({
        toEmail: to,
        subject: subject,
        messageBody: text || html
      });
      if (success) {
        return { success: true, provider: 'Google Gmail (Client-side Fallback)' };
      } else {
        throw new Error('Gmail API fallback returned failure.');
      }
    } catch (fallbackErr) {
      console.error('[emailEngine]: All transactional email dispatch strategies failed:', fallbackErr);
      return { success: false, error: fallbackErr.message };
    }
  }
}

/**
 * Formats and dispatches a magic sign-in or password reset email.
 */
export async function sendMagicLinkEmail(to, name, link) {
  const subject = "🔑 Your Secure Magic Sign-In Link";
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 30px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color: var(--theme-color-primary, #2b6cb0); font-weight: 800; margin-top: 0; margin-bottom: 1rem;">Magic Sign-In Link</h2>
      <p style="color: #4a5568; font-size: 1rem; line-height: 1.6;">Hello ${name || 'there'},</p>
      <p style="color: #4a5568; font-size: 1rem; line-height: 1.6;">We received a request to log in to your account. Click the button below to sign in instantly:</p>
      <div style="text-align: center; margin: 35px 0;">
        <a href="${link}" style="background-color: var(--theme-color-primary, #2b6cb0); color: white; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 0.95rem; box-shadow: 0 4px 6px rgba(43, 108, 176, 0.2);">Sign In Instantly</a>
      </div>
      <p style="font-size: 0.85rem; color: #718096; border-top: 1px solid #edf2f7; padding-top: 1rem; margin-top: 2rem;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
  const text = `Hello ${name || 'there'},\n\nWe received a request to log in. Click the link below to sign in instantly:\n\n${link}\n\nIf you did not request this, you can safely ignore this email.`;
  return sendEmail({ to, subject, html, text });
}

/**
 * Formats and dispatches digital product order fulfillment details.
 */
export async function sendOrderFulfillmentEmail(to, name, orderId, products) {
  const subject = `📦 Order Confirmation & Downloads - #${orderId || 'Download Ready'}`;
  const productRows = (products || []).map(p => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #edf2f7; color: #2d3748; font-weight: 500;">${p.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #edf2f7; text-align: right;"><a href="${p.downloadUrl}" style="color: var(--theme-color-accent, #38a169); font-weight: bold; text-decoration: underline;">Download</a></td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 30px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color: var(--theme-color-accent, #38a169); font-weight: 800; margin-top: 0;">Your Order is Ready!</h2>
      <p style="color: #4a5568; font-size: 1rem;">Hello ${name || 'Valued Customer'},</p>
      <p style="color: #4a5568; font-size: 1rem; margin-bottom: 1.5rem;">Thank you for your purchase! Your digital products are available for immediate download below:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f7fafc;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #4a5568; font-weight: 700; font-size: 0.85rem; text-transform: uppercase;">Product</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #4a5568; font-weight: 700; font-size: 0.85rem; text-transform: uppercase;">Link</th>
          </tr>
        </thead>
        <tbody>
          ${productRows || '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #718096;">No download items.</td></tr>'}
        </tbody>
      </table>
      <p style="font-size: 0.85rem; color: #718096; border-top: 1px solid #edf2f7; padding-top: 1rem; margin-top: 2rem;">If you have any questions, feel free to reply to this email.</p>
    </div>
  `;

  const productListText = (products || []).map(p => `- ${p.name}: ${p.downloadUrl}`).join('\n');
  const text = `Hello ${name || 'Valued Customer'},\n\nThank you for your purchase! Your digital products are available for download:\n\n${productListText}`;
  return sendEmail({ to, subject, html, text });
}

/**
 * Formats and dispatches a lead magnet handbook.
 */
export async function sendLeadMagnetEmail(to, name, handbookName, downloadLink) {
  const subject = `📖 Your Free Copy: ${handbookName || 'Digital Guide'}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 30px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color: var(--theme-color-primary, #2b6cb0); font-weight: 800; margin-top: 0;">Your Download is Ready!</h2>
      <p style="color: #4a5568; font-size: 1rem;">Hello ${name || 'there'},</p>
      <p style="color: #4a5568; font-size: 1rem;">Thank you for requesting our handbook: <strong>${handbookName || 'Digital Guide'}</strong>.</p>
      <p style="color: #4a5568; font-size: 1rem; margin-bottom: 1.5rem;">Click the link below to get your free copy instantly:</p>
      <div style="text-align: center; margin: 35px 0;">
        <a href="${downloadLink}" style="background-color: var(--theme-color-accent, #38a169); color: white; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 0.95rem; box-shadow: 0 4px 6px rgba(56, 161, 105, 0.2);">Download Handbook</a>
      </div>
      <p style="font-size: 0.85rem; color: #718096; border-top: 1px solid #edf2f7; padding-top: 1rem; margin-top: 2rem;">Enjoy your reading!</p>
    </div>
  `;
  const text = `Hello ${name || 'there'},\n\nYour copy of "${handbookName || 'Digital Guide'}" is ready. Download here:\n\n${downloadLink}`;
  return sendEmail({ to, subject, html, text });
}

/**
 * Formats and dispatches security threat audit summary logs to administrators.
 */
export async function sendAdminSecurityThreatEmail(to, threatSummary, threatDetails) {
  const subject = "⚠️ [Security Alert] Admin Threat Audit Summary";
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 30px; max-width: 600px; margin: auto; border: 2px solid #ef4444; border-radius: 12px; background-color: #fff5f5; box-shadow: 0 4px 6px rgba(229, 62, 62, 0.15);">
      <h2 style="color: #ef4444; font-weight: 800; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
        <span>⚠️</span> Security Threat Detection Alert
      </h2>
      <p style="color: #2d3748; font-size: 1rem;"><strong>Threat Summary:</strong></p>
      <blockquote style="background: white; border-left: 4px solid #ef4444; padding: 12px; margin: 10px 0; font-family: monospace; border-radius: 0 6px 6px 0; font-size: 0.9rem; line-height: 1.5; color: #2d3748;">
        ${threatSummary}
      </blockquote>
      <p style="color: #2d3748; font-size: 1rem; margin-top: 1.5rem;"><strong>Detailed Audit Logs:</strong></p>
      <div style="background: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #fed7d7; font-family: monospace; white-space: pre-wrap; font-size: 0.85rem; color: #4a5568; max-height: 250px; overflow-y: auto;">
        ${threatDetails}
      </div>
      <p style="font-size: 0.85rem; color: #718096; border-top: 1px solid #fed7d7; padding-top: 1rem; margin-top: 2rem;">Delivered automatically by Foundation System Intrusion Detection.</p>
    </div>
  `;
  const text = `SECURITY ALERT:\n\nThreat Summary:\n${threatSummary}\n\nDetailed Audit Logs:\n${threatDetails}`;
  return sendEmail({ to, subject, html, text });
}
