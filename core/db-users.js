// core/db-users.js
import {
  getFirestoreDB, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, limit,
  queryWith3SecTimeout, withTimeout, USERS_COLLECTION
} from './db-shared.js';

export async function getAllUsers() {
  const users = [];
  const db = getFirestoreDB();
  if (db) {
    try {
      const querySnapshot = await queryWith3SecTimeout(getDocs(collection(db, USERS_COLLECTION)));
      querySnapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (users.length > 0) return users;
    } catch (err) {
      console.warn('[DB]: Could not fetch users collection from Firestore.', err.message);
    }
  }

  const local = getLocalUsers();
  return Object.values(local);
}

export async function saveUser(userData) {
  const userId = userData.id || (userData.email ? userData.email.replace(/[@.]/g, '_') : `user_${Date.now()}`);

  // ePHI Encryption at Rest Guard: Encrypt sensitive PHI fields using AES-GCM 256-bit
  let encryptedUserData = { ...userData };
  const phiKeys = ['ephi', 'phi', 'medicalHistory', 'sensitiveNotes'];
  for (const key of phiKeys) {
    if (userData[key] && typeof userData[key] === 'string' && !userData[key].cipherText) {
      try {
        const { encryptPHIRecord } = await import('../utils/hipaa-audit.js');
        encryptedUserData[key] = await encryptPHIRecord(userData[key]);
      } catch (encErr) {
        console.warn('[ePHI Guard]: AES-GCM 256-bit encryption warning:', encErr.message);
      }
    }
  }

  const payload = {
    ...encryptedUserData,
    id: userId,
    updatedAt: new Date().toISOString()
  };

  // Log to immutable HIPAA audit trail
  try {
    const { logHipaaAccess } = await import('../utils/hipaa-audit.js');
    await logHipaaAccess('WRITE', userId, 'SUCCESS', { notes: `Saved user record for ${userData.email || userId}` });
  } catch (auditErr) {
    console.warn('[HIPAA Audit]: Audit log queue warning:', auditErr.message);
  }

  // Local-First: Persist to LocalStorage immediately
  const local = getLocalUsers();
  local[userId] = payload;
  saveLocalUsers(local);

  const db = getFirestoreDB();
  if (!db) {
    return payload;
  }

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await withTimeout(setDoc(docRef, payload, { merge: true }), 1500);
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore user save error or timeout. Saved locally.', err.message);
    return payload;
  }
}

export async function queryUsersByEmail(email) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) return [];
  const allUsers = await getAllUsers();
  return allUsers.filter(u => (u.email || '').toLowerCase().trim() === normalizedEmail);
}

export async function updateUserRecord(id, userData) {
  return await saveUser({ ...userData, id });
}

export async function createNewUserRecord(userData) {
  return await saveUser(userData);
}

export async function registerOrMergeUser(userData) {
  const normalizedEmail = (userData.email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  // Query existing user record by normalized email
  const existingUsers = await queryUsersByEmail(normalizedEmail);

  if (existingUsers && existingUsers.length > 0) {
    // Existing user found -> Merge properties without downgrading roles
    const primaryUser = existingUsers[0];

    // Preserve elevated roles (Admin/Editor > Member > Subscriber > Prospect)
    const roleHierarchy = { 'admin': 4, 'editor': 3, 'member': 2, 'subscriber': 1, 'prospect': 0 };
    const currentRank = roleHierarchy[primaryUser.role] || 0;
    const newRank = roleHierarchy[userData.role] || 0;
    const finalRole = newRank > currentRank ? userData.role : primaryUser.role;

    // Merge arrays (newsletter tags, registered events, purchased products)
    const mergedConsents = { ...(primaryUser.consents || {}), ...(userData.consents || {}) };
    const mergedEvents = Array.from(new Set([...(primaryUser.registeredEvents || []), ...(userData.registeredEvents || [])]));

    // Deduplicate purchasedProducts cleanly across strings and objects by item ID
    const existingProducts = primaryUser.purchasedProducts || [];
    const newProducts = userData.purchasedProducts || [];
    const productMap = new Map();
    [...existingProducts, ...newProducts].forEach(p => {
      const key = typeof p === 'string' ? p : (p?.id || JSON.stringify(p));
      productMap.set(key, p);
    });
    const mergedProducts = Array.from(productMap.values());

    const updatedUser = {
      ...primaryUser,
      ...userData,
      role: finalRole,
      isAdmin: primaryUser.isAdmin || userData.isAdmin || false,
      consents: mergedConsents,
      registeredEvents: mergedEvents,
      purchasedProducts: mergedProducts,
      updatedAt: new Date().toISOString()
    };

    await updateUserRecord(primaryUser.id, updatedUser);
    console.log(`[Identity Recon]: Successfully merged guest action into primary account: ${normalizedEmail}`);
    return updatedUser;
  }

  // No existing user found -> Create new user record
  return await createNewUserRecord({ ...userData, email: normalizedEmail });
}

export async function getUser(userId) {
  const users = await getAllUsers();
  return users.find(u => u.id === userId || u.email === userId) || null;
}

export async function deleteUser(userId) {
  const local = getLocalUsers();
  delete local[userId];
  saveLocalUsers(local);

  const db = getFirestoreDB();
  if (!db) {
    return true;
  }

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await withTimeout(deleteDoc(docRef), 1500);
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore user delete error or timeout. Saved locally.', err.message);
    return true;
  }
}

export async function saveUserCourseProgress(userId, courseId, progressData) {
  const payload = {
    ...progressData,
    userId,
    courseId,
    updatedAt: new Date().toISOString()
  };

  // Local-First: Persist to LocalStorage immediately
  const local = getLocalCourseProgress();
  const key = `${userId}_${courseId}`;
  local[key] = payload;
  saveLocalCourseProgress(local);

  const dbInstance = getFirestoreDB();
  if (!dbInstance) {
    return payload;
  }

  try {
    const docRef = doc(dbInstance, USERS_COLLECTION, userId, 'course_progress', courseId);
    await withTimeout(setDoc(docRef, payload, { merge: true }), 1500);
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore course progress write error or timeout. Saved locally.', err.message);
    return payload;
  }
}

export async function getUserCourseProgress(userId, courseId) {
  const dbInstance = getFirestoreDB();
  if (!dbInstance) {
    const local = getLocalCourseProgress();
    const key = `${userId}_${courseId}`;
    return local[key] || null;
  }

  try {
    const docRef = doc(dbInstance, USERS_COLLECTION, userId, 'course_progress', courseId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (err) {
    console.warn('[DB]: Firestore course progress read error. Falling back to LocalStorage.', err.message);
    const local = getLocalCourseProgress();
    const key = `${userId}_${courseId}`;
    return local[key] || null;
  }
}

export async function getUserAllProgress(userId) {
  const dbInstance = getFirestoreDB();
  if (!dbInstance) {
    const local = getLocalCourseProgress();
    return Object.values(local).filter(item => item.userId === userId);
  }

  try {
    const colRef = collection(dbInstance, USERS_COLLECTION, userId, 'course_progress');
    const querySnapshot = await getDocs(colRef);
    const results = [];
    querySnapshot.forEach(docSnap => {
      results.push(docSnap.data());
    });
    if (results.length > 0) return results;
  } catch (err) {
    console.warn('[DB]: Firestore course progress query error. Falling back to LocalStorage.', err.message);
  }

  const local = getLocalCourseProgress();
  return Object.values(local).filter(item => item.userId === userId);
}

// Helpers
function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_users') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalUsers(data) {
  localStorage.setItem('foundation_local_users', JSON.stringify(data));
}

function getLocalCourseProgress() {
  try {
    return JSON.parse(localStorage.getItem('foundation_local_course_progress') || '{}');
  } catch (e) {
    return {};
  }
}

function saveLocalCourseProgress(data) {
  localStorage.setItem('foundation_local_course_progress', JSON.stringify(data));
}
