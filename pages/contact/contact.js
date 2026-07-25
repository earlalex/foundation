// pages/contact/contact.js
import { createGoogleContact, sendGmailNotification } from '../../core/google-services.js';

export function initContactPage() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('contact-name').value;
    const email = document.getElementById('contact-email').value;
    const message = document.getElementById('contact-message').value;

    // 1. Save directly to Google Contacts
    await createGoogleContact({ name, email });

    // 2. Send email notification via Gmail API
    await sendGmailNotification({
      toEmail: 'your-admin-email@gmail.com', // Your notification email
      subject: `New Website Contact Lead: ${name}`,
      messageBody: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    });

    alert('Message sent! Contact saved and email delivered.');
    form.reset();
  });
}