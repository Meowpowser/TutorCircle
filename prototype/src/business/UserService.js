/**
 * UserService — own profile management and admin account management.
 */
import { AppError, ErrorCodes } from '../core/errors.js';
import { Events } from '../core/EventBus.js';
import { rules, validate, clean } from './validation.js';

export const MAJORS = [
  'Computer Science', 'Software Engineering', 'Computer Engineering', 'Data Science and AI',
  'Cybersecurity', 'Mathematics', 'Business', 'Architecture', 'Not set',
];
export const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Not set'];

/** What the admin "Role" dropdown means in terms of stored roles. */
const ROLE_SETS = { student: ['student'], tutor: ['student', 'tutor'], admin: ['admin'] };

export function primaryRole(user) {
  if (user.roles.includes('admin')) return 'admin';
  if (user.roles.includes('tutor')) return 'tutor';
  return 'student';
}

export class UserService {
  constructor(repos, permissions, bus) {
    this.repos = repos;
    this.permissions = permissions;
    this.bus = bus;
  }

  /** Public-safe copy of a user (never expose the password hash to the UI). */
  view(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return { ...safe, role: primaryRole(user) };
  }

  updateOwnProfile(user, { name, major, year }) {
    if (!user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Please log in to continue.');
    validate({ name, major, year }, {
      name: [rules.required('Full name'), rules.minLength('Full name', 3), rules.maxLength('Full name', 60)],
      major: [rules.oneOf('Major', MAJORS)],
      year: [rules.oneOf('Year', YEARS)],
    });
    const updated = this.repos.users.update(user.id, { name: clean(name), major, year });
    this.bus.publish(Events.USERS, { userId: user.id });
    return this.view(updated);
  }

  // ---- admin ----------------------------------------------------------------

  list(admin, role = '') {
    this.permissions.requireRole(admin, 'admin');
    return this.repos.users.findAll()
      .map((u) => this.view(u))
      .filter((u) => !role || u.role === role)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get(admin, userId) {
    this.permissions.requireRole(admin, 'admin');
    const user = this.repos.users.findById(userId);
    if (!user) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found.');
    return this.view(user);
  }

  changeRole(admin, userId, role) {
    this.permissions.requireRole(admin, 'admin');
    if (!(role in ROLE_SETS)) throw new AppError(ErrorCodes.VALIDATION, 'Unknown role.');
    if (userId === admin.id && role !== 'admin') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You cannot remove your own admin access.');
    }
    const user = this.repos.users.findById(userId);
    if (!user) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found.');
    if (role === 'tutor' && !this.repos.tutorProfiles.findByUser(userId)) {
      this.repos.tutorProfiles.insert({
        userId, courses: [], about: '', experience: 'Added by an admin.',
        availability: { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [] }, method: 'in-person',
      });
    }
    if (role !== 'student' && role !== 'tutor') {
      // Admin accounts do not join groups as students.
      this.repos.groups.removeAllMembershipsForStudent(userId);
    }
    const updated = this.repos.users.update(userId, { roles: ROLE_SETS[role] });
    this.bus.publish(Events.USERS, { userId });
    this.bus.publish(Events.GROUPS, { userId });
    return this.view(updated);
  }

  setStatus(admin, userId, status) {
    this.permissions.requireRole(admin, 'admin');
    if (!['active', 'inactive'].includes(status)) throw new AppError(ErrorCodes.VALIDATION, 'Unknown status.');
    if (userId === admin.id) throw new AppError(ErrorCodes.FORBIDDEN, 'You cannot deactivate your own account.');
    const updated = this.repos.users.update(userId, { status });
    this.bus.publish(Events.USERS, { userId });
    return this.view(updated);
  }
}
