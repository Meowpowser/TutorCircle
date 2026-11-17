/**
 * All repositories of the Data Layer.
 * Small repositories live in this file; GroupRepository has its own file
 * because it implements the US-04 sequence diagram operations.
 */
import { BaseRepository } from './BaseRepository.js';
import { GroupRepository } from './GroupRepository.js';

export class UserRepository extends BaseRepository {
  constructor(storage) { super(storage, 'users', 'usr'); }

  findByEmail(email) {
    const target = String(email ?? '').trim().toLowerCase();
    return this.findAll().find((u) => u.email.toLowerCase() === target) ?? null;
  }

  findByRole(role) {
    return this.findWhere((u) => u.roles.includes(role));
  }
}

export class TutorProfileRepository extends BaseRepository {
  constructor(storage) { super(storage, 'tutorProfiles', 'tp'); }

  findByUser(userId) {
    return this.findAll().find((p) => p.userId === userId) ?? null;
  }
}

export class TutorApplicationRepository extends BaseRepository {
  constructor(storage) { super(storage, 'tutorApplications', 'app'); }

  findByStatus(status) {
    return status ? this.findWhere((a) => a.status === status) : this.findAll();
  }

  findLatestForUser(userId) {
    const apps = this.findWhere((a) => a.userId === userId);
    return apps.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null;
  }
}

export class TutoringRequestRepository extends BaseRepository {
  constructor(storage) { super(storage, 'tutoringRequests', 'req'); }

  findByTutor(tutorId) { return this.findWhere((r) => r.tutorId === tutorId); }
  findByStudent(studentId) { return this.findWhere((r) => r.studentId === studentId); }
}

export class TicketRepository extends BaseRepository {
  constructor(storage) { super(storage, 'tickets', 'tkt'); }

  findBySubmitter(userId) { return this.findWhere((t) => t.submittedBy === userId); }

  /** Tickets are shown to users as #1042, #1043 ... */
  nextNumber() {
    const numbers = this.findAll().map((t) => t.number);
    return numbers.length ? Math.max(...numbers) + 1 : 1001;
  }
}

export class MessageRepository extends BaseRepository {
  constructor(storage) { super(storage, 'messages', 'msg'); }

  findByGroup(groupId) {
    return this.findWhere((m) => m.groupId === groupId).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }
}

export class SurveyRepository extends BaseRepository {
  constructor(storage) { super(storage, 'surveys', 'srv'); }

  findLatestForStudent(studentId) {
    const list = this.findWhere((s) => s.studentId === studentId);
    return list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null;
  }
}

export class CourseRepository extends BaseRepository {
  constructor(storage) { super(storage, 'courses', 'crs'); }

  findByCode(code) { return this.findAll().find((c) => c.code === code) ?? null; }
}

export { GroupRepository };

/** Creates every repository on top of one storage adapter. */
export function createRepositories(storage) {
  return {
    users: new UserRepository(storage),
    tutorProfiles: new TutorProfileRepository(storage),
    applications: new TutorApplicationRepository(storage),
    requests: new TutoringRequestRepository(storage),
    tickets: new TicketRepository(storage),
    messages: new MessageRepository(storage),
    surveys: new SurveyRepository(storage),
    courses: new CourseRepository(storage),
    groups: new GroupRepository(storage),
  };
}
