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

// ⚠️ Replace this with your actual Firebase Project Config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase App & Auth
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Define Admin UIDs or emails allowed to access settings
const ADMIN_EMAILS = [
  'your-email@gmail.com' // Replace with your actual Google account email
];

export class AuthManager {
  constructor() {
    this.initAuthObserver();
  }

  initAuthObserver() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const isAdmin = ADMIN_EMAILS.includes(user.email);
        
        // Dispatch user profile into Immutable Global Store
        store.dispatch('SET_USER', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isAdmin: isAdmin
        });

        console.log(`[Auth]: Authenticated as ${user.email} (Admin: ${isAdmin})`);
      } else {
        // Clear user state on logout
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

  // Guard Helper for Admin Views
  isAdminAuthenticated() {
    const user = store.state.user;
    return !!(user && user.isAdmin);
  }
}

export const authManager = new AuthManager();