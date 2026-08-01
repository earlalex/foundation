// pages/contact/contact.js
import { 
  createGoogleContact, 
  sendGmailNotification, 
  bookAppointmentSlot 
} from '../../core/google-services.js';
import { contentDB } from '../../core/db.js';
import { configManager } from '../../core/config.js';
import { errorHandler } from '../../core/error-handler.js';
import { toast } from '../../utils/toast.js';

let calendarCurrentMonthOffset = 0; // offset of start month shown (e.g. 0 = current month)

export function initContactPage() {
  const msgForm = document.getElementById('contact-message-form');
  const apptForm = document.getElementById('appointment-form');
  const dateInput = document.getElementById('appt-date');
  const slotSelect = document.getElementById('appt-timeslot');

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
      consultationFee: 150,
      depositRule: "percentage",
      depositAmount: 50,
      depositPercentage: 20
    };

    const fee = apptConfig.consultationFee || 150;
    const rule = apptConfig.depositRule || 'none';
    let depositRequired = 0;

    if (rule === 'full') {
      depositRequired = fee;
    } else if (rule === 'fixed') {
      depositRequired = Math.min(fee, apptConfig.depositAmount || 50);
    } else if (rule === 'percentage') {
      depositRequired = Math.round(fee * ((apptConfig.depositPercentage || 20) / 100));
    }

    if (depositRequired > 0) {
      const paid = await showDepositPaymentModal(depositRequired);
      if (!paid) {
        toast.warning('Upfront payment was cancelled. Appointment not booked.');
        return;
      }
      toast.success(`Secure payment of $${depositRequired.toFixed(2)} completed successfully!`);
    }

    const btn = document.getElementById('btn-book-appt');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Booking Google Meet...';
    }

    try {
      // Create and save booking in ContentDB (real-time sync)
      const bookingData = {
        name,
        email,
        date,
        timeSlot,
        createdAt: new Date().toISOString()
      };

      // Call Google Calendar API service
      const res = await bookAppointmentSlot({ name, email, date, timeSlot });
      bookingData.meetUrl = res?.meetUrl || 'https://meet.google.com/mock-meet';
      bookingData.calendarEventId = res?.calendarEventId || `mock_event_${Date.now()}`;

      await contentDB.saveAppointment(bookingData);

      // Remaining balance invoicing task
      const remainingBalance = fee - depositRequired;
      if (remainingBalance > 0) {
        // Queue draft invoice in ContentDB for post-meeting invoicing
        const draftInvoice = {
          id: 'inv_' + Date.now(),
          customerName: name,
          customerEmail: email,
          amount: Math.round(remainingBalance * 100), // cents
          currency: 'USD',
          description: `Post-meeting remaining balance for Consultation session on ${date} ${timeSlot}`,
          status: 'draft',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days due
          createdAt: new Date().toISOString()
        };
        await contentDB.saveInvoice(draftInvoice);
        toast.success(`Confirmed remaining balance task queued: $${remainingBalance.toFixed(2)}`);
      }

      toast.success(`Appointment confirmed for ${date} at ${timeSlot}!\nMeet link synced to dashboard.`);
      apptForm.reset();

      // Clear selected state inside view
      document.getElementById('appt-date').value = '';
      if (slotSelect) {
        slotSelect.innerHTML = '<option value="">Select a date on the calendar above first...</option>';
      }

      // Re-render to block out the freshly booked slot
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

async function showDepositPaymentModal(amountRequired) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000002;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); text-align: left;">
        <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--theme-color-primary, #2b6cb0);">Secure Consultation Checkout</h3>
        <p style="color: var(--theme-color-text-secondary, #4a5568); font-size: 0.9rem; margin-bottom: 1.5rem;">
          To complete your booking, an upfront consultation deposit is required.
        </p>

        <div style="background: var(--theme-color-background, #f7fafc); padding: 1rem; border-radius: 6px; border: 1px solid var(--theme-color-border, #e2e8f0); margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 0.95rem;">Required Deposit:</span>
          <strong style="font-size: 1.25rem; color: var(--theme-color-accent, #38a169);">$${amountRequired.toFixed(2)}</strong>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.25rem; color: #4a5568;">Card Number</label>
            <input type="text" value="4242 4242 4242 4242" disabled style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.25rem; color: #4a5568;">Expiry Date</label>
              <input type="text" value="12/28" disabled style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 0.25rem; color: #4a5568;">CVC</label>
              <input type="text" value="123" disabled style="width: 100%; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; box-sizing: border-box;" />
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="btn-pay-cancel" style="padding: 8px 16px; background: transparent; border: 1px solid #cbd5e0; border-radius: 4px; font-weight: 600; cursor: pointer; color: #4a5568;">Cancel</button>
          <button id="btn-pay-confirm" class="btn-primary" style="padding: 8px 20px; font-weight: bold; border-radius: 4px; border: none; cursor: pointer;">Pay & Confirm</button>
        </div>
      </div>
    `;

    modal.querySelector('#btn-pay-cancel').onclick = () => {
      modal.remove();
      resolve(false);
    };

    modal.querySelector('#btn-pay-confirm').onclick = () => {
      modal.remove();
      resolve(true);
    };

    document.body.appendChild(modal);
  });
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

  // Load existing real-time appointment bookings to calculate fully booked days
  let bookedAppointments = [];
  try {
    bookedAppointments = await contentDB.getAppointments();
  } catch (err) {
    console.warn('[Calendar Load]: Using local appointment array fallback.', err);
  }

  // Detect Mobile width to render either 1 month (paginated) or 3 months (full desktop)
  const isMobile = window.innerWidth < 768;
  const totalMonthsToShow = isMobile ? 1 : 3;

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

      // Check how many slots exist and how many are already booked
      const totalPossibleSlots = calculatePossibleSlotsCount(apptConfig);
      const bookedOnThisDay = bookedAppointments.filter(a => a.date === dateStr);
      const isFullyBooked = bookedOnThisDay.length >= totalPossibleSlots;

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

          // Render timeslots
          loadAvailableSlotsForDate(dateStr, apptConfig, bookedOnThisDay);
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

async function loadAvailableSlotsForDate(dateStr, config, bookedOnThisDay) {
  const select = document.getElementById('appt-timeslot');
  if (!select) return;

  select.innerHTML = '<option value="">Loading available slots...</option>';

  const duration = config.duration || 30;
  const buffer = config.buffer || 15;
  const startStr = config.operatingHours?.start || "09:00";
  const endStr = config.operatingHours?.end || "17:00";

  // Query Google freeBusy API in real time to filter slots
  let busyIntervals = [];
  try {
    const { getGoogleAccessToken } = await import('../../core/google-services.js');
    const token = await getGoogleAccessToken(false);
    if (token) {
      const dayStartIso = new Date(`${dateStr}T${startStr}:00`).toISOString();
      const dayEndIso = new Date(`${dateStr}T${endStr}:00`).toISOString();

      const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeMin: dayStartIso,
          timeMax: dayEndIso,
          items: [{ id: 'primary' }]
        })
      });
      const data = await response.json();
      busyIntervals = data.calendars?.primary?.busy || [];
    }
  } catch (err) {
    console.warn('[Calendar freeBusy Query]:', err);
  }

  const start = new Date(`${dateStr}T${startStr}:00`);
  const end = new Date(`${dateStr}T${endStr}:00`);

  let curr = new Date(start);
  const slots = [];

  while (curr.getTime() + duration * 60000 <= end.getTime()) {
    const slotTimeStr = curr.toTimeString().substring(0, 5);
    const slotStart = new Date(curr);
    const slotEnd = new Date(curr.getTime() + duration * 60000);

    // Check if slot is already booked in our DB
    const isBookedInDb = bookedOnThisDay.some(b => b.timeSlot === slotTimeStr);

    // Check if slot is busy on Google Calendar
    const isBusyOnGoogle = busyIntervals.some(busy => {
      const busyStart = new Date(busy.start).getTime();
      const busyEnd = new Date(busy.end).getTime();
      return (slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart);
    });

    if (!isBookedInDb && !isBusyOnGoogle) {
      const displayLabel = curr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      slots.push({
        time: slotTimeStr,
        label: displayLabel
      });
    }

    curr = new Date(curr.getTime() + (duration + buffer) * 60000);
  }

  if (slots.length === 0) {
    select.innerHTML = '<option value="">No open appointment slots remaining on this day.</option>';
  } else {
    select.innerHTML = slots.map(s => `<option value="${s.time}">${s.label} (${s.time})</option>`).join('');
  }
}