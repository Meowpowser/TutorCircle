/**
 * Admin interface (Figma section "Admin").
 * Every action is checked again by the business services (admin role required).
 */
import { Events } from '../../core/EventBus.js';
import { formatShortDate, formatLongDate, formatSchedule } from '../../core/time.js';
import { METHOD_LABELS } from '../../business/TutorService.js';
import { TICKET_STATUSES, TICKET_STATUS_LABELS } from '../../business/TicketService.js';
import {
  esc, on, readForm, alertBox, toast, errorMessage, avatar, badge, chip, emptyState, confirmDialog, options, showFieldErrors,
} from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { renderShell, pageHeader, backLink } from '../ui/layout.js';
import {
  linkTabs, ticketStatusBadge, applicationStatusBadge, groupCapacityBadge, detailRow,
} from '../ui/components.js';
import { openGroupForm } from './groupForm.js';
import { chatPage } from './chat.js';

function userStatusBadge(status) {
  return status === 'active' ? badge('Active', 'success') : badge('Inactive', 'neutral');
}
const roleLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1);

function notFound(ctx, active, back, label, message) {
  renderShell(ctx, { active, content: `${backLink(back, label)}${emptyState('Not found', message)}` });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function adminDashboardPage(ctx) {
  const { services, user, query } = ctx;
  const pending = services.tutors.listApplications('pending');
  const ticketCounts = services.tickets.counts(user);
  const tickets = services.tickets.listAll(user).filter((t) => t.status !== 'resolved').slice(0, 4);
  const groups = services.groups.allGroups();
  const activeGroups = groups.filter((g) => !g.isClosed).length;
  const tab = query.tab === 'groups' ? 'groups' : 'users';
  const users = services.users.list(user).slice(0, 5);

  const main = renderShell(ctx, {
    active: '/admin/dashboard',
    content: `
      ${pageHeader('Admin Dashboard', 'Review tutor applications, support tickets and platform activity.')}
      <div class="stat-grid">
        <a class="card stat" href="#/admin/approvals"><span class="icon-tile">${icon('userCheck')}</span><div><strong>${pending.length}</strong><span>Pending tutor approvals</span></div></a>
        <a class="card stat" href="#/admin/tickets?status=open"><span class="icon-tile">${icon('ticket')}</span><div><strong>${ticketCounts.open}</strong><span>Open support tickets</span></div></a>
        <a class="card stat" href="#/admin/groups"><span class="icon-tile">${icon('users')}</span><div><strong>${activeGroups}</strong><span>Active tutoring groups</span></div></a>
      </div>
      <div class="two-col wide-left">
        <section>
          <h2 class="section-title">Pending tutor approvals</h2>
          ${pending.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Name</th><th>Major</th><th>Submitted</th><th>Action</th></tr></thead>
            <tbody>${pending.slice(0, 4).map((a) => `<tr><td class="strong">${esc(a.fullName)}</td><td>${esc(a.major)}</td><td>${esc(formatShortDate(a.submittedAt))}</td>
              <td><a class="btn btn-outline btn-sm" href="#/admin/approvals/${esc(a.id)}">Review</a></td></tr>`).join('')}</tbody></table></div>`
            : emptyState('No pending applications')}
        </section>
        <section>
          <h2 class="section-title">Recent support tickets</h2>
          ${tickets.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Subject</th><th>Status</th></tr></thead>
            <tbody>${tickets.map((t) => `<tr><td><a class="link" href="#/admin/tickets/${esc(t.id)}">${esc(t.subject)}</a></td><td>${ticketStatusBadge(t.status)}</td></tr>`).join('')}</tbody></table></div>`
            : emptyState('No open tickets')}
        </section>
      </div>
      <h2 class="section-title">Users and groups overview</h2>
      ${linkTabs([
        { key: 'users', label: 'Users', href: '#/admin/dashboard?tab=users' },
        { key: 'groups', label: 'Groups', href: '#/admin/dashboard?tab=groups' },
      ], tab)}
      ${tab === 'users' ? `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${users.map((u) => `<tr><td class="strong">${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(roleLabel(u.role))}</td><td>${userStatusBadge(u.status)}</td>
            <td><a class="btn btn-outline btn-sm" href="#/admin/users/${esc(u.id)}">Manage</a></td></tr>`).join('')}</tbody></table></div>
        <p class="small"><a class="link" href="#/admin/users">View all users →</a></p>` : `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Course</th><th>Tutor</th><th>Members</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${groups.slice(0, 5).map((g) => `<tr><td class="strong">${esc(g.courseCode)} · ${esc(g.name)}</td><td>${esc(g.tutorName)}</td><td>${g.memberCount} of ${g.capacity}</td><td>${groupCapacityBadge(g)}</td>
            <td><a class="btn btn-outline btn-sm" href="#/admin/groups/${esc(g.id)}">Manage</a></td></tr>`).join('')}</tbody></table></div>
        <p class="small"><a class="link" href="#/admin/groups">View all groups →</a></p>`}
    `,
  });
  ctx.liveRefresh([Events.APPLICATIONS, Events.TICKETS, Events.GROUPS, Events.USERS]);
  return main;
}

// ---------------------------------------------------------------------------
// Tutor approvals
// ---------------------------------------------------------------------------
export function approvalsPage(ctx) {
  const { services, query } = ctx;
  const status = ['pending', 'approved', 'rejected'].includes(query.status) ? query.status : 'pending';
  const all = services.tutors.listApplications();
  const count = (s) => all.filter((a) => a.status === s).length;
  const list = all.filter((a) => a.status === status);

  renderShell(ctx, {
    active: '/admin/approvals',
    content: `
      ${pageHeader('Tutor Approvals', 'Review applications from students who want to become tutors.')}
      ${linkTabs([
        { key: 'pending', label: 'Pending', count: count('pending'), href: '#/admin/approvals?status=pending' },
        { key: 'approved', label: 'Approved', count: count('approved'), href: '#/admin/approvals?status=approved' },
        { key: 'rejected', label: 'Rejected', count: count('rejected'), href: '#/admin/approvals?status=rejected' },
      ], status)}
      ${list.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Name</th><th>Major</th><th>Courses</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${list.map((a) => `<tr>
          <td class="strong">${esc(a.fullName)}</td><td>${esc(a.major)}</td><td>${esc(a.courses.join(', '))}</td>
          <td>${esc(formatShortDate(a.submittedAt))}</td><td>${applicationStatusBadge(a.status)}</td>
          <td><a class="btn btn-outline btn-sm" href="#/admin/approvals/${esc(a.id)}">${status === 'pending' ? 'Review' : 'View'}</a></td></tr>`).join('')}
        </tbody></table></div>` : emptyState(`No ${status} applications`)}
    `,
  });
  ctx.liveRefresh([Events.APPLICATIONS]);
}

export function approvalDetailPage(ctx) {
  const { services, user, params } = ctx;
  let app;
  try { app = services.tutors.getApplication(params.id); } catch {
    return notFound(ctx, '/admin/approvals', '/admin/approvals', 'Back to tutor approvals', 'This application does not exist.');
  }

  const decision = app.status === 'pending' ? `
    <form data-form="decision" novalidate>
      <div class="field" data-field="note"><label for="d-note">Note to applicant (optional for approval)</label>
      <textarea id="d-note" name="note" rows="3" maxlength="300" placeholder="Add a short note..."></textarea></div>
      <button type="button" class="btn btn-primary btn-block" data-action="decide" data-decision="approved">Approve application</button>
      <button type="button" class="btn btn-danger-outline btn-block" data-action="decide" data-decision="rejected">Reject application</button>
    </form>
    <p class="muted small">Approved applicants gain access to tutor features and appear in Find Tutors.</p>` : `
    ${alertBox(`This application was ${app.status} on ${formatLongDate(app.decidedAt)}.`, app.status === 'approved' ? 'success' : 'warning')}
    <h3 class="section-label">Note to applicant</h3><p>${esc(app.decisionNote || '—')}</p>`;

  const main = renderShell(ctx, {
    active: '/admin/approvals',
    content: `
      ${backLink('/admin/approvals', 'Back to tutor approvals')}
      <div class="page-header"><div><h1>Tutor application · ${esc(app.fullName)}</h1><p class="muted">Submitted ${esc(formatLongDate(app.submittedAt))}</p></div>${applicationStatusBadge(app.status)}</div>
      <div class="two-col">
        <section class="card">
          <h2 class="card-title">Applicant</h2>
          <dl class="details">
            ${detailRow('Full name', `<strong>${esc(app.fullName)}</strong>`)}
            ${detailRow('AUBH email', `<strong>${esc(app.email)}</strong>`)}
            ${detailRow('Major · Year', `<strong>${esc(app.major)} · ${esc(app.year)}</strong>`)}
            ${detailRow('Preferred method', `<strong>${esc(METHOD_LABELS[app.method])}</strong>`)}
            ${detailRow('Available days', `<strong>${esc(app.days.join(', '))}</strong>`)}
          </dl>
          <h3 class="section-label">Courses to tutor</h3>
          <div class="chips">${app.courses.map((c) => chip(c)).join('')}</div>
          <h3 class="section-label">Tutoring experience</h3>
          <p>${esc(app.experience)}</p>
        </section>
        <aside class="card side-card"><h2 class="card-title">Decision</h2>${decision}</aside>
      </div>`,
  });

  on(main, 'click', '[data-action="decide"]', async (e, btn) => {
    const form = main.querySelector('[data-form="decision"]');
    const { note } = readForm(form);
    const approve = btn.dataset.decision === 'approved';
    const ok = await confirmDialog({
      title: approve ? 'Approve this tutor?' : 'Reject this application?',
      message: approve ? `${app.fullName} will be able to log in as a tutor and will be shown to students.` : `${app.fullName} will see your note on their profile.`,
      confirmText: approve ? 'Approve' : 'Reject',
      danger: !approve,
    });
    if (!ok) return;
    try {
      services.tutors.decideApplication(user, app.id, btn.dataset.decision, note);
      toast(approve ? `${app.fullName} is now an approved tutor.` : 'Application rejected.');
      ctx.rerender();
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      toast(errorMessage(err), 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------
export function adminTicketsPage(ctx) {
  const { services, user, query } = ctx;
  const status = TICKET_STATUSES.includes(query.status) ? query.status : '';
  const counts = services.tickets.counts(user);
  const list = services.tickets.listAll(user, status);

  renderShell(ctx, {
    active: '/admin/tickets',
    content: `
      ${pageHeader('Support Tickets', 'Review reported problems and track their resolution.')}
      ${linkTabs([
        { key: '', label: 'All', count: counts.all, href: '#/admin/tickets' },
        { key: 'open', label: 'Open', count: counts.open, href: '#/admin/tickets?status=open' },
        { key: 'in-progress', label: 'In progress', count: counts['in-progress'], href: '#/admin/tickets?status=in-progress' },
        { key: 'resolved', label: 'Resolved', count: counts.resolved, href: '#/admin/tickets?status=resolved' },
      ], status)}
      ${list.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>ID</th><th>Subject</th><th>Submitted by</th><th>Category</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${list.map((t) => `<tr>
          <td>#${t.number}</td><td class="strong">${esc(t.subject)}</td><td>${esc(t.submitterName)}</td><td>${esc(t.category)}</td>
          <td>${esc(formatShortDate(t.createdAt))}</td><td>${ticketStatusBadge(t.status)}</td>
          <td><a class="btn btn-outline btn-sm" href="#/admin/tickets/${esc(t.id)}">View</a></td></tr>`).join('')}
        </tbody></table></div>` : emptyState('No tickets here')}
    `,
  });
  ctx.liveRefresh([Events.TICKETS]);
}

export function adminTicketDetailPage(ctx) {
  const { services, user, params } = ctx;
  let t;
  try { t = services.tickets.get(user, params.id); } catch {
    return notFound(ctx, '/admin/tickets', '/admin/tickets', 'Back to support tickets', 'This ticket does not exist.');
  }

  const main = renderShell(ctx, {
    active: '/admin/tickets',
    content: `
      ${backLink('/admin/tickets', 'Back to support tickets')}
      <div class="page-header"><div><h1>Ticket #${t.number} · ${esc(t.subject)}</h1><p class="muted">Submitted ${esc(formatLongDate(t.createdAt))} · last update ${esc(formatLongDate(t.updatedAt))}</p></div><span data-slot="status-badge">${ticketStatusBadge(t.status)}</span></div>
      <div class="two-col">
        <section class="card">
          <h2 class="card-title">Ticket details</h2>
          <dl class="details">
            ${detailRow('Submitted by', `<strong>${esc(t.submitterName)} · ${esc(t.submitterEmail)}</strong>`)}
            ${detailRow('Category', `<strong>${esc(t.category)}</strong>`)}
            ${detailRow('Date', `<strong>${esc(formatLongDate(t.createdAt))}</strong>`)}
          </dl>
          <h3 class="section-label">Description</h3>
          <p>${esc(t.description)}</p>
          ${t.adminNote ? `<h3 class="section-label">Latest note to student</h3><p>${esc(t.adminNote)}</p>` : ''}
        </section>
        <aside class="card side-card">
          <h2 class="card-title">Update status</h2>
          <form data-form="ticket-status" novalidate>
            <div class="field"><label for="ts-status">Status</label>
              <select id="ts-status" name="status">${options(TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABELS[s] })), t.status)}</select></div>
            <div class="field" data-field="note"><label for="ts-note">Note to student (optional)</label>
              <textarea id="ts-note" name="note" rows="3" maxlength="500" placeholder="Add a short note..."></textarea></div>
            <button type="submit" class="btn btn-primary btn-block">Save status</button>
            ${t.status !== 'in-progress' && t.status !== 'resolved' ? '<button type="button" class="btn btn-outline btn-block" data-action="quick" data-status="in-progress">Mark as in progress</button>' : ''}
            ${t.status !== 'resolved' ? '<button type="button" class="btn btn-outline btn-block" data-action="quick" data-status="resolved">Mark as resolved</button>' : ''}
          </form>
        </aside>
      </div>`,
  });

  const form = main.querySelector('[data-form="ticket-status"]');
  const save = (status) => {
    try {
      const updated = services.tickets.updateStatus(user, t.id, status, form.note.value);
      toast(`Ticket #${updated.number} marked as ${TICKET_STATUS_LABELS[updated.status].toLowerCase()}.`);
      ctx.rerender();
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else toast(errorMessage(err), 'error');
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); save(form.status.value); });
  on(main, 'click', '[data-action="quick"]', (e, btn) => save(btn.dataset.status));
}

// ---------------------------------------------------------------------------
// Manage groups
// ---------------------------------------------------------------------------
export function adminGroupsPage(ctx) {
  const { services, query } = ctx;
  const filters = { course: query.course ?? '', status: query.status ?? '' };
  const groups = services.groups.allGroups(filters);
  const courses = services.groups.listCourses().map((c) => ({ value: c.code, label: `${c.code} · ${c.title}` }));

  const main = renderShell(ctx, {
    active: '/admin/groups',
    content: `
      ${pageHeader('Manage Groups', 'Oversee tutoring groups and address issues.')}
      <form class="filters" data-form="filters">
        <label class="sr-only" for="ag-course">Course</label>
        <select id="ag-course" name="course">${options(courses, filters.course, { placeholder: 'All courses' })}</select>
        <label class="sr-only" for="ag-status">Status</label>
        <select id="ag-status" name="status">${options([{ value: 'open', label: 'Open' }, { value: 'full', label: 'Full' }, { value: 'closed', label: 'Closed' }], filters.status, { placeholder: 'Any status' })}</select>
        <button type="submit" class="btn btn-primary">Apply filters</button>
        <button type="button" class="btn btn-ghost" data-action="reset">Reset</button>
      </form>
      ${groups.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Group</th><th>Course</th><th>Tutor</th><th>Members</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${groups.map((g) => `<tr>
          <td class="strong">${esc(g.name)}</td><td>${esc(g.courseCode)} · ${esc(g.courseTitle)}</td><td>${esc(g.tutorName)}</td>
          <td>${g.memberCount} of ${g.capacity}</td><td>${groupCapacityBadge(g)}</td>
          <td><a class="btn btn-outline btn-sm" href="#/admin/groups/${esc(g.id)}">Manage</a></td></tr>`).join('')}
        </tbody></table></div>` : emptyState('No groups match these filters')}
    `,
  });
  main.querySelector('[data-form="filters"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const qs = new URLSearchParams(Object.entries(readForm(e.currentTarget)).filter(([, v]) => v)).toString();
    ctx.navigate(`/admin/groups${qs ? `?${qs}` : ''}`);
  });
  on(main, 'click', '[data-action="reset"]', () => ctx.navigate('/admin/groups'));
  ctx.liveRefresh([Events.GROUPS]);
}

export function adminGroupDetailPage(ctx) {
  const { services, user, params } = ctx;
  let g;
  try { g = services.groups.getGroupDetails(params.id); } catch {
    return notFound(ctx, '/admin/groups', '/admin/groups', 'Back to groups', 'This group does not exist.');
  }

  const main = renderShell(ctx, {
    active: '/admin/groups',
    content: `
      ${backLink('/admin/groups', 'Back to groups')}
      <div class="page-header"><div><h1>${esc(g.courseCode)} · ${esc(g.courseTitle)}</h1><p class="muted">${esc(g.name)}</p></div>${groupCapacityBadge(g)}</div>
      <div class="two-col">
        <section class="card">
          <h2 class="card-title">Group overview</h2>
          <dl class="details">
            ${detailRow('Tutor', `<strong>${esc(g.tutorName)}</strong>`)}
            ${detailRow('Schedule', `<strong>${esc(formatSchedule(g.schedule))}</strong>`)}
            ${detailRow('Location', `<strong>${esc(g.location)}</strong>`)}
            ${detailRow('Capacity', `<strong>${g.memberCount} of ${g.capacity} members</strong>`)}
          </dl>
          <h3 class="section-label">Members</h3>
          ${g.members.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Action</th></tr></thead>
            <tbody>${g.members.map((m) => `<tr><td class="strong">${esc(m.name)}</td><td>${esc(m.email)}</td><td>${esc(formatShortDate(m.joinedAt))}</td>
              <td><button type="button" class="btn btn-danger-outline btn-sm" data-action="remove" data-student="${esc(m.id)}" data-name="${esc(m.name)}">Remove</button></td></tr>`).join('')}</tbody>
          </table></div>` : '<p class="muted">No members yet.</p>'}
        </section>
        <aside class="card side-card">
          <h2 class="card-title">Group actions</h2>
          ${g.isClosed
            ? '<button type="button" class="btn btn-primary btn-block" data-action="status" data-status="open">Reopen group</button><p class="muted small">Reopening lets students join again (if spaces are available).</p>'
            : '<button type="button" class="btn btn-danger-outline btn-block" data-action="status" data-status="closed">Close group</button><p class="muted small">Closing a group stops new students from joining. Current members are not removed.</p>'}
          <button type="button" class="btn btn-outline btn-block" data-action="edit">${icon('edit')} Edit group details</button>
          <a class="btn btn-outline btn-block" href="#/admin/chat/${esc(g.id)}">${icon('message')} Open group chat</a>
          <p class="muted small">${icon('lock')} Admins may open private chats only to review reported issues.</p>
        </aside>
      </div>`,
  });

  on(main, 'click', '[data-action="remove"]', async (e, btn) => {
    const ok = await confirmDialog({ title: 'Remove member?', message: `${btn.dataset.name} will be removed from this group.`, confirmText: 'Remove', danger: true });
    if (!ok) return;
    try { services.groups.removeMember(user, g.id, btn.dataset.student); toast(`${btn.dataset.name} was removed.`); }
    catch (err) { toast(errorMessage(err), 'error'); }
  });
  on(main, 'click', '[data-action="status"]', async (e, btn) => {
    const closing = btn.dataset.status === 'closed';
    const ok = await confirmDialog({
      title: closing ? 'Close this group?' : 'Reopen this group?',
      message: closing ? 'Students will no longer be able to join. Members stay in the group.' : 'Students will be able to join again.',
      confirmText: closing ? 'Close group' : 'Reopen group',
      danger: closing,
    });
    if (!ok) return;
    try { services.groups.setStatus(user, g.id, btn.dataset.status); toast(closing ? 'Group closed.' : 'Group reopened.'); }
    catch (err) { toast(errorMessage(err), 'error'); }
  });
  on(main, 'click', '[data-action="edit"]', () => openGroupForm(ctx, { group: g, onSaved: () => ctx.rerender() }));
  ctx.liveRefresh([Events.GROUPS]);
}

export function adminChatPage(ctx) {
  chatPage(ctx, {
    basePath: '/admin/chat',
    active: '/admin/groups',
    title: 'Group chat (admin view)',
    subtitle: 'Authorized admin access for reviewing reported issues.',
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export function adminUsersPage(ctx) {
  const { services, user, query } = ctx;
  const role = ['student', 'tutor', 'admin'].includes(query.role) ? query.role : '';
  const all = services.users.list(user);
  const list = role ? all.filter((u) => u.role === role) : all;
  const count = (r) => all.filter((u) => u.role === r).length;

  renderShell(ctx, {
    active: '/admin/users',
    content: `
      ${pageHeader('Users', 'Manage user accounts and access.')}
      ${linkTabs([
        { key: '', label: 'All users', count: all.length, href: '#/admin/users' },
        { key: 'student', label: 'Students', count: count('student'), href: '#/admin/users?role=student' },
        { key: 'tutor', label: 'Tutors', count: count('tutor'), href: '#/admin/users?role=tutor' },
        { key: 'admin', label: 'Admins', count: count('admin'), href: '#/admin/users?role=admin' },
      ], role)}
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${list.map((u) => `<tr><td class="strong">${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(roleLabel(u.role))}</td><td>${userStatusBadge(u.status)}</td>
          <td><a class="btn btn-outline btn-sm" href="#/admin/users/${esc(u.id)}">Manage</a></td></tr>`).join('')}</tbody>
      </table></div>`,
  });
  ctx.liveRefresh([Events.USERS]);
}

export function adminUserDetailPage(ctx) {
  const { services, user, params } = ctx;
  let u;
  try { u = services.users.get(user, params.id); } catch {
    return notFound(ctx, '/admin/users', '/admin/users', 'Back to users', 'This user does not exist.');
  }
  const groups = services.groups.groupsForStudent(u.id);
  const tutorGroups = u.roles.includes('tutor') ? services.groups.groupsForTutor(u.id) : [];
  const application = services.tutors.latestApplication(u.id);
  const isSelf = u.id === user.id;

  const main = renderShell(ctx, {
    active: '/admin/users',
    content: `
      ${backLink('/admin/users', 'Back to users')}
      <div class="page-header"><div class="profile-head">${avatar(u.name, 'lg')}<div><h1>${esc(u.name)}</h1><p class="muted">${esc(u.email)}</p></div></div>
        <div class="chips">${badge(roleLabel(u.role), 'info')}${userStatusBadge(u.status)}</div></div>
      <div class="two-col">
        <section class="card">
          <h2 class="card-title">Account details</h2>
          <dl class="details">
            ${detailRow('Student ID', `<strong>${esc(u.studentId)}</strong>`)}
            ${detailRow('Major', `<strong>${esc(u.major)}</strong>`)}
            ${detailRow('Year', `<strong>${esc(u.year)}</strong>`)}
            ${detailRow('Role', `<strong>${esc(roleLabel(u.role))}</strong>`)}
            ${detailRow('Status', `<strong>${u.status === 'active' ? 'Active' : 'Inactive'}</strong>`)}
            ${detailRow('Tutor application', application ? applicationStatusBadge(application.status) : '<span class="muted">None</span>')}
          </dl>
          <h3 class="section-label">Groups (member)</h3>
          <div class="chips">${groups.map((g) => `<a class="chip chip-link" href="#/admin/groups/${esc(g.id)}">${esc(g.courseCode)} · ${esc(g.courseTitle)}</a>`).join('') || '<span class="muted">None</span>'}</div>
          ${tutorGroups.length ? `<h3 class="section-label">Groups (tutor)</h3><div class="chips">${tutorGroups.map((g) => `<a class="chip chip-link" href="#/admin/groups/${esc(g.id)}">${esc(g.courseCode)} · ${esc(g.name)}</a>`).join('')}</div>` : ''}
        </section>
        <aside class="card side-card">
          <h2 class="card-title">Account actions</h2>
          ${isSelf ? alertBox('This is your own account. You cannot change your own role or deactivate yourself.', 'info') : `
          <form data-form="role">
            <div class="field"><label for="u-role">Role</label>
              <select id="u-role" name="role">${options([{ value: 'student', label: 'Student' }, { value: 'tutor', label: 'Tutor (also a student)' }, { value: 'admin', label: 'Admin' }], u.role)}</select></div>
            <button type="submit" class="btn btn-primary btn-block">Save changes</button>
          </form>
          ${u.status === 'active'
            ? '<button type="button" class="btn btn-danger-outline btn-block" data-action="status" data-status="inactive">Deactivate account</button>'
            : '<button type="button" class="btn btn-outline btn-block" data-action="status" data-status="active">Reactivate account</button>'}
          <p class="muted small">Deactivated users cannot log in or join groups.</p>`}
        </aside>
      </div>`,
  });

  main.querySelector('[data-form="role"]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = e.currentTarget.role.value;
    if (role === u.role) return toast('No changes to save.', 'success');
    const ok = await confirmDialog({ title: 'Change role?', message: `${u.name} will become ${role === 'tutor' ? 'a tutor' : `a${role === 'admin' ? 'n' : ''} ${role}`}.${role === 'admin' ? ' Admins are removed from student groups.' : ''}`, confirmText: 'Change role' });
    if (!ok) return;
    try { services.users.changeRole(user, u.id, role); toast('Role updated.'); ctx.rerender(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  });
  on(main, 'click', '[data-action="status"]', async (e, btn) => {
    const deactivate = btn.dataset.status === 'inactive';
    const ok = await confirmDialog({
      title: deactivate ? 'Deactivate account?' : 'Reactivate account?',
      message: deactivate ? `${u.name} will not be able to log in or join groups.` : `${u.name} will be able to log in again.`,
      confirmText: deactivate ? 'Deactivate' : 'Reactivate',
      danger: deactivate,
    });
    if (!ok) return;
    try { services.users.setStatus(user, u.id, btn.dataset.status); toast(deactivate ? 'Account deactivated.' : 'Account reactivated.'); ctx.rerender(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  });
}
