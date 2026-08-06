// pages/admin/modules/admin-identity.js
import { initSiteSettingsTab } from '../admin-site-settings.js';
import { initBusinessProfileTab } from '../admin-business-profile.js';
import { initPublicProfileTab } from '../admin-public-profile.js';
import { initIntegrationsTab } from '../admin-integrations.js';

export function initAdminIdentity() {
  initSiteSettingsTab();
  initBusinessProfileTab();
  initPublicProfileTab();
  initIntegrationsTab();
}
