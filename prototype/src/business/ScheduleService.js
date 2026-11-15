/**
 * ScheduleService — builds the "Upcoming sessions" tables shown on the
 * Student My Groups page and the Tutor Home page. It combines:
 *   - weekly group meetings (always "Confirmed")
 *   - one-to-one tutoring requests ("Confirmed" when accepted, "Pending" when waiting)
 */
import { nextOccurrences } from '../core/time.js';

export class ScheduleService {
  constructor(repos, groupService, requestService) {
    this.repos = repos;
    this.groups = groupService;
    this.requests = requestService;
  }

  groupSessions(groups, perGroup = 2) {
    return groups
      .filter((g) => g.status !== 'closed')
      .flatMap((g) => nextOccurrences(g.schedule, perGroup).map((start) => ({
        start,
        kind: 'group',
        courseCode: g.courseCode,
        courseTitle: g.courseTitle,
        groupName: g.name,
        groupId: g.id,
        location: g.location,
        status: 'Confirmed',
      })));
  }

  requestSessions(requests) {
    const now = new Date().toISOString();
    return requests
      .filter((r) => r.status !== 'declined' && r.preferredTime > now)
      .map((r) => ({
        start: r.preferredTime,
        kind: 'request',
        courseCode: r.courseCode,
        courseTitle: r.courseTitle,
        groupName: '1-to-1',
        withName: r.studentName,
        tutorName: r.tutorName,
        location: r.type,
        status: r.status === 'accepted' ? 'Confirmed' : 'Pending',
      }));
  }

  forStudent(studentId, limit = 6) {
    const groups = this.groups.groupsForStudent(studentId);
    const requests = this.requests.listForStudent(studentId);
    return [...this.groupSessions(groups), ...this.requestSessions(requests)]
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, limit);
  }

  forTutor(tutorId, limit = 6) {
    const groups = this.groups.groupsForTutor(tutorId);
    const requests = this.requests.listForTutor(tutorId);
    return [...this.groupSessions(groups), ...this.requestSessions(requests)]
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, limit);
  }
}
