// core/db-users.js
import {
  getFirestoreDB, doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, limit,
  queryWith3SecTimeout, USERS_COLLECTION
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
  const userId = userData.id || userData.email.replace(/[@.]/g, '_');
  const payload = {
    ...userData,
    id: userId,
    updatedAt: new Date().toISOString()
  };

  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalUsers();
    local[userId] = payload;
    saveLocalUsers(local);
    return payload;
  }

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore user save error. Falling back to LocalStorage.', err.message);
    const local = getLocalUsers();
    local[userId] = payload;
    saveLocalUsers(local);
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
    const mergedProducts = Array.from(new Set([...(primaryUser.purchasedProducts || []), ...(userData.purchasedProducts || [])]));

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
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalUsers();
    delete local[userId];
    saveLocalUsers(local);
    return true;
  }

  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore user delete error. Falling back to LocalStorage.', err.message);
    const local = getLocalUsers();
    delete local[userId];
    saveLocalUsers(local);
    return true;
  }
}

export async function saveUserCourseProgress(userId, courseId, progressData) {
  const dbInstance = getFirestoreDB();
  const payload = {
    ...progressData,
    userId,
    courseId,
    updatedAt: new Date().toISOString()
  };

  if (!dbInstance) {
    const local = getLocalCourseProgress();
    const key = `${userId}_${courseId}`;
    local[key] = payload;
    saveLocalCourseProgress(local);
    return payload;
  }

  try {
    const docRef = doc(dbInstance, USERS_COLLECTION, userId, 'course_progress', courseId);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore course progress write error. Falling back to LocalStorage.', err.message);
    const local = getLocalCourseProgress();
    const key = `${userId}_${courseId}`;
    local[key] = payload;
    saveLocalCourseProgress(local);
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
