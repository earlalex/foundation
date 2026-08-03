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
import { toast } from '../utils/toast.js';

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
    this.isAuthenticating = false;
    this.initAuthObserver();
  }

  /**
   * Initialize Firebase auth state observer
   * Updates store when user authentication state changes
   */
  initAuthObserver() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const adminEmails = configManager.current.adminEmails || [];
        let isAdmin = adminEmails.includes(user.email) || user.email === 'admin@earlalex.com';

        let profile = {
          role: isAdmin ? 'admin' : 'subscriber',
          paymentStatus: 'None',
          affiliateCode: `aff_${String(user.uid).substring(0, 5)}`
        };

        // Try syncing from ContentDB user profile if it exists
        try {
          const { contentDB } = await import('./db.js');
          const syncedUser = await contentDB.getUser(user.email);
          if (syncedUser) {
            profile = {
              role: syncedUser.role || profile.role,
              paymentStatus: syncedUser.paymentStatus || profile.paymentStatus,
              affiliateCode: syncedUser.affiliateCode || profile.affiliateCode,
              referredBy: syncedUser.referredBy || null
            };
          } else {
            // Save initial subscriber profile
            await contentDB.saveUser({
              id: String(user.uid),
              name: user.displayName || 'Subscriber',
              email: user.email,
              role: profile.role,
              paymentStatus: profile.paymentStatus,
              affiliateCode: profile.affiliateCode
            });
          }
        } catch (dbErr) {
          console.warn('[Auth Sync]: DB profiling sync skipped or unavailable.', dbErr);
        }

        if (profile.role === 'admin' || user.email === 'admin@earlalex.com') {
          isAdmin = true;
        }

        const userObj = {
          uid: String(user.uid),
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || '',
          isAdmin: isAdmin,
          role: profile.role,
          paymentStatus: profile.paymentStatus,
          affiliateCode: profile.affiliateCode,
          referredBy: profile.referredBy
        };
        store.dispatch('SET_USER', userObj);
        console.log(`[Auth]: Authenticated as ${user.email} (Admin: ${isAdmin}, Role: ${profile.role})`);

        // Trigger system-wide hook execution pipeline for user login
        try {
          const { doAction } = await import('./hooks.js');
          await doAction('user_login', userObj);
        } catch (hookErr) {
          console.error('[Auth System]: Failed to dispatch user_login hook.', hookErr);
        }

        // Smoothly redirect and update UI elements on status changes
        if (window.router) {
          const currentPath = window.location.pathname;
          let relPath = currentPath;
          const basePath = window.router.basePath || '/';
          if (basePath !== '/' && currentPath.startsWith(basePath.slice(0, -1))) {
            relPath = currentPath.slice(basePath.length - 1);
          }
          if (relPath.endsWith('/index.html')) {
            relPath = relPath.replace(/\/index\.html$/, '');
          }
          while (relPath.length > 1 && relPath.endsWith('/')) {
            relPath = relPath.slice(0, -1);
          }
          if (relPath === '' || relPath === '/') {
            relPath = '/home';
          }

          const intendedDest = sessionStorage.getItem('intended_destination');
          sessionStorage.removeItem('intended_destination');

          if (intendedDest) {
            const hasAdminAccess = isAdmin || profile.role === 'admin' || profile.role === 'editor';
            if (intendedDest === '/admin') {
              if (hasAdminAccess) {
                window.router.loadRoute('/admin');
              } else {
                window.router.loadRoute('/account');
              }
            } else {
              window.router.loadRoute(intendedDest);
            }
          } else if (relPath === '/login') {
            window.router.loadRoute('/account');
          } else {
            // Reload the current active route to update paywall views and interactive components
            window.router.loadRoute(currentPath);
          }
        }
      } else {
        if (!window.__FOUNDATION_DEV_BYPASS__) {
          store.dispatch('LOGOUT');
          console.log('[Auth]: Signed out.');

          // Trigger system-wide hook execution pipeline for user logout
          try {
            const { doAction } = await import('./hooks.js');
            await doAction('user_logout');
          } catch (hookErr) {
            console.error('[Auth System]: Failed to dispatch user_logout hook.', hookErr);
          }
        }
      }
    });
  }

  /**
   * Sign in with Google popup
   * @returns {Promise<Object>} Firebase user object
   * @throws {Error} If sign-in fails
   */
  async loginWithGoogle() {
    if (this.isAuthenticating) {
      const busyMsg = "Authentication is already in progress. Please wait.";
      toast.warning(busyMsg);
      throw new Error(busyMsg);
    }

    // Check if Firebase is running on demo/unconfigured credentials
    const currentFbConfig = configManager.current.firebase;
    const isConfigured = currentFbConfig &&
                          currentFbConfig.projectId &&
                          currentFbConfig.projectId !== "YOUR_PROJECT_ID" &&
                          currentFbConfig.projectId !== "demo-foundation-app" &&
                          currentFbConfig.apiKey !== "" &&
                          currentFbConfig.apiKey !== "YOUR_API_KEY";

    if (!isConfigured) {
      const warningMsg = "Firebase is running on demo/unconfigured credentials. Please run the Setup Wizard or update API keys.";
      toast.warning(warningMsg);
      const customError = new Error(warningMsg);
      errorHandler.handleError(customError);
      throw customError;
    }

    this.isAuthenticating = true;

    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      const errorCode = err.code || '';
      const errorMessage = err.message || '';

      // Gracefully fallback to signInWithRedirect or catch promise rejection cleanly
      try {
        console.warn('[Auth]: Popup authentication failed or was closed. Attempting redirect fallback...', err);
        const { signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        console.error('[Auth]: Redirect authentication fallback failed.', redirectErr);
      }

      if (errorCode === 'auth/popup-blocked') {
        toast.error("Sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (errorCode === 'auth/popup-closed-by-user') {
        console.log('[Auth]: Sign-in popup closed by user.');
      } else if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('auth/unauthorized-domain')) {
        toast.error(`Domain authorization error: Please add '${window.location.hostname}' to Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
      } else if (errorCode === 'auth/configuration-not-found' || errorMessage.includes('configuration-not-found')) {
        toast.error("Firebase is running on demo/unconfigured credentials. Please run the Setup Wizard or update API keys.");
      } else {
        toast.error(`Google Sign-In Failed: ${errorMessage}`);
      }

      let customError;
      if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('auth/unauthorized-domain')) {
        customError = new Error(
          `Unauthorized Domain: Please add "${window.location.hostname}" (or your base domain "foundation-5b8.pages.dev") to your Firebase Console -> Authentication -> Settings -> Authorized Domains list.`
        );
      } else {
        customError = err;
      }
      errorHandler.handleError(customError);
      throw customError;
    } finally {
      this.isAuthenticating = false;
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      window.__FOUNDATION_DEV_BYPASS__ = false;
      await signOut(auth);
      store.dispatch('LOGOUT');
    } catch (err) {
      errorHandler.handleError(new Error(`Sign-Out Failed: ${err.message}`));
    }
  }

  /**
   * Check if current user is authenticated as admin
   * @returns {boolean} True if user is authenticated and has admin privileges
   */
  isAdminAuthenticated() {
    // STRICT ZERO-TRUST BOUNDARY SEPARATION:
    // Client-side UI bypass flags (e.g., window.__FOUNDATION_DEV_BYPASS__ or store.state.devMode)
    // are ONLY evaluated for local client-side UI rendering and routing simulation.
    // They NEVER grant any actual read/write permissions to production Cloud Firestore databases
    // or bypass serverless Edge API token-based security controls. Actual backend authorization
    // is strictly enforced on the server-side via cryptographic request.auth tokens.
    const user = store.state.user;
    return !!(user && (user.isAdmin || user.role === 'admin') || window.__FOUNDATION_DEV_BYPASS__);
  }
}

export const authManager = new AuthManager();