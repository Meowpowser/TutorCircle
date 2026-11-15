/**
 * Error codes shared by every layer. The Presentation Layer turns each code
 * into a clear message, so users always know what went wrong (Ethical Design
 * Statement: "doesn't give a false success message").
 */
export const ErrorCodes = Object.freeze({
  // Join group (US-04 sequence diagram)
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  GROUP_FULL: 'GROUP_FULL',
  GROUP_CLOSED: 'GROUP_CLOSED',
  SAVE_FAILED: 'SAVE_FAILED',
  // General
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  WRONG_ROLE: 'WRONG_ROLE',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  DUPLICATE: 'DUPLICATE',
  INVALID_STATE: 'INVALID_STATE',
});

export class AppError extends Error {
  /**
   * @param {string} code one of ErrorCodes
   * @param {string} message human readable message shown to the user
   * @param {Record<string,string>} [fields] per-field validation messages
   */
  constructor(code, message, fields = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
  }
}

/** Default user-facing messages for the join-group outcomes. */
export const JOIN_MESSAGES = Object.freeze({
  NOT_ELIGIBLE: 'Your account is not eligible to join groups. Only active student accounts can join.',
  ALREADY_MEMBER: "You're already a member of this group.",
  GROUP_FULL: "This group is full. You can't join it, but you can browse other groups.",
  GROUP_CLOSED: 'This group is closed and is not accepting new members.',
  SAVE_FAILED: 'We could not save your membership. Please try again.',
});
