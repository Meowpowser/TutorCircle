/**
 * TutorService — tutor applications, admin approval, tutor profiles,
 * availability and the student "Find Tutors" search.
 *
 * Fairness: every applicant goes through the same review, and tutors are
 * shown to students only after an admin approves them.
 */
import { AppError, ErrorCodes } from '../core/errors.js';
import { Events } from '../core/EventBus.js';
import { TEACHING_DAYS, SLOTS, nextWeekday } from '../core/time.js';
import { rules, validate, clean } from './validation.js';

export const METHODS = ['in-person', 'online', 'both'];
export const METHOD_LABELS = { 'in-person': 'In person', online: 'Online', both: 'In person or online' };

function emptyAvailability() {
  return Object.fromEntries(TEACHING_DAYS.map((d) => [d, []]));
}

export class TutorService {
  constructor(repos, permissions, bus) {
    this.repos = repos;
    this.permissions = permissions;
    this.bus = bus;
  }

  // ---- applications ---------------------------------------------------------

  latestApplication(userId) {
    return this.repos.applications.findLatestForUser(userId);
  }

  submitApplication(user, data) {
    this.permissions.requireRole(user, 'student');
    if (user.roles.includes('tutor')) {
      throw new AppError(ErrorCodes.INVALID_STATE, 'You are already an approved tutor.');
    }
    const latest = this.latestApplication(user.id);
    if (latest?.status === 'pending') {
      throw new AppError(ErrorCodes.DUPLICATE, 'You already have an application waiting for review.');
    }
    validate(data, {
      fullName: [rules.required('Full name')],
      major: [rules.required('Major')],
      year: [rules.required('Year')],
      courses: [rules.nonEmptyList('Choose at least one course you can tutor.')],
      experience: [rules.required('Tutoring experience'), rules.minLength('Tutoring experience', 20), rules.maxLength('Tutoring experience', 600)],
      days: [rules.nonEmptyList('Choose at least one available day.')],
      method: [rules.oneOf('Preferred method', METHODS)],
    });
    const application = this.repos.applications.insert({
      userId: user.id,
      fullName: clean(data.fullName),
      email: user.email,
      major: clean(data.major),
      year: clean(data.year),
      courses: data.courses,
      experience: clean(data.experience),
      days: data.days,
      method: data.method,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    });
    this.bus.publish(Events.APPLICATIONS, { applicationId: application.id });
    return application;
  }

  listApplications(status = '') {
    return this.repos.applications.findByStatus(status)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  getApplication(id) {
    const app = this.repos.applications.findById(id);
    if (!app) throw new AppError(ErrorCodes.NOT_FOUND, 'Application not found.');
    return app;
  }

  /**
   * Admin approves or rejects an application. The backend checks the admin
   * role first (Architecture Report: "Approve Tutor Applications").
   */
  decideApplication(admin, applicationId, decision, note = '') {
    this.permissions.requireRole(admin, 'admin');
    if (!['approved', 'rejected'].includes(decision)) throw new AppError(ErrorCodes.VALIDATION, 'Unknown decision.');
    const app = this.getApplication(applicationId);
    if (app.status !== 'pending') {
      throw new AppError(ErrorCodes.INVALID_STATE, `This application was already ${app.status}.`);
    }
    if (decision === 'rejected' && !clean(note)) {
      throw new AppError(ErrorCodes.VALIDATION, 'Please add a short note explaining the rejection.', { note: 'A note is required when rejecting.' });
    }
    const updated = this.repos.applications.update(applicationId, {
      status: decision,
      decisionNote: clean(note),
      decidedBy: admin.id,
      decidedAt: new Date().toISOString(),
    });

    if (decision === 'approved') {
      const user = this.repos.users.findById(app.userId);
      if (user && !user.roles.includes('tutor')) {
        this.repos.users.update(user.id, { roles: [...user.roles, 'tutor'] });
      }
      const availability = emptyAvailability();
      app.days.forEach((d) => { if (availability[d]) availability[d] = ['afternoon']; });
      const existing = this.repos.tutorProfiles.findByUser(app.userId);
      const profile = {
        userId: app.userId,
        courses: app.courses,
        about: existing?.about ?? '',
        experience: app.experience,
        availability: existing?.availability ?? availability,
        method: app.method,
      };
      if (existing) this.repos.tutorProfiles.update(existing.id, profile);
      else this.repos.tutorProfiles.insert(profile);
      this.bus.publish(Events.USERS, { userId: app.userId });
    }
    this.bus.publish(Events.APPLICATIONS, { applicationId, decision });
    return updated;
  }

  // ---- profiles -------------------------------------------------------------

  getTutor(userId) {
    const user = this.repos.users.findById(userId);
    const profile = this.repos.tutorProfiles.findByUser(userId);
    if (!user || !profile || !user.roles.includes('tutor')) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Tutor not found.');
    }
    return { ...profile, id: user.id, profileId: profile.id, name: user.name, email: user.email, status: user.status, major: user.major };
  }

  /** Approved, active tutors only. Filters: course, day, method. */
  findTutors({ course = '', day = '', method = '', q = '' } = {}) {
    const text = clean(q).toLowerCase();
    return this.repos.users.findByRole('tutor')
      .filter((u) => u.status === 'active')
      .map((u) => { try { return this.getTutor(u.id); } catch { return null; } })
      .filter(Boolean)
      .filter((t) => !course || t.courses.includes(course))
      .filter((t) => !day || (t.availability[day] ?? []).length > 0)
      .filter((t) => !method || t.method === method || t.method === 'both' || method === 'both')
      .filter((t) => !text || [t.name, ...t.courses].join(' ').toLowerCase().includes(text))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  updateProfile(tutor, { courses, about, experience }) {
    this.permissions.requireRole(tutor, 'tutor');
    validate({ courses, experience }, {
      courses: [rules.nonEmptyList('Choose at least one course you tutor.')],
      experience: [rules.required('Tutoring experience'), rules.maxLength('Tutoring experience', 600)],
    });
    const profile = this.repos.tutorProfiles.findByUser(tutor.id);
    if (!profile) throw new AppError(ErrorCodes.NOT_FOUND, 'Tutor profile not found.');
    const updated = this.repos.tutorProfiles.update(profile.id, {
      courses, about: clean(about ?? profile.about), experience: clean(experience),
    });
    this.bus.publish(Events.USERS, { userId: tutor.id });
    return updated;
  }

  saveAvailability(tutor, availability, method) {
    this.permissions.requireRole(tutor, 'tutor');
    validate({ method }, { method: [rules.oneOf('Preferred session method', METHODS)] });
    const cleanAvailability = emptyAvailability();
    for (const day of TEACHING_DAYS) {
      cleanAvailability[day] = (availability[day] ?? []).filter((slot) => slot in SLOTS);
    }
    if (!Object.values(cleanAvailability).some((slots) => slots.length)) {
      throw new AppError(ErrorCodes.VALIDATION, 'Mark at least one time as available so students can request sessions.');
    }
    const profile = this.repos.tutorProfiles.findByUser(tutor.id);
    if (!profile) throw new AppError(ErrorCodes.NOT_FOUND, 'Tutor profile not found.');
    const updated = this.repos.tutorProfiles.update(profile.id, { availability: cleanAvailability, method });
    this.bus.publish(Events.USERS, { userId: tutor.id });
    return updated;
  }

  /** Concrete session times students can pick from, based on availability (next 2 weeks). */
  requestableTimes(tutorId, from = new Date()) {
    const tutor = this.getTutor(tutorId);
    const times = [];
    for (let week = 0; week < 2; week++) {
      for (const day of TEACHING_DAYS) {
        for (const slot of tutor.availability[day] ?? []) {
          const s = SLOTS[slot];
          times.push(nextWeekday(day, s.requestHour, s.requestMinute, from, week));
        }
      }
    }
    return times.sort();
  }
}
