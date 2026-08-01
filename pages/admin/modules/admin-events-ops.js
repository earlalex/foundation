// pages/admin/modules/admin-events-ops.js
import { initAdminEventsTab } from '../admin-events.js';
import { configManager } from '../../../core/config.js';
import { toast } from '../../../utils/toast.js';
import { errorHandler } from '../../../core/error-handler.js';

export function initAdminEventsOps() {
  initAdminEventsTab();
  initAppointmentConfig();
}

export function initAppointmentConfig() {
  const form = document.getElementById('appointment-config-form');
  if (!form) return;

  const currentCfg = configManager.current?.appointments || {
    operatingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    operatingHours: { start: "09:00", end: "17:00" },
    duration: 30,
    buffer: 15,
    notifications: {
      adminEmail: true,
      appointeeEmail: true,
      adminAlert: true
    }
  };

  // Populate days checkboxes
  const dayCheckboxes = form.querySelectorAll('input[name="operating-days"]');
  dayCheckboxes.forEach(cb => {
    cb.checked = currentCfg.operatingDays?.includes(cb.value);
  });

  // Populate time & select fields
  const startTimeInput = document.getElementById('appt-start-time');
  const endTimeInput = document.getElementById('appt-end-time');
  const durationSelect = document.getElementById('appt-duration-select');
  const bufferSelect = document.getElementById('appt-buffer-select');

  if (startTimeInput) startTimeInput.value = currentCfg.operatingHours?.start || "09:00";
  if (endTimeInput) endTimeInput.value = currentCfg.operatingHours?.end || "17:00";
  if (durationSelect) durationSelect.value = String(currentCfg.duration || "30");
  if (bufferSelect) bufferSelect.value = String(currentCfg.buffer || "15");

  // Populate notifications
  const notifAdmin = document.getElementById('appt-notif-admin');
  const notifClient = document.getElementById('appt-notif-client');
  const notifAlert = document.getElementById('appt-notif-alert');

  if (notifAdmin) notifAdmin.checked = !!currentCfg.notifications?.adminEmail;
  if (notifClient) notifClient.checked = !!currentCfg.notifications?.appointeeEmail;
  if (notifAlert) notifAlert.checked = !!currentCfg.notifications?.adminAlert;

  // Handle Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedDays = Array.from(form.querySelectorAll('input[name="operating-days"]:checked')).map(cb => cb.value);
    const updatedAppointments = {
      operatingDays: selectedDays,
      operatingHours: {
        start: startTimeInput.value,
        end: endTimeInput.value
      },
      duration: Number(durationSelect.value),
      buffer: Number(bufferSelect.value),
      notifications: {
        adminEmail: notifAdmin.checked,
        appointeeEmail: notifClient.checked,
        adminAlert: notifAlert.checked
      }
    };

    try {
      const success = await configManager.saveToFirebase({
        ...configManager.current,
        appointments: updatedAppointments
      });

      if (success) {
        toast.success('Appointment & Consultation scheduler settings saved!');
      } else {
        toast.error('Failed to save scheduler guidelines.');
      }
    } catch (err) {
      errorHandler.handleError(err, 'Admin Appointment Config');
      toast.error(`Error saving guidelines: ${err.message}`);
    }
  });
}
