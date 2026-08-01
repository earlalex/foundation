// pages/contact/contact.js
import { 
  createGoogleContact, 
  sendGmailNotification, 
  getAvailableAppointmentSlots, 
  getGoogleCalendarFreeBusy,
  bookAppointmentSlot 
} from '../../core/google-services.js';
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

    if (!date || !timeSlot) {
      toast.warning('Please select a green date and available time slot on the calendar first.');
      return;
    }

    const btn = document.getElementById('btn-book-appt');
    const originalText = btn?.textContent;

    if (apptCfg.requirePayment) {
      // Payment is Required Upfront! Let's launch Stripe Checkout via Serverless Redirect
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Redirecting to Secure Checkout...';
      }

      const totalCents = apptCfg.totalFee || 15000;
      const structure = apptCfg.depositStructure || 'full';
      let upfrontCents = totalCents;

      if (structure === 'fixed') {
        upfrontCents = apptCfg.depositAmount || 5000;
      } else if (structure === 'percentage') {
        const percentage = apptCfg.depositPercentage || 50;
        upfrontCents = Math.round((totalCents * percentage) / 100);
      }
      if (upfrontCents > totalCents) upfrontCents = totalCents;

      const balanceCents = totalCents - upfrontCents;

      try {
        const successUrl = window.location.origin + `/contact?success=true&session_id={CHECKOUT_SESSION_ID}&appt_name=${encodeURIComponent(name)}&appt_email=${encodeURIComponent(email)}&appt_date=${date}&appt_time=${encodeURIComponent(timeSlot)}&appt_notes=${encodeURIComponent(notes)}&appt_total_fee=${totalCents}&appt_paid=${upfrontCents}&appt_balance=${balanceCents}`;

        const metadata = {
          action: 'appt_booking',
          appt_name: name,
          appt_email: email,
          appt_date: date,
          appt_time: timeSlot,
          appt_notes: notes,
          appt_total_fee: String(totalCents),
          appt_paid: String(upfrontCents),
          appt_balance: String(balanceCents)
        };

        const session = await stripeService.createAppointmentCheckoutSession(email, upfrontCents, successUrl, metadata);
        if (session.url) {
          window.location.href = session.url;
        } else {
          throw new Error(session.error || 'Failed to initialize payment gateway.');
        }
      } catch (err) {
        errorHandler.handleError(err, 'Contact Appointment - Checkout Init');
        toast.error(`Checkout initialization failed: ${err.message}`);
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }

    } else {
      // Free consultation booking! Call booking pipeline directly
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Scheduling Video Consultation...';
      }

      try {
        const res = await bookAppointmentSlot({ name, email, date, timeSlot, notes });
        if (res) {
          // Save to Firestore /registrations
          await contentDB.saveRegistration({
            eventId: 'appointment',
            type: 'appointment',
            email: email,
            accessCode: `APT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            cartItems: JSON.stringify([{ id: 'consultation', name: 'Video Consultation Session', price: 0, quantity: 1 }]),
            apptDate: date,
            apptTime: timeSlot,
            apptName: name,
            meetUrl: res.meetUrl || '',
            price: 0,
            paid: 0,
            balance: 0,
            status: 'Confirmed',
            notes: notes,
            createdAt: new Date().toISOString()
          });

          // Dispatches
          if (apptCfg.notifyAppointeeEmail) {
            await sendGmailNotification({
              toEmail: email,
              subject: `Consultation Confirmed: ${date} @ ${timeSlot}`,
              messageBody: `Hello ${name},\n\nYour video consultation appointment has been successfully scheduled!\n\nDate: ${date}\nTime: ${timeSlot}\nGoogle Meet URL: ${res.meetUrl || 'See calendar invite'}\n\nWe look forward to meeting you.`
            });
          }

          if (apptCfg.notifyAdminEmail) {
            const adminEmail = configManager.current.adminEmails?.[0] || 'admin@example.com';
            await sendGmailNotification({
              toEmail: adminEmail,
              subject: `[Admin Alert] New Consultation Booked: ${name}`,
              messageBody: `Hello Administrator,\n\nA new video consultation appointment has been scheduled!\n\nClient Name: ${name}\nClient Email: ${email}\nDate: ${date}\nTime: ${timeSlot}\nNotes: ${notes}\nGoogle Meet Link: ${res.meetUrl || 'Generated'}`
            });
          }

          toast.success(`Session confirmed! Check inbox for calendar invites.`);
          alert(`Appointment confirmed for ${date} at ${timeSlot}!\n\nGoogle Meet Link: ${res.meetUrl || 'Sent via email'}`);
          apptForm.reset();
          bootCalendar();
        } else {
          toast.error('Booking failed. Please try a different slot.');
        }
      } catch (err) {
        errorHandler.handleError(err, 'Contact Appointment - Save Free');
        toast.error(`Scheduling failed: ${err.message}`);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      }
    }
  });

  // --- Verify and Finalize Paid Booking on success redirect ---
  async function handleSuccessRedirect() {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const sessionId = params.get('session_id');

    if (success !== 'true' || !sessionId) return;

    // Guard: Prevent double-registration on page refresh
    const completed = JSON.parse(localStorage.getItem('foundation_completed_bookings') || '[]');
    if (completed.includes(sessionId)) {
      // Already handled, clean query params cleanly
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Block page interaction beautifully
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(255,255,255,0.9); z-index: 2147483640;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif;
    `;
    overlay.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
      <h3 style="margin: 0; font-weight: bold; color: var(--theme-color-primary, #2b6cb0);">Securing Consultation Slot...</h3>
      <p style="color: #718096; font-size: 0.9rem; margin-top: 0.5rem;">Verifying deposit payment and establishing Google Meet rooms...</p>
    `;
    document.body.appendChild(overlay);

    try {
      const name = decodeURIComponent(params.get('appt_name') || '');
      const email = decodeURIComponent(params.get('appt_email') || '');
      const date = params.get('appt_date') || '';
      const timeSlot = decodeURIComponent(params.get('appt_time') || '');
      const notes = decodeURIComponent(params.get('appt_notes') || '');
      const totalFee = Number(params.get('appt_total_fee') || '0');
      const paid = Number(params.get('appt_paid') || '0');
      const balance = Number(params.get('appt_balance') || '0');

      // 1. Establish Google Calendar event + Google Meet
      const res = await bookAppointmentSlot({ name, email, date, timeSlot, notes });

      if (res) {
        // 2. Save appointment record inside Firestore `/registrations`
        const accessCode = `APT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        await contentDB.saveRegistration({
          eventId: 'appointment',
          type: 'appointment',
          email: email,
          accessCode,
          cartItems: JSON.stringify([{ id: 'consultation', name: 'Paid Video Consultation Session', price: totalFee, quantity: 1 }]),
          apptDate: date,
          apptTime: timeSlot,
          apptName: name,
          meetUrl: res.meetUrl || '',
          price: totalFee,
          paid,
          balance,
          status: 'Confirmed',
          notes,
          sessionId,
          createdAt: new Date().toISOString()
        });

        // 3. Queue automated post-meeting invoice task in Firestore if balance remains unpaid
        if (balance > 0 && apptCfg.autoInvoice) {
          const appointmentDate = new Date(`${date}T${timeSlot}:00`);
          const invoiceDate = new Date(appointmentDate.getTime() + 24 * 60 * 60 * 1000); // the day after!

          await contentDB.saveContent({
            type: 'scheduled_task',
            id: `task_invoice_${sessionId}`,
            taskType: 'auto_invoice_balance',
            clientEmail: email,
            clientName: name,
            amount: balance,
            invoiceDate: invoiceDate.toISOString().split('T')[0],
            status: 'Pending',
            metadata: {
              sessionId,
              appointmentDate: date,
              timeslot: timeSlot
            }
          });
          console.log('[System Scheduler]: Queued day-after unpaid balance invoice task successfully.');
        }

        // 4. Send Gmail confirmations
        if (apptCfg.notifyAppointeeEmail) {
          await sendGmailNotification({
            toEmail: email,
            subject: `Consultation Booking Confirmed: ${date} @ ${timeSlot}`,
            messageBody: `Hello ${name},\n\nYour video consultation appointment deposit has been received and confirmed!\n\nDate: ${date}\nTime: ${timeSlot}\nGoogle Meet URL: ${res.meetUrl || 'See calendar invite'}\nTotal Fee: $${(totalFee / 100).toFixed(2)}\nPaid Deposit: $${(paid / 100).toFixed(2)}\nRemaining Balance: $${(balance / 100).toFixed(2)}\n\nWe look forward to meeting you.`
          });
        }

        if (apptCfg.notifyAdminEmail) {
          const adminEmail = configManager.current.adminEmails?.[0] || 'admin@example.com';
          await sendGmailNotification({
            toEmail: adminEmail,
            subject: `[Admin Alert] New Paid Consultation: ${name}`,
            messageBody: `Hello Administrator,\n\nA new video consultation appointment has been scheduled!\n\nClient Name: ${name}\nClient Email: ${email}\nDate: ${date}\nTime: ${timeSlot}\nPaid Deposit: $${(paid / 100).toFixed(2)}\nRemaining Balance: $${(balance / 100).toFixed(2)}\nNotes: ${notes}\nGoogle Meet Link: ${res.meetUrl || 'Generated'}`
          });
        }

        // Add to completed log
        completed.push(sessionId);
        localStorage.setItem('foundation_completed_bookings', JSON.stringify(completed));

        alert(`Appointment and Deposit Payment confirmed for ${date} at ${timeSlot}!\n\nGoogle Meet Link: ${res.meetUrl || 'Sent via email'}`);
        toast.success('Paid video consultation confirmed successfully!');
      } else {
        toast.error('Payment verified, but slot generation failed. Please contact support.');
      }
    } catch (e) {
      errorHandler.handleError(e, 'Contact Appointment - Success Verification Redirect');
      toast.error('Verification failed: ' + e.message);
    } finally {
      overlay.remove();
      // Clear URL query parameters safely
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}
