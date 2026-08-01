// pages/contact/contact.js
import { 
  createGoogleContact, 
  sendGmailNotification, 
  bookAppointmentSlot,
  getFreeBusyIntervalsForRange
} from '../../core/google-services.js';
import { contentDB } from '../../core/db.js';
import { configManager } from '../../core/config.js';
import { stripeService } from '../../core/stripe.js';
import { errorHandler } from '../../core/error-handler.js';
import { toast } from '../../utils/toast.js';

let calendarCurrentMonthOffset = 0; // offset of start month shown (e.g. 0 = current month)

export function initContactPage() {
  const msgForm = document.getElementById('contact-message-form');
  const apptForm = document.getElementById('appointment-form');
  const slotSelect = document.getElementById('appt-timeslot');

  // Check for successful Stripe redirect session_id to finalize booking
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  if (sessionId) {
    finalizeAppointmentBookingAfterPayment(sessionId);
  }

  // Multi-Month view renderer
  renderSchedulingCalendar();

  // Handle Month Pagination
  document.getElementById('btn-prev-month')?.addEventListener('click', () => {
    if (calendarCurrentMonthOffset > 0) {
      calendarCurrentMonthOffset--;
      renderSchedulingCalendar();
    }
  });

  document.getElementById('btn-next-month')?.addEventListener('click', () => {
    calendarCurrentMonthOffset++;
    renderSchedulingCalendar();
  });

  msgForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('msg-name').value;
    const email = document.getElementById('msg-email').value;
    const body = document.getElementById('msg-body').value;

    try {
      await createGoogleContact({ name, email });
      await sendGmailNotification({
        toEmail: email,
        subject: `Inquiry Received: Thank you ${name}`,
        messageBody: `Hello ${name},\n\nWe received your message:\n"${body}"\n\nWe will get back to you shortly.`
      });

      toast.success('Your message has been sent successfully!');
      e.target.reset();
    } catch (err) {
      errorHandler.handleError(err, 'Contact Page - Message Form');
      toast.error('Failed to send message. Please try again.');
    }
  });

  apptForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('appt-name').value;
    const email = document.getElementById('appt-email').value;
    const date = document.getElementById('appt-date').value;
    const timeSlot = document.getElementById('appt-timeslot').value;
    const notes = document.getElementById('appt-notes')?.value || '';

    if (!date) {
      toast.error('Please select an available date from the calendar first.');
      return;
    }

    if (!timeSlot) {
      toast.error('Please select an available time slot.');
      return;
    }

    const apptConfig = configManager.current?.appointments || {
      operatingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      operatingHours: { start: "09:00", end: "17:00" },
      duration: 30,
      buffer: 15,
      depositRule: 'none',
      appointmentPrice: 100.00,
      depositValue: 0
    };

    const depositRule = apptConfig.depositRule || 'none';
    const price = Number(apptConfig.appointmentPrice || 100.00);
    const depositValue = Number(apptConfig.depositValue || 0);

    let amountToPay = 0;
    if (depositRule === 'full') {
      amountToPay = price;
    } else if (depositRule === 'fixed') {
      amountToPay = depositValue;
    } else if (depositRule === 'percentage') {
      amountToPay = (price * depositValue) / 100;
    }

    if (amountToPay > 0) {
      // Redirect to Stripe Checkout Session for required deposit
      const btn = document.getElementById('btn-book-appt');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Redirecting to payment gateway...';
      }
      try {
        const remainingBalance = price - amountToPay;
        const response = await fetch('/api/stripe-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            productId: `Consultation Deposit: ${name}`,
            amount: Math.round(amountToPay * 100), // in cents
            currency: 'USD',
            mode: 'payment',
            metadata: {
              type: 'appointment_booking',
              name,
              email,
              date,
              timeSlot,
              notes,
              depositRule,
              amountPaid: String(amountToPay),
              remainingBalance: String(remainingBalance)
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to initialize payment session');
        }

        const resData = await response.json();
        if (resData.url) {
          window.location.href = resData.url;
        } else {
          throw new Error('No checkout URL returned from payment endpoint');
        }
      } catch (err) {
        errorHandler.handleError(err, 'Contact Page - Checkout Redirect');
        toast.error(`Checkout failed: ${err.message}`);
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Confirm Google Meet Appointment';
        }
      }
      return;
    }

    // Direct booking flow (if no deposit is required)
    const btn = document.getElementById('btn-book-appt');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Booking Google Meet...';
    }

    try {
      const bookingData = {
        name,
        email,
        date,
        timeSlot,
        notes,
        createdAt: new Date().toISOString()
      };

      // Call Google Calendar API service with conferenceData enabled to generate a Google Meet link
      const res = await bookAppointmentSlot({ name, email, date, timeSlot, notes });
      bookingData.meetUrl = res?.meetUrl || 'https://meet.google.com/mock-meet';
      bookingData.calendarEventId = res?.calendarEventId || `event_${Date.now()}`;

      await contentDB.saveAppointment(bookingData);

      toast.success(`Appointment confirmed for ${date} at ${timeSlot}!\nMeet link synced to dashboard.`);
      apptForm.reset();

      // Clear selected state inside view
      document.getElementById('appt-date').value = '';
      if (slotSelect) {
        slotSelect.innerHTML = '<option value="">Select a date on the calendar above first...</option>';
      }

      renderSchedulingCalendar();
    } catch (err) {
      errorHandler.handleError(err, 'Contact Page - Appointment Booking');
      toast.error('Failed to book appointment. Please try again.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Confirm Google Meet Appointment';
      }
    }
  });
}

async function finalizeAppointmentBookingAfterPayment(sessionId) {
  try {
    toast.info('Verifying deposit payment and finalizing booking...');
    const headers = await stripeService.getAuthHeaders();
    const response = await fetch('/api/stripe-proxy', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'generic_relay',
        endpoint: `checkout/sessions/${sessionId}`,
        method: 'GET'
      })
    });
    if (!response.ok) {
      throw new Error('Failed to retrieve checkout session details.');
    }
    const session = await response.json();
    const metadata = session.metadata || {};

    if (metadata.type === 'appointment_booking') {
      const { name, email, date, timeSlot, notes } = metadata;

      const bookingData = {
        name,
        email,
        date,
        timeSlot,
        notes,
        createdAt: new Date().toISOString()
      };

      // Call Google Calendar API service with conferenceData enabled to generate a Google Meet link
      const res = await bookAppointmentSlot({ name, email, date, timeSlot, notes });
      bookingData.meetUrl = res?.meetUrl || 'https://meet.google.com/mock-meet';
      bookingData.calendarEventId = res?.calendarEventId || `event_${Date.now()}`;

      await contentDB.saveAppointment(bookingData);

      toast.success(`Appointment confirmed for ${date} at ${timeSlot}! Google Meet link generated and calendar invitations sent.`);

      // Clean query params from the URL bar cleanly
      window.history.replaceState({}, document.title, window.location.pathname);

      // Reload calendar to block the newly booked slot
      renderSchedulingCalendar();
    }
  } catch (err) {
    errorHandler.handleError(err, 'Contact Page - Finalize Booking');
    toast.error('Failed to finalize booking details.');
  }
}

async function renderSchedulingCalendar() {
  const container = document.getElementById('calendar-wrapper');
  if (!container) return;

  const apptConfig = configManager.current?.appointments || {
    operatingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    operatingHours: { start: "09:00", end: "17:00" },
    duration: 30,
    buffer: 15
  };

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Detect Mobile width to render either 1 month (paginated) or 3 months (full desktop)
  const isMobile = window.innerWidth < 768;
  const totalMonthsToShow = isMobile ? 1 : 3;

  const rangeStartDate = new Date(currentYear, currentMonth + calendarCurrentMonthOffset, 1);
  const rangeEndDate = new Date(currentYear, currentMonth + calendarCurrentMonthOffset + totalMonthsToShow, 0);

  // Fetch real-time Google Calendar freeBusy intervals across the 3-month range
  let busyIntervals = [];
  try {
    busyIntervals = await getFreeBusyIntervalsForRange(rangeStartDate.toISOString(), rangeEndDate.toISOString());
  } catch (err) {
    console.warn('[Calendar real-time freeBusy]: Query failed, using local database/offline fallbacks.', err);
  }

  // Load existing local/synchronized appointment bookings
  let bookedAppointments = [];
  try {
    bookedAppointments = await contentDB.getAppointments();
  } catch (err) {
    console.warn('[Calendar Load]: Using local appointment array fallback.', err);
  }

  container.innerHTML = '';

  for (let m = 0; m < totalMonthsToShow; m++) {
    const renderMonthOffset = calendarCurrentMonthOffset + m;
    const targetDate = new Date(currentYear, currentMonth + renderMonthOffset, 1);
    const monthYearStr = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const monthEl = document.createElement('div');
    monthEl.className = 'calendar-month-container';

    // Header
    const title = document.createElement('div');
    title.className = 'calendar-month-title';
    title.textContent = monthYearStr;
    monthEl.appendChild(title);

    // Days Header (Sun - Sat)
    const gridHeader = document.createElement('div');
    gridHeader.className = 'calendar-grid-header';
    const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    dayLabels.forEach(lbl => {
      const cell = document.createElement('div');
      cell.textContent = lbl;
      gridHeader.appendChild(cell);
    });
    monthEl.appendChild(gridHeader);

    // Days grid
    const gridDays = document.createElement('div');
    gridDays.className = 'calendar-grid-days';

    // Get padding first day of month
    const firstDayIndex = targetDate.getDay();
    for (let p = 0; p < firstDayIndex; p++) {
      const pad = document.createElement('div');
      gridDays.appendChild(pad);
    }

    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateToCheck = new Date(targetDate.getFullYear(), targetDate.getMonth(), day);
      const dateStr = dateToCheck.toISOString().split('T')[0];
      const dayOfWeekName = dateToCheck.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();

      // Check if date is in the past
      const isPast = dateToCheck.getTime() < today.setHours(0,0,0,0);

      // Check against Operating Guidelines
      const isOperatingDay = apptConfig.operatingDays?.includes(dayOfWeekName);

      // Check how many slots exist and how many are available
      const bookedOnThisDay = bookedAppointments.filter(a => a.date === dateStr);
      const slotsForDay = calculateAvailableSlotsForDate(dateStr, apptConfig, bookedOnThisDay, busyIntervals);
      const isFullyBooked = slotsForDay.length === 0;

      const isAvailable = isOperatingDay && !isPast && !isFullyBooked;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `calendar-day-btn ${isAvailable ? 'available' : 'disabled'}`;
      btn.textContent = day;
      btn.dataset.date = dateStr;

      if (!isAvailable) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          // Deselect previous
          document.querySelectorAll('.calendar-day-btn.selected').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');

          // Set date value
          document.getElementById('appt-date').value = dateStr;

          // Render timeslots using real-time calculated slots
          loadAvailableSlotsForDate(slotsForDay);
        });
      }

      gridDays.appendChild(btn);
    }

    monthEl.appendChild(gridDays);
    container.appendChild(monthEl);
  }
}

function calculatePossibleSlotsCount(config) {
  const duration = config.duration || 30;
  const buffer = config.buffer || 15;
  const startStr = config.operatingHours?.start || "09:00";
  const endStr = config.operatingHours?.end || "17:00";

  const dummyDate = "2026-01-01";
  const start = new Date(`${dummyDate}T${startStr}:00`);
  const end = new Date(`${dummyDate}T${endStr}:00`);

  let count = 0;
  let curr = new Date(start);

  while (curr.getTime() + duration * 60000 <= end.getTime()) {
    count++;
    curr = new Date(curr.getTime() + (duration + buffer) * 60000);
  }
  return count;
}

function calculateAvailableSlotsForDate(dateStr, config, bookedOnThisDay, busyIntervals) {
  const duration = config.duration || 30;
  const buffer = config.buffer || 15;
  const startStr = config.operatingHours?.start || "09:00";
  const endStr = config.operatingHours?.end || "17:00";

  const start = new Date(`${dateStr}T${startStr}:00`);
  const end = new Date(`${dateStr}T${endStr}:00`);

  let curr = new Date(start);
  const slots = [];

  while (curr.getTime() + duration * 60000 <= end.getTime()) {
    const slotStart = new Date(curr);
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);
    const slotTimeStr = curr.toTimeString().substring(0, 5);

    // Check if slot is already booked locally on this day
    const isLocalBooked = bookedOnThisDay.some(b => b.timeSlot === slotTimeStr);

    // Check if slot overlaps with busy intervals from Google Calendar
    const isGoogleBusy = (busyIntervals || []).some(busy => {
      const busyStart = new Date(busy.start).getTime();
      const busyEnd = new Date(busy.end).getTime();
      return (slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart);
    });

    if (!isLocalBooked && !isGoogleBusy) {
      const displayLabel = curr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      slots.push({
        time: slotTimeStr,
        label: displayLabel
      });
    }

    curr = new Date(curr.getTime() + (duration + buffer) * 60000);
  }
  return slots;
}

function loadAvailableSlotsForDate(slots) {
  const select = document.getElementById('appt-timeslot');
  if (!select) return;

  if (slots.length === 0) {
    select.innerHTML = '<option value="">No open appointment slots remaining on this day.</option>';
  } else {
    select.innerHTML = slots.map(s => `<option value="${s.time}">${s.label} (${s.time})</option>`).join('');
  }
}
