/**
 * AuthService — login, sign-up, logout and the current session.
 *
 * SIMULATED: real AUBH single sign-on is not available in a browser-only
 * prototype. We only check that emails end in @aubh.edu.bh and compare a
 * salted SHA-256 hash stored in localStorage.
 */
import { AppError, ErrorCodes } from '../core/errors.js';
import { Events } from '../core/EventBus.js';
import { hashPassword } from '../core/crypto.js';
import { rules, validate, clean } from './validation.js';

export const ROLES = ['student', 'tutor', 'admin'];

export class AuthService {
  constructor(repos, sessionStore, bus) {
    this.repos = repos;
    this.session = sessionStore;
    this.bus = bus;
  }

  /** Returns the logged-in user (fresh from storage) or null. */
  currentUser() {
    const s = this.session.get();
    if (!s) return null;
    const user = this.repos.users.findById(s.userId);
    if (!user || user.status !== 'active' || !user.roles.includes(s.role)) return null;
    return user;
  }

  /** The role the user chose on the login screen (a tutor is also a student). */
  activeRole() {
    return this.currentUser() ? this.session.get().role : null;
  }

  async login({ email, password, role }) {
    validate({ email, password, role }, {
      email: [rules.aubhEmail()],
      password: [rules.required('Password')],
      role: [rules.oneOf('Role', ROLES)],
    });
    const user = this.repos.users.findByEmail(email);
    const hash = await hashPassword(clean(email), password);
    if (!user || user.passwordHash !== hash) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 'Incorrect email or password. Please try again.');
    }
    if (user.status !== 'active') {
      throw new AppError(ErrorCodes.ACCOUNT_INACTIVE, 'This account has been deactivated. Please contact an admin.');
    }
    if (!user.roles.includes(role)) {
      const hint = role === 'tutor'
        ? 'This account is not an approved tutor yet. Log in as a student or apply to be a tutor.'
        : `This account does not have ${role} access. Choose the correct tab.`;
      throw new AppError(ErrorCodes.WRONG_ROLE, hint);
    }
    this.session.set({ userId: user.id, role, loggedInAt: new Date().toISOString() });
    this.bus.publish(Events.SESSION, { userId: user.id, role });
    return user;
  }

  async signUp({ name, email, password, confirmPassword }) {
    validate({ name, email, password, confirmPassword }, {
      name: [rules.required('Full name'), rules.minLength('Full name', 3), rules.maxLength('Full name', 60)],
      email: [rules.aubhEmail()],
      password: [rules.password()],
      confirmPassword: [rules.required('Confirm password'), (v) => (v === password ? '' : 'Passwords do not match.')],
    });
    const normalized = clean(email).toLowerCase();
    if (this.repos.users.findByEmail(normalized)) {
      throw new AppError(ErrorCodes.EMAIL_TAKEN, 'An account with this email already exists.', { email: 'An account with this email already exists.' });
    }
    const localPart = normalized.split('@')[0].toUpperCase();
    const user = this.repos.users.insert({
      name: clean(name),
      email: normalized,
      studentId: localPart,
      major: 'Not set',
      year: 'Not set',
      roles: ['student'],
      status: 'active',
      passwordHash: await hashPassword(normalized, password),
      createdAt: new Date().toISOString(),
    });
    this.bus.publish(Events.USERS, { userId: user.id });
    this.session.set({ userId: user.id, role: 'student', loggedInAt: new Date().toISOString() });
    this.bus.publish(Events.SESSION, { userId: user.id, role: 'student' });
    return user;
  }

  /** An approved tutor is also a student and may switch between the two views. */
  switchRole(role) {
    const user = this.currentUser();
    if (!user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Please log in to continue.');
    if (!user.roles.includes(role)) throw new AppError(ErrorCodes.FORBIDDEN, `This account does not have ${role} access.`);
    this.session.set({ ...this.session.get(), role });
    this.bus.publish(Events.SESSION, { userId: user.id, role });
  }

  /** SIMULATED: no email is actually sent. */
  requestPasswordReset(email) {
    validate({ email }, { email: [rules.aubhEmail()] });
    // Same response whether or not the account exists (avoids revealing accounts).
    return { sentTo: clean(email).toLowerCase() };
  }

  logout() {
    this.session.clear();
    this.bus.publish(Events.SESSION, null);
  }
}
