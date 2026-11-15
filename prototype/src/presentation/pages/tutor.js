/**
 * Tutor interface (Figma section "Tutor").
 */
import { Events } from '../../core/EventBus.js';
import { TEACHING_DAYS, SLOTS, formatDateTime, formatShortDate } from '../../core/time.js';
import { METHOD_LABELS } from '../../business/TutorService.js';
import {
  esc, on, readForm, showFieldErrors, toast, errorMessage, avatar, badge, emptyState, confirmDialog,
} from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { renderShell, pageHeader } from '../ui/layout.js';
import { sessionsTable, requestStatusBadge, linkTabs, groupCapacityBadge } from '../ui/components.js';
import { chatPage } from './chat.js';
import { openGroupForm } from './groupForm.js';

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
export function tutorHomePage(ctx) {
  const { services, user } = ctx;
  const pending = services.requests.countsForTutor(user.id).pending;
  const groups = services.groups.groupsForTutor(user.id);
  const sessions = services.schedule.forTutor(user.id, 8);
  const byCourse = new Map();
  groups.forEach((g) => {
    const entry = byCourse.get(g.courseCode) ?? { courseCode: g.courseCode, courseTitle: g.courseTitle, groups: 0, students: 0, next: null };
    entry.groups += 1;
    entry.students += g.memberCount;
    const next = services.schedule.groupSessions([g], 1)[0]?.start;
    if (next && (!entry.next || next < entry.next)) entry.next = next;
    byCourse.set(g.courseCode, entry);
  });

  const main = renderShell(ctx, {
    active: '/tutor/home',
    content: `
      <section class="card banner-card">
        <span class="icon-tile warn">${icon('bell')}</span>
        <div class="grow">
          <h2 class="card-title" data-slot="pending-title">${pending ? `${pending} new tutoring ${pending === 1 ? 'request' : 'requests'}` : 'No new tutoring requests'}</h2>
          <p class="muted small">${pending ? 'Students are waiting for a response. Accept or decline each request.' : "You're all caught up."}</p>
        </div>
        <a class="btn btn-primary" href="#/tutor/requests">Review Requests</a>
      </section>
      <h2 class="section-title">My Courses</h2>
      ${byCourse.size ? `<div class="card-grid">${[...byCourse.values()].map((c) => `
        <article class="card course-card">
          <div class="group-card-head"><span class="icon-tile">${icon('book')}</span><div><p class="eyebrow">${esc(c.courseCode)}</p><h3>${esc(c.courseTitle)}</h3></div></div>
          <p class="muted small">${c.groups} ${c.groups === 1 ? 'group' : 'groups'} · ${c.students} students</p>
          <p class="small strong">Next: ${c.next ? esc(formatDateTime(c.next)) : '—'}</p>
        </article>`).join('')}</div>`
        : emptyState('No groups yet', 'Create a tutoring group for one of your courses.', '<a class="btn btn-primary" href="#/tutor/groups?create=1">Create group</a>')}
      <h2 class="section-title">Upcoming Sessions</h2>
      ${sessionsTable(sessions, { showWith: true, emptyText: 'Create a group or accept a tutoring request to see sessions here.' })}
    `,
  });
  ctx.liveRefresh([Events.REQUESTS, Events.GROUPS]);
  return main;
}

// ---------------------------------------------------------------------------
// Tutoring Requests — US-08 Observer pattern
// ---------------------------------------------------------------------------
export function tutorRequestsPage(ctx) {
  const { services, user, query } = ctx;
  const status = ['pending', 'accepted', 'declined'].includes(query.status) ? query.status : 'pending';

  const main = renderShell(ctx, {
    active: '/tutor/requests',
    content: `
      ${pageHeader('Tutoring Requests', 'Review incoming requests from students and respond.')}
      <div data-component="status-panel"></div>
      <div data-component="request-list"></div>`,
  });

  const panelEl = main.querySelector('[data-component="status-panel"]');
  const listEl = main.querySelector('[data-component="request-list"]');

  /** Component 1: status panel (tab counts). */
  const renderStatusPanel = () => {
    const counts = services.requests.countsForTutor(user.id);
    panelEl.innerHTML = linkTabs([
      { key: 'pending', label: 'Pending', count: counts.pending, href: '#/tutor/requests?status=pending' },
      { key: 'accepted', label: 'Accepted', count: counts.accepted, href: '#/tutor/requests?status=accepted' },
      { key: 'declined', label: 'Declined', count: counts.declined, href: '#/tutor/requests?status=declined' },
    ], status);
  };

  /** Component 2: request list for the selected status. */
  const renderList = () => {
    const requests = services.requests.listForTutor(user.id, status);
    listEl.innerHTML = requests.length ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Student</th><th>Course</th><th>Requested time</th><th>Type</th><th>Note</th><th>${status === 'pending' ? 'Actions' : 'Status'}</th></tr></thead>
        <tbody>${requests.map((r) => `
          <tr data-request-row="${esc(r.id)}">
            <td class="strong">${esc(r.studentName)}</td>
            <td>${esc(r.courseCode)}</td>
            <td>${esc(formatDateTime(r.preferredTime))}</td>
            <td>${esc(r.type)}</td>
            <td class="note-cell">${esc(r.note || '—')}</td>
            <td>${status === 'pending' ? `<div class="row-actions">
              <button type="button" class="btn btn-primary btn-sm" data-action="respond" data-decision="accepted" data-id="${esc(r.id)}" aria-label="Accept request from ${esc(r.studentName)}">Accept</button>
              <button type="button" class="btn btn-danger-outline btn-sm" data-action="respond" data-decision="declined" data-id="${esc(r.id)}" aria-label="Decline request from ${esc(r.studentName)}">Decline</button>
            </div>` : `${requestStatusBadge(r.status)}${r.respondedAt ? `<span class="muted small block">${esc(formatShortDate(r.respondedAt))}</span>` : ''}`}</td>
          </tr>`).join('')}</tbody>
      </table></div>`
      : emptyState(`No ${status} requests`, status === 'pending' ? 'New requests from students will appear here.' : '');
  };

  renderStatusPanel();
  renderList();

  // Observer: both components subscribe to the same saved request state.
  ctx.subscribe(Events.REQUESTS, renderStatusPanel);
  ctx.subscribe(Events.REQUESTS, renderList);

  on(main, 'click', '[data-action="respond"]', (e, btn) => {
    const row = btn.closest('tr');
    row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const updated = services.requests.respond(user, btn.dataset.id, btn.dataset.decision);
      toast(`Request from ${updated.studentName} ${updated.status}.`);
      // No manual DOM update needed: the published event refreshed both components.
    } catch (err) {
      // Save failed → no event was published, so both components still show the previous status.
      row.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      toast(errorMessage(err), 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
export function availabilityPage(ctx) {
  const { services, user } = ctx;
  const tutor = services.tutors.getTutor(user.id);
  let availability = structuredClone(tutor.availability);
  let method = tutor.method;

  const main = renderShell(ctx, {
    active: '/tutor/availability',
    content: `
      ${pageHeader('Availability', 'Choose the days and times students can request sessions with you.')}
      <section class="card">
        <div class="table-wrap"><table class="table availability-table" data-slot="grid"></table></div>
      </section>
      <section class="card">
        <h2 class="card-title">Preferred session method</h2>
        <div class="choice-row" role="radiogroup" aria-label="Preferred session method" data-slot="method"></div>
      </section>
      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-action="save">Save availability</button>
        <button type="button" class="btn btn-outline" data-action="reset">Reset</button>
        <span class="muted small">Students see these times when they request a session.</span>
      </div>`,
  });

  const grid = main.querySelector('[data-slot="grid"]');
  const methodEl = main.querySelector('[data-slot="method"]');
  const render = () => {
    grid.innerHTML = `
      <thead><tr><th></th>${TEACHING_DAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>${Object.entries(SLOTS).map(([slot, s]) => `
        <tr><th scope="row">${s.label} · <span class="muted">${s.range}</span></th>
        ${TEACHING_DAYS.map((d) => {
          const on_ = (availability[d] ?? []).includes(slot);
          return `<td><button type="button" class="slot ${on_ ? 'on' : ''}" aria-pressed="${on_}" data-action="toggle" data-day="${d}" data-slot="${slot}" aria-label="${d} ${s.label}">${on_ ? `${icon('check')} Available` : 'Not available'}</button></td>`;
        }).join('')}</tr>`).join('')}
      </tbody>`;
    methodEl.innerHTML = Object.entries(METHOD_LABELS).map(([v, l]) => `
      <button type="button" role="radio" aria-checked="${method === v}" class="chip-btn ${method === v ? 'on' : ''}" data-action="method" data-value="${v}">${method === v ? icon('check') : ''}${v === 'both' ? 'Both' : l}</button>`).join('');
  };
  render();

  on(main, 'click', '[data-action="toggle"]', (e, btn) => {
    const { day, slot } = btn.dataset;
    const list = availability[day] ?? [];
    availability[day] = list.includes(slot) ? list.filter((s) => s !== slot) : [...list, slot];
    render();
    main.querySelector(`[data-day="${day}"][data-slot="${slot}"]`)?.focus();
  });
  on(main, 'click', '[data-action="method"]', (e, btn) => { method = btn.dataset.value; render(); });
  on(main, 'click', '[data-action="reset"]', () => {
    const fresh = services.tutors.getTutor(user.id);
    availability = structuredClone(fresh.availability);
    method = fresh.method;
    render();
    toast('Changes discarded.', 'success');
  });
  on(main, 'click', '[data-action="save"]', () => {
    try {
      services.tutors.saveAvailability(user, availability, method);
      toast('Availability saved.');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// My Groups — manage groups and members
// ---------------------------------------------------------------------------
export function tutorGroupsPage(ctx) {
  const { services, user, query } = ctx;
  const groups = services.groups.groupsForTutor(user.id);
  const selectedId = query.group ?? groups[0]?.id;
  const selected = selectedId ? (() => { try { return services.groups.getGroupDetails(selectedId); } catch { return null; } })() : null;
  const profile = services.tutors.getTutor(user.id);

  const main = renderShell(ctx, {
    active: '/tutor/groups',
    content: `
      ${pageHeader('My Groups', 'Manage the tutoring groups you lead and see who has joined.', `<button type="button" class="btn btn-primary" data-action="create">${icon('plus')} Create group</button>`)}
      ${groups.length ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Group</th><th>Course</th><th>Members</th><th>Next session</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${groups.map((g) => {
          const next = services.schedule.groupSessions([g], 1)[0];
          return `<tr class="${g.id === selectedId ? 'selected' : ''}">
            <td class="strong">${esc(g.name)}</td>
            <td>${esc(g.courseCode)} · ${esc(g.courseTitle)}</td>
            <td>${g.memberCount} of ${g.capacity}</td>
            <td>${next ? esc(formatDateTime(next.start)) : '—'}</td>
            <td>${groupCapacityBadge(g)}</td>
            <td><div class="row-actions">
              <a class="btn btn-outline btn-sm" href="#/tutor/groups?group=${esc(g.id)}">Members</a>
              <a class="btn btn-outline btn-sm" href="#/tutor/messages/${esc(g.id)}">Message</a>
              <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(g.id)}">${icon('edit')} Edit</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : emptyState('No groups yet', 'Create your first tutoring group so students can join.')}
      ${selected ? `
      <div class="two-col">
        <section class="card">
          <h2 class="card-title">${esc(selected.courseCode)} · ${esc(selected.name)} members (${selected.memberCount} of ${selected.capacity})</h2>
          ${selected.members.length ? `<ul class="member-list roomy">${selected.members.map((m) => `
            <li>${avatar(m.name, 'sm')}<div class="grow"><strong>${esc(m.name)}</strong><span class="muted small">${esc(m.studentId)} · joined ${esc(formatShortDate(m.joinedAt))}</span></div>
            ${badge('Member', 'neutral')}
            <button type="button" class="btn btn-danger-outline btn-sm" data-action="remove" data-student="${esc(m.id)}" data-name="${esc(m.name)}">Remove</button></li>`).join('')}</ul>`
          : '<p class="muted">No members yet.</p>'}
        </section>
        <aside class="card side-card">
          <h2 class="card-title">Upcoming sessions</h2>
          <ul class="plain-list">${selected.nextSessions.map((s) => `<li><strong>${esc(formatDateTime(s))}</strong><span class="muted small">${esc(selected.location)}</span></li>`).join('') || '<li class="muted">No sessions scheduled.</li>'}</ul>
        </aside>
      </div>` : ''}
    `,
  });

  const refresh = () => ctx.rerender();
  on(main, 'click', '[data-action="create"]', () => openGroupForm(ctx, { courses: profile.courses, onSaved: (g) => ctx.navigate(`/tutor/groups?group=${g.id}`) }));
  on(main, 'click', '[data-action="edit"]', (e, btn) => {
    const g = groups.find((x) => x.id === btn.dataset.id);
    openGroupForm(ctx, { group: g, onSaved: refresh });
  });
  on(main, 'click', '[data-action="remove"]', async (e, btn) => {
    const ok = await confirmDialog({ title: 'Remove member?', message: `${btn.dataset.name} will be removed from ${selected.courseCode} · ${selected.name}.`, confirmText: 'Remove', danger: true });
    if (!ok) return;
    try {
      services.groups.removeMember(user, selected.id, btn.dataset.student);
      toast(`${btn.dataset.name} was removed from the group.`);
    } catch (err) { toast(errorMessage(err), 'error'); }
  });
  if (query.create === '1') openGroupForm(ctx, { courses: profile.courses, onSaved: (g) => ctx.navigate(`/tutor/groups?group=${g.id}`) });
  ctx.liveRefresh([Events.GROUPS]);
}

export function tutorMessagesPage(ctx) {
  chatPage(ctx, {
    basePath: '/tutor/messages',
    active: '/tutor/messages',
    title: 'Messages',
    subtitle: 'Chat with the members of your groups.',
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export function tutorProfilePage(ctx) {
  const { services, user } = ctx;
  const tutor = services.tutors.getTutor(user.id);
  const courses = services.groups.listCourses();

  const main = renderShell(ctx, {
    active: '/tutor/profile',
    content: `
      <section class="card narrow">
        <div class="profile-head">${avatar(user.name, 'lg')}<div><h1 class="h2">${esc(user.name)}</h1><p class="muted small">${esc(user.email)}</p>${badge('Approved tutor', 'success')}</div></div>
        <form data-form="tutor-profile" novalidate>
          <fieldset class="field" data-field="courses">
            <legend>Courses I tutor</legend>
            <div class="chip-toggles">${courses.map((c) => `<label class="chip-toggle"><input type="checkbox" name="courses" value="${esc(c.code)}" ${tutor.courses.includes(c.code) ? 'checked' : ''}><span>${icon('check')}${esc(c.code)}</span></label>`).join('')}</div>
          </fieldset>
          <div class="field" data-field="about"><label for="tp-about">About me</label><textarea id="tp-about" name="about" rows="3" maxlength="400">${esc(tutor.about)}</textarea></div>
          <div class="field" data-field="experience"><label for="tp-exp">Tutoring experience</label><textarea id="tp-exp" name="experience" rows="3" maxlength="600">${esc(tutor.experience)}</textarea></div>
          <p class="muted small">${icon('calendar')} Availability: ${esc(TEACHING_DAYS.filter((d) => tutor.availability[d]?.length).join(', ') || 'not set')} · ${esc(METHOD_LABELS[tutor.method])}</p>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save changes</button>
            <a class="btn btn-outline" href="#/tutor/availability">Manage availability</a>
          </div>
        </form>
      </section>`,
  });

  const form = main.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      services.tutors.updateProfile(user, readForm(form));
      showFieldErrors(form, {});
      toast('Profile saved.');
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else toast(errorMessage(err), 'error');
    }
  });
}

