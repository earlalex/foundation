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
  // Literal matcher for exact value checking (e.g., Type.literal('event'))
  literal: (expectedValue) => (val) => val === expectedValue,
  // Clean, strict-mode compatible smart array validator
  array: (itemCheckFn) => {
    // Allows uncalled usage like `Type.array` inside validateSchema
    if (Array.isArray(itemCheckFn)) {
      return true;
    }
    return (val) => {
      if (!Array.isArray(val)) return false;
      if (typeof itemCheckFn !== 'function') return true;
      return val.every((item) => itemCheckFn(item));
    };
  },
  function: (val) => typeof val === 'function',
  optional: (checkFn) => (val) => {
    // Guard against passing undefined/non-functions to optional
    if (typeof checkFn !== 'function') return true;
    return val === undefined || val === null || checkFn(val);
  }
};

/**
 * Validates an object against a target schema.
 */
export function validateSchema(schema, data, parentPath = '') {
  if (!Type.object(data)) {
    throw new ValidationError('Expected an object payload', parentPath);
  }

  for (const [key, typeCheck] of Object.entries(schema)) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;
    const value = data[key];

    // 1. Function Validator Check (Primitives, Type.literal, Type.optional, etc.)
    if (typeof typeCheck === 'function') {
      if (!typeCheck(value)) {
        throw new ValidationError(
          `Invalid or missing type for field "${key}". Received: ${typeof value}`,
          currentPath
        );
      }
    } 
    // 2. Nested Schema Object Check
    else if (Type.object(typeCheck)) {
      if (value === undefined || value === null) {
        throw new ValidationError(
          `Missing required object field "${key}".`,
          currentPath
        );
      }
      validateSchema(typeCheck, value, currentPath);
    }
  }
  return true;
}