/**
 * Wires the Business Logic Layer together.
 * The same function is used by the browser app and by the automated tests,
 * only the storage adapter differs.
 */
import { EventBus } from '../core/EventBus.js';
import { createRepositories } from '../data/repositories/index.js';
import { PermissionService } from './PermissionService.js';
import { AuthService } from './AuthService.js';
import { GroupService } from './GroupService.js';
import { TutorService } from './TutorService.js';
import { RequestService } from './RequestService.js';
import { TicketService } from './TicketService.js';
import { ChatService } from './ChatService.js';
import { SurveyService } from './SurveyService.js';
import { UserService } from './UserService.js';
import { ScheduleService } from './ScheduleService.js';

/**
 * @param {object} storage a storage adapter (LocalStorageAdapter or MemoryStorageAdapter)
 * @param {object} sessionStore a SessionStore
 * @param {EventBus} [bus]
 */
export function createServices(storage, sessionStore, bus = new EventBus()) {
  const repos = createRepositories(storage);
  const permissions = new PermissionService(repos);
  const auth = new AuthService(repos, sessionStore, bus);
  const groups = new GroupService(repos, permissions, bus);
  const tutors = new TutorService(repos, permissions, bus);
  const requests = new RequestService(repos, permissions, tutors, bus);
  const tickets = new TicketService(repos, permissions, bus);
  const chat = new ChatService(repos, permissions, groups, bus);
  const surveys = new SurveyService(repos, permissions, groups, bus);
  const users = new UserService(repos, permissions, bus);
  const schedule = new ScheduleService(repos, groups, requests);
  return { bus, repos, permissions, auth, groups, tutors, requests, tickets, chat, surveys, users, schedule };
}
