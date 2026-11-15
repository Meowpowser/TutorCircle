/**
 * TicketService — support tickets and reported issues.
 * Any logged-in user can submit; only admins can change a ticket's status.
 */
import { AppError, ErrorCodes } from '../core/errors.js';
import { Events } from '../core/EventBus.js';
import { rules, validate, clean } from './validation.js';

export const TICKET_CATEGORIES = ['Groups', 'Tutors', 'Requests', 'Account', 'Technical', 'Report a concern', 'Other'];
export const TICKET_STATUSES = ['open', 'in-progress', 'resolved'];
export const TICKET_STATUS_LABELS = { open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved' };

export class TicketService {
  constructor(repos, permissions, bus) {
    this.repos = repos;
    this.permissions = permissions;
    this.bus = bus;
  }

  withSubmitter(ticket) {
    const user = this.repos.users.findById(ticket.submittedBy);
    return { ...ticket, submitterName: user?.name ?? 'Unknown', submitterEmail: user?.email ?? '' };
  }

  submit(user, { subject, category, description }) {
    if (!user) throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Please log in to continue.');
    validate({ subject, category, description }, {
      subject: [rules.required('Subject'), rules.minLength('Subject', 5), rules.maxLength('Subject', 80)],
      category: [rules.oneOf('Category', TICKET_CATEGORIES)],
      description: [rules.required('Description'), rules.minLength('Description', 15), rules.maxLength('Description', 1000)],
    });
    const now = new Date().toISOString();
    const ticket = this.repos.tickets.insert({
      number: this.repos.tickets.nextNumber(),
      subject: clean(subject),
      category,
      description: clean(description),
      submittedBy: user.id,
      status: 'open',
      adminNote: '',
      createdAt: now,
      updatedAt: now,
    });
    this.bus.publish(Events.TICKETS, { ticketId: ticket.id });
    return ticket;
  }

  listForUser(userId) {
    return this.repos.tickets.findBySubmitter(userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listAll(admin, status = '') {
    this.permissions.requireRole(admin, 'admin');
    return this.repos.tickets.findAll()
      .filter((t) => !status || t.status === status)
      .map((t) => this.withSubmitter(t))
      .sort((a, b) => b.number - a.number);
  }

  counts(admin) {
    const all = this.listAll(admin);
    return {
      all: all.length,
      open: all.filter((t) => t.status === 'open').length,
      'in-progress': all.filter((t) => t.status === 'in-progress').length,
      resolved: all.filter((t) => t.status === 'resolved').length,
    };
  }

  /** Owners and admins can view a ticket. */
  get(user, ticketId) {
    const ticket = this.repos.tickets.findById(ticketId);
    if (!ticket) throw new AppError(ErrorCodes.NOT_FOUND, 'Ticket not found.');
    if (!this.permissions.isAdmin(user) && ticket.submittedBy !== user?.id) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You can only view your own tickets.');
    }
    return this.withSubmitter(ticket);
  }

  updateStatus(admin, ticketId, status, note = '') {
    this.permissions.requireRole(admin, 'admin');
    validate({ status, note }, {
      status: [rules.oneOf('Status', TICKET_STATUSES)],
      note: [rules.maxLength('Note', 500)],
    });
    const ticket = this.repos.tickets.findById(ticketId);
    if (!ticket) throw new AppError(ErrorCodes.NOT_FOUND, 'Ticket not found.');
    const updated = this.repos.tickets.update(ticketId, {
      status,
      adminNote: clean(note) || ticket.adminNote,
      updatedAt: new Date().toISOString(),
      handledBy: admin.id,
    });
    this.bus.publish(Events.TICKETS, { ticketId, status });
    return this.withSubmitter(updated);
  }
}
