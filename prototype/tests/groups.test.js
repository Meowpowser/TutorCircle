/**
 * US-04 — search and join tutoring groups (follows the sequence diagram).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';
import { ErrorCodes } from '../src/core/errors.js';
import { Events } from '../src/core/EventBus.js';

test('searchGroups(course) returns only matching groups (steps 1–7)', async () => {
  const { services } = await setup();
  const result = services.groups.findGroups({ course: 'SWEN 360' });
  assert.equal(result.length, 1);
  assert.equal(result[0].courseCode, 'SWEN 360');
  assert.equal(services.groups.findGroups({ course: 'CYBR 310' }).length, 0, 'no matching groups → empty list');
});

test('availability filters by day and time of day', async () => {
  const { services } = await setup();
  const thursday = services.groups.findGroups({ day: 'Thu' }).map((g) => g.courseCode).sort();
  assert.deepEqual(thursday, ['COSC 102', 'DSAI 310', 'SWEN 360']);
  const evening = services.groups.findGroups({ time: 'evening' }).map((g) => g.courseCode);
  assert.deepEqual(evening, ['MATH 260']);
});

test('getGroupDetails returns member count and members (steps 8–15)', async () => {
  const { services } = await setup();
  const g = services.groups.getGroupDetails('grp-swen360');
  assert.equal(g.memberCount, 4);
  assert.equal(g.capacity, 6);
  assert.equal(g.spotsLeft, 2);
  assert.equal(g.members.length, 4);
});

test('student joins a group: capacity updates and is saved (steps 16–34)', async () => {
  const { services, storage } = await setup();
  let published = 0;
  services.bus.subscribe(Events.GROUPS, () => { published++; });
  const result = services.groups.joinGroup('u-helena', 'grp-swen360');
  assert.deepEqual(result, { status: 'JOINED', updatedCount: 5 });
  assert.equal(services.groups.getGroupDetails('grp-swen360').spotsLeft, 1);
  assert.equal(published, 1, 'observers are notified once after the save');
  // persisted: a brand-new service layer on the same storage still sees the membership
  const saved = storage.read('memberships').filter((m) => m.groupId === 'grp-swen360' && m.studentId === 'u-helena');
  assert.equal(saved.length, 1);
  assert.ok(services.groups.groupsForStudent('u-helena').some((g) => g.id === 'grp-swen360'));
});

test('duplicate membership is rejected with ALREADY_MEMBER (steps 21–24)', async () => {
  const { services } = await setup();
  assert.throws(() => services.groups.joinGroup('u-helena', 'grp-cosc102'), (e) => e.code === ErrorCodes.ALREADY_MEMBER);
  assert.equal(services.groups.getGroupDetails('grp-cosc102').memberCount, 5, 'count unchanged');
});

test('full group is rejected with GROUP_FULL (steps 25–30)', async () => {
  const { services } = await setup();
  assert.throws(() => services.groups.joinGroup('u-helena', 'grp-phys101'), (e) => e.code === ErrorCodes.GROUP_FULL);
  assert.equal(services.groups.getGroupDetails('grp-phys101').memberCount, 6);
});

test('last spot: first student gets it, second sees GROUP_FULL', async () => {
  const { services } = await setup();
  services.groups.joinGroup('u-helena', 'grp-math154'); // 6 of 6 now
  assert.throws(() => services.groups.joinGroup('u-ahmed', 'grp-math154'), (e) => e.code === ErrorCodes.GROUP_FULL);
});

test('repository re-checks inside tryAddMemberAtomically', async () => {
  const { services } = await setup();
  const repo = services.repos.groups;
  assert.equal(repo.tryAddMemberAtomically('u-noor', 'grp-swen360').status, 'ALREADY_MEMBER');
  assert.equal(repo.tryAddMemberAtomically('u-helena', 'grp-phys101').status, 'GROUP_FULL');
});

test('inactive accounts and admins are NOT_ELIGIBLE (steps 18–20)', async () => {
  const { services } = await setup();
  assert.throws(() => services.groups.joinGroup('u-hamad', 'grp-swen360'), (e) => e.code === ErrorCodes.NOT_ELIGIBLE);
  assert.throws(() => services.groups.joinGroup('u-admin', 'grp-swen360'), (e) => e.code === ErrorCodes.NOT_ELIGIBLE);
});

test('closed groups cannot be joined', async () => {
  const { services, user } = await setup();
  services.groups.setStatus(user('u-admin'), 'grp-swen360', 'closed');
  assert.throws(() => services.groups.joinGroup('u-helena', 'grp-swen360'), (e) => e.code === ErrorCodes.GROUP_CLOSED);
});

test('failed save → SAVE_FAILED and no observer notification', async () => {
  const { services, storage } = await setup();
  let published = 0;
  services.bus.subscribe(Events.GROUPS, () => { published++; });
  storage.failWrites = true;
  assert.throws(() => services.groups.joinGroup('u-helena', 'grp-swen360'), (e) => e.code === ErrorCodes.SAVE_FAILED);
  storage.failWrites = false;
  assert.equal(published, 0);
  assert.equal(services.groups.getGroupDetails('grp-swen360').memberCount, 4);
});

test('tutors manage only their own groups; capacity cannot drop below members', async () => {
  const { services, user } = await setup();
  const maryam = user('u-maryam');
  assert.throws(() => services.groups.removeMember(maryam, 'grp-swen360', 'u-noor'), (e) => e.code === ErrorCodes.FORBIDDEN);
  services.groups.removeMember(maryam, 'grp-cosc102', 'u-noor');
  assert.equal(services.groups.getGroupDetails('grp-cosc102').memberCount, 4);
  const g = services.repos.groups.findById('grp-cosc102');
  assert.throws(() => services.groups.updateGroup(maryam, g.id, { ...g.schedule, location: g.location, capacity: 2 }), (e) => e.code === ErrorCodes.VALIDATION);
});

test('tutor creates a group only for a course they tutor', async () => {
  const { services, user } = await setup();
  const maryam = user('u-maryam');
  const base = { name: 'Group B', days: ['Sun'], start: '10:00', end: '11:00', location: 'Library, Room 1', capacity: 5 };
  assert.throws(() => services.groups.createGroup(maryam, { ...base, courseCode: 'PHYS 101' }), (e) => e.code === ErrorCodes.VALIDATION);
  const g = services.groups.createGroup(maryam, { ...base, courseCode: 'MATH 154' });
  assert.equal(services.groups.findGroups({ course: 'MATH 154' }).length, 2);
  assert.equal(g.tutorId, 'u-maryam');
});
