// core/db-events.js
import {
  getFirestoreDB, doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, limit,
  originalGetDocs, queryWith3SecTimeout, CONTENT_COLLECTION,
  getLocalContent, saveLocalContent
} from './db-shared.js';

export async function saveEvent(eventData) {
  const payload = {
    ...eventData,
    type: 'event'
  };
  const db = getFirestoreDB();
  if (!db) {
    const local = getLocalContent();
    local[payload.id] = { ...payload, updatedAt: new Date().toISOString() };
    saveLocalContent(local);
    return true;
  }

  try {
    const docRef = doc(db, CONTENT_COLLECTION, payload.id);
    await setDoc(docRef, {
      ...payload,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[DB]: Firestore permission or write error.', err.message);
    const local = getLocalContent();
    local[payload.id] = { ...payload, updatedAt: new Date().toISOString() };
    saveLocalContent(local);
    return true;
  }
}

export async function getEventBySlug(slug) {
  const all = await getAllEvents();
  return all.find(e => e.slug === slug || e.id === slug) || null;
}

export async function getAllEvents() {
  const results = [];
  const db = getFirestoreDB();
  if (db) {
    try {
      const q = query(collection(db, CONTENT_COLLECTION), where('type', '==', 'event'));
      const querySnapshot = await queryWith3SecTimeout(originalGetDocs(q));
      querySnapshot.forEach((docSnap) => {
        results.push(docSnap.data());
      });
      if (results.length > 0) return results;
    } catch (err) {
      console.warn('[DB]: Cloud Firestore events query bypassed or unreachable.', err.message);
    }
  }

  const local = getLocalContent();
  Object.values(local).forEach(item => {
    if (item.type === 'event') {
      results.push(item);
    }
  });
  return results;
}

export async function updateTicketAvailability(eventId, ticketTypeId, quantity) {
  const db = getFirestoreDB();
  let event = null;

  if (db) {
    try {
      const docRef = doc(db, CONTENT_COLLECTION, eventId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        event = docSnap.data();
      }
    } catch (e) {}
  }

  if (!event) {
    const local = getLocalContent();
    event = local[eventId] || null;
  }

  if (!event) return false;

  let updated = false;

  if (event.ticketTypes) {
    const tType = event.ticketTypes.find(t => t.id === ticketTypeId);
    if (tType) {
      tType.sold = (tType.sold || 0) + quantity;
      updated = true;
    }
  }

  if (event.vendorPackages) {
    const vPkg = event.vendorPackages.find(v => v.id === ticketTypeId);
    if (vPkg) {
      vPkg.capacity = Math.max(0, (vPkg.capacity || 0) - quantity);
      vPkg.sold = (vPkg.sold || 0) + quantity;
      updated = true;
    }
  }

  if (event.sponsorshipPackages) {
    const sPkg = event.sponsorshipPackages.find(s => s.id === ticketTypeId);
    if (sPkg) {
      sPkg.capacity = Math.max(0, (sPkg.capacity || 0) - quantity);
      sPkg.sold = (sPkg.sold || 0) + quantity;
      updated = true;
    }
  }

  if (updated) {
    return saveEvent(event);
  }
  return false;
}

export async function saveRegistration(regData) {
  const db = getFirestoreDB();
  const id = regData.id || `reg_${Date.now()}`;
  const payload = { ...regData, id, updatedAt: new Date().toISOString() };

  try {
    const local = JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
    const index = local.findIndex(r => r.id === id);
    if (index !== -1) {
      local[index] = payload;
    } else {
      local.push(payload);
    }
    localStorage.setItem('foundation_local_registrations', JSON.stringify(local));
  } catch (e) {
    console.warn('Failed to save registration locally', e);
  }

  if (!db) return payload;

  try {
    const docRef = doc(db, 'registrations', id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore registration save error.', err.message);
    return payload;
  }
}

export async function getRegistrationsByUser(email) {
  const db = getFirestoreDB();
  if (!db) {
    const local = JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
    return local.filter(r => r.email === email);
  }
  try {
    const q = query(collection(db, 'registrations'), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach(docSnap => {
      results.push(docSnap.data());
    });
    if (results.length > 0) return results;
  } catch (e) {
    console.warn('[DB]: Failed to query registrations from firestore, falling back', e);
  }
  const local = JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
  return local.filter(r => r.email === email);
}

export async function getAllRegistrations() {
  const db = getFirestoreDB();
  if (!db) {
    return JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
  }
  try {
    const querySnapshot = await getDocs(collection(db, 'registrations'));
    const results = [];
    querySnapshot.forEach(docSnap => {
      results.push(docSnap.data());
    });
    if (results.length > 0) return results;
  } catch (err) {
    console.warn('[DB]: Failed to fetch registrations, falling back', err);
  }
  return JSON.parse(localStorage.getItem('foundation_local_registrations') || '[]');
}

export async function saveAppointment(apptData) {
  const db = getFirestoreDB();
  const id = apptData.id || `appt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = { ...apptData, id, updatedAt: new Date().toISOString() };

  try {
    const local = JSON.parse(localStorage.getItem('foundation_local_appointments') || '[]');
    const idx = local.findIndex(a => a.id === id);
    if (idx !== -1) {
      local[idx] = payload;
    } else {
      local.push(payload);
    }
    localStorage.setItem('foundation_local_appointments', JSON.stringify(local));
  } catch (e) {
    console.warn('Failed to save appointment locally', e);
  }

  if (!db) return payload;

  try {
    const docRef = doc(db, 'appointments', id);
    await setDoc(docRef, payload, { merge: true });
    return payload;
  } catch (err) {
    console.warn('[DB]: Firestore appointment save error.', err.message);
    return payload;
  }
}

export async function getAppointments() {
  const db = getFirestoreDB();
  if (!db) {
    return JSON.parse(localStorage.getItem('foundation_local_appointments') || '[]');
  }
  try {
    const querySnapshot = await getDocs(collection(db, 'appointments'));
    const results = [];
    querySnapshot.forEach(docSnap => {
      results.push(docSnap.data());
    });
    if (results.length > 0) return results;
  } catch (err) {
    console.warn('[DB]: Failed to fetch appointments from Firestore, falling back', err);
  }
  return JSON.parse(localStorage.getItem('foundation_local_appointments') || '[]');
}

