// core/google-services.js
import { GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { auth } from './auth.js';
import { errorHandler } from './error-handler.js';

let googleAccessToken = null;

/**
 * Request OAuth Scopes for Calendar, Contacts, Gmail, Search Console, & Analytics
 */
export async function authenticateGoogleServices() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar');
  provider.addScope('https://www.googleapis.com/auth/contacts');
  provider.addScope('https://www.googleapis.com/auth/gmail.send');
  
  // 👈 Readonly scopes for SEO & Analytics Dashboard
  provider.addScope('https://www.googleapis.com/auth/webmasters.readonly');
  provider.addScope('https://www.googleapis.com/auth/analytics.readonly');

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    googleAccessToken = credential.accessToken;
    console.log('[Google Services]: Access token acquired with SEO & Analytics scopes.');
    return googleAccessToken;
  } catch (err) {
    errorHandler.handleError(new Error(`Google Auth Failed: ${err.message}`));
    return null;
  }
}

async function getAccessToken() {
  if (!googleAccessToken) {
    await authenticateGoogleServices();
  }
  return googleAccessToken;
}

/**
 * 1. GOOGLE CALENDAR: Schedule Google Meet or Live Appointment
 */
export async function createGoogleCalendarEvent(eventData) {
  const token = await getAccessToken();
  if (!token) return null;

  const startIso = `${eventData.date}T${eventData.startTime}:00`;
  const endIso = `${eventData.date}T${eventData.endTime}:00`;

  const calendarPayload = {
    summary: eventData.title,
    description: eventData.description,
    location: eventData.location || '',
    start: { dateTime: new Date(startIso).toISOString() },
    end: { dateTime: new Date(endIso).toISOString() },
    attendees: eventData.attendeeEmail ? [{ email: eventData.attendeeEmail }] : []
  };

  if (eventData.eventType === 'google-meet') {
    calendarPayload.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(calendarPayload)
      }
    );

    const result = await response.json();
    console.log('[Calendar Event Created]:', result);

    const meetUrl = result.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || result.htmlLink;
    return { calendarEventId: result.id, meetUrl };
  } catch (err) {
    errorHandler.handleError(new Error(`Calendar Event Creation Failed: ${err.message}`));
    return null;
  }
}

/**
 * 2. GOOGLE CONTACTS: Add contact from Contact Form
 */
export async function createGoogleContact(contact) {
  const token = await getAccessToken();
  if (!token) return false;

  const contactPayload = {
    names: [{ givenName: contact.name }],
    emailAddresses: [{ value: contact.email }],
    phoneNumbers: contact.phone ? [{ value: contact.phone }] : [],
    userDefined: [{ key: 'Source', value: 'Website Contact Form' }]
  };

  try {
    const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    const result = await response.json();
    console.log('[Google Contact Created]:', result);
    return true;
  } catch (err) {
    errorHandler.handleError(new Error(`Failed to create Google Contact: ${err.message}`));
    return false;
  }
}

/**
 * 3. GMAIL API: Send email notification from Contact Form
 */
export async function sendGmailNotification({ toEmail, subject, messageBody }) {
  const token = await getAccessToken();
  if (!token) return false;

  const rawEmail = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    messageBody
  ].join('\r\n');

  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedEmail })
    });

    const result = await response.json();
    console.log('[Gmail Sent]:', result);
    return true;
  } catch (err) {
    errorHandler.handleError(new Error(`Failed to send Gmail: ${err.message}`));
    return false;
  }
}

/**
 * 4. GOOGLE SEARCH CONSOLE: Fetch indexing & keyword query stats
 */
export async function getSearchConsolePerformance(siteUrl) {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const encodedSite = encodeURIComponent(siteUrl);
    const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startDate: '2026-06-01',
        endDate: '2026-07-24',
        dimensions: ['query', 'page'],
        rowLimit: 10
      })
    });

    const data = await response.json();
    console.log('[Search Console Data]:', data);
    return data;
  } catch (err) {
    errorHandler.handleError(new Error(`Failed to fetch Search Console data: ${err.message}`));
    return null;
  }
}

/**
 * 5. GOOGLE ANALYTICS 4: Fetch traffic summaries
 */
export async function getAnalyticsOverview(propertyId) {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }]
      })
    });

    const data = await response.json();
    console.log('[GA4 Report Data]:', data);
    return data;
  } catch (err) {
    errorHandler.handleError(new Error(`Failed to fetch GA4 report: ${err.message}`));
    return null;
  }
}