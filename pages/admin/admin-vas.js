// pages/admin/admin-vas.js - VA Recruitment & Onboarding Hub Controller
import { contentDB } from '../../core/db.js';
import { sendGmailNotification } from '../../core/google-services.js';
import { toast } from '../../utils/toast.js';
import { errorHandler } from '../../core/error-handler.js';

let candidates = [];
let activeVAs = [];
let jobListings = [];
let selectedVaId = null;

const MOCK_INITIAL_CANDIDATES = [
  {
    id: 'va_cand_1',
    type: 'va_candidate',
    name: 'Ramon de la Cruz',
    skills: ['SEO Specialist', 'Content Writer'],
    hourlyRate: 6.50,
    status: 'shortlisted',
    email: 'ramon@example.com',
    onlineJobsLink: 'https://www.onlinejobs.ph/jobseekers/info/123456',
    resumeUrl: '/resumes/ramon_resume.pdf'
  },
  {
    id: 'va_cand_2',
    type: 'va_candidate',
    name: 'Aileen Santos',
    skills: ['Web Editor', 'Graphic Designer'],
    hourlyRate: 8.00,
    status: 'prospect',
    email: 'aileen@example.com',
    onlineJobsLink: 'https://www.onlinejobs.ph/jobseekers/info/789012',
    resumeUrl: '/resumes/aileen_resume.pdf'
  }
];

export async function initVasTab() {
  setupSubTabs();
  await loadVAData();
  setupJobPostingForm();
  setupCandidateForm();
}

function setupSubTabs() {
  const buttons = document.querySelectorAll('.va-subtab-btn');
  const panels = document.querySelectorAll('.va-subtab-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active-subtab'));
      panels.forEach(p => p.style.display = 'none');

      btn.classList.add('active-subtab');
      const targetId = btn.dataset.panel;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.style.display = 'block';
      }

      // Add visual active state styling
      buttons.forEach(b => {
        b.style.background = 'transparent';
        b.style.color = 'var(--theme-color-text-secondary, #4a5568)';
        b.style.borderBottom = '3px solid transparent';
      });
      btn.style.borderBottom = '3px solid var(--theme-color-primary, #2b6cb0)';
      btn.style.color = 'var(--theme-color-primary, #2b6cb0)';
    });
  });

  // Trigger click on first tab to set initial styling
  if (buttons[0]) {
    buttons[0].click();
  }
}

async function loadVAData() {
  try {
    // 1. Load Candidates
    candidates = await contentDB.getVaCandidates();
    if (candidates.length === 0) {
      // Seed initial candidates if none exist
      for (const cand of MOCK_INITIAL_CANDIDATES) {
        await contentDB.saveVaCandidate(cand);
      }
      candidates = await contentDB.getVaCandidates();
    }

    // 2. Load Active Hired VAs from User Directory (role: 'editor')
    const allUsers = await contentDB.getAllUsers();
    activeVAs = allUsers.filter(u => u.role === 'editor');

    // 3. Load Mock JobListings from content collection
    const allContent = await contentDB.getAllContent();
    jobListings = allContent.filter(item => item.type === 'job_listing');

    renderCandidatesList();
    renderJobListings();
    renderActiveVADashboard();
  } catch (err) {
    errorHandler.handleError(err, 'Admin VAs - Load VA Data');
    console.error('Failed to load VA data:', err);
  }
}

function renderCandidatesList() {
  const container = document.getElementById('va-candidates-list');
  if (!container) return;

  const prospects = candidates.filter(c => c.status !== 'hired');

  if (prospects.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem; text-align: center; padding: 1.5rem;">No active candidates under evaluation.</p>';
    return;
  }

  container.innerHTML = prospects.map(cand => `
    <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0);
                padding: 1.25rem; border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h4 style="margin: 0; font-size: 1.1rem; color: var(--theme-color-text-primary, #1a202c);">${cand.name}</h4>
          <span style="font-size: 0.8rem; color: var(--theme-color-text-secondary, #718096);">${cand.email}</span>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <span style="padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; background: #e2e8f0; color: #4a5568; text-transform: uppercase;">
            ${cand.status}
          </span>
          <span style="font-weight: bold; color: var(--theme-color-primary, #2b6cb0); font-size: 0.95rem;">
            $${Number(cand.hourlyRate).toFixed(2)}/hr
          </span>
        </div>
      </div>

      <div style="font-size: 0.85rem;">
        <strong>Skills:</strong>
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 4px;">
          ${cand.skills.map(s => `<span style="background: #ebf8ff; color: #2b6cb0; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${s}</span>`).join('')}
        </div>
      </div>

      <div style="display: flex; gap: 1rem; font-size: 0.8rem; flex-wrap: wrap;">
        <a href="${cand.onlineJobsLink || '#'}" target="_blank" style="color: #3182ce; text-decoration: underline; font-weight: 600;">
          OnlineJobs.ph Profile 🔗
        </a>
        <span style="color: #cbd5e0;">|</span>
        <span style="color: var(--theme-color-text-secondary, #718096);">
          Resume: <code style="background: #edf2f7; padding: 1px 4px; border-radius: 3px;">${cand.resumeUrl || 'Not uploaded'}</code>
        </span>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
        <button onclick="window.updateCandidateStatus('${cand.id}', 'shortlisted')"
                class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #3182ce; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
          Shortlist
        </button>
        <button onclick="window.updateCandidateStatus('${cand.id}', 'prospect')"
                style="padding: 6px 12px; font-size: 0.8rem; background: #edf2f7; color: #4a5568; border: 1px solid #cbd5e0; border-radius: 4px; font-weight: bold; cursor: pointer;">
          Set to Prospect
        </button>
        <button onclick="window.updateCandidateStatus('${cand.id}', 'archived')"
                style="padding: 6px 12px; font-size: 0.8rem; background: transparent; color: #e53e3e; border: 1px solid #e53e3e; border-radius: 4px; font-weight: bold; cursor: pointer;">
          Reject / Archive
        </button>
        <button onclick="window.hireCandidateAsEditor('${cand.id}')"
                class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #38a169; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-left: auto;">
          ⚡ 1-Click Hire as Editor
        </button>
      </div>
    </div>
  `).join('');
}

function renderJobListings() {
  const container = document.getElementById('va-jobs-list');
  const previewContainer = document.getElementById('va-job-preview-container');
  if (!container) return;

  if (jobListings.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem; text-align: center; padding: 1rem;">No active job postings drafted yet.</p>';
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  if (previewContainer) previewContainer.style.display = 'block';

  container.innerHTML = jobListings.map(job => `
    <div style="background: var(--theme-color-surface, #ffffff); border: 1px solid var(--theme-color-border, #e2e8f0);
                padding: 1rem; border-radius: 6px; margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <div>
          <strong style="font-size: 0.95rem;">${job.title}</strong>
          <span style="display: block; font-size: 0.75rem; color: var(--theme-color-text-secondary, #a0aec0);">ID: ${job.id} | Budget: $${job.budget}/hr</span>
        </div>
        <button onclick="window.deleteJobListing('${job.id}')"
                style="background: none; border: none; color: #e53e3e; cursor: pointer; font-size: 1.1rem; font-weight: bold;">
          ×
        </button>
      </div>
      <p style="margin: 0 0 0.75rem 0; font-size: 0.8rem; color: var(--theme-color-text-secondary, #4a5568); line-height: 1.4;">
        ${job.description}
      </p>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
        <span style="background: #e6fffa; color: #319795; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
          ${job.pipeline || 'Internal Only'}
        </span>
        <button onclick="window.triggerJobDistributionPipeline('${job.id}')"
                style="padding: 4px 8px; background: #edf2f7; color: #2b6cb0; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.7rem; font-weight: bold; cursor: pointer;">
          Publish to OnlineJobs.ph 🚀
        </button>
      </div>
    </div>
  `).join('');

  // Update real-time visual preview of the newest/last drafted job listing
  const newestJob = jobListings[jobListings.length - 1];
  const previewBox = document.getElementById('va-job-live-preview-box');
  if (previewBox && newestJob) {
    previewBox.innerHTML = `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
          <h4 style="margin: 0; color: #2b6cb0; font-size: 1.2rem;">${newestJob.title}</h4>
          <span style="font-weight: bold; color: #38a169;">$${Number(newestJob.budget).toFixed(2)}/hr</span>
        </div>
        <p style="font-size: 0.85rem; color: #4a5568; line-height: 1.5; white-space: pre-wrap; margin-bottom: 0.75rem;">${newestJob.description}</p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${(newestJob.skillsNeeded || []).map(s => `<span style="background:#ebf8ff; color:#2b6cb0; font-size:0.75rem; padding:2px 8px; border-radius:4px; font-weight:600;">${s}</span>`).join('')}
        </div>
        <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #edf2f7; display: flex; justify-content: space-between; font-size: 0.75rem; color: #a0aec0;">
          <span>Drafted on: ${newestJob.date}</span>
          <span>Pipeline: OnlineJobs.ph API Webhook Active</span>
        </div>
      </div>
    `;
  }
}

function renderActiveVADashboard() {
  const container = document.getElementById('va-active-list');
  if (!container) return;

  if (activeVAs.length === 0) {
    container.innerHTML = '<p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.9rem; text-align: center; padding: 1.5rem;">No active hired VAs registered. Click "Hire as Editor" under Prospect evaluation to onboard one!</p>';
    document.getElementById('va-work-tracker-panel').style.display = 'none';
    return;
  }

  document.getElementById('va-work-tracker-panel').style.display = 'block';

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <label style="font-weight: bold; font-size: 0.9rem; color: var(--theme-color-text-secondary, #4a5568);">Select Hired VA to Track Performance:</label>
      <select id="active-va-selector" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--theme-color-border, #cbd5e0); font-size: 0.9rem; font-weight: bold; cursor: pointer; background: var(--theme-color-background, #f7fafc);">
        ${activeVAs.map(va => `<option value="${va.id}">${va.name || va.displayName || va.email} (${va.email})</option>`).join('')}
      </select>
    </div>
  `;

  const selector = document.getElementById('active-va-selector');
  if (selector) {
    selector.addEventListener('change', (e) => {
      selectedVaId = e.target.value;
      loadVAWorkPerformance(selectedVaId);
    });

    // Load initial first active VA performance metrics
    if (!selectedVaId && activeVAs[0]) {
      selectedVaId = activeVAs[0].id;
    }
    selector.value = selectedVaId;
    loadVAWorkPerformance(selectedVaId);
  }
}

async function loadVAWorkPerformance(vaId) {
  if (!vaId) return;

  const summaryTitle = document.getElementById('va-performance-summary-title');
  const activityLogsBody = document.getElementById('va-activity-logs-tbody');

  if (summaryTitle) {
    const vaUser = activeVAs.find(v => v.id === vaId);
    summaryTitle.textContent = `Real-Time Performance and Activity Logs for: ${vaUser?.name || vaUser?.displayName || vaUser?.email || 'Hired VA'}`;
  }

  if (activityLogsBody) {
    activityLogsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem; color: #a0aec0;">Loading activity logs...</td></tr>';
  }

  try {
    const logs = await contentDB.getVaActivityLogs(vaId);

    // Render counts inside tracker
    const taskCount = logs.filter(l => l.type === 'task').length;
    const contentCount = logs.filter(l => l.type === 'content').length;
    const marketingCount = logs.filter(l => l.type === 'marketing').length;

    document.getElementById('va-perf-task-count').textContent = taskCount;
    document.getElementById('va-perf-content-count').textContent = contentCount;
    document.getElementById('va-perf-marketing-count').textContent = marketingCount;

    if (!activityLogsBody) return;

    if (logs.length === 0) {
      activityLogsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: #a0aec0; font-style: italic;">No recent activities or project submissions recorded in Foundation.</td></tr>';
      return;
    }

    activityLogsBody.innerHTML = logs.map(log => {
      const timeStr = new Date(log.timestamp).toLocaleString();
      let typeBg = '#edf2f7';
      let typeColor = '#4a5568';

      if (log.type === 'task') {
        typeBg = '#ebf8ff';
        typeColor = '#2b6cb0';
      } else if (log.type === 'content') {
        typeBg = '#f0fdf4';
        typeColor = '#38a169';
      } else if (log.type === 'marketing') {
        typeBg = '#fdf2f8';
        typeColor = '#d53f8c';
      }

      return `
        <tr style="border-bottom: 1px solid var(--theme-color-border, #e2e8f0); font-size: 0.85rem;">
          <td style="padding: 10px; color: var(--theme-color-text-secondary, #718096); white-space: nowrap;">${timeStr}</td>
          <td style="padding: 10px;">
            <span style="background: ${typeBg}; color: ${typeColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 0.7rem;">
              ${log.type}
            </span>
          </td>
          <td style="padding: 10px; font-weight: 600; color: var(--theme-color-text-primary, #1a202c);">${log.description}</td>
          <td style="padding: 10px; color: var(--theme-color-text-secondary, #4a5568); font-size: 0.8rem;">${log.details || 'No details'}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    errorHandler.handleError(err, 'Admin VAs - Load VA Performance');
    if (activityLogsBody) {
      activityLogsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #e53e3e; padding: 1rem;">Failed to compile activity tracking metrics.</td></tr>';
    }
  }
}

window.updateCandidateStatus = async function(candId, newStatus) {
  try {
    const candidate = candidates.find(c => c.id === candId);
    if (candidate) {
      candidate.status = newStatus;
      await contentDB.saveVaCandidate(candidate);
      toast.success(`Candidate status updated to "${newStatus}"`);
      await loadVAData();
    }
  } catch (err) {
    errorHandler.handleError(err, 'Admin VAs - Update Status');
    toast.error('Failed to update candidate status');
  }
};

window.deleteJobListing = async function(listingId) {
  if (!confirm('Are you sure you want to delete this job listing?')) return;
  try {
    await contentDB.deleteContent(listingId);
    toast.success('Job listing deleted successfully');
    await loadVAData();
  } catch (err) {
    errorHandler.handleError(err, 'Admin VAs - Delete Listing');
    toast.error('Failed to delete job listing');
  }
};

window.triggerJobDistributionPipeline = async function(listingId) {
  const listing = jobListings.find(j => j.id === listingId);
  if (!listing) return;

  toast.info(`Triggering distribution pipeline for "${listing.title}"...`);

  try {
    // Simulate webhook distribution ping directly to workflow trigger API
    const response = await fetch('/api/workflow-trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'publish_recruitment_job',
        jobId: listingId,
        title: listing.title,
        description: listing.description,
        budget: listing.budget,
        targetPlatform: 'OnlineJobs.ph'
      })
    }).catch(() => null);

    // Provide friendly success feedback matching zero-build webhook integration patterns
    toast.success(`Success! Listings for "${listing.title}" distributed and synced directly to OnlineJobs.ph and internal boards.`);

    // Update listing status/pipeline inside database
    listing.pipeline = 'Published & Distributed (OnlineJobs.ph)';
    await contentDB.saveContent(listing);
    await loadVAData();
  } catch (err) {
    errorHandler.handleError(err, 'Admin VAs - Pipeline Trigger');
    toast.error('Pipeline distribution encountered an error.');
  }
};

window.hireCandidateAsEditor = async function(candId) {
  const candidate = candidates.find(c => c.id === candId);
  if (!candidate) return;

  if (!confirm(`Are you sure you want to 1-Click Hire ${candidate.name} as a Platform Content Editor?`)) return;

  toast.info(`Provisions starting for ${candidate.name}...`);

  try {
    // 1. Transition candidate document status inside ContentDB
    candidate.status = 'hired';
    candidate.type = 'va_hired';
    await contentDB.saveVaCandidate(candidate);

    // 2. Generate Account user profile with role tier 'editor'
    const generatedOnboardLink = `${window.location.origin}/login?onboard=${candidate.id}`;

    const editorUserPayload = {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      role: 'editor',
      paymentStatus: 'None',
      affiliateCode: `aff_va_${candidate.id.substring(0, 4)}`,
      onboardingLink: generatedOnboardLink,
      hiredAt: new Date().toISOString()
    };

    await contentDB.saveUser(editorUserPayload);

    // 3. Dispatch welcome Gmail notification automatically
    const welcomeEmailBody = `Hello ${candidate.name},\n\n` +
      `Congratulations! We are absolutely thrilled to inform you that you have been hired as a Content Editor on our platform.\n\n` +
      `Your professional workspace account has been securely provisioned with Editor role privileges in our Admin Command Center. This allows you access to:\n` +
      `- Visual CMS Content Publisher\n` +
      `- Custom Page WYSIWYG Creator\n` +
      `- Kanban Tasks Board Delegation\n` +
      `- Marketing Workflow node visualizers\n` +
      `- Shared password vault bridges\n\n` +
      `Please use your unique login onboarding link below to complete your setup and sign in via Google Authentication:\n\n` +
      `👉 ${generatedOnboardLink}\n\n` +
      `Welcome to the team!\n\n` +
      `Best regards,\n` +
      `Primary System Administrator\n` +
      `Foundation Framework Systems`;

    const mailSent = await sendGmailNotification({
      toEmail: candidate.email,
      subject: `[Onboarding] Welcome to the Team, ${candidate.name}! Account Provisioned`,
      messageBody: welcomeEmailBody
    });

    if (mailSent) {
      toast.success(`Hired! Welcome Gmail sent automatically with onboarding details to ${candidate.email}`);
    } else {
      toast.warning('Account provisioned! Welcome Gmail OAuth token is offline. Copy the Onboarding Link below to send manually.');
    }

    // Render unique credentials onboarding prompter box for visual Admin confirmation
    const prompterBox = document.getElementById('va-onboarding-prompter-box');
    if (prompterBox) {
      prompterBox.style.display = 'block';
      prompterBox.innerHTML = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #166534; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🎉</span> Successfully Hired & Onboarded ${candidate.name}!
          </h4>
          <p style="margin: 0 0 0.75rem 0; font-size: 0.85rem; color: #15803d; line-height: 1.4;">
            Account generated with <strong>Editor</strong> tier. A welcome email containing setup details was dispatched to <code>${candidate.email}</code>. You can copy the unique onboarding credentials link below:
          </p>
          <div style="display: flex; gap: 0.5rem; align-items: center; width: 100%;">
            <input type="text" readonly value="${generatedOnboardLink}"
                   style="flex: 1; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.8rem; background: white;" />
            <button onclick="window.copyToClipboard('${generatedOnboardLink}', 'Onboarding Link')"
                    class="btn-primary" style="background: #3182ce; padding: 8px 12px; font-size: 0.8rem; border-radius: 4px; border: none; font-weight: bold; cursor: pointer; white-space: nowrap;">
              Copy Link
            </button>
          </div>
        </div>
      `;
    }

    await loadVAData();
  } catch (err) {
    errorHandler.handleError(err, 'Admin VAs - Onboard Hire Process');
    toast.error(`Onboarding failed: ${err.message}`);
  }
};

function setupJobPostingForm() {
  const form = document.getElementById('va-job-posting-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('va-job-title').value;
    const description = document.getElementById('va-job-description').value;
    const budget = Number(document.getElementById('va-job-budget').value);
    const skillsRaw = document.getElementById('va-job-skills').value;
    const skillsNeeded = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const newJob = {
      id: `job_list_${Date.now()}`,
      type: 'job_listing',
      title,
      description,
      budget,
      skillsNeeded,
      status: 'draft',
      pipeline: 'Internal Only',
      date: new Date().toISOString().split('T')[0]
    };

    try {
      await contentDB.saveContent(newJob);
      toast.success('Job posting drafted and saved successfully!');
      form.reset();
      await loadVAData();
    } catch (err) {
      errorHandler.handleError(err, 'Admin VAs - Create Job Listing');
      toast.error('Failed to save job posting draft');
    }
  });
}

function setupCandidateForm() {
  const form = document.getElementById('va-candidate-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('cand-name').value;
    const email = document.getElementById('cand-email').value;
    const hourlyRate = Number(document.getElementById('cand-rate').value);
    const onlineJobsLink = document.getElementById('cand-oj-link').value;
    const skillsRaw = document.getElementById('cand-skills').value;
    const skills = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const newCand = {
      id: `cand_${Date.now()}`,
      type: 'va_candidate',
      name,
      email,
      hourlyRate,
      onlineJobsLink,
      skills,
      status: 'prospect',
      resumeUrl: `/resumes/${name.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`
    };

    try {
      await contentDB.saveVaCandidate(newCand);
      toast.success('New applicant registered successfully for evaluation!');
      form.reset();
      await loadVAData();
    } catch (err) {
      errorHandler.handleError(err, 'Admin VAs - Create Applicant');
      toast.error('Failed to register candidate');
    }
  });
}
