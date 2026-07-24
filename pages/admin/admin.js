// pages/admin/admin.js
import { store } from '/core/store.js';
import { contentDB } from '/core/db.js';
import { uploadFileToDrive } from '/core/drive-upload.js';
import { createGoogleCalendarEvent } from '/core/google-services.js'; // 👈 1. Added missing import

export function initAdminPage() {
  const radioOn = document.getElementById('radio-dev-on');
  const radioOff = document.getElementById('radio-dev-off');
  const labelOn = document.getElementById('label-dev-on');
  const labelOff = document.getElementById('label-dev-off');

  if (!radioOn || !radioOff) return;

  function syncUI(isDevMode) {
    if (isDevMode) {
      radioOn.checked = true;
      labelOn.style.background = '#38a169';
      labelOn.style.color = '#ffffff';
      labelOff.style.background = 'transparent';
      labelOff.style.color = '#a0aec0';
    } else {
      radioOff.checked = true;
      labelOff.style.background = '#e53e3e';
      labelOff.style.color = '#ffffff';
      labelOn.style.background = 'transparent';
      labelOn.style.color = '#a0aec0';
    }
  }

  syncUI(store.state.devMode);

  radioOn.addEventListener('change', () => {
    store.dispatch('SET_DEV_MODE', true);
    syncUI(true);
    setTimeout(() => window.location.reload(), 400);
  });

  radioOff.addEventListener('change', () => {
    store.dispatch('SET_DEV_MODE', false);
    syncUI(false);
  });

  // 👈 2. Toggle event-specific inputs when "event" is selected in dropdown
  const contentTypeSelect = document.getElementById('content-type');
  const eventFieldsContainer = document.getElementById('event-fields');

  contentTypeSelect?.addEventListener('change', (e) => {
    if (eventFieldsContainer) {
      eventFieldsContainer.style.display = e.target.value === 'event' ? 'block' : 'none';
    }
  });

  // Master Form Submitter
  const cmsForm = document.getElementById('cms-form');
  cmsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const contentType = document.getElementById('content-type').value;
    const contentId = document.getElementById('content-id').value;
    const title = document.getElementById('content-title').value;
    const description = document.getElementById('content-description').value;
    const visibility = document.getElementById('content-visibility').value;
    const rawBody = document.getElementById('content-body').value;
    const fileInput = document.getElementById('media-file');

    let assetData = null;

    // 1. Process File Upload if attached
    if (fileInput.files.length > 0) {
      assetData = await uploadFileToDrive(fileInput.files[0]);
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const paragraphs = rawBody ? rawBody.split('\n').filter(p => p.trim().length > 0) : [];

    // 2. Construct Master JSON Payload
    const payload = {
      type: contentType,
      id: contentId,
      title: title,
      description: description,
      author: store.state.user?.displayName || 'Admin',
      date: currentDate,
      longFormText: paragraphs.length > 0 ? paragraphs : [description],
      access: { visibility: visibility },
      preview: {
        teaserText: description,
        featuredImage: assetData ? {
          type: assetData.category,
          src: assetData.src,
          localPath: assetData.localPath
        } : null
      }
    };

    // 3. Process Event / Google Meet Integration
    if (contentType === 'event') {
      const startTimeVal = document.getElementById('event-start-time').value || '14:00';
      const endTimeVal = document.getElementById('event-end-time')?.value || '15:00'; // 👈 3. Dynamic End Time

      const eventDetails = {
        title: title,
        description: description,
        eventType: document.getElementById('event-type').value,
        date: document.getElementById('event-date').value || currentDate,
        startTime: startTimeVal,
        endTime: endTimeVal
      };

      // Create Google Calendar event & auto-generate Meet link
      const calResult = await createGoogleCalendarEvent(eventDetails);

      if (calResult) {
        payload.meetUrl = calResult.meetUrl;
        payload.calendarEventId = calResult.calendarEventId;
        payload.eventType = eventDetails.eventType;
        payload.date = eventDetails.date;
        payload.startTime = eventDetails.startTime;
        payload.endTime = eventDetails.endTime;
      }
    } 
    // 4. Custom schema fields for Podcast & Education
    else if (contentType === 'podcast' && assetData) {
      payload.audioUrl = assetData.src;
    } else if (contentType === 'education' && assetData) {
      payload.worksheets = [{
        title: fileInput.files[0].name,
        pdfUrl: assetData.src
      }];
    }

    // 5. Validate through schemaRegistry and commit to Firestore
    const success = await contentDB.saveContent(payload);
    if (success) {
      alert(`Successfully published "${title}"!`);
      e.target.reset();
      if (eventFieldsContainer) eventFieldsContainer.style.display = 'none';
    }
  });
}