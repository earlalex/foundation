// core/auth.js
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
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

/**
 * Get or initialize Firebase app instance
 * @returns {Object} Firebase app instance
 */
export function getFirebaseApp() {
  const currentFbConfig = configManager.current.firebase;
  const isConfigured = currentFbConfig && 
                        currentFbConfig.projectId && 
                        currentFbConfig.projectId !== "YOUR_PROJECT_ID" &&
                        currentFbConfig.projectId !== "demo-foundation-app" &&
                        currentFbConfig.apiKey !== "" &&
                        currentFbConfig.apiKey !== "YOUR_API_KEY";

  const firebaseConfig = isConfigured
    ? {
        ...currentFbConfig,
        authDomain: currentFbConfig.authDomain || `${currentFbConfig.projectId}.firebaseapp.com`
      }
    : {
        apiKey: "AIzaSy_DEMO_KEY_FOUNDATION",
        authDomain: "demo.firebaseapp.com",
        projectId: "demo-foundation-app"
      };

  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

const app = getFirebaseApp();
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

/**
 * AuthManager handles Firebase authentication with Google sign-in
 * Manages user state in the store, including admin status based on configured admin emails
 */
export class AuthManager {
  constructor() {
    this.initAuthObserver();
  }

  /**
   * Initialize Firebase auth state observer
   * Updates store when user authentication state changes
   */
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

  /**
   * Sign in with Google popup
   * @returns {Promise<Object>} Firebase user object
   * @throws {Error} If sign-in fails
   */
  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      let customError;
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('auth/unauthorized-domain'))) {
        customError = new Error(
          `Unauthorized Domain: Please add "${window.location.hostname}" (or your base domain "foundation-5b8.pages.dev") to your Firebase Console -> Authentication -> Settings -> Authorized Domains list.`
        );
      } else {
        customError = new Error(`Google Sign-In Failed: ${err.message}`);
      }
      errorHandler.handleError(customError);
      throw customError;
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await signOut(auth);
    } catch (err) {
      errorHandler.handleError(new Error(`Sign-Out Failed: ${err.message}`));
    }
  }

  /**
   * Check if current user is authenticated as admin
   * @returns {boolean} True if user is authenticated and has admin privileges
   */
  isAdminAuthenticated() {
    const user = store.state.user;
    return !!(user && user.isAdmin);
  }
}

export const authManager = new AuthManager();
