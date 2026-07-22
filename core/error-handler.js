// core/error-handler.js

export class ErrorHandler {
  constructor() {
    this.initGlobalListeners();
  }

  initGlobalListeners() {
    // Catch standard JS runtime errors & thrown exceptions
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message));
    });

    // Catch unhandled promise rejections (e.g. failed fetches)
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.handleError(reason);
    });
  }

  handleError(error) {
    console.error('[Foundation Monitor Captured Error]:', error);

    // 1. Differentiate between user-facing validation errors and critical system failures
    if (error.name === 'ValidationError') {
      this.showToast(`Data Error: ${error.message}`, 'warning');
    } else {
      this.showToast('Something unexpected happened. We are working on it!', 'error');
    }

    // 2. Placeholder hook for sending error notifications/logs to an external service
    this.logToServer(error);
  }

  showToast(message, type = 'info') {
    // Create container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;
      document.body.appendChild(container);
    }

    // Render lightweight inline toast
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? '#e53e3e' : type === 'warning' ? '#dd6b20' : '#3182ce';
    
    toast.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 12px 18px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      transition: opacity 0.3s ease;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  logToServer(error) {
    // In the future, this can post logs to Cloudflare Workers or Firebase
    // fetch('/api/log-error', { method: 'POST', body: JSON.stringify({ message: error.message, stack: error.stack }) });
  }
}

// Instantiate singleton monitoring immediately
export const errorHandler = new ErrorHandler();