/**
 * Student interface (Figma section "Student").
 */
import { Events } from '../../core/EventBus.js';
import { TEACHING_DAYS, SLOTS, formatDateTime, formatLongDate, formatShortDate } from '../../core/time.js';
import { CONFIDENCE_LEVELS, NEED_OPTIONS } from '../../business/SurveyService.js';
import { TICKET_CATEGORIES } from '../../business/TicketService.js';
import { METHOD_LABELS } from '../../business/TutorService.js';
import { MAJORS, YEARS } from '../../business/UserService.js';
import { SESSION_TYPES } from '../../business/RequestService.js';
import {
  esc, on, readForm, showFieldErrors, alertBox, toast, errorMessage, options, avatar, chip, badge,
  emptyState, openModal,
} from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { renderShell, pageHeader, backLink } from '../ui/layout.js';
import {
  groupCard, sessionsTable, requestStatusBadge, ticketStatusBadge,
  applicationStatusBadge, detailRow,
} from '../ui/components.js';
import { openGroupDetails } from './groupModal.js';
import { chatPage } from './chat.js';

const DAY_OPTIONS = TEACHING_DAYS.map((d) => ({ value: d, label: d }));
const TIME_OPTIONS = Object.entries(SLOTS).map(([value, s]) => ({ value, label: `${s.label} (${s.range})` }));

function courseOptions(ctx, list = null) {
  return (list ?? ctx.services.groups.listCourses()).map((c) => ({ value: c.code, label: `${c.code} · ${c.title}` }));
}

// ---------------------------------------------------------------------------
// Home — search & filter groups (US-04 part A)
// ---------------------------------------------------------------------------
export function studentHomePage(ctx) {
  const { services, user, query } = ctx;
  const filters = { course: query.course ?? '', day: query.day ?? '', time: query.time ?? '' };
  const groups = services.groups.findGroups(filters, user.id);
  const survey = services.surveys.latest(user.id);
  const filtered = Boolean(filters.course || filters.day || filters.time);

  const main = renderShell(ctx, {
    active: '/student/home',
    content: `
      ${pageHeader('Available Tutoring Groups', 'Find peer tutoring groups that fit your courses and schedule.', `
        <a class="btn btn-outline" href="#/student/survey">Take Survey</a>
        <a class="btn btn-primary" href="#/student/tickets">${icon('plus')} Create Support Ticket</a>`)}
      ${!survey ? alertBox('Tip: complete the Student Needs Survey so we can show groups for the course you need help with.', 'info') : ''}
      <form class="filters" data-form="filters" aria-label="Filter groups">
        <label class="sr-only" for="f-course">Course</label>
        <select id="f-course" name="course">${options(courseOptions(ctx), filters.course, { placeholder: 'All courses' })}</select>
        <label class="sr-only" for="f-day">Availability</label>
        <select id="f-day" name="day">${options(DAY_OPTIONS, filters.day, { placeholder: 'Any availability' })}</select>
        <label class="sr-only" for="f-time">Time</label>
        <select id="f-time" name="time">${options(TIME_OPTIONS, filters.time, { placeholder: 'Any time' })}</select>
        <button type="submit" class="btn btn-primary">Apply filters</button>
        <button type="button" class="btn btn-ghost" data-action="reset-filters">Reset</button>
        ${survey && filters.course !== survey.courseCode ? `<a class="link small" href="#/student/home?course=${encodeURIComponent(survey.courseCode)}">Show my survey course (${esc(survey.courseCode)})</a>` : ''}
      </form>
      <p class="muted small" aria-live="polite">${groups.length} ${groups.length === 1 ? 'group' : 'groups'} found${filtered ? ' for your filters' : ''}.</p>
      ${groups.length
        ? `<div class="card-grid">${groups.map(groupCard).join('')}</div>`
        : emptyState('No groups found', 'No tutoring groups match these filters. Try another course or time.', '<button type="button" class="btn btn-outline" data-action="reset-filters">Clear filters</button>')}
    `,
  });

  main.querySelector('[data-form="filters"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readForm(e.currentTarget);
    const qs = new URLSearchParams(Object.entries(data).filter(([, v]) => v)).toString();
    ctx.navigate(`/student/home${qs ? `?${qs}` : ''}`);
  });
  on(main, 'click', '[data-action="reset-filters"]', () => ctx.navigate('/student/home'));
  on(main, 'click', '[data-action="group-details"]', (e, btn) => openGroupDetails(ctx, btn.dataset.id, { onClose: () => ctx.rerender() }));

  if (query.group) openGroupDetails(ctx, query.group, { onClose: () => ctx.navigate('/student/home') });
  ctx.liveRefresh([Events.GROUPS]);
}

// ---------------------------------------------------------------------------
// My Groups — joined groups + upcoming sessions + my requests
// ---------------------------------------------------------------------------
export function studentGroupsPage(ctx) {
  const { services, user } = ctx;
  const groups = services.groups.groupsForStudent(user.id);
  const sessions = services.schedule.forStudent(user.id, 8);
  const requests = services.requests.listForStudent(user.id);

  const main = renderShell(ctx, {
    active: '/student/groups',
    content: `
      ${pageHeader('My Groups', 'Groups you have joined and your upcoming study sessions.')}
      <div class="stack">
        ${groups.length ? groups.map((g) => `
          <article class="card group-row">
            <div class="group-row-top">
              <span class="icon-tile">${icon('book')}</span>
              <div class="grow"><p class="eyebrow">${esc(g.courseCode)} · ${esc(g.name)}</p><h3>${esc(g.courseTitle)}</h3></div>
              <div class="row-actions">
                ${g.isClosed ? badge('Closed', 'neutral') : badge('Active', 'info')}
                <a class="btn btn-primary btn-sm" href="#/student/chat/${esc(g.id)}">Open chat</a>
                <button type="button" class="btn btn-outline btn-sm" data-action="group-details" data-id="${esc(g.id)}">View details</button>
              </div>
            </div>
            <ul class="meta-inline">
              <li>${icon('user')} Tutor: ${esc(g.tutorName)}</li>
              <li>${icon('calendar')} ${esc(g.scheduleLabel)}</li>
              <li>${icon('pin')} ${esc(g.location)}</li>
              <li>${icon('users')} ${g.memberCount} of ${g.capacity} members</li>
            </ul>
          </article>`).join('')
        : emptyState("You haven't joined any groups yet", 'Browse the available groups and join one that fits your schedule.', '<a class="btn btn-primary" href="#/student/home">Browse groups</a>')}
      </div>
      <h2 class="section-title">Upcoming sessions</h2>
      ${sessionsTable(sessions)}
      <h2 class="section-title">My tutoring requests</h2>
      ${requests.length ? `
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Tutor</th><th>Course</th><th>Requested time</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>${requests.map((r) => `
            <tr><td class="strong"><a class="link" href="#/student/tutors/${esc(r.tutorId)}">${esc(r.tutorName)}</a></td><td>${esc(r.courseCode)}</td>
            <td>${esc(formatDateTime(r.preferredTime))}</td><td>${esc(r.type)}</td><td>${requestStatusBadge(r.status)}</td></tr>`).join('')}
          </tbody></table></div>`
        : emptyState('No tutoring requests yet', 'Find a tutor and request a one-to-one session.', '<a class="btn btn-outline" href="#/student/tutors">Find tutors</a>')}
    `,
  });
  on(main, 'click', '[data-action="group-details"]', (e, btn) => openGroupDetails(ctx, btn.dataset.id, { onClose: () => ctx.rerender() }));
  ctx.liveRefresh([Events.GROUPS, Events.REQUESTS]);
}

export function studentChatPage(ctx) {
  chatPage(ctx, {
    basePath: '/student/chat',
    active: '/student/groups',
    title: 'Group Chat',
    subtitle: 'Message the members of your tutoring groups to plan sessions.',
  });
}

// ---------------------------------------------------------------------------
// Find Tutors + Tutor profile + request a session
// ---------------------------------------------------------------------------
function availabilitySummary(t) {
  const days = TEACHING_DAYS.filter((d) => (t.availability[d] ?? []).length);
  return days.length ? days.join(', ') : 'No times set';
}

export function findTutorsPage(ctx) {
  const { services, query } = ctx;
  const filters = { course: query.course ?? '', day: query.day ?? '', method: query.method ?? '' };
  const tutors = services.tutors.findTutors(filters).filter((t) => t.id !== ctx.user.id);

  const main = renderShell(ctx, {
    active: '/student/tutors',
    content: `
      ${pageHeader('Find Tutors', 'Search approved peer tutors by course and see when they are available.')}
      <form class="filters" data-form="filters" aria-label="Filter tutors">
        <label class="sr-only" for="t-course">Course</label>
        <select id="t-course" name="course">${options(courseOptions(ctx), filters.course, { placeholder: 'All courses' })}</select>
        <label class="sr-only" for="t-day">Day</label>
        <select id="t-day" name="day">${options(DAY_OPTIONS, filters.day, { placeholder: 'Any day' })}</select>
        <label class="sr-only" for="t-method">Method</label>
        <select id="t-method" name="method">${options([{ value: 'in-person', label: 'In person' }, { value: 'online', label: 'Online' }], filters.method, { placeholder: 'In person or online' })}</select>
        <button type="submit" class="btn btn-primary">Apply filters</button>
        <button type="button" class="btn btn-ghost" data-action="reset">Reset</button>
      </form>
      <p class="muted small">${tutors.length} approved ${tutors.length === 1 ? 'tutor' : 'tutors'} found.</p>
      ${tutors.length ? `<div class="card-grid">${tutors.map((t) => `
        <article class="card tutor-card">
          <div class="tutor-card-head">${avatar(t.name)}<div><h3>${esc(t.name)}</h3><p class="muted small">Approved tutor</p></div></div>
          <div class="chips">${t.courses.map((c) => chip(c)).join('')}</div>
          <ul class="meta-list">
            <li>${icon('calendar')} ${esc(availabilitySummary(t))}</li>
            <li>${icon('pin')} ${esc(METHOD_LABELS[t.method])}</li>
          </ul>
          <a class="btn btn-outline btn-block" href="#/student/tutors/${esc(t.id)}">View profile</a>
        </article>`).join('')}</div>`
        : emptyState('No tutors found', 'No approved tutors match these filters yet.', '<button type="button" class="btn btn-outline" data-action="reset">Clear filters</button>')}
    `,
  });
  main.querySelector('[data-form="filters"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const qs = new URLSearchParams(Object.entries(readForm(e.currentTarget)).filter(([, v]) => v)).toString();
    ctx.navigate(`/student/tutors${qs ? `?${qs}` : ''}`);
  });
  on(main, 'click', '[data-action="reset"]', () => ctx.navigate('/student/tutors'));
  ctx.liveRefresh([Events.USERS]);
}

export function tutorProfileForStudentPage(ctx) {
  const { services, user, params } = ctx;
  let tutor;
  try {
    tutor = services.tutors.getTutor(params.tutorId);
    if (tutor.status !== 'active') throw new Error('inactive');
  } catch {
    renderShell(ctx, { active: '/student/tutors', content: `${backLink('/student/tutors', 'Back to tutors')}${emptyState('Tutor not found', 'This tutor is not available.')}` });
    return;
  }
  const times = services.tutors.requestableTimes(tutor.id);
  const types = tutor.method === 'both' ? SESSION_TYPES : [tutor.method === 'online' ? 'Online' : 'In person'];
  const myRequests = services.requests.listForStudent(user.id).filter((r) => r.tutorId === tutor.id);
  const availabilityChips = TEACHING_DAYS.flatMap((d) => (tutor.availability[d] ?? []).map((s) => chip(`${d} · ${SLOTS[s].range}`)));

  const requestForm = `
    <h2 class="card-title">Request a session</h2>
    <div data-slot="request-message"></div>
    ${times.length ? `
    <form data-form="request" novalidate>
      <div class="field" data-field="courseCode">
        <label for="r-course">Course</label>
        <select id="r-course" name="courseCode">${options(tutor.courses.map((c) => ({ value: c, label: services.groups.courseLabel(c) })), '', { placeholder: 'Choose a course' })}</select>
      </div>
      <div class="field" data-field="preferredTime">
        <label for="r-time">Preferred time</label>
        <select id="r-time" name="preferredTime">${options(times.map((t) => ({ value: t, label: formatDateTime(t) })), '', { placeholder: 'Choose a time' })}</select>
      </div>
      <div class="field" data-field="type">
        <label for="r-type">Session type</label>
        <select id="r-type" name="type">${options(types, types[0])}</select>
      </div>
      <div class="field" data-field="note">
        <label for="r-note">Note (optional)</label>
        <textarea id="r-note" name="note" rows="3" maxlength="300" placeholder="What would you like help with?"></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Send request</button>
    </form>
    <p class="muted small">${esc(tutor.name.split(' ')[0])} will see your request on their Requests page.</p>`
    : alertBox('This tutor has not set any available times yet.', 'info')}`;

  const main = renderShell(ctx, {
    active: '/student/tutors',
    content: `
      ${backLink('/student/tutors', 'Back to tutors')}
      <div class="two-col">
        <section class="card">
          <div class="profile-head">${avatar(tutor.name, 'lg')}<div><h1 class="h2">${esc(tutor.name)}</h1>${badge('Approved tutor', 'success')}</div></div>
          <h3 class="section-label">Courses</h3>
          <div class="chips">${tutor.courses.map((c) => chip(services.groups.courseLabel(c))).join('') || '<span class="muted">No courses listed</span>'}</div>
          <h3 class="section-label">About</h3>
          <p>${esc(tutor.about || 'No description yet.')}</p>
          <h3 class="section-label">Experience</h3>
          <p>${esc(tutor.experience)}</p>
          <h3 class="section-label">Availability</h3>
          <div class="chips">${availabilityChips.join('') || '<span class="muted">No times set</span>'}</div>
          <p class="muted small mt">${icon('pin')} ${esc(METHOD_LABELS[tutor.method])}</p>
        </section>
        <aside class="card side-card" data-slot="request-panel">${requestForm}</aside>
      </div>
      ${myRequests.length ? `
        <h2 class="section-title">Your requests with ${esc(tutor.name.split(' ')[0])}</h2>
        <div class="table-wrap"><table class="table"><thead><tr><th>Course</th><th>Time</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>${myRequests.map((r) => `<tr><td>${esc(r.courseCode)}</td><td>${esc(formatDateTime(r.preferredTime))}</td><td>${esc(r.type)}</td><td>${requestStatusBadge(r.status)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    `,
  });

  const form = main.querySelector('[data-form="request"]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = main.querySelector('[data-slot="request-message"]');
    msg.innerHTML = '';
    try {
      const req = services.requests.createRequest(user, { tutorId: tutor.id, ...readForm(form) });
      main.querySelector('[data-slot="request-panel"]').innerHTML = `
        <h2 class="card-title">Request a session</h2>
        ${alertBox(`Request sent to ${tutor.name}. You'll be notified when they respond.`, 'success')}
        <dl class="details">
          ${detailRow('Course', esc(services.groups.courseLabel(req.courseCode)))}
          ${detailRow('Time', esc(formatDateTime(req.preferredTime)))}
          ${detailRow('Type', esc(req.type))}
          ${detailRow('Status', requestStatusBadge(req.status))}
        </dl>
        <a class="btn btn-outline btn-block" href="#/student/tutors">Back to tutors</a>`;
      toast('Request sent.');
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else msg.innerHTML = alertBox(errorMessage(err));
    }
  });
  // Only refresh for changes made elsewhere (e.g. the tutor answering in another tab),
  // so the "Request sent" confirmation above is not replaced.
  ctx.liveRefresh([Events.REQUESTS, Events.USERS], { externalOnly: true });
}

// ---------------------------------------------------------------------------
// Student Needs Survey
// ---------------------------------------------------------------------------
export function surveyPage(ctx) {
  const { services, user } = ctx;
  const previous = services.surveys.latest(user.id);

  const main = renderShell(ctx, {
    active: '/student/survey',
    content: `
      <section class="card narrow">
        <h1 class="h2">Student Needs Survey</h1>
        <p class="muted">Tell us what kind of support you need. This helps tutors and admins understand your goals.</p>
        ${previous ? `<p class="muted small">Last completed on ${esc(formatLongDate(previous.submittedAt))} (${esc(previous.courseCode)}).</p>` : ''}
        <div class="progress" aria-hidden="true"><span data-slot="progress-bar"></span></div>
        <p class="muted small" data-slot="progress-text" aria-live="polite"></p>
        <form data-form="survey" novalidate>
          <div class="field" data-field="courseCode">
            <label for="s-course" class="q-label">1. Which course do you need help with?</label>
            <select id="s-course" name="courseCode">${options(courseOptions(ctx), previous?.courseCode ?? '', { placeholder: 'Choose a course' })}</select>
          </div>
          <fieldset class="field" data-field="confidence">
            <legend class="q-label">2. How confident do you feel in this course?</legend>
            <div class="choice-row">
              ${CONFIDENCE_LEVELS.map((level) => `
                <label class="choice"><input type="radio" name="confidence" value="${level}" ${previous?.confidence === level ? 'checked' : ''}><span>${level}</span></label>`).join('')}
            </div>
          </fieldset>
          <fieldset class="field" data-field="needs">
            <legend class="q-label">3. What do you need help with? (Select all that apply)</legend>
            <div class="choice-grid">
              ${NEED_OPTIONS.map((n) => `
                <label class="choice"><input type="checkbox" name="needs" value="${esc(n)}" ${previous?.needs.includes(n) ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('')}
            </div>
          </fieldset>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Submit survey</button>
            <span class="muted small">You can retake the survey at any time.</span>
          </div>
        </form>
      </section>`,
  });

  const form = main.querySelector('[data-form="survey"]');
  const updateProgress = () => {
    const d = readForm(form);
    const answered = [d.courseCode, d.confidence, d.needs?.length].filter(Boolean).length;
    main.querySelector('[data-slot="progress-bar"]').style.width = `${(answered / 3) * 100}%`;
    main.querySelector('[data-slot="progress-text"]').textContent = `${answered} of 3 questions answered`;
  };
  form.addEventListener('change', updateProgress);
  updateProgress();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      services.surveys.submit(user, readForm(form));
      toast('Survey submitted.');
      ctx.navigate('/student/survey/done');
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else toast(errorMessage(err), 'error');
    }
  });
}

export function surveyDonePage(ctx) {
  const { services, user } = ctx;
  const survey = services.surveys.latest(user.id);
  if (!survey) return ctx.navigate('/student/survey');
  const groups = services.surveys.recommendedGroups(user, survey);

  const main = renderShell(ctx, {
    active: '/student/survey',
    content: `
      <section class="card narrow center-card">
        <div class="success-icon">${icon('check')}</div>
        <h1 class="h2">Survey submitted</h1>
        <p class="muted">Thanks! Here is what you told us.</p>
        <dl class="details left">
          ${detailRow('Course', esc(services.groups.courseLabel(survey.courseCode)))}
          ${detailRow('Confidence', esc(survey.confidence))}
          ${detailRow('Needs help with', esc(survey.needs.join(', ')))}
        </dl>
        <div class="form-actions center">
          <a class="btn btn-outline" href="#/student/survey">Retake survey</a>
          <a class="btn btn-primary" href="#/student/home?course=${encodeURIComponent(survey.courseCode)}">See all ${esc(survey.courseCode)} groups</a>
        </div>
      </section>
      <h2 class="section-title">Groups for ${esc(survey.courseCode)}</h2>
      <p class="muted small">Every student who chooses this course sees the same list — groups are matched by course only.</p>
      ${groups.length ? `<div class="card-grid">${groups.map(groupCard).join('')}</div>`
        : emptyState('No groups for this course yet', 'You can request a one-to-one session with a tutor instead.', `<a class="btn btn-primary" href="#/student/tutors?course=${encodeURIComponent(survey.courseCode)}">Find tutors</a>`)}
    `,
  });
  on(main, 'click', '[data-action="group-details"]', (e, btn) => openGroupDetails(ctx, btn.dataset.id, { onClose: () => ctx.rerender() }));
  ctx.liveRefresh([Events.GROUPS]);
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------
export function studentTicketsPage(ctx) {
  const { services, user } = ctx;
  const tickets = services.tickets.listForUser(user.id);
  const base = ctx.role === 'tutor' ? '/tutor' : '/student';

  const main = renderShell(ctx, {
    active: `${base}/tickets`,
    content: `
      ${pageHeader('Support Ticket', 'Report a problem or ask for help with the platform. An admin will review it.')}
      <div class="two-col">
        <section class="card">
          <h2 class="card-title">New ticket</h2>
          <form data-form="ticket" novalidate>
            <div class="field" data-field="subject">
              <label for="tk-subject">Subject</label>
              <input id="tk-subject" name="subject" maxlength="80" placeholder="Short summary of the problem">
            </div>
            <div class="field" data-field="category">
              <label for="tk-category">Category</label>
              <select id="tk-category" name="category">${options(TICKET_CATEGORIES, '', { placeholder: 'Choose a category' })}</select>
            </div>
            <div class="field" data-field="description">
              <label for="tk-desc">Description</label>
              <textarea id="tk-desc" name="description" rows="6" maxlength="1000" placeholder="Describe what happened..."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Submit ticket</button>
              <button type="reset" class="btn btn-outline">Cancel</button>
            </div>
          </form>
        </section>
        <aside class="card side-card">
          <h2 class="card-title">My tickets</h2>
          ${tickets.length ? `<ul class="ticket-list">${tickets.map((t) => `
            <li><button type="button" class="ticket-item" data-action="view-ticket" data-id="${esc(t.id)}">
              <span><strong>${esc(t.subject)}</strong><span class="muted small">#${t.number} · ${esc(formatShortDate(t.createdAt))}</span></span>
              ${ticketStatusBadge(t.status)}
            </button></li>`).join('')}</ul>`
          : '<p class="muted">You have not submitted any tickets yet.</p>'}
        </aside>
      </div>`,
  });

  const form = main.querySelector('[data-form="ticket"]');
  form.addEventListener('reset', () => showFieldErrors(form, {}));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const t = services.tickets.submit(user, readForm(form));
      toast(`Ticket #${t.number} submitted. An admin will review it.`);
      ctx.rerender();
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else toast(errorMessage(err), 'error');
    }
  });
  on(main, 'click', '[data-action="view-ticket"]', (e, btn) => {
    try {
      const t = services.tickets.get(user, btn.dataset.id);
      const modal = openModal({ labelledBy: 'ticket-title' });
      modal.body.innerHTML = `
        <div class="modal-header"><div class="grow"><p class="eyebrow">Ticket #${t.number}</p><h2 id="ticket-title">${esc(t.subject)}</h2></div>
          <button type="button" class="icon-btn" data-action="close" aria-label="Close">${icon('x')}</button></div>
        <dl class="details">
          ${detailRow('Status', ticketStatusBadge(t.status))}
          ${detailRow('Category', esc(t.category))}
          ${detailRow('Submitted', esc(formatLongDate(t.createdAt)))}
          ${detailRow('Last update', esc(formatLongDate(t.updatedAt)))}
        </dl>
        <h3 class="section-label">Description</h3><p>${esc(t.description)}</p>
        <h3 class="section-label">Admin response</h3><p>${esc(t.adminNote || 'No response yet. An admin will review your ticket soon.')}</p>
        <div class="modal-actions"><button type="button" class="btn btn-primary" data-action="close">Close</button></div>`;
      on(modal.body, 'click', '[data-action="close"]', () => modal.close());
    } catch (err) { toast(errorMessage(err), 'error'); }
  });
  ctx.liveRefresh([Events.TICKETS]);
}

// ---------------------------------------------------------------------------
// Profile + tutor application
// ---------------------------------------------------------------------------
export function studentProfilePage(ctx) {
  const { services, user } = ctx;
  const survey = services.surveys.latest(user.id);
  const groups = services.groups.groupsForStudent(user.id);
  const application = services.tutors.latestApplication(user.id);
  const isTutor = user.roles.includes('tutor');
  const editing = ctx.query.edit === '1';

  let tutorAction;
  if (isTutor) tutorAction = '<button type="button" class="btn btn-primary" data-action="switch-tutor">Switch to tutor view</button>';
  else if (application?.status === 'pending') tutorAction = '<a class="btn btn-outline" href="#/student/apply">View tutor application</a>';
  else tutorAction = '<a class="btn btn-primary" href="#/student/apply">Apply to be a tutor</a>';

  const main = renderShell(ctx, {
    active: '/student/profile',
    content: `
      <section class="card narrow">
        <div class="profile-head">${avatar(user.name, 'lg')}<div>
          <h1 class="h2">${esc(user.name)}</h1>
          <p class="muted small">${esc(user.email)}</p>
          <div class="chips">${badge('Student', 'info')}${isTutor ? badge('Approved tutor', 'success') : ''}</div>
        </div></div>
        ${editing ? `
          <form data-form="profile" novalidate>
            <div class="field" data-field="name"><label for="p-name">Full name</label><input id="p-name" name="name" value="${esc(user.name)}"></div>
            <div class="form-grid">
              <div class="field" data-field="major"><label for="p-major">Major</label><select id="p-major" name="major">${options(MAJORS, user.major)}</select></div>
              <div class="field" data-field="year"><label for="p-year">Year</label><select id="p-year" name="year">${options(YEARS, user.year)}</select></div>
            </div>
            <div class="form-actions"><button type="submit" class="btn btn-primary">Save changes</button><a class="btn btn-outline" href="#/student/profile">Cancel</a></div>
          </form>` : `
          <dl class="details">
            ${detailRow('Student ID', esc(user.studentId))}
            ${detailRow('Major', `<strong>${esc(user.major)}</strong>`)}
            ${detailRow('Year', `<strong>${esc(user.year)}</strong>`)}
            ${detailRow('Survey', survey ? `<strong>Completed on ${esc(formatLongDate(survey.submittedAt))}</strong>` : '<span class="muted">Not completed yet</span>')}
            ${detailRow('Tutor application', application ? applicationStatusBadge(application.status) : '<span class="muted">Not submitted</span>')}
          </dl>
          <h3 class="section-label">My groups</h3>
          <div class="chips">${groups.map((g) => `<a class="chip chip-link" href="#/student/chat/${esc(g.id)}">${esc(g.courseCode)} · ${esc(g.courseTitle)}</a>`).join('') || '<span class="muted">No groups yet</span>'}</div>
          ${application?.status === 'rejected' ? alertBox(`Your last tutor application was not approved: ${application.decisionNote || 'no note given'}. You can apply again.`, 'warning') : ''}
          <div class="form-actions">
            ${tutorAction}
            <a class="btn btn-outline" href="#/student/survey">Take the survey again</a>
            <a class="btn btn-ghost" href="#/student/profile?edit=1">${icon('edit')} Edit profile</a>
          </div>`}
      </section>`,
  });

  const form = main.querySelector('[data-form="profile"]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      services.users.updateOwnProfile(user, readForm(form));
      toast('Profile updated.');
      ctx.navigate('/student/profile');
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else toast(errorMessage(err), 'error');
    }
  });
  on(main, 'click', '[data-action="switch-tutor"]', () => {
    services.auth.switchRole('tutor');
    ctx.navigate('/tutor/home');
  });
  ctx.liveRefresh([Events.USERS, Events.APPLICATIONS, Events.GROUPS]);
}

export function applyTutorPage(ctx) {
  const { services, user } = ctx;
  const latest = services.tutors.latestApplication(user.id);
  const courses = services.groups.listCourses();
  const showForm = !latest || latest.status === 'rejected' || ctx.query.again === '1';

  if (user.roles.includes('tutor')) {
    renderShell(ctx, { active: '/student/profile', content: `<section class="card narrow center-card"><div class="success-icon">${icon('check')}</div><h1 class="h2">You are an approved tutor</h1><p class="muted">Use the account menu to switch to the tutor view.</p><a class="btn btn-primary" href="#/student/profile">Back to profile</a></section>` });
    return;
  }

  if (!showForm || latest?.status === 'pending') {
    renderShell(ctx, {
      active: '/student/profile',
      content: `
        <section class="card narrow center-card">
          <div class="success-icon">${icon('check')}</div>
          <h1 class="h2">Application submitted</h1>
          <p class="muted">An admin reviews every tutor application the same way. You'll see the decision on your profile.</p>
          <dl class="details left">
            ${detailRow('Status', applicationStatusBadge(latest.status))}
            ${detailRow('Submitted', esc(formatLongDate(latest.submittedAt)))}
            ${detailRow('Courses', esc(latest.courses.join(', ')))}
            ${detailRow('Available days', esc(latest.days.join(', ')))}
            ${detailRow('Preferred method', esc(METHOD_LABELS[latest.method]))}
          </dl>
          <div class="form-actions center"><a class="btn btn-primary" href="#/student/profile">Back to profile</a></div>
        </section>`,
    });
    ctx.liveRefresh([Events.APPLICATIONS]);
    return;
  }

  const main = renderShell(ctx, {
    active: '/student/profile',
    content: `
      <section class="card narrow">
        <div class="card-head-row"><h1 class="h2">Apply to Become a Tutor</h1>${badge('Not submitted', 'neutral')}</div>
        <p class="muted">An admin reviews every application. You'll be notified of the decision.</p>
        <form data-form="apply" novalidate>
          <div class="form-grid">
            <div class="field" data-field="fullName"><label for="a-name">Full name *</label><input id="a-name" name="fullName" value="${esc(user.name)}"></div>
            <div class="field"><label for="a-email">AUBH email *</label><input id="a-email" value="${esc(user.email)}" readonly aria-readonly="true"></div>
            <div class="field" data-field="major"><label for="a-major">Major *</label><select id="a-major" name="major">${options(MAJORS.filter((m) => m !== 'Not set'), user.major, { placeholder: 'Choose your major' })}</select></div>
            <div class="field" data-field="year"><label for="a-year">Year *</label><select id="a-year" name="year">${options(YEARS.filter((y) => y !== 'Not set'), user.year, { placeholder: 'Choose your year' })}</select></div>
          </div>
          <fieldset class="field" data-field="courses">
            <legend>Courses you can tutor *</legend>
            <div class="chip-toggles">${courses.map((c) => `<label class="chip-toggle"><input type="checkbox" name="courses" value="${esc(c.code)}"><span>${icon('check')}${esc(c.code)}</span></label>`).join('')}</div>
          </fieldset>
          <div class="field" data-field="experience">
            <label for="a-exp">Tutoring experience *</label>
            <textarea id="a-exp" name="experience" rows="4" maxlength="600" placeholder="Tell us how you have helped other students (at least 20 characters)."></textarea>
          </div>
          <fieldset class="field" data-field="days">
            <legend>Available days *</legend>
            <div class="chip-toggles">${TEACHING_DAYS.map((d) => `<label class="chip-toggle"><input type="checkbox" name="days" value="${d}"><span>${icon('check')}${d}</span></label>`).join('')}</div>
          </fieldset>
          <fieldset class="field" data-field="method">
            <legend>Preferred method *</legend>
            <div class="choice-row">
              ${[['in-person', 'In person'], ['online', 'Online'], ['both', 'Both']].map(([v, l]) => `<label class="choice"><input type="radio" name="method" value="${v}"><span>${l}</span></label>`).join('')}
            </div>
          </fieldset>
          <div class="form-actions end">
            <a class="btn btn-outline" href="#/student/profile">Cancel</a>
            <button type="submit" class="btn btn-primary">Submit application</button>
          </div>
        </form>
      </section>`,
  });

  const form = main.querySelector('[data-form="apply"]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      services.tutors.submitApplication(user, readForm(form));
      toast('Application submitted.');
      ctx.navigate('/student/apply');
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else toast(errorMessage(err), 'error');
    }
  });
}

