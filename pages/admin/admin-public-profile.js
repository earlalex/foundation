// pages/admin/admin-public-profile.js - Public Author Profile management
import { uploadFileToDrive } from '../../core/drive-upload.js';
import { configManager } from '../../core/config.js';
import { toast } from '../../utils/toast.js';

export function initPublicProfileTab() {
  const currentCfg = configManager.current || {};
  const authorProfile = currentCfg.authorProfile || {};
  
  // Form elements
  const authorNameInput = document.getElementById('author-name');
  const authorRoleInput = document.getElementById('author-role');
  const authorTaglineInput = document.getElementById('author-tagline');
  const authorShortBioInput = document.getElementById('author-short-bio');
  const authorFullBioInput = document.getElementById('author-full-bio');
  const authorGithubInput = document.getElementById('author-github');
  const authorTwitterInput = document.getElementById('author-twitter');
  const authorLinkedinInput = document.getElementById('author-linkedin');

  // Social media links
  const authorFacebookInput = document.getElementById('author-facebook');
  const authorInstagramInput = document.getElementById('author-instagram');
  const authorTiktokInput = document.getElementById('author-tiktok');
  const authorYoutubeInput = document.getElementById('author-youtube');

  // Custom links
  const customLinksContainer = document.getElementById('author-custom-links-container');
  const addCustomLinkBtn = document.getElementById('btn-add-custom-link');

  // Load existing values
  if (authorNameInput) authorNameInput.value = authorProfile.name || '';
  if (authorRoleInput) authorRoleInput.value = authorProfile.role || '';
  if (authorTaglineInput) authorTaglineInput.value = authorProfile.tagline || '';
  if (authorShortBioInput) authorShortBioInput.value = authorProfile.shortBio || '';
  if (authorFullBioInput) authorFullBioInput.value = authorProfile.fullBio || '';
  if (authorGithubInput) authorGithubInput.value = authorProfile.socials?.github || '';
  if (authorTwitterInput) authorTwitterInput.value = authorProfile.socials?.twitter || '';
  if (authorLinkedinInput) authorLinkedinInput.value = authorProfile.socials?.linkedin || '';

  if (authorFacebookInput) authorFacebookInput.value = authorProfile.socials?.facebook || '';
  if (authorInstagramInput) authorInstagramInput.value = authorProfile.socials?.instagram || '';
  if (authorTiktokInput) authorTiktokInput.value = authorProfile.socials?.tiktok || '';
  if (authorYoutubeInput) authorYoutubeInput.value = authorProfile.socials?.youtube || '';

  // Render pre-existing custom links
  const initialCustomLinks = authorProfile.customLinks || [];
  if (customLinksContainer) {
    customLinksContainer.innerHTML = '';
    initialCustomLinks.forEach(link => {
      addCustomLinkRow(link.label, link.url);
    });
  }

  function addCustomLinkRow(label = '', url = '') {
    if (!customLinksContainer) return;
    const div = document.createElement('div');
    div.className = 'custom-link-row';
    div.style.display = 'flex';
    div.style.gap = '0.5rem';
    div.style.alignItems = 'center';
    div.innerHTML = `
      <input type="text" placeholder="Link Label (e.g., Substack)" value="${label}" class="custom-link-label" style="flex: 1; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
      <input type="url" placeholder="URL (e.g., https://substack.com/...)" value="${url}" class="custom-link-url" style="flex: 2; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px;" />
      <button type="button" class="btn-delete-custom-link" style="padding: 6px 12px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
    `;
    div.querySelector('.btn-delete-custom-link').addEventListener('click', () => div.remove());
    customLinksContainer.appendChild(div);
  }

  addCustomLinkBtn?.addEventListener('click', () => addCustomLinkRow());

  document.getElementById('author-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const avatarInput = document.getElementById('author-avatar-file');
      const signatureInput = document.getElementById('author-signature-file');
      let avatarUrl = authorProfile.avatarUrl || null;
      let signatureUrl = authorProfile.signatureUrl || null;

      if (avatarInput && avatarInput.files.length > 0) {
        const res = await uploadFileToDrive(avatarInput.files[0]);
        if (res) avatarUrl = res.src;
      }
      if (signatureInput && signatureInput.files.length > 0) {
        const res = await uploadFileToDrive(signatureInput.files[0]);
        if (res) signatureUrl = res.src;
      }

      // Assemble custom links
      const customLinkRows = document.querySelectorAll('.custom-link-row');
      const customLinks = [];
      customLinkRows.forEach(row => {
        const labelVal = row.querySelector('.custom-link-label').value.trim();
        const urlVal = row.querySelector('.custom-link-url').value.trim();
        if (labelVal && urlVal) {
          customLinks.push({ label: labelVal, url: urlVal, icon: 'link' });
        }
      });

      const updatedProfile = {
        ...configManager.current,
        authorProfile: {
          name: authorNameInput.value,
          role: authorRoleInput.value,
          tagline: authorTaglineInput.value,
          avatarUrl,
          signatureUrl,
          shortBio: authorShortBioInput.value,
          fullBio: authorFullBioInput.value,
          socials: {
            github: authorGithubInput.value,
            twitter: authorTwitterInput.value,
            linkedin: authorLinkedinInput.value,
            facebook: authorFacebookInput?.value || '',
            instagram: authorInstagramInput?.value || '',
            tiktok: authorTiktokInput?.value || '',
            youtube: authorYoutubeInput?.value || ''
          },
          customLinks
        }
      };
      const success = await configManager.saveToFirebase(updatedProfile);
      if (success) {
        toast.success(`Public Author Profile saved for "${authorNameInput.value}"!`);
      } else {
        toast.error('Failed to save author profile. Please try again.');
      }
    } catch (err) {
      toast.error(`Error saving author profile: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}
