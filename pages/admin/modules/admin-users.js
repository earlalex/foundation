// pages/admin/modules/admin-users.js
import { contentDB } from '../../../core/db.js';
import { toast } from '../../../utils/toast.js';

/**
 * Deduplicate user directory records by normalized email.
 * Groups users, merges attributes non-destructively, deletes secondary records,
 * and updates the primary record in Firestore and LocalStorage.
 */
export async function deduplicateUserDirectory() {
  const allUsers = await contentDB.getAllUsers();

  // Group user records by normalized email
  const groups = {};
  for (const user of allUsers) {
    const email = (user.email || '').toLowerCase().trim();
    if (!email) continue;
    if (!groups[email]) {
      groups[email] = [];
    }
    groups[email].push(user);
  }

  const roleHierarchy = { 'admin': 4, 'editor': 3, 'member': 2, 'subscriber': 1, 'prospect': 0 };
  let deduplicatedCount = 0;

  for (const email in groups) {
    const userRecords = groups[email];
    if (userRecords.length <= 1) continue;

    // Designate primary record (preferring records with role === 'admin' or googleUid)
    userRecords.sort((a, b) => {
      const aScore = (a.role === 'admin' ? 10 : 0) + (a.googleUid ? 5 : 0) + (roleHierarchy[a.role] || 0);
      const bScore = (b.role === 'admin' ? 10 : 0) + (b.googleUid ? 5 : 0) + (roleHierarchy[b.role] || 0);
      return bScore - aScore;
    });

    const primaryUser = { ...userRecords[0] };
    const secondaryUsers = userRecords.slice(1);

    for (const sec of secondaryUsers) {
      // Preserve elevated role
      const currentRank = roleHierarchy[primaryUser.role] || 0;
      const secRank = roleHierarchy[sec.role] || 0;
      const finalRole = secRank > currentRank ? sec.role : primaryUser.role;

      // Merge arrays & consents
      const mergedConsents = { ...(sec.consents || {}), ...(primaryUser.consents || {}) };
      const mergedEvents = Array.from(new Set([...(primaryUser.registeredEvents || []), ...(sec.registeredEvents || [])]));
      const mergedProducts = Array.from(new Set([...(primaryUser.purchasedProducts || []), ...(sec.purchasedProducts || [])]));

      primaryUser.role = finalRole;
      primaryUser.isAdmin = primaryUser.isAdmin || sec.isAdmin || finalRole === 'admin';
      primaryUser.googleUid = primaryUser.googleUid || sec.googleUid || null;
      primaryUser.consents = mergedConsents;
      primaryUser.registeredEvents = mergedEvents;
      primaryUser.purchasedProducts = mergedProducts;
      primaryUser.name = primaryUser.name || sec.name;
      primaryUser.affiliateCode = primaryUser.affiliateCode || sec.affiliateCode;
      primaryUser.referredBy = primaryUser.referredBy || sec.referredBy;
      primaryUser.referredCount = Math.max(primaryUser.referredCount || 0, sec.referredCount || 0);
      primaryUser.updatedAt = new Date().toISOString();

      // Delete redundant secondary record
      await contentDB.deleteUser(sec.id);
      deduplicatedCount++;
    }

    // Save primary record with merged attributes
    await contentDB.saveUser(primaryUser);
  }

  toast.success(`Successfully deduplicated ${deduplicatedCount} account records!`);
  return deduplicatedCount;
}
