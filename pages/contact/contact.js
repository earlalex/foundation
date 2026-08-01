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

function loadAvailableSlotsForDate(dateStr, config, bookedOnThisDay) {
  const select = document.getElementById('appt-timeslot');
  if (!select) return;

  const duration = config.duration || 30;
  const buffer = config.buffer || 15;
  const startStr = config.operatingHours?.start || "09:00";
  const endStr = config.operatingHours?.end || "17:00";

  const start = new Date(`${dateStr}T${startStr}:00`);
  const end = new Date(`${dateStr}T${endStr}:00`);

  let curr = new Date(start);
  const slots = [];

  while (curr.getTime() + duration * 60000 <= end.getTime()) {
    const slotTimeStr = curr.toTimeString().substring(0, 5);

    // Check if slot is already booked on this day
    const isBooked = bookedOnThisDay.some(b => b.timeSlot === slotTimeStr);

    if (!isBooked) {
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