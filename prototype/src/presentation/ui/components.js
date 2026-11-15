/**
 * Reusable interface pieces shared by Student, Tutor and Admin screens.
 */
import { GroupService } from '../../business/GroupService.js';
import { TICKET_STATUS_LABELS } from '../../business/TicketService.js';
import { formatDateTime, formatSchedule } from '../../core/time.js';
import { esc, badge, emptyState } from './dom.js';
import { icon } from './icons.js';

export function groupStatusBadge(summary) {
  const s = GroupService.statusLabel(summary);
  return badge(s.text, s.tone);
}

/** Admin/tutor view of group availability (no "You joined"). */
export function groupCapacityBadge(summary) {
  if (summary.isClosed) return badge('Closed', 'neutral');
  if (summary.isFull) return badge('Full', 'neutral');
  if (summary.spotsLeft === 1) return badge('1 spot left', 'warning');
  return badge(`${summary.spotsLeft} spots left`, 'success');
}

export function requestStatusBadge(status) {
  const map = { pending: ['Pending', 'warning'], accepted: ['Accepted', 'success'], declined: ['Declined', 'danger'] };
  const [text, tone] = map[status] ?? [status, 'neutral'];
  return badge(text, tone);
}

export function ticketStatusBadge(status) {
  const tone = { open: 'info', 'in-progress': 'warning', resolved: 'success' }[status] ?? 'neutral';
  return badge(TICKET_STATUS_LABELS[status] ?? status, tone);
}

export function applicationStatusBadge(status) {
  const map = { pending: ['Pending review', 'warning'], approved: ['Approved', 'success'], rejected: ['Rejected', 'danger'] };
  const [text, tone] = map[status] ?? [status, 'neutral'];
  return badge(text, tone);
}

export function sessionStatusBadge(status) {
  return badge(status, status === 'Confirmed' ? 'success' : 'warning');
}

/** Group card used on Student Home and survey results (Figma: Student - Home). */
export function groupCard(g) {
  let action;
  if (g.isMember) action = `<a class="btn btn-outline btn-block" href="#/student/chat/${esc(g.id)}">Open group</a>`;
  else if (g.isFull || g.isClosed) action = `<button type="button" class="btn btn-outline btn-block" data-action="group-details" data-id="${esc(g.id)}">View details</button>`;
  else action = `<button type="button" class="btn btn-primary btn-block" data-action="group-details" data-id="${esc(g.id)}">View details</button>`;
  return `
    <article class="card group-card">
      <div class="group-card-head">
        <span class="icon-tile">${icon('book')}</span>
        <div>
          <p class="eyebrow">${esc(g.courseCode)}</p>
          <h3>${esc(g.courseTitle)}</h3>
        </div>
      </div>
      <div>${groupStatusBadge(g)}</div>
      <ul class="meta-list">
        <li>${icon('user')} Tutor: ${esc(g.tutorName)}</li>
        <li>${icon('calendar')} ${esc(formatSchedule(g.schedule))}</li>
        <li>${icon('pin')} ${esc(g.location)}</li>
        <li>${icon('users')} ${g.memberCount} of ${g.capacity} members</li>
      </ul>
      ${action}
    </article>`;
}

/** "Upcoming sessions" table. `who` adds a column with the other person. */
export function sessionsTable(sessions, { showWith = false, emptyText = 'Join a group or request a tutor session to see it here.' } = {}) {
  if (!sessions.length) return emptyState('No upcoming sessions', emptyText);
  return `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Date &amp; time</th><th>Course</th><th>Group</th>${showWith ? '<th>With</th>' : ''}<th>Location</th><th>Status</th></tr></thead>
        <tbody>
          ${sessions.map((s) => `
            <tr>
              <td class="strong">${esc(formatDateTime(s.start))}</td>
              <td>${esc(s.courseCode)} · ${esc(s.courseTitle)}</td>
              <td>${esc(s.groupName)}</td>
              ${showWith ? `<td>${esc(s.withName ?? '—')}</td>` : ''}
              <td>${esc(s.location)}</td>
              <td>${sessionStatusBadge(s.status)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/** Tabs that link to query-string filters, e.g. ?status=pending */
export function linkTabs(items, activeKey) {
  return `<div class="tabs" role="tablist">${items.map((t) => `
    <a role="tab" class="tab ${t.key === activeKey ? 'active' : ''}" aria-selected="${t.key === activeKey}" href="${esc(t.href)}">${esc(t.label)}${t.count !== undefined ? ` <span class="tab-count">(${t.count})</span>` : ''}</a>`).join('')}
  </div>`;
}

export function detailRow(label, value) {
  return `<div class="detail-row"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
}
