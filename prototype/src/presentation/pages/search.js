/**
 * Results for the top search bar. Each role only searches what it may see.
 */
import { formatShortDate } from '../../core/time.js';
import { esc, emptyState, chip } from '../ui/dom.js';
import { renderShell, pageHeader } from '../ui/layout.js';
import { requestStatusBadge, ticketStatusBadge, groupCapacityBadge } from '../ui/components.js';

function section(title, items) {
  return `<h2 class="section-title">${esc(title)} <span class="muted small">(${items.length})</span></h2>
    ${items.length ? `<ul class="result-list card">${items.join('')}</ul>` : '<p class="muted">No matches.</p>'}`;
}

function li(href, title, sub, extra = '') {
  return `<li><a href="${esc(href)}"><span><strong>${esc(title)}</strong><span class="muted small">${esc(sub)}</span></span>${extra}</a></li>`;
}

export function searchPage(ctx) {
  const { services, user, role, query } = ctx;
  const q = (query.q ?? '').trim();
  const text = q.toLowerCase();
  const has = (...parts) => parts.join(' ').toLowerCase().includes(text);
  let body = '';

  if (!q) {
    body = emptyState('Type something to search', 'Use the search bar above.');
  } else if (role === 'student') {
    const groups = services.groups.findGroups({ q }, user.id);
    const tutors = services.tutors.findTutors({ q }).filter((t) => t.id !== user.id);
    body = section('Tutoring groups', groups.map((g) => li(`#/student/home?group=${g.id}`, `${g.courseCode} · ${g.courseTitle}`, `${g.tutorName} · ${g.scheduleLabel} · ${g.location}`, groupCapacityBadge(g))))
      + section('Tutors', tutors.map((t) => li(`#/student/tutors/${t.id}`, t.name, t.courses.join(', '))));
  } else if (role === 'tutor') {
    const groups = services.groups.groupsForTutor(user.id).filter((g) => has(g.courseCode, g.courseTitle, g.location, g.name));
    const requests = services.requests.listForTutor(user.id).filter((r) => has(r.studentName, r.courseCode, r.note));
    body = section('My groups', groups.map((g) => li(`#/tutor/groups?group=${g.id}`, `${g.courseCode} · ${g.name}`, `${g.courseTitle} · ${g.memberCount} of ${g.capacity} members`)))
      + section('Requests', requests.map((r) => li(`#/tutor/requests?status=${r.status}`, `${r.studentName} · ${r.courseCode}`, r.note || 'No note', requestStatusBadge(r.status))));
  } else {
    const users = services.users.list(user).filter((u) => has(u.name, u.email, u.studentId));
    const groups = services.groups.allGroups().filter((g) => has(g.courseCode, g.courseTitle, g.tutorName));
    const tickets = services.tickets.listAll(user).filter((t) => has(`#${t.number}`, t.subject, t.submitterName, t.category));
    body = section('Users', users.map((u) => li(`#/admin/users/${u.id}`, u.name, `${u.email} · ${u.role}`)))
      + section('Groups', groups.map((g) => li(`#/admin/groups/${g.id}`, `${g.courseCode} · ${g.courseTitle}`, `${g.name} · ${g.tutorName}`, groupCapacityBadge(g))))
      + section('Support tickets', tickets.map((t) => li(`#/admin/tickets/${t.id}`, `#${t.number} · ${t.subject}`, `${t.submitterName} · ${formatShortDate(t.createdAt)}`, ticketStatusBadge(t.status))));
  }

  renderShell(ctx, {
    active: '',
    content: `${pageHeader('Search results', q ? `Results for “${q}”` : '')}${q ? `<div class="chips">${chip(`Searching as ${role}`)}</div>` : ''}${body}`,
  });
}
