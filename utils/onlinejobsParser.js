// utils/onlinejobsParser.js - OnlineJobs.ph Candidate Inbound Parser & Normalizer

/**
 * Normalizes a candidate profile payload (JSON object or string) into the standard va_candidate schema.
 * @param {Object|string} data - Inbound OnlineJobs.ph candidate profile or webhook payload
 * @returns {Object} Normalized candidate object
 */
export function parseOnlineJobsProfile(data) {
  let obj = data;
  if (typeof data === 'string') {
    try {
      obj = JSON.parse(data);
    } catch (e) {
      throw new Error("Invalid OnlineJobs.ph profile payload: JSON parsing failed.");
    }
  }

  if (!obj || typeof obj !== 'object') {
    throw new Error("Invalid OnlineJobs.ph profile payload: Data must be a non-null object.");
  }

  // Handle nested skill parsing
  let skills = [];
  if (Array.isArray(obj.skills)) {
    skills = obj.skills;
  } else if (typeof obj.skills === 'string') {
    skills = obj.skills.split(',').map(s => s.trim()).filter(Boolean);
  } else if (obj.job_skills) {
    skills = typeof obj.job_skills === 'string' ? obj.job_skills.split(',').map(s => s.trim()).filter(Boolean) : obj.job_skills;
  }

  const name = obj.name || obj.fullName || obj.contactName || 'Anonymous Candidate';
  const email = obj.email || obj.emailAddress || '';
  const phone = obj.phone || obj.phoneNumber || obj.mobile || '';
  const location = obj.location || obj.city || 'Manila, PH';
  const expectedSalary = Number(obj.expectedSalary) || Number(obj.salary) || Number(obj.hourlyRate * 160) || 600;

  // Extract Philippines local bank details or e-wallet mapping for Wise Payouts
  const bankDetails = {
    bankName: obj.bankName || obj.bankDetails?.bankName || obj.bankCode || 'GCASH',
    accountNumber: obj.accountNumber || obj.bankDetails?.accountNumber || obj.phone || phone || '09123456789'
  };

  const id = obj.candidateId || obj.id || `cand_olj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const onlineJobsProfileUrl = obj.onlineJobsProfileUrl || obj.onlineJobsLink || obj.profileUrl || '';
  const resumeUrl = obj.resumeUrl || `/resumes/${name.toLowerCase().replace(/\s+/g, '_')}_resume.pdf`;

  // Status mapping matching defined applied, interviewing, hired, rejected
  let status = obj.status || 'applied';
  if (status === 'prospect') status = 'applied';

  return {
    id,
    type: 'va_candidate',
    candidateId: String(id),
    name,
    email,
    phone,
    location,
    skills,
    expectedSalary,
    bankDetails,
    onlineJobsProfileUrl,
    resumeUrl,
    status
  };
}

/**
 * Parses a CSV export file of OnlineJobs.ph candidates.
 * @param {string} csvText - Raw CSV export string
 * @returns {Array<Object>} Mapped candidate profiles
 */
export function parseOnlineJobsCSV(csvText) {
  if (!csvText) return [];
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim());
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    // Basic CSV cell extraction split by comma (ignoring commas inside quotes for simplicity)
    const cols = lines[i].split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length < headers.length) continue;

    const row = {};
    headers.forEach((h, index) => {
      row[h] = cols[index];
    });

    try {
      results.push(parseOnlineJobsProfile(row));
    } catch (e) {
      console.warn("[OnlineJobs Parser]: Skipped row parsing:", lines[i], e.message);
    }
  }

  return results;
}
