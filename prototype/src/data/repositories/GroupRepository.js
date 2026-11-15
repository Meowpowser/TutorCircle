/**
 * GroupRepository — the "Group Repository" lifeline in the US-04 sequence diagram.
 *
 * It stores tutoring groups and their membership records. It contains NO
 * business rules except the final re-check inside tryAddMemberAtomically,
 * which mirrors the database transaction described in the diagram note.
 */
import { BaseRepository, generateId } from './BaseRepository.js';

const MEMBERSHIPS = 'memberships';

export class GroupRepository extends BaseRepository {
  constructor(storage) {
    super(storage, 'groups', 'grp');
  }

  // ---- groups -------------------------------------------------------------

  /** Sequence step 3: findByCourse(course). Empty course returns all groups. */
  findByCourse(courseCode) {
    const groups = this.findAll();
    return courseCode ? groups.filter((g) => g.courseCode === courseCode) : groups;
  }

  findByTutor(tutorId) {
    return this.findWhere((g) => g.tutorId === tutorId);
  }

  /** Sequence step 25: getMaxCapacity(groupId). */
  getMaxCapacity(groupId) {
    return this.findById(groupId)?.capacity ?? 0;
  }

  // ---- memberships --------------------------------------------------------

  allMemberships() {
    return this.storage.read(MEMBERSHIPS, []);
  }

  saveMemberships(list) {
    this.storage.write(MEMBERSHIPS, list);
  }

  /** Sequence steps 12 / 27: countMembers(groupId). */
  countMembers(groupId) {
    return this.allMemberships().filter((m) => m.groupId === groupId).length;
  }

  /** Sequence step 21: exists(studentId, groupId). */
  exists(studentId, groupId) {
    return this.allMemberships().some((m) => m.groupId === groupId && m.studentId === studentId);
  }

  getMemberships(groupId) {
    return this.allMemberships().filter((m) => m.groupId === groupId);
  }

  findGroupIdsForStudent(studentId) {
    return this.allMemberships().filter((m) => m.studentId === studentId).map((m) => m.groupId);
  }

  /**
   * Sequence step 31: tryAddMemberAtomically(studentId, groupId).
   *
   * Re-reads the latest data, re-checks duplicate membership and remaining
   * capacity, then saves with a single write. In the browser JavaScript runs
   * one task at a time, so no other code in this tab can change memberships
   * between the check and the write. (Across several tabs or a real
   * multi-user server, a database transaction would be required instead.)
   *
   * @returns {{status: 'JOINED'|'ALREADY_MEMBER'|'GROUP_FULL'|'SAVE_FAILED', updatedCount: number}}
   */
  tryAddMemberAtomically(studentId, groupId) {
    const memberships = this.allMemberships();
    const current = memberships.filter((m) => m.groupId === groupId);
    if (current.some((m) => m.studentId === studentId)) {
      return { status: 'ALREADY_MEMBER', updatedCount: current.length };
    }
    if (current.length >= this.getMaxCapacity(groupId)) {
      return { status: 'GROUP_FULL', updatedCount: current.length };
    }
    memberships.push({ id: generateId('mem'), groupId, studentId, joinedAt: new Date().toISOString() });
    try {
      this.saveMemberships(memberships);
    } catch {
      return { status: 'SAVE_FAILED', updatedCount: current.length };
    }
    return { status: 'JOINED', updatedCount: current.length + 1 };
  }

  removeMember(studentId, groupId) {
    const memberships = this.allMemberships();
    const next = memberships.filter((m) => !(m.groupId === groupId && m.studentId === studentId));
    this.saveMemberships(next);
    return memberships.length !== next.length;
  }

  removeAllMembershipsForStudent(studentId) {
    this.saveMemberships(this.allMemberships().filter((m) => m.studentId !== studentId));
  }
}
