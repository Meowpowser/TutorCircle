/**
 * Tutor requests (US-08 Observer), admin approvals, tickets, auth, chat, survey.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { ErrorCodes } from '../src/core/errors.js';
import { Events, EventBus } from '../src/core/EventBus.js';

// ---- Observer ------------------------------------------------------------------
test('EventBus notifies every subscriber and supports unsubscribe', () => {
  const bus = new EventBus();
  const seen = [];
  const off = bus.subscribe('x', (p) => seen.push(['a', p]));
  bus.subscribe('x', (p) => seen.push(['b', p]));
  bus.publish('x', 1);
  off();
  bus.publish('x', 2);
  assert.deepEqual(seen, [['a', 1], ['b', 1], ['b', 2]]);
});

// ---- US-08 tutoring requests ----------------------------------------------------
test('tutor accepts a request: status saved, list + status panel observers both notified', async () => {
  const { services, user } = await setup();
  const maryam = user('u-maryam');
  const notifications = { list: 0, panel: 0 };
  services.bus.subscribe(Events.REQUESTS, () => notifications.list++);
  services.bus.subscribe(Events.REQUESTS, () => notifications.panel++);
  const before = services.requests.countsForTutor('u-maryam');
  const updated = services.requests.respond(maryam, 'req-1', 'accepted');
  assert.equal(updated.status, 'accepted');
  const after = services.requests.countsForTutor('u-maryam');
  assert.equal(after.pending, before.pending - 1);
  assert.equal(after.accepted, before.accepted + 1);
  assert.deepEqual(notifications, { list: 1, panel: 1 });
});

test('request save failure keeps previous status and publishes nothing', async () => {
  const { services, user, storage } = await setup();
  let published = 0;
  services.bus.subscribe(Events.REQUESTS, () => published++);
  storage.failWrites = true;
  assert.throws(() => services.requests.respond(user('u-maryam'), 'req-2', 'declined'), (e) => e.code === ErrorCodes.SAVE_FAILED);
  storage.failWrites = false;
  assert.equal(published, 0);
  assert.equal(services.repos.requests.findById('req-2').status, 'pending');
});

test('tutors cannot respond to other tutors\' requests or twice', async () => {
  const { services, user } = await setup();
  assert.throws(() => services.requests.respond(user('u-elias'), 'req-1', 'accepted'), (e) => e.code === ErrorCodes.FORBIDDEN);
  assert.throws(() => services.requests.respond(user('u-helena'), 'req-1', 'accepted'), (e) => e.code === ErrorCodes.FORBIDDEN);
  services.requests.respond(user('u-maryam'), 'req-1', 'declined');
  assert.throws(() => services.requests.respond(user('u-maryam'), 'req-1', 'accepted'), (e) => e.code === ErrorCodes.INVALID_STATE);
});

test('student requests a session; duplicates and invalid courses are rejected', async () => {
  const { services, user } = await setup();
  const helena = user('u-helena');
  const time = services.tutors.requestableTimes('u-dana')[0];
  const req = services.requests.createRequest(helena, { tutorId: 'u-dana', courseCode: 'COSC 102', preferredTime: time, type: 'In person', note: 'Help' });
  assert.equal(req.status, 'pending');
  assert.ok(services.requests.listForTutor('u-dana', 'pending').some((r) => r.id === req.id));
  assert.throws(() => services.requests.createRequest(helena, { tutorId: 'u-dana', courseCode: 'COSC 102', preferredTime: time }), (e) => e.code === ErrorCodes.DUPLICATE);
  assert.throws(() => services.requests.createRequest(helena, { tutorId: 'u-dana', courseCode: 'MATH 154', preferredTime: time }), (e) => e.code === ErrorCodes.VALIDATION);
});

// ---- Admin tutor approval --------------------------------------------------------
test('only admins can approve; approval grants tutor role and shows tutor in Find Tutors', async () => {
  const { services, user } = await setup();
  assert.throws(() => services.tutors.decideApplication(user('u-maryam'), 'app-reem', 'approved'), (e) => e.code === ErrorCodes.FORBIDDEN);
  assert.ok(!services.tutors.findTutors().some((t) => t.id === 'u-reem'), 'not visible before approval');
  services.tutors.decideApplication(user('u-admin'), 'app-reem', 'approved', 'Welcome');
  assert.ok(user('u-reem').roles.includes('tutor'));
  assert.ok(services.tutors.findTutors({ course: 'MATH 260' }).some((t) => t.id === 'u-reem'));
  assert.throws(() => services.tutors.decideApplication(user('u-admin'), 'app-reem', 'rejected', 'x'), (e) => e.code === ErrorCodes.INVALID_STATE);
});

test('rejecting needs a note; rejected applicant stays a student', async () => {
  const { services, user } = await setup();
  assert.throws(() => services.tutors.decideApplication(user('u-admin'), 'app-ali', 'rejected', ''), (e) => e.code === ErrorCodes.VALIDATION);
  services.tutors.decideApplication(user('u-admin'), 'app-ali', 'rejected', 'Please gain more experience.');
  assert.deepEqual(user('u-ali').roles, ['student']);
});

test('tutor application validation and duplicate pending application', async () => {
  const { services, user } = await setup();
  const noor = user('u-noor');
  assert.throws(() => services.tutors.submitApplication(noor, { fullName: 'Noor', major: 'CS', year: 'Junior', courses: [], experience: 'short', days: [], method: 'x' }),
    (e) => e.code === ErrorCodes.VALIDATION && ['courses', 'experience', 'days', 'method'].every((f) => Boolean(e.fields[f])));
  const ok = { fullName: 'Noor Khalil', major: 'Computer Science', year: 'Sophomore', courses: ['COSC 102'], experience: 'Helped classmates in labs every week.', days: ['Sun'], method: 'online' };
  services.tutors.submitApplication(noor, ok);
  assert.throws(() => services.tutors.submitApplication(noor, ok), (e) => e.code === ErrorCodes.DUPLICATE);
  assert.throws(() => services.tutors.submitApplication(user('u-helena'), ok), (e) => e.code === ErrorCodes.DUPLICATE, 'Helena already has a pending application');
});

// ---- Support tickets -------------------------------------------------------------
test('student submits a ticket; admin moves it through the statuses', async () => {
  const { services, user } = await setup();
  const helena = user('u-helena');
  assert.throws(() => services.tickets.submit(helena, { subject: 'Hi', category: 'Nope', description: 'short' }), (e) => e.code === ErrorCodes.VALIDATION);
  const t = services.tickets.submit(helena, { subject: 'Cannot open chat', category: 'Groups', description: 'The chat page shows an error when I open it.' });
  assert.equal(t.number, 1043);
  assert.equal(t.status, 'open');
  assert.throws(() => services.tickets.updateStatus(helena, t.id, 'resolved'), (e) => e.code === ErrorCodes.FORBIDDEN);
  services.tickets.updateStatus(user('u-admin'), t.id, 'in-progress', 'Looking into it');
  const done = services.tickets.updateStatus(user('u-admin'), t.id, 'resolved', 'Fixed');
  assert.equal(done.status, 'resolved');
  assert.equal(services.tickets.listForUser('u-helena')[0].adminNote, 'Fixed');
  assert.throws(() => services.tickets.get(user('u-noor'), t.id), (e) => e.code === ErrorCodes.FORBIDDEN, 'other students cannot read it');
});

// ---- Auth --------------------------------------------------------------------------
test('login checks password, AUBH email, role tab and account status', async () => {
  const { services } = await setup();
  await assert.rejects(services.auth.login({ email: 'f2400229@gmail.com', password: 'x', role: 'student' }), (e) => e.code === ErrorCodes.VALIDATION);
  await assert.rejects(services.auth.login({ email: 'f2400229@aubh.edu.bh', password: 'wrong', role: 'student' }), (e) => e.code === ErrorCodes.INVALID_CREDENTIALS);
  await assert.rejects(services.auth.login({ email: 'f2400229@aubh.edu.bh', password: 'Student123!', role: 'tutor' }), (e) => e.code === ErrorCodes.WRONG_ROLE);
  await assert.rejects(services.auth.login({ email: 'f2409102@aubh.edu.bh', password: 'Demo123!', role: 'student' }), (e) => e.code === ErrorCodes.ACCOUNT_INACTIVE);
  const u = await services.auth.login({ email: 'F2400229@AUBH.EDU.BH', password: 'Student123!', role: 'student' });
  assert.equal(services.auth.currentUser().id, u.id);
  await services.auth.login({ email: 'f2400084@aubh.edu.bh', password: 'Tutor123!', role: 'tutor' });
  services.auth.switchRole('student');
  assert.equal(services.auth.activeRole(), 'student');
  services.auth.logout();
  assert.equal(services.auth.currentUser(), null);
});

test('sign up validates input and rejects duplicate emails', async () => {
  const { services } = await setup();
  await assert.rejects(services.auth.signUp({ name: 'A', email: 'a@b.com', password: 'short', confirmPassword: 'other' }),
    (e) => e.code === ErrorCodes.VALIDATION && ['name', 'email', 'password', 'confirmPassword'].every((f) => Boolean(e.fields[f])));
  await assert.rejects(services.auth.signUp({ name: 'Helena Copy', email: 'f2400229@aubh.edu.bh', password: 'Password1', confirmPassword: 'Password1' }), (e) => e.code === ErrorCodes.EMAIL_TAKEN);
  const u = await services.auth.signUp({ name: 'New Student', email: 'f2499999@aubh.edu.bh', password: 'Password1', confirmPassword: 'Password1' });
  assert.deepEqual(u.roles, ['student']);
  assert.equal(services.auth.activeRole(), 'student');
});

// ---- Chat privacy --------------------------------------------------------------------
test('group chat is private to members, the tutor and admins', async () => {
  const { services, user } = await setup();
  assert.ok(services.chat.listMessages(user('u-helena'), 'grp-cosc102').length > 0);
  assert.ok(services.chat.listMessages(user('u-maryam'), 'grp-cosc102').length > 0);
  assert.ok(services.chat.listMessages(user('u-admin'), 'grp-swen360').length > 0);
  assert.throws(() => services.chat.listMessages(user('u-helena'), 'grp-swen360'), (e) => e.code === ErrorCodes.FORBIDDEN);
  assert.throws(() => services.chat.send(user('u-helena'), 'grp-swen360', 'hi'), (e) => e.code === ErrorCodes.FORBIDDEN);
  services.chat.send(user('u-helena'), 'grp-cosc102', 'See you Thursday!');
  assert.equal(services.chat.listMessages(user('u-maryam'), 'grp-cosc102').at(-1).text, 'See you Thursday!');
});

// ---- Survey & admin users ---------------------------------------------------------------
test('survey requires all answers and recommends groups by course only', async () => {
  const { services, user } = await setup();
  const noor = user('u-noor');
  assert.throws(() => services.surveys.submit(noor, { courseCode: '', confidence: 'x', needs: [] }), (e) => e.code === ErrorCodes.VALIDATION);
  const s = services.surveys.submit(noor, { courseCode: 'MATH 260', confidence: 'Low', needs: ['Exam preparation'] });
  const recs = services.surveys.recommendedGroups(noor, s);
  assert.deepEqual(recs.map((g) => g.courseCode), ['MATH 260']);
});

test('admin deactivates a user, who then cannot log in; admins cannot deactivate themselves', async () => {
  const { services, user } = await setup();
  services.users.setStatus(user('u-admin'), 'u-noor', 'inactive');
  await assert.rejects(services.auth.login({ email: 'f2409101@aubh.edu.bh', password: 'Demo123!', role: 'student' }), (e) => e.code === ErrorCodes.ACCOUNT_INACTIVE);
  assert.throws(() => services.users.setStatus(user('u-admin'), 'u-admin', 'inactive'), (e) => e.code === ErrorCodes.FORBIDDEN);
  assert.throws(() => services.users.list(user('u-helena')), (e) => e.code === ErrorCodes.FORBIDDEN);
});
