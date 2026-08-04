// core/error-handler.js
import { logger } from './logger.js';
import { toast } from '../utils/toast.js';

export class ErrorHandler {
  constructor() {
    if (typeof window !== 'undefined') {
      this.initGlobalListeners();
    }
  }

  /**
   * Listens for uncaught DOM exceptions and unhandled Promise rejections
   */
  initGlobalListeners() {
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), 'Unhandled Error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      const msg = event.reason?.message || String(event.reason || '');
      if (msg.includes('message channel closed before a response was received') ||
          msg.includes('A listener indicated an asynchronous response')) {
        event.preventDefault();
        return; // Suppress extension channel noise cleanly
      }
      this.handleError(event.reason, 'Unhandled Promise Rejection');
    });
  }

  /**
   * Central error processing pipeline
   * @param {Error|string} error - The caught error
   * @param {string} [context='Application Error'] - Operational category context
   * @param {boolean} [showToast=true] - Whether to render a toast notification
   */
  handleError(error, context = 'Application Error', showToast = true) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    const message = errObj.message || 'An unexpected runtime error occurred.';

    // 1. Log structured trace using system Logger
    try {
      logger.error(`[${context}]:`, errObj);
    } catch (e) {
      console.error(`[${context}]:`, errObj);
    }

    // 2. Dispatch user notification using unified Toast system
    if (showToast && typeof document !== 'undefined' && document.body) {
      try {
        if (errObj.name === 'ValidationError') {
          toast.warning(`Data Error: ${message}`);
        } else {
          toast.error(`${context}: ${message}`);
        }
      } catch (toastErr) {
        console.error('[ErrorHandler]: Failed to render toast UI:', toastErr);
      }
    }

    // 3. Dispatch hook for server-side remote telemetry
    this.logToServer(errObj, context);

    return errObj;
  }

  /**
   * Hook for streaming telemetry to Cloudflare Workers or Firestore
   */
  logToServer(error, context) {
    // Cloudflare Edge or remote logging endpoint integration point
  }
}

export const errorHandler = new ErrorHandler();