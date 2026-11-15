/**
 * PermissionService — the single place where role rules are checked
 * (Architecture Report: "a singular place to check whether someone is an admin").
 */
import { AppError, ErrorCodes } from '../core/errors.js';

export class PermissionService {
  constructor(repos) {
    this.repos = repos;
  }

  /** Throws unless `user` is logged in, active and holds `role`. */
  requireRole(user, role) {
    if (!user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Please log in to continue.');
    if (user.status !== 'active') throw new AppError(ErrorCodes.ACCOUNT_INACTIVE, 'Your account is inactive. Contact an admin.');
    if (!user.roles.includes(role)) {
      throw new AppError(ErrorCodes.FORBIDDEN, `Only ${role}s can do this.`);
    }
  }

  isAdmin(user) {
    return Boolean(user && user.status === 'active' && user.roles.includes('admin'));
  }

  isGroupMember(userId, groupId) {
    return this.repos.groups.exists(userId, groupId);
  }

  isGroupTutor(userId, group) {
    return Boolean(group && group.tutorId === userId);
  }

  /** Private group chat: only members, the group's tutor and authorized admins. */
  canAccessGroupChat(user, group) {
    if (!user || !group || user.status !== 'active') return false;
    return this.isAdmin(user) || this.isGroupTutor(user.id, group) || this.isGroupMember(user.id, group.id);
  }

  requireGroupChatAccess(user, group) {
    if (!this.canAccessGroupChat(user, group)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Group chats are private. Only group members, the tutor and admins can open them.');
    }
  }

  /** Tutors may manage only their own groups; admins may manage every group. */
  requireGroupManager(user, group) {
    if (this.isAdmin(user)) return;
    this.requireRole(user, 'tutor');
    if (!this.isGroupTutor(user.id, group)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You can only manage groups that you tutor.');
    }
  }
}
