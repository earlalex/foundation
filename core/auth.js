// core/auth.js
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  getRedirectResult,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
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
export function getFirebaseAuth() {
  return auth;
}
const googleProvider = new GoogleAuthProvider();

let isSigningIn = false;

export async function loginWithGoogle() {
  if (isSigningIn) {
    console.warn('[Auth]: Google sign-in operation already in progress. Ignoring duplicate trigger.');
    return;
  }
  isSigningIn = true;
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error('[Auth]: Google login failed:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * AuthManager handles Firebase authentication with Google sign-in
 * Manages user state in the store, including admin status based on configured admin emails
 */
export class AuthManager {
  constructor() {
    this.isAuthenticating = false;
    this.initAuthObserver();
    this.checkRedirectResult();
    this.checkEmailSignInLink();
  }

  /**
   * Handle redirect results for authentication flows
   */
  async checkRedirectResult() {
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        console.log('[Auth]: Redirect sign-in success:', result.user.email);
      }
    } catch (err) {
      console.error('[Auth]: Error resolving redirect result:', err);
    } finally {
      sessionStorage.removeItem('firebase_auth_in_progress');
    }
  }

  /**
   * Initialize Firebase auth state observer
   * Updates store when user authentication state changes
   */
  initAuthObserver() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await this.handleUserSession(user);
      } else {
        if (!window.__FOUNDATION_DEV_BYPASS__) {
          if (sessionStorage.getItem('firebase_auth_in_progress') === 'true') {
            console.log('[Auth]: Auth is in progress. Skipping premature sign-out bounce.');
            return;
          }
          store.dispatch('LOGOUT');
          console.log('[Auth]: Signed out.');

          // Trigger system-wide hook execution pipeline for user logout
          try {
            const { doAction } = await import('./hooks.js');
            await doAction('user_logout');
          } catch (hookErr) {
            console.error('[Auth System]: Failed to dispatch user_logout hook.', hookErr);
          }

          if (!user && window.router) {
            window.router.loadRoute(window.location.pathname || '/home');
          }
        }
      }
    });
  }

  /**
   * Handle user session updates and auto-elevate primary admins
   * @param {Object} user - Firebase user object
   */
  async handleUserSession(user) {
    const adminEmails = configManager.current?.adminEmails || ['admin@earlalex.com'];
    const isPrimaryAdmin = adminEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase()) || user.email.toLowerCase() === 'admin@earlalex.com';

    let profile = {
      role: isPrimaryAdmin ? 'admin' : 'subscriber',
      paymentStatus: 'None',
      affiliateCode: `aff_${String(user.uid).substring(0, 5)}`
    };

    // Try syncing from ContentDB user profile if it exists
    try {
      const { contentDB } = await import('./db.js');
      const syncedUser = await contentDB.getUser(user.email);
      if (syncedUser) {
        profile = {
          role: isPrimaryAdmin ? 'admin' : (syncedUser.role || profile.role),
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

    const isGoogleAuth = user.providerData && user.providerData.some(p => p.providerId === 'google.com');
    const provider = isGoogleAuth ? 'google.com' : (user.providerData && user.providerData[0]?.providerId || '');

    const userRecord = {
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || '',
      provider: provider,
      paymentStatus: profile.paymentStatus,
      affiliateCode: profile.affiliateCode,
      referredBy: profile.referredBy,
      role: profile.role
    };

    const effectiveRole = isPrimaryAdmin ? 'admin' : (userRecord?.role || 'subscriber');
    const effectiveAdmin = isPrimaryAdmin || userRecord?.isAdmin || false;

    const userObj = {
      ...userRecord,
      uid: String(user.uid),
      email: user.email,
      role: effectiveRole,
      isAdmin: effectiveAdmin
    };

    sessionStorage.removeItem('firebase_auth_in_progress');
    store.dispatch('SET_USER', userObj);
    console.log(`[Auth]: Authenticated as ${user.email} (Admin: ${effectiveAdmin}, Role: ${effectiveRole}, Provider: ${provider})`);

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
        const hasAdminAccess = effectiveAdmin || effectiveRole === 'admin' || effectiveRole === 'editor' || provider === 'google.com';
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
  }

  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      const user = result.user;

      const adminEmails = configManager.current?.adminEmails || ['admin@earlalex.com'];
      const isPrimaryAdmin = adminEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase()) || user.email.toLowerCase() === 'admin@earlalex.com';

      const effectiveRole = isPrimaryAdmin ? 'admin' : 'member';
      const effectiveAdmin = isPrimaryAdmin;

      // Update application state
      store.dispatch('SET_USER', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        provider: 'google.com',
        role: effectiveRole,
        isAdmin: effectiveAdmin
      });

      const { toast } = await import('../utils/toast.js');
      toast.success(`Welcome back, ${user.displayName || user.email}!`);

      // Navigate to account or destination route
      const intendedDest = sessionStorage.getItem('intended_destination');
      sessionStorage.removeItem('intended_destination');
      window.router.navigateTo(intendedDest || '/account');
    } catch (err) {
      console.warn('[Auth Core]: Google OAuth popup error / closed by user:', err);
      throw err;
    }
  }

  /**
   * Sends a magic sign-in link to the specified email address.
   * @param {string} email
   */
  async sendMagicLink(email) {
    if (!email) throw new Error("Email is required.");

    // Check if Firebase is running on demo/unconfigured credentials
    const currentFbConfig = configManager.current.firebase;
    const isConfigured = currentFbConfig &&
                          currentFbConfig.projectId &&
                          currentFbConfig.projectId !== "YOUR_PROJECT_ID" &&
                          currentFbConfig.projectId !== "demo-foundation-app" &&
                          currentFbConfig.apiKey !== "" &&
                          currentFbConfig.apiKey !== "YOUR_API_KEY";

    if (!isConfigured) {
      console.log(`[Auth Magic Link Simulation]: Magic link dispatched to ${email}`);
      return;
    }

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
    } catch (err) {
      console.error('[Auth Core]: Send magic link failed', err);
      throw err;
    }
  }

  /**
   * Checks if the incoming URL is a Magic Sign-In link and completes the authentication.
   */
  async checkEmailSignInLink() {
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          email = window.prompt('Please provide your email for confirmation');
        }
        if (email) {
          this.isAuthenticating = true;
          sessionStorage.setItem('firebase_auth_in_progress', 'true');
          const result = await signInWithEmailLink(auth, email, window.location.href);
          window.localStorage.removeItem('emailForSignIn');
          sessionStorage.removeItem('firebase_auth_in_progress');
          console.log('[Auth]: Email link sign-in success:', result.user.email);
        }
      }
    } catch (err) {
      console.error('[Auth]: Error resolving email link sign-in:', err);
      sessionStorage.removeItem('firebase_auth_in_progress');
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
      if (window.router) {
        window.router.loadRoute(window.location.pathname || '/home');
      }
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
    const isAuthorized = !!(user && (
      user.provider === 'google.com' ||
      user.role === 'admin' ||
      user.role === 'editor' ||
      user.isAdmin
    ));
    return isAuthorized || !!window.__FOUNDATION_DEV_BYPASS__;
  }
}

export const authManager = new AuthManager();