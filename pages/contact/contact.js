// pages/contact/contact.js
import { 
  createGoogleContact, 
  sendGmailNotification, 
  getAvailableAppointmentSlots, 
  bookAppointmentSlot 
} from '../../core/google-services.js';

export function initContactPage() {
  const msgForm = document.getElementById('contact-message-form');
  const apptForm = document.getElementById('appointment-form');
  const dateInput = document.getElementById('appt-date');
  const slotSelect = document.getElementById('appt-timeslot');

  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    dateInput.addEventListener('change', async (e) => {
      const selectedDate = e.target.value;
      if (!selectedDate) return;

      slotSelect.innerHTML = '<option value="">Checking Google Calendar Availability...</option>';
      const availableSlots = await getAvailableAppointmentSlots(selectedDate);

      if (!availableSlots || availableSlots.length === 0) {
        slotSelect.innerHTML = '<option value="">No open appointment slots on this date.</option>';
        return;
      }

      slotSelect.innerHTML = availableSlots.map(s => 
        `<option value="${s.time}">${s.label} (${s.time})</option>`
      ).join('');
    });
  }

  msgForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('msg-name').value;
    const email = document.getElementById('msg-email').value;
    const body = document.getElementById('msg-body').value;

    await createGoogleContact({ name, email });
    await sendGmailNotification({
      toEmail: email,
      subject: `Inquiry Received: Thank you ${name}`,
      messageBody: `Hello ${name},\n\nWe received your message:\n"${body}"\n\nWe will get back to you shortly.`
    });

    alert('Your message has been sent successfully!');
    e.target.reset();
  });

  apptForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('appt-name').value;
    const email = document.getElementById('appt-email').value;
    const date = document.getElementById('appt-date').value;
    const timeSlot = document.getElementById('appt-timeslot').value;

    if (!timeSlot) {
      alert('Please select an available time slot.');
      return;
    }

    const btn = document.getElementById('btn-book-appt');
    if (btn) btn.textContent = 'Booking Google Meet...';

    const res = await bookAppointmentSlot({ name, email, date, timeSlot });

    if (res) {
      alert(`Appointment confirmed for ${date} at ${timeSlot}!\n\nGoogle Meet Link: ${res.meetUrl || 'Sent via email'}`);
      e.target.reset();
    } else {
      alert('Could not schedule appointment. Please try again.');
    }
    if (btn) btn.textContent = 'Confirm Google Meet Appointment';
  });
}