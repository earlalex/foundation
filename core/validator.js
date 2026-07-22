// core/validator.js

export class ValidationError extends Error {
  constructor(message, path = '') {
    super(path ? `[Validation Error at '${path}']: ${message}` : `[Validation Error]: ${message}`);
    this.name = 'ValidationError';
    this.path = path;
  }
}

/**
 * Primitive type assertion helpers
 */
export const Type = {
  string: (val) => typeof val === 'string',
  number: (val) => typeof val === 'number' && !isNaN(val),
  boolean: (val) => typeof val === 'boolean',
  object: (val) => typeof val === 'object' && val !== null && !Array.isArray(val),
  array: (val) => Array.isArray(val),
  function: (val) => typeof val === 'function',
  optional: (checkFn) => (val) => val === undefined || val === null || checkFn(val)
};

/**
 * Validates an object against a target schema.
 * @param {Object} schema - Object describing expected property types.
 * @param {Object} data - The payload to validate.
 * @returns {boolean} Returns true if valid, throws ValidationError if invalid.
 */
export function validateSchema(schema, data, parentPath = '') {
  if (!Type.object(data)) {
    throw new ValidationError('Expected an object payload', parentPath);
  }

  for (const [key, typeCheck] of Object.entries(schema)) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    const value = data[key];

    // Nested schema handling
    if (Type.object(typeCheck)) {
      validateSchema(typeCheck, value || {}, currentPath);
      continue;
    }

    // Type checking function evaluation
    if (typeof typeCheck === 'function') {
      if (!typeCheck(value)) {
        throw new ValidationError(`Invalid or missing type for field "${key}". Received: ${typeof value}`, currentPath);
      }
    }
  }

  return true;
}