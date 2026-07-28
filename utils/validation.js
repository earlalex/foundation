// utils/validation.js - Client-side form validation utilities

/**
 * Validation rules for common field types
 */
export const validationRules = {
  required: (value) => value && value.trim().length > 0 ? null : 'This field is required',
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Please enter a valid email address',
  url: (value) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'Please enter a valid URL';
    }
  },
  minLength: (min) => (value) => value && value.length >= min ? null : `Minimum ${min} characters required`,
  maxLength: (max) => (value) => value && value.length <= max ? null : `Maximum ${max} characters allowed`,
  numeric: (value) => !isNaN(parseFloat(value)) && isFinite(value) ? null : 'Please enter a valid number',
  positive: (value) => parseFloat(value) > 0 ? null : 'Please enter a positive number',
  apiKey: (value) => value && value.length >= 8 ? null : 'API key must be at least 8 characters',
  phone: (value) => {
    if (!value) return null;
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10 
      ? null 
      : 'Please enter a valid phone number';
  }
};

/**
 * Form validator class
 */
export class FormValidator {
  constructor(formElement, rules) {
    this.form = formElement;
    this.rules = rules;
    this.errors = new Map();
    this.init();
  }

  init() {
    // Add blur validation to all fields
    Object.keys(this.rules).forEach(fieldName => {
      const field = this.form.querySelector(`[name="${fieldName}"]`) || 
                   this.form.querySelector(`#${fieldName}`);
      if (field) {
        field.addEventListener('blur', () => this.validateField(fieldName));
        field.addEventListener('input', () => {
          // Clear error on input
          this.clearFieldError(fieldName);
        });
      }
    });
  }

  validateField(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`) || 
                 this.form.querySelector(`#${fieldName}`);
    if (!field) return true;

    const value = field.value;
    const fieldRules = this.rules[fieldName];

    for (const rule of fieldRules) {
      const error = rule(value);
      if (error) {
        this.setFieldError(fieldName, error);
        return false;
      }
    }

    this.clearFieldError(fieldName);
    return true;
  }

  setFieldError(fieldName, message) {
    const field = this.form.querySelector(`[name="${fieldName}"]`) || 
                 this.form.querySelector(`#${fieldName}`);
    if (!field) return;

    this.errors.set(fieldName, message);
    field.style.borderColor = '#e53e3e';

    // Remove existing error message
    let errorEl = field.nextElementSibling;
    if (errorEl && errorEl.classList.contains('validation-error')) {
      errorEl.remove();
    }

    // Add error message
    errorEl = document.createElement('div');
    errorEl.className = 'validation-error';
    errorEl.style.cssText = 'color: #e53e3e; font-size: 0.75rem; margin-top: 4px;';
    errorEl.textContent = message;
    field.parentNode.insertBefore(errorEl, field.nextSibling);
  }

  clearFieldError(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`) || 
                 this.form.querySelector(`#${fieldName}`);
    if (!field) return;

    this.errors.delete(fieldName);
    field.style.borderColor = '';

    const errorEl = field.nextElementSibling;
    if (errorEl && errorEl.classList.contains('validation-error')) {
      errorEl.remove();
    }
  }

  validateAll() {
    let isValid = true;
    Object.keys(this.rules).forEach(fieldName => {
      if (!this.validateField(fieldName)) {
        isValid = false;
      }
    });
    return isValid;
  }

  getErrors() {
    return Object.fromEntries(this.errors);
  }
}

/**
 * Common validation rule sets for admin forms
 */
export const adminFormRules = {
  siteSettings: {
    'site-title': [validationRules.required, validationRules.minLength(3)],
    'site-domain': [validationRules.required, validationRules.url],
    'site-description': [validationRules.maxLength(500)]
  },
  businessProfile: {
    'biz-legal-name': [validationRules.required],
    'biz-email': [validationRules.required, validationRules.email],
    'biz-phone': [validationRules.phone],
    'biz-ein': [validationRules.minLength(9)]
  },
  authorProfile: {
    'author-name': [validationRules.required],
    'author-email': [validationRules.required, validationRules.email]
  },
  integrations: {
    'cfg-fb-project': [validationRules.required],
    'cfg-gemini-key': [validationRules.apiKey],
    'cfg-openai-key': [validationRules.apiKey],
    'cfg-stripe-key': [validationRules.apiKey],
    'cfg-vt-apikey': [validationRules.apiKey]
  },
  userDirectory: {
    'new-user-name': [validationRules.required],
    'new-user-email': [validationRules.required, validationRules.email]
  },
  chatbot: {
    'chat-name': [validationRules.required],
    'chat-welcome': [validationRules.required]
  }
};
