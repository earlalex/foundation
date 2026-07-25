// core/auth.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { store } from './store.js';
import { errorHandler } from './error-handler.js';
import { configManager } from './config.js';

// Initialize Firebase App & Auth with configuration from ConfigEngine
const firebaseConfig = configManager.current.firebase || {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export class AuthManager {
  constructor() {
    this.initAuthObserver();
  }

  initAuthObserver() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const adminEmails = configManager.current.adminEmails || [];
        const isAdmin = adminEmails.includes(user.email);

        store.dispatch('SET_USER', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isAdmin: isAdmin
        });
        console.log(`[Auth]: Authenticated as ${user.email} (Admin: ${isAdmin})`);
      } else {
        store.dispatch('LOGOUT');
        console.log('[Auth]: Signed out.');
      }
    });
  }

  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      errorHandler.handleError(new Error(`Google Sign-In Failed: ${err.message}`));
    }
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (err) {
      errorHandler.handleError(new Error(`Sign-Out Failed: ${err.message}`));
    }
  }

  isAdminAuthenticated() {
    const user = store.state.user;
    return !!(user && user.isAdmin);
  }
}

export const authManager = new AuthManager();