// pages/login.js - Authentication Portal Controller for Google OAuth & Magic Links
import { authManager } from '../core/auth.js';
import { toast } from '../utils/toast.js';

/**
 * Initializes the login page controller.
 * Binds reliable event listeners to both Google Sign-In and Magic Link form elements.
 */
export function initLoginPage() {
  const googleBtn = document.getElementById('btn-login-google') || document.querySelector('.btn-google-login');
  const magicForm = document.getElementById('magic-login-form') || document.querySelector('#login-form');

  if (googleBtn) {
    googleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      googleBtn.disabled = true;
      googleBtn.innerHTML = '<span>⏳ Signing in...</span>';
      try {
        const { authManager } = await import('../core/auth.js');
        await authManager.loginWithGoogle();
      } catch (err) {
        console.error('[Login Page]: Google sign-in failed', err);
        const { toast } = await import('../utils/toast.js');
        toast.error('Google Sign-In failed: ' + (err.message || 'Popup blocked or network error'));
      } finally {
        googleBtn.disabled = false;
        googleBtn.innerHTML = '<span class="g-icon">G</span> Continue with Google';
      }
    });
  }

  if (magicForm) {
    magicForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('magic-email') || document.querySelector('#login-email') || document.querySelector('input[type="email"]');
      if (!emailInput) return;
      const email = emailInput.value.trim();
      if (!email) return;

      const submitBtn = document.getElementById('btn-send-magic-link') || document.querySelector('button[type="submit"]');
      const originalHtml = submitBtn ? submitBtn.innerHTML : 'Send Magic Sign-In Link';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳ Sending...</span>';
      }

      try {
        await authManager.sendMagicLink(email);
        toast.success("Magic Sign-In link sent to your email!");

        // Render confirmation state in UI
        magicForm.innerHTML = `
          <div style="padding: 1rem; background: var(--theme-color-surface-alt, #f8fafc); border: 1px solid var(--theme-color-border, #cbd5e1); border-radius: 6px; text-align: center; margin-top: 0.5rem;">
            <p style="margin: 0 0 0.5rem 0; font-weight: bold; color: var(--theme-color-accent, #38a169);">Check your email!</p>
            <p style="margin: 0; font-size: 0.85rem; color: var(--theme-color-text-secondary, #718096); line-height: 1.5;">We sent a secure sign-in link to <strong>${email}</strong>. Click the link in the email to log in.</p>
          </div>
        `;
      } catch (err) {
        console.error('[Login Page]: Magic Link dispatch failed', err);
        toast.error('Failed to send Magic Link: ' + (err.message || 'Unknown error'));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHtml;
        }
      }
    });
  }
}
