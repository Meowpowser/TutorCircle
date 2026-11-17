/**
 * RequestService — tutoring session requests (student → tutor).
 *
 * US-08 / Observer pattern: respond() checks permission, saves the new status
 * and only THEN publishes Events.REQUESTS. Subscribed interface parts (the
 * request list and the status panel) refresh from the saved data. If saving
 * fails, an error is thrown, nothing is published and the screen keeps
 * showing the previous status.
 */
import { AppError, ErrorCodes } from '../core/errors.js';
import { Events } from '../core/EventBus.js';
import { rules, validate, clean } from './validation.js';

export const REQUEST_STATUSES = ['pending', 'accepted', 'declined'];
export const SESSION_TYPES = ['In person', 'Online'];

export class RequestService {
  constructor(repos, permissions, tutorService, bus) {
    this.repos = repos;
    this.permissions = permissions;
    this.tutors = tutorService;
    this.bus = bus;
  }

  withNames(request) {
    const student = this.repos.users.findById(request.studentId);
    const tutor = this.repos.users.findById(request.tutorId);
    const course = this.repos.courses.findByCode(request.courseCode);
    return {
      ...request,
      studentName: student?.name ?? 'Unknown student',
      tutorName: tutor?.name ?? 'Unknown tutor',
      courseTitle: course?.title ?? request.courseCode,
    };
  }

  createRequest(student, { tutorId, courseCode, preferredTime, type = 'In person', note = '' }) {
    this.permissions.requireRole(student, 'student');
    if (student.id === tutorId) throw new AppError(ErrorCodes.VALIDATION, 'You cannot request a session with yourself.');
    const tutor = this.tutors.getTutor(tutorId);
    validate({ courseCode, preferredTime, type, note }, {
      courseCode: [rules.required('Course'), (v) => (tutor.courses.includes(v) ? '' : 'This tutor does not teach that course.')],
      preferredTime: [rules.required('Preferred time'), (v) => (new Date(v) > new Date() ? '' : 'Choose a time in the future.')],
      type: [rules.oneOf('Session type', SESSION_TYPES)],
      note: [rules.maxLength('Note', 300)],
    });
    const duplicate = this.repos.requests.findByStudent(student.id)
      .some((r) => r.tutorId === tutorId && r.courseCode === courseCode && r.status === 'pending');
    if (duplicate) {
      throw new AppError(ErrorCodes.DUPLICATE, 'You already have a pending request with this tutor for this course.');
    }
    const request = this.repos.requests.insert({
      studentId: student.id,
      tutorId,
      courseCode,
      preferredTime,
      type,
      note: clean(note),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    this.bus.publish(Events.REQUESTS, { requestId: request.id, status: 'pending' });
    return this.withNames(request);
  }

  listForTutor(tutorId, status = '') {
    return this.repos.requests.findByTutor(tutorId)
      .filter((r) => !status || r.status === status)
      .map((r) => this.withNames(r))
      .sort((a, b) => a.preferredTime.localeCompare(b.preferredTime));
  }

  listForStudent(studentId) {
    return this.repos.requests.findByStudent(studentId)
      .map((r) => this.withNames(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  countsForTutor(tutorId) {
    const counts = { pending: 0, accepted: 0, declined: 0 };
    this.repos.requests.findByTutor(tutorId).forEach((r) => { counts[r.status] += 1; });
    return counts;
  }

  /** Tutor accepts or declines one of THEIR pending requests. */
  respond(tutor, requestId, decision) {
    this.permissions.requireRole(tutor, 'tutor');
    if (!['accepted', 'declined'].includes(decision)) throw new AppError(ErrorCodes.VALIDATION, 'Unknown decision.');
    const request = this.repos.requests.findById(requestId);
    if (!request) throw new AppError(ErrorCodes.NOT_FOUND, 'This request no longer exists.');
    if (request.tutorId !== tutor.id) throw new AppError(ErrorCodes.FORBIDDEN, 'You can only respond to requests sent to you.');
    if (request.status !== 'pending') {
      throw new AppError(ErrorCodes.INVALID_STATE, `This request was already ${request.status}.`);
    }
    const updated = this.repos.requests.update(requestId, { status: decision, respondedAt: new Date().toISOString() });
    this.bus.publish(Events.REQUESTS, { requestId, status: decision });
    return this.withNames(updated);
  }
}
