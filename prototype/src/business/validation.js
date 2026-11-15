/**
 * Input validation rules (Business Logic Layer).
 * Each validator returns an error message string, or '' when the value is valid.
 */
import { AppError, ErrorCodes } from '../core/errors.js';

export const AUBH_DOMAIN = '@aubh.edu.bh';

export const rules = {
  required: (label) => (v) => (String(v ?? '').trim() ? '' : `${label} is required.`),
  aubhEmail: () => (v) => {
    const email = String(v ?? '').trim().toLowerCase();
    if (!email) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    if (!email.endsWith(AUBH_DOMAIN)) return `Use your AUBH email (ending in ${AUBH_DOMAIN}).`;
    return '';
  },
  minLength: (label, n) => (v) => (String(v ?? '').trim().length >= n ? '' : `${label} must be at least ${n} characters.`),
  maxLength: (label, n) => (v) => (String(v ?? '').trim().length <= n ? '' : `${label} must be ${n} characters or fewer.`),
  password: () => (v) => {
    const p = String(v ?? '');
    if (p.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain letters and at least one number.';
    return '';
  },
  nonEmptyList: (message) => (v) => (Array.isArray(v) && v.length ? '' : message),
  oneOf: (label, options) => (v) => (options.includes(v) ? '' : `Choose a valid ${label.toLowerCase()}.`),
  integerBetween: (label, min, max) => (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? '' : `${label} must be a whole number between ${min} and ${max}.`;
  },
  time: (label) => (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v ?? '')) ? '' : `${label} must be a valid time.`),
};

/**
 * Runs a schema of validators against `data`.
 * Throws AppError(VALIDATION) with per-field messages when anything fails.
 * @param {Record<string, any>} data
 * @param {Record<string, Array<(v:any)=>string>>} schema
 */
export function validate(data, schema) {
  const fields = {};
  for (const [field, validators] of Object.entries(schema)) {
    for (const check of validators) {
      const message = check(data[field]);
      if (message) {
        fields[field] = message;
        break;
      }
    }
  }
  if (Object.keys(fields).length) {
    throw new AppError(ErrorCodes.VALIDATION, 'Please fix the highlighted fields.', fields);
  }
}

export function clean(text) {
  return String(text ?? '').trim();
}
