/**
 * GroupService — the "Group Module" lifeline in the US-04 sequence diagram.
 *
 * Holds every group rule: eligibility, duplicate membership, capacity,
 * open/closed status and who may manage a group. Storage is delegated to the
 * GroupRepository (Repository pattern).
 */
import { AppError, ErrorCodes, JOIN_MESSAGES } from '../core/errors.js';
import { Events } from '../core/EventBus.js';
import { slotOfTime, nextOccurrences, formatSchedule } from '../core/time.js';
import { rules, validate, clean } from './validation.js';

export class GroupService {
  constructor(repos, permissions, bus) {
    this.repos = repos;
    this.permissions = permissions;
    this.bus = bus;
  }

  // ---- courses --------------------------------------------------------------

  listCourses() {
    return this.repos.courses.findAll().sort((a, b) => a.code.localeCompare(b.code));
  }

  courseLabel(code) {
    const course = this.repos.courses.findByCode(code);
    return course ? `${course.code} · ${course.title}` : code;
  }

  // ---- read models ----------------------------------------------------------

  /** Adds the information every screen needs (tutor name, counts, spots left). */
  toSummary(group, viewerId = null) {
    const memberCount = this.repos.groups.countMembers(group.id);
    const course = this.repos.courses.findByCode(group.courseCode);
    const tutor = this.repos.users.findById(group.tutorId);
    const spotsLeft = Math.max(group.capacity - memberCount, 0);
    return {
      ...group,
      courseTitle: course?.title ?? group.courseCode,
      tutorName: tutor?.name ?? 'Unassigned',
      memberCount,
      spotsLeft,
      isFull: spotsLeft === 0,
      isClosed: group.status === 'closed',
      isMember: viewerId ? this.repos.groups.exists(viewerId, group.id) : false,
      scheduleLabel: formatSchedule(group.schedule),
      timeOfDay: slotOfTime(group.schedule.start),
    };
  }

  /** Text used for the coloured badge on group cards (Figma: "2 spots left", "Full", "You joined"). */
  static statusLabel(summary) {
    if (summary.isMember) return { text: 'You joined', tone: 'info' };
    if (summary.isClosed) return { text: 'Closed', tone: 'neutral' };
    if (summary.isFull) return { text: 'Full', tone: 'neutral' };
    if (summary.spotsLeft === 1) return { text: '1 spot left', tone: 'warning' };
    return { text: `${summary.spotsLeft} spots left`, tone: 'success' };
  }

  /**
   * Sequence steps 1–7: searchGroups(course) → findGroups(course) → findByCourse(course).
   * Extra filters (day, time of day, free text) narrow the result by availability.
   */
  findGroups({ course = '', day = '', time = '', q = '' } = {}, viewerId = null) {
    const text = clean(q).toLowerCase();
    return this.repos.groups.findByCourse(course)
      .map((g) => this.toSummary(g, viewerId))
      .filter((g) => !day || g.schedule.days.includes(day))
      .filter((g) => !time || g.timeOfDay === time)
      .filter((g) => !text || [g.courseCode, g.courseTitle, g.tutorName, g.location].join(' ').toLowerCase().includes(text))
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }

  /** Sequence steps 8–15: getGroupDetails(groupId) → findById + countMembers. */
  getGroupDetails(groupId, viewerId = null) {
    const group = this.repos.groups.findById(groupId);
    if (!group) throw new AppError(ErrorCodes.NOT_FOUND, 'This group no longer exists.');
    const summary = this.toSummary(group, viewerId);
    // Group details (members and student IDs) are visible only to logged-in users.
    const members = this.repos.groups.getMemberships(groupId).map((m) => {
      const u = this.repos.users.findById(m.studentId);
      return { id: m.studentId, name: u?.name ?? 'Unknown', studentId: u?.studentId ?? '', email: u?.email ?? '', joinedAt: m.joinedAt };
    });
    return { ...summary, members, nextSessions: nextOccurrences(group.schedule, 3) };
  }

  // ---- US-04: join a group ---------------------------------------------------

  /** Sequence step 18: checkEligibility(studentId). */
  checkEligibility(studentId) {
    const user = this.repos.users.findById(studentId);
    return Boolean(user && user.status === 'active' && user.roles.includes('student'));
  }

  /**
   * Sequence steps 16–36: joinGroup(studentId, groupId).
   * Returns { status: 'JOINED', updatedCount } or throws AppError whose code is
   * NOT_ELIGIBLE, ALREADY_MEMBER, GROUP_FULL, GROUP_CLOSED or SAVE_FAILED.
   */
  joinGroup(studentId, groupId) {
    const group = this.repos.groups.findById(groupId);
    if (!group) throw new AppError(ErrorCodes.NOT_FOUND, 'This group no longer exists.');

    if (!this.checkEligibility(studentId)) {                                  // 18–20
      throw new AppError(ErrorCodes.NOT_ELIGIBLE, JOIN_MESSAGES.NOT_ELIGIBLE);
    }
    if (this.repos.groups.exists(studentId, groupId)) {                       // 21–24
      throw new AppError(ErrorCodes.ALREADY_MEMBER, JOIN_MESSAGES.ALREADY_MEMBER);
    }
    if (group.status === 'closed') {
      throw new AppError(ErrorCodes.GROUP_CLOSED, JOIN_MESSAGES.GROUP_CLOSED);
    }
    const maxCapacity = this.repos.groups.getMaxCapacity(groupId);           // 25–26
    const memberCount = this.repos.groups.countMembers(groupId);             // 27–28
    if (memberCount >= maxCapacity) {                                        // 29–30
      throw new AppError(ErrorCodes.GROUP_FULL, JOIN_MESSAGES.GROUP_FULL);
    }

    const result = this.repos.groups.tryAddMemberAtomically(studentId, groupId); // 31–32
    if (result.status !== 'JOINED') {                                        // 35–36
      throw new AppError(ErrorCodes[result.status], JOIN_MESSAGES[result.status]);
    }
    this.bus.publish(Events.GROUPS, { groupId, studentId, action: 'joined' });
    return result;                                                           // 33–34
  }

  groupsForStudent(studentId) {
    return this.repos.groups.findGroupIdsForStudent(studentId)
      .map((id) => this.repos.groups.findById(id))
      .filter(Boolean)
      .map((g) => this.toSummary(g, studentId));
  }

  groupsForTutor(tutorId) {
    return this.repos.groups.findByTutor(tutorId).map((g) => this.toSummary(g));
  }

  allGroups({ course = '', status = '' } = {}) {
    return this.repos.groups.findByCourse(course)
      .map((g) => this.toSummary(g))
      .filter((g) => {
        if (!status) return true;
        if (status === 'full') return g.isFull && !g.isClosed;
        if (status === 'open') return !g.isFull && !g.isClosed;
        return g.status === status;
      })
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }

  // ---- managing groups (tutor for own groups, admin for all) ----------------

  groupSchema(data) {
    return {
      courseCode: [rules.required('Course')],
      name: [rules.required('Group name'), rules.maxLength('Group name', 30)],
      days: [rules.nonEmptyList('Choose at least one meeting day.')],
      start: [rules.time('Start time')],
      end: [rules.time('End time'), (v) => (String(v) > String(data.start) ? '' : 'End time must be after the start time.')],
      location: [rules.required('Location'), rules.maxLength('Location', 60)],
      capacity: [rules.integerBetween('Capacity', 2, 30)],
    };
  }

  createGroup(tutor, data) {
    this.permissions.requireRole(tutor, 'tutor');
    validate(data, this.groupSchema(data));
    const profile = this.repos.tutorProfiles.findByUser(tutor.id);
    if (!profile?.courses.includes(data.courseCode)) {
      throw new AppError(ErrorCodes.VALIDATION, 'You can only create groups for courses you tutor.', { courseCode: 'Choose one of the courses you tutor.' });
    }
    const group = this.repos.groups.insert({
      courseCode: data.courseCode,
      name: clean(data.name),
      tutorId: tutor.id,
      schedule: { days: data.days, start: data.start, end: data.end },
      location: clean(data.location),
      capacity: Number(data.capacity),
      description: clean(data.description),
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    this.bus.publish(Events.GROUPS, { groupId: group.id, action: 'created' });
    return group;
  }

  updateGroup(actor, groupId, data) {
    const group = this.repos.groups.findById(groupId);
    if (!group) throw new AppError(ErrorCodes.NOT_FOUND, 'Group not found.');
    this.permissions.requireGroupManager(actor, group);
    const merged = { courseCode: group.courseCode, name: group.name, ...data };
    validate(merged, this.groupSchema(merged));
    const memberCount = this.repos.groups.countMembers(groupId);
    if (Number(merged.capacity) < memberCount) {
      throw new AppError(ErrorCodes.VALIDATION, `Capacity cannot be lower than the current ${memberCount} members.`, { capacity: `Must be at least ${memberCount}.` });
    }
    const updated = this.repos.groups.update(groupId, {
      name: clean(merged.name),
      schedule: { days: merged.days, start: merged.start, end: merged.end },
      location: clean(merged.location),
      capacity: Number(merged.capacity),
      description: clean(merged.description ?? group.description),
    });
    this.bus.publish(Events.GROUPS, { groupId, action: 'updated' });
    return updated;
  }

  removeMember(actor, groupId, studentId) {
    const group = this.repos.groups.findById(groupId);
    if (!group) throw new AppError(ErrorCodes.NOT_FOUND, 'Group not found.');
    this.permissions.requireGroupManager(actor, group);
    if (!this.repos.groups.removeMember(studentId, groupId)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'This student is not a member of the group.');
    }
    this.bus.publish(Events.GROUPS, { groupId, studentId, action: 'removed' });
  }

  /** Admin: close a group (stops new joins, keeps members) or reopen it. */
  setStatus(actor, groupId, status) {
    const group = this.repos.groups.findById(groupId);
    if (!group) throw new AppError(ErrorCodes.NOT_FOUND, 'Group not found.');
    this.permissions.requireGroupManager(actor, group);
    if (!['open', 'closed'].includes(status)) throw new AppError(ErrorCodes.VALIDATION, 'Unknown group status.');
    this.repos.groups.update(groupId, { status });
    this.bus.publish(Events.GROUPS, { groupId, action: status });
  }
}
