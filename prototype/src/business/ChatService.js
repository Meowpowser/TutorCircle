/**
 * ChatService — private group chats.
 *
 * SIMULATED real-time: messages are saved in localStorage. Other tabs in the
 * same browser receive them instantly through the `storage` event, but there
 * is no server, so other computers never see them.
 */
import { AppError, ErrorCodes } from '../core/errors.js';
import { Events } from '../core/EventBus.js';
import { rules, validate, clean } from './validation.js';

export class ChatService {
  constructor(repos, permissions, groupService, bus) {
    this.repos = repos;
    this.permissions = permissions;
    this.groups = groupService;
    this.bus = bus;
  }

  /** Groups whose chat the user may open, with the latest message preview. */
  chatGroupsFor(user, role) {
    const groups = role === 'tutor'
      ? this.groups.groupsForTutor(user.id)
      : this.groups.groupsForStudent(user.id);
    return groups.map((g) => {
      const messages = this.repos.messages.findByGroup(g.id);
      const last = messages[messages.length - 1];
      const sender = last ? this.repos.users.findById(last.senderId) : null;
      return { ...g, lastMessage: last ? `${sender?.name.split(' ')[0] ?? 'Someone'}: ${last.text}` : 'No messages yet' };
    });
  }

  listMessages(user, groupId) {
    const group = this.repos.groups.findById(groupId);
    if (!group) throw new AppError(ErrorCodes.NOT_FOUND, 'Group not found.');
    this.permissions.requireGroupChatAccess(user, group);
    return this.repos.messages.findByGroup(groupId).map((m) => {
      const sender = this.repos.users.findById(m.senderId);
      return {
        ...m,
        senderName: sender?.name ?? 'Unknown',
        senderIsTutor: m.senderId === group.tutorId,
        senderIsAdmin: Boolean(sender?.roles.includes('admin')),
        mine: m.senderId === user.id,
      };
    });
  }

  send(user, groupId, text) {
    const group = this.repos.groups.findById(groupId);
    if (!group) throw new AppError(ErrorCodes.NOT_FOUND, 'Group not found.');
    this.permissions.requireGroupChatAccess(user, group);
    validate({ text }, { text: [rules.required('Message'), rules.maxLength('Message', 500)] });
    const message = this.repos.messages.insert({ groupId, senderId: user.id, text: clean(text), sentAt: new Date().toISOString() });
    this.bus.publish(Events.MESSAGES, { groupId, messageId: message.id });
    return message;
  }
}
