// pages/contact/contact.js
import { 
  createGoogleContact, 
  sendGmailNotification, 
  getAvailableAppointmentSlots, 
  getGoogleCalendarFreeBusy,
  bookAppointmentSlot 
} from '../../core/google-services.js';
import { contentDB } from '../../core/db.js';
import { configManager } from '../../core/config.js';
import { errorHandler } from '../../core/error-handler.js';
import { configManager } from '../../core/config.js';
import { contentDB } from '../../core/db.js';
import { toast } from '../../utils/toast.js';
import { stripeService } from '../../core/stripe.js';

export function initContactPage() {
  const msgForm = document.getElementById('contact-message-form');
  const apptForm = document.getElementById('appointment-form');

  // 3-Month Multi-Calendar Elements
  const prevBtn = document.getElementById('btn-prev-months');
  const nextBtn = document.getElementById('btn-next-months');
  const calendarWrapper = document.getElementById('multi-calendar-wrapper');
  const slotsContainer = document.getElementById('time-slots-container');
  const selectedBanner = document.getElementById('selected-datetime-banner');
  const bannerText = document.getElementById('banner-text');

  const apptDateInput = document.getElementById('appt-date');
  const apptTimeslotInput = document.getElementById('appt-timeslot');

  const feeBreakdown = document.getElementById('appt-fee-breakdown');
  const lblTotalFee = document.getElementById('lbl-total-fee');
  const lblUpfrontDeposit = document.getElementById('lbl-upfront-deposit');
  const lblRemainingBalance = document.getElementById('lbl-remaining-balance');

  let currentOffset = 0; // Starts from current month
  let busyIntervalsGlobal = [];
  const apptCfg = configManager.current.appointments || {
    operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    operatingHoursStart: "09:00",
    operatingHoursEnd: "17:00",
    slotDuration: "30",
    bufferTime: "15",
    requirePayment: false,
    totalFee: 15000,
    depositStructure: "full",
    depositAmount: 5000,
    depositPercentage: 50,
    autoInvoice: false,
    notifyAdminEmail: false,
    notifyAppointeeEmail: false,
    dashboardAlerts: false
  };

  // --- Payment Redirect Verification ---
  handleSuccessRedirect();

  // --- Initialize Event Listeners & Boot Calendar ---
  if (calendarWrapper) {
    bootCalendar();

    prevBtn?.addEventListener('click', () => {
      currentOffset--;
      bootCalendar();
    });
    nextBtn?.addEventListener('click', () => {
      currentOffset++;
      bootCalendar();
    });
  }

  // --- Standard Inquiry Form ---
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

  // --- Calendar Boot & Render logic ---
  async function bootCalendar() {
    calendarWrapper.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #a0aec0;">Syncing real-time Google Calendar availability...</div>';

    // Compute 3 consecutive months range
    const startRange = new Date();
    startRange.setMonth(startRange.getMonth() + currentOffset);
    startRange.setDate(1);
    startRange.setHours(0, 0, 0, 0);

    const endRange = new Date(startRange);
    endRange.setMonth(endRange.getMonth() + 3);
    endRange.setDate(0);
    endRange.setHours(23, 59, 59, 999);

    try {
      // Query freeBusy range at once!
      busyIntervalsGlobal = await getGoogleCalendarFreeBusy(startRange.toISOString(), endRange.toISOString());
    } catch (err) {
      console.warn('Google Calendar freeBusy query offline. Falling back to default operating times.', err);
      busyIntervalsGlobal = [];
    }

    render3Months(startRange);
  }

  function render3Months(baseDate) {
    calendarWrapper.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(baseDate);
      monthDate.setMonth(monthDate.getMonth() + i);

      const monthCard = renderMonthCard(monthDate);
      calendarWrapper.appendChild(monthCard);
    }

    // On mobile, let's optionally hide index 1 & 2 to show only 1 month
    const isMobile = window.innerWidth <= 640;
    if (isMobile) {
      const cards = calendarWrapper.querySelectorAll('.month-card');
      cards.forEach((card, idx) => {
        if (idx > 0) card.style.display = 'none';
      });
    }
  }

  function renderMonthCard(dateObj) {
    const card = document.createElement('div');
    card.className = 'month-card card';
    card.style.cssText = 'padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;';

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; font-weight: bold; font-size: 0.95rem; border-bottom: 1px solid #edf2f7; padding-bottom: 0.5rem; margin-bottom: 0.5rem; color: var(--theme-color-primary, #2b6cb0);';
    header.textContent = monthName;
    card.appendChild(header);

    // Weekdays
    const weekdaysGrid = document.createElement('div');
    weekdaysGrid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.75rem; font-weight: bold; color: #a0aec0; margin-bottom: 0.25rem;';
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    weekdaysGrid.innerHTML = weekdays.map(w => `<div>${w}</div>`).join('');
    card.appendChild(weekdaysGrid);

    // Days Grid
    const daysGrid = document.createElement('div');
    daysGrid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;';

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Padding cells before 1st of month
    for (let p = 0; p < firstDayIndex; p++) {
      const pad = document.createElement('div');
      daysGrid.appendChild(pad);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Render days
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const dayOfWeek = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
      const isOperatingDay = apptCfg.operatingDays?.includes(dayOfWeek);
      const isPast = dateStr < todayStr;

      let isAvailable = isOperatingDay && !isPast;

      // Calculate available slots to confirm if day has at least 1 open slot
      let slots = [];
      if (isAvailable) {
        slots = calculateSlotsForDate(dateStr);
        isAvailable = slots.length > 0;
      }

      cell.textContent = day;
      cell.style.cssText = `
        font-size: 0.85rem;
        padding: 6px 0;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: background 0.2s, color 0.2s;
      `;

      if (isAvailable) {
        cell.className = 'calendar-day-available';
        cell.style.backgroundColor = '#f0fdf4';
        cell.style.color = '#166534';
        cell.style.border = '1px solid #bbf7d0';

        cell.addEventListener('mouseover', () => {
          cell.style.backgroundColor = '#bbf7d0';
        });
        cell.addEventListener('mouseout', () => {
          cell.style.backgroundColor = '#f0fdf4';
        });
        cell.addEventListener('click', () => {
          selectDate(dateStr, slots);
          // Highlight active cell visually
          const allCells = calendarWrapper.querySelectorAll('.calendar-day-available');
          allCells.forEach(c => {
            c.style.outline = 'none';
          });
          cell.style.outline = '2px solid var(--theme-color-primary, #2b6cb0)';
        });
      } else {
        cell.style.color = '#cbd5e0';
        cell.style.textDecoration = 'line-through';
        cell.style.cursor = 'not-allowed';
      }

      daysGrid.appendChild(cell);
    }

    card.appendChild(daysGrid);
    return card;
  }

  function calculateSlotsForDate(dateStr) {
    const startHourStr = apptCfg.operatingHoursStart || '09:00';
    const endHourStr = apptCfg.operatingHoursEnd || '17:00';
    const duration = parseInt(apptCfg.slotDuration || '30', 10);
    const buffer = parseInt(apptCfg.bufferTime || '15', 10);

    const slots = [];
    let currentTime = new Date(`${dateStr}T${startHourStr}:00`);
    const endTime = new Date(`${dateStr}T${endHourStr}:00`);

    while (currentTime.getTime() + duration * 60000 <= endTime.getTime()) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);

      // Check busy overlap
      const isBusy = busyIntervalsGlobal.some(busy => {
        const busyStart = new Date(busy.start).getTime();
        const busyEnd = new Date(busy.end).getTime();
        return (slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart);
      });

      if (!isBusy) {
        const timeLabel = slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        slots.push({
          time: slotStart.toTimeString().substring(0, 5),
          label: timeLabel
        });
      }

      // Add duration + buffer
      currentTime = new Date(currentTime.getTime() + (duration + buffer) * 60000);
    }

    return slots;
  }

  function selectDate(dateStr, slots) {
    apptDateInput.value = dateStr;
    apptTimeslotInput.value = ''; // Reset selected slot

    if (selectedBanner) selectedBanner.style.display = 'none';

    if (slots.length === 0) {
      slotsContainer.innerHTML = '<p style="color: #e53e3e; font-size: 0.85rem; width: 100%;">No open slots on this date.</p>';
      return;
    }

    slotsContainer.innerHTML = slots.map(s => `
      <button type="button" class="btn-slot" data-time="${s.time}" style="
        padding: 6px 12px;
        border: 1px solid var(--theme-color-primary, #2b6cb0);
        background: transparent;
        color: var(--theme-color-primary, #2b6cb0);
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
      ">${s.label}</button>
    `).join('');

    // Bind slot clicks
    slotsContainer.querySelectorAll('.btn-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        // Highlight active slot
        slotsContainer.querySelectorAll('.btn-slot').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = 'var(--theme-color-primary, #2b6cb0)';
        });
        btn.style.background = 'var(--theme-color-primary, #2b6cb0)';
        btn.style.color = '#ffffff';

        apptTimeslotInput.value = btn.dataset.time;

        // Show selection banner
        if (selectedBanner && bannerText) {
          bannerText.textContent = `${dateStr} @ ${btn.textContent}`;
          selectedBanner.style.display = 'block';
        }

        // Calculate and render monetization if payment is required
        if (apptCfg.requirePayment) {
          calculateMonetizationBreakdown();
        }
      });
    });
  }

  function calculateMonetizationBreakdown() {
    if (!feeBreakdown) return;

    feeBreakdown.style.display = 'flex';

    const totalCents = apptCfg.totalFee || 15000;
    const structure = apptCfg.depositStructure || 'full';
    let upfrontCents = totalCents;

    if (structure === 'fixed') {
      upfrontCents = apptCfg.depositAmount || 5000;
    } else if (structure === 'percentage') {
      const percentage = apptCfg.depositPercentage || 50;
      upfrontCents = Math.round((totalCents * percentage) / 100);
    }

    // Handle edge: upfront can't be more than total
    if (upfrontCents > totalCents) upfrontCents = totalCents;

    const remainingCents = totalCents - upfrontCents;

    lblTotalFee.textContent = `$${(totalCents / 100).toFixed(2)}`;
    lblUpfrontDeposit.textContent = `$${(upfrontCents / 100).toFixed(2)}`;
    lblRemainingBalance.textContent = `$${(remainingCents / 100).toFixed(2)}`;
  }

  // --- Handle Booking Submission ---
  apptForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('appt-name').value;
    const email = document.getElementById('appt-email').value;
    const notes = document.getElementById('appt-notes').value || '';
    const date = apptDateInput.value;
    const timeSlot = apptTimeslotInput.value;

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
