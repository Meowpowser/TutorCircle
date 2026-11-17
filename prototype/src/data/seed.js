/**
 * Fictional demo data. Names and AUBH-style emails are invented for testing.
 * Dates are generated relative to "now" so upcoming sessions stay upcoming.
 *
 * Demo logins (see README):
 *   Student  f2400229@aubh.edu.bh / Student123!
 *   Tutor    f2400084@aubh.edu.bh / Tutor123!
 *   Admin    admin@aubh.edu.bh    / Admin123!
 * Every other demo account uses the password  Demo123!
 */
import { hashPassword } from '../core/crypto.js';
import { daysAgo, nextWeekday } from '../core/time.js';

export const SEED_VERSION = 3;

export const DEMO_ACCOUNTS = Object.freeze([
  { role: 'student', email: 'f2400229@aubh.edu.bh', password: 'Student123!', name: 'Helena Azuela' },
  { role: 'tutor', email: 'f2400084@aubh.edu.bh', password: 'Tutor123!', name: 'Maryam AlBastaki' },
  { role: 'admin', email: 'admin@aubh.edu.bh', password: 'Admin123!', name: 'Layla Hassan' },
]);

const COURSES = [
  { code: 'SWEN 360', title: 'Software Design and Engineering' },
  { code: 'MATH 154', title: 'Calculus II' },
  { code: 'DSAI 310', title: 'Introduction to Data Science' },
  { code: 'PHYS 101', title: 'Principles of Physics I' },
  { code: 'MATH 260', title: 'Probability and Statistics' },
  { code: 'COSC 102', title: 'Object-Oriented Programming' },
  { code: 'COSC 125', title: 'Discrete Structures' },
  { code: 'CMPE 270', title: 'Digital Logic Design' },
  { code: 'CYBR 310', title: 'Network Security' },
];

// [id, name, studentId, major, year, roles, status]
const PEOPLE = [
  ['u-helena', 'Helena Azuela', 'F2400229', 'Data Science and AI', 'Junior', ['student'], 'active'],
  ['u-maryam', 'Maryam AlBastaki', 'F2400084', 'Computer Science', 'Senior', ['student', 'tutor'], 'active'],
  ['u-elias', 'Elias AlSaie', 'F2400111', 'Software Engineering', 'Senior', ['student', 'tutor'], 'active'],
  ['u-bassem', 'Bassem Mahmood', 'F2400145', 'Computer Engineering', 'Senior', ['student', 'tutor'], 'active'],
  ['u-fatema', 'Fatema Akbar', 'F2400162', 'Data Science and AI', 'Senior', ['student', 'tutor'], 'active'],
  ['u-khalid', 'Khalid Mansoor', 'F2400178', 'Computer Engineering', 'Junior', ['student', 'tutor'], 'active'],
  ['u-dana', 'Dana Jaber', 'F2400190', 'Computer Science', 'Junior', ['student', 'tutor'], 'active'],
  ['u-noor', 'Noor Khalil', 'F2409101', 'Computer Science', 'Sophomore', ['student'], 'active'],
  ['u-hamad', 'Hamad Ali', 'F2409102', 'Data Science and AI', 'Sophomore', ['student'], 'inactive'],
  ['u-yousef', 'Yousef Mansour', 'F2409103', 'Software Engineering', 'Junior', ['student'], 'active'],
  ['u-fatima', 'Fatima Saleh', 'F2409104', 'Computer Science', 'Sophomore', ['student'], 'active'],
  ['u-ahmed', 'Ahmed Abdulla', 'F2409105', 'Software Engineering', 'Junior', ['student'], 'active'],
  ['u-reem', 'Reem Al-Saleh', 'F2409106', 'Mathematics', 'Junior', ['student'], 'active'],
  ['u-zainab', 'Zainab Ahmed', 'F2409107', 'Computer Engineering', 'Junior', ['student'], 'active'],
  ['u-ali', 'Ali Yusuf', 'F2409108', 'Cybersecurity', 'Sophomore', ['student'], 'active'],
  ['u-mahdi', 'Mahdi Nasser', 'F2409109', 'Computer Science', 'Senior', ['student'], 'active'],
  ['u-sara', 'Sara Jamal', 'F2409110', 'Mathematics', 'Freshman', ['student'], 'active'],
  ['u-omar', 'Omar Haddad', 'F2409111', 'Computer Engineering', 'Sophomore', ['student'], 'active'],
  ['u-layan', 'Layan Isa', 'F2409112', 'Data Science and AI', 'Freshman', ['student'], 'active'],
];

const PASSWORDS = {
  'u-helena': 'Student123!',
  'u-maryam': 'Tutor123!',
  'u-admin': 'Admin123!',
};

const TUTOR_PROFILES = [
  {
    userId: 'u-maryam',
    courses: ['MATH 154', 'COSC 102', 'DSAI 310'],
    about: 'I help classmates with calculus, data science basics and getting started with Java. I like working through examples step by step.',
    experience: 'Peer mentor in the CS lab for two semesters. Leads the COSC 102 study group on Thursdays.',
    availability: { Sun: ['afternoon'], Mon: ['afternoon'], Tue: [], Wed: ['afternoon'], Thu: ['morning', 'afternoon'] },
    method: 'in-person',
  },
  {
    userId: 'u-elias',
    courses: ['SWEN 360', 'CYBR 310'],
    about: 'Happy to review UML diagrams, design patterns and sprint deliverables.',
    experience: 'Teaching assistant for SWEN 260. Two internships in software development.',
    availability: { Sun: [], Mon: [], Tue: ['afternoon'], Wed: [], Thu: ['afternoon'] },
    method: 'in-person',
  },
  {
    userId: 'u-bassem',
    courses: ['PHYS 101', 'CMPE 270'],
    about: 'Physics problem solving and digital logic, with lots of practice questions.',
    experience: 'Tutored PHYS 101 at the Learning Center for one year.',
    availability: { Sun: ['afternoon'], Mon: [], Tue: ['afternoon'], Wed: [], Thu: [] },
    method: 'both',
  },
  {
    userId: 'u-fatema',
    courses: ['MATH 260', 'DSAI 310'],
    about: 'Statistics made simple — I focus on intuition before formulas.',
    experience: 'Grader for MATH 260 and peer tutor for DSAI 310.',
    availability: { Sun: [], Mon: [], Tue: [], Wed: ['evening'], Thu: [] },
    method: 'online',
  },
  {
    userId: 'u-khalid',
    courses: ['CMPE 270', 'COSC 125'],
    about: 'Logic design and discrete maths, including proof techniques.',
    experience: 'Lab assistant for CMPE 270.',
    availability: { Sun: [], Mon: ['morning'], Tue: [], Wed: [], Thu: ['morning'] },
    method: 'both',
  },
  {
    userId: 'u-dana',
    courses: ['COSC 102', 'COSC 125'],
    about: 'Java, object-oriented design and discrete structures.',
    experience: 'Peer tutor for first-year programming courses.',
    availability: { Sun: ['afternoon'], Mon: [], Tue: ['afternoon'], Wed: [], Thu: ['afternoon'] },
    method: 'in-person',
  },
];

const GROUPS = [
  {
    id: 'grp-swen360', courseCode: 'SWEN 360', name: 'Group A', tutorId: 'u-elias',
    schedule: { days: ['Tue', 'Thu'], start: '15:30', end: '17:00' }, location: 'Library, Room 204', capacity: 6,
    description: 'Weekly review sessions on requirements, UML and design patterns. Bring your sprint tasks and questions.',
    status: 'open', members: ['u-ahmed', 'u-noor', 'u-fatima', 'u-yousef'],
  },
  {
    id: 'grp-math154', courseCode: 'MATH 154', name: 'Group A', tutorId: 'u-maryam',
    schedule: { days: ['Mon', 'Wed'], start: '13:00', end: '14:30' }, location: 'Building 2, Room 110', capacity: 6,
    description: 'Integration techniques, series and practice problems before each quiz.',
    status: 'open', members: ['u-noor', 'u-hamad', 'u-yousef', 'u-omar', 'u-layan'],
  },
  {
    id: 'grp-dsai310', courseCode: 'DSAI 310', name: 'Group A', tutorId: 'u-maryam',
    schedule: { days: ['Thu'], start: '13:00', end: '14:30' }, location: 'Building 2, Room 110', capacity: 6,
    description: 'Python, pandas and data visualisation practice with real datasets.',
    status: 'open', members: ['u-sara', 'u-mahdi', 'u-layan'],
  },
  {
    id: 'grp-phys101', courseCode: 'PHYS 101', name: 'Group A', tutorId: 'u-bassem',
    schedule: { days: ['Sun', 'Tue'], start: '13:00', end: '14:30' }, location: 'Library, Room 105', capacity: 6,
    description: 'Mechanics problem-solving sessions. We go through the weekly problem sets together.',
    status: 'open', members: ['u-noor', 'u-hamad', 'u-yousef', 'u-fatima', 'u-sara', 'u-omar'],
  },
  {
    id: 'grp-math260', courseCode: 'MATH 260', name: 'Group A', tutorId: 'u-fatema',
    schedule: { days: ['Wed'], start: '16:00', end: '17:30' }, location: 'Online (Microsoft Teams)', capacity: 6,
    description: 'Probability distributions and hypothesis testing with worked examples.',
    status: 'open', members: ['u-reem', 'u-zainab'],
  },
  {
    id: 'grp-cosc102', courseCode: 'COSC 102', name: 'Group A', tutorId: 'u-maryam',
    schedule: { days: ['Thu'], start: '11:00', end: '12:30' }, location: 'Library, Room 301', capacity: 8,
    description: 'Classes, interfaces and inheritance in Java. Bring your lab code.',
    status: 'open', members: ['u-helena', 'u-hamad', 'u-noor', 'u-fatima', 'u-ali'],
  },
];

function buildApplications() {
  return [
    {
      id: 'app-helena', userId: 'u-helena', fullName: 'Helena Azuela', email: 'f2400229@aubh.edu.bh',
      major: 'Data Science and AI', year: 'Junior', courses: ['SWEN 360', 'MATH 260'],
      experience: 'I have helped classmates with probability and software design projects. I like explaining concepts with worked examples.',
      days: ['Sun', 'Tue', 'Thu'], method: 'both', status: 'pending', submittedAt: daysAgo(4),
    },
    {
      id: 'app-reem', userId: 'u-reem', fullName: 'Reem Al-Saleh', email: 'f2409106@aubh.edu.bh',
      major: 'Mathematics', year: 'Junior', courses: ['MATH 154', 'MATH 260'],
      experience: 'Volunteer maths tutor at my high school for two years.',
      days: ['Mon', 'Wed'], method: 'in-person', status: 'pending', submittedAt: daysAgo(5),
    },
    {
      id: 'app-zainab', userId: 'u-zainab', fullName: 'Zainab Ahmed', email: 'f2409107@aubh.edu.bh',
      major: 'Computer Engineering', year: 'Junior', courses: ['CMPE 270', 'COSC 125'],
      experience: 'Got an A in CMPE 270 and helped my lab partners prepare for the final.',
      days: ['Sun', 'Thu'], method: 'both', status: 'pending', submittedAt: daysAgo(6),
    },
    {
      id: 'app-ali', userId: 'u-ali', fullName: 'Ali Yusuf', email: 'f2409108@aubh.edu.bh',
      major: 'Cybersecurity', year: 'Sophomore', courses: ['CYBR 310', 'COSC 102'],
      experience: 'Member of the AUBH cybersecurity club; ran two workshops on networking basics.',
      days: ['Tue'], method: 'online', status: 'pending', submittedAt: daysAgo(7),
    },
    {
      id: 'app-mahdi', userId: 'u-mahdi', fullName: 'Mahdi Nasser', email: 'f2409109@aubh.edu.bh',
      major: 'Computer Science', year: 'Senior', courses: ['COSC 102', 'COSC 125'],
      experience: 'Teaching assistant for an intro programming bootcamp last summer.',
      days: ['Mon', 'Wed', 'Thu'], method: 'in-person', status: 'pending', submittedAt: daysAgo(8),
    },
    ...['u-maryam', 'u-elias', 'u-bassem', 'u-fatema', 'u-khalid', 'u-dana'].map((userId, i) => {
      const person = PEOPLE.find((p) => p[0] === userId);
      const profile = TUTOR_PROFILES.find((p) => p.userId === userId);
      return {
        id: `app-${userId.slice(2)}`, userId, fullName: person[1], email: `${person[2].toLowerCase()}@aubh.edu.bh`,
        major: person[3], year: person[4], courses: profile.courses, experience: profile.experience,
        days: Object.keys(profile.availability).filter((d) => profile.availability[d].length), method: profile.method,
        status: 'approved', submittedAt: daysAgo(60 + i), decidedAt: daysAgo(55 + i), decidedBy: 'u-admin',
        decisionNote: 'Welcome to the tutor team!',
      };
    }),
    {
      id: 'app-omar', userId: 'u-omar', fullName: 'Omar Haddad', email: 'f2409111@aubh.edu.bh',
      major: 'Computer Engineering', year: 'Sophomore', courses: ['PHYS 101'],
      experience: 'Interested in tutoring.', days: ['Sun'], method: 'online',
      status: 'rejected', submittedAt: daysAgo(20), decidedAt: daysAgo(18), decidedBy: 'u-admin',
      decisionNote: 'Please re-apply after completing PHYS 101 with a strong grade.',
    },
  ];
}

function buildRequests() {
  return [
    { id: 'req-1', studentId: 'u-helena', tutorId: 'u-maryam', courseCode: 'MATH 154', preferredTime: nextWeekday('Mon', 14), type: 'In person', note: 'Need help with integration by parts.', status: 'pending', createdAt: daysAgo(1) },
    { id: 'req-2', studentId: 'u-noor', tutorId: 'u-maryam', courseCode: 'COSC 102', preferredTime: nextWeekday('Thu', 10), type: 'In person', note: 'Questions on interfaces and abstract classes.', status: 'pending', createdAt: daysAgo(1) },
    { id: 'req-3', studentId: 'u-layan', tutorId: 'u-maryam', courseCode: 'DSAI 310', preferredTime: nextWeekday('Thu', 14), type: 'Online', note: 'Intro to pandas before the quiz.', status: 'pending', createdAt: daysAgo(2) },
    { id: 'req-4', studentId: 'u-yousef', tutorId: 'u-maryam', courseCode: 'MATH 154', preferredTime: nextWeekday('Wed', 14), type: 'In person', note: 'Practice problems for the midterm.', status: 'pending', createdAt: daysAgo(2) },
    { id: 'req-5', studentId: 'u-fatima', tutorId: 'u-maryam', courseCode: 'COSC 102', preferredTime: nextWeekday('Sun', 14), type: 'In person', note: 'Review of inheritance.', status: 'accepted', createdAt: daysAgo(5), respondedAt: daysAgo(4) },
    { id: 'req-6', studentId: 'u-sara', tutorId: 'u-maryam', courseCode: 'DSAI 310', preferredTime: nextWeekday('Thu', 14, 0, new Date(), 1), type: 'In person', note: 'Help with my project dataset.', status: 'accepted', createdAt: daysAgo(6), respondedAt: daysAgo(5) },
    { id: 'req-7', studentId: 'u-omar', tutorId: 'u-maryam', courseCode: 'MATH 154', preferredTime: nextWeekday('Sun', 14), type: 'Online', note: 'Series convergence tests.', status: 'declined', createdAt: daysAgo(7), respondedAt: daysAgo(6) },
    { id: 'req-8', studentId: 'u-ahmed', tutorId: 'u-maryam', courseCode: 'COSC 102', preferredTime: nextWeekday('Mon', 14), type: 'In person', note: 'Exception handling.', status: 'declined', createdAt: daysAgo(8), respondedAt: daysAgo(7) },
    { id: 'req-9', studentId: 'u-helena', tutorId: 'u-elias', courseCode: 'SWEN 360', preferredTime: nextWeekday('Thu', 14), type: 'In person', note: 'Feedback on our sequence diagram.', status: 'accepted', createdAt: daysAgo(3), respondedAt: daysAgo(2) },
  ];
}

function buildTickets() {
  return [
    { id: 'tkt-1042', number: 1042, subject: "Can't see group meeting time", category: 'Groups', description: 'I joined the MATH 154 group yesterday, but the schedule section on the group page is empty. Could you check it?', submittedBy: 'u-noor', status: 'open', createdAt: daysAgo(5), updatedAt: daysAgo(5), adminNote: '' },
    { id: 'tkt-1041', number: 1041, subject: "Can't join a full group", category: 'Groups', description: 'The PHYS 101 group is full. Will another group be opened this semester?', submittedBy: 'u-omar', status: 'open', createdAt: daysAgo(5), updatedAt: daysAgo(5), adminNote: '' },
    { id: 'tkt-1031', number: 1031, subject: 'Request to switch groups', category: 'Groups', description: 'I would like to move from the Thursday COSC 102 group to a different time because of a lab clash.', submittedBy: 'u-helena', status: 'in-progress', createdAt: daysAgo(9), updatedAt: daysAgo(7), adminNote: "We're checking with the tutor whether another time is possible." },
    { id: 'tkt-1030', number: 1030, subject: 'Tutor request not showing', category: 'Requests', description: 'I sent a request to a tutor but I cannot see it in my list.', submittedBy: 'u-yousef', status: 'in-progress', createdAt: daysAgo(10), updatedAt: daysAgo(9), adminNote: 'Investigating.' },
    { id: 'tkt-1024', number: 1024, subject: 'Login issue on mobile', category: 'Account', description: 'The login button was hidden on my phone screen.', submittedBy: 'u-helena', status: 'resolved', createdAt: daysAgo(20), updatedAt: daysAgo(18), adminNote: 'Fixed in the latest update. Thanks for reporting!' },
    { id: 'tkt-1020', number: 1020, subject: 'Wrong major on profile', category: 'Account', description: 'My major shows as Mathematics but I am in Computer Science.', submittedBy: 'u-fatima', status: 'resolved', createdAt: daysAgo(25), updatedAt: daysAgo(24), adminNote: 'Updated your profile.' },
  ];
}

function buildMessages() {
  const t = (n, h, m) => { const d = new Date(daysAgo(n, h)); d.setMinutes(m); return d.toISOString(); };
  return [
    { id: 'msg-1', groupId: 'grp-swen360', senderId: 'u-elias', text: 'Hi everyone! On Tuesday we will review the Sprint 2 UML diagrams. Please bring your diagram drafts.', sentAt: t(1, 15, 2) },
    { id: 'msg-2', groupId: 'grp-swen360', senderId: 'u-noor', text: 'Can we also look at the sequence diagram for joining a group?', sentAt: t(1, 15, 10) },
    { id: 'msg-3', groupId: 'grp-swen360', senderId: 'u-elias', text: "Yes, we'll cover that first.", sentAt: t(1, 15, 12) },
    { id: 'msg-4', groupId: 'grp-swen360', senderId: 'u-fatima', text: 'Same here.', sentAt: t(1, 15, 40) },
    { id: 'msg-5', groupId: 'grp-cosc102', senderId: 'u-maryam', text: 'Reminder: Thursday we cover interfaces. Please finish Lab 6 before the session.', sentAt: t(2, 11, 5) },
    { id: 'msg-6', groupId: 'grp-cosc102', senderId: 'u-helena', text: 'Will we also go through the abstract class example from the lecture?', sentAt: t(2, 11, 20) },
    { id: 'msg-7', groupId: 'grp-cosc102', senderId: 'u-maryam', text: 'Yes — bring your laptop so we can code it together.', sentAt: t(2, 11, 25) },
    { id: 'msg-8', groupId: 'grp-math154', senderId: 'u-maryam', text: 'Quiz 3 is next week. We will do integration by parts practice on Monday.', sentAt: t(3, 13, 0) },
    { id: 'msg-9', groupId: 'grp-dsai310', senderId: 'u-maryam', text: 'Please install Jupyter before Thursday.', sentAt: t(3, 14, 0) },
  ];
}

/**
 * Writes all demo data into the given storage adapter.
 * Called on first launch and from "Reset demo data".
 */
export async function seedDemoData(storage) {
  const users = [];
  for (const [id, name, studentId, major, year, roles, status] of PEOPLE) {
    const email = `${studentId.toLowerCase()}@aubh.edu.bh`;
    users.push({
      id, name, email, studentId, major, year, roles, status,
      passwordHash: await hashPassword(email, PASSWORDS[id] ?? 'Demo123!'),
      createdAt: daysAgo(90),
    });
  }
  users.push({
    id: 'u-admin', name: 'Layla Hassan', email: 'admin@aubh.edu.bh', studentId: 'STAFF-001',
    major: 'Student Success Office', year: 'Staff', roles: ['admin'], status: 'active',
    passwordHash: await hashPassword('admin@aubh.edu.bh', PASSWORDS['u-admin']), createdAt: daysAgo(120),
  });

  const memberships = [];
  GROUPS.forEach((g) => g.members.forEach((studentId, i) => {
    memberships.push({ id: `mem-${g.id}-${studentId}`, groupId: g.id, studentId, joinedAt: daysAgo(14 - i) });
  }));

  storage.write('courses', COURSES.map((c) => ({ id: c.code, ...c })));
  storage.write('users', users);
  storage.write('tutorProfiles', TUTOR_PROFILES.map((p) => ({ id: `tp-${p.userId.slice(2)}`, ...p })));
  storage.write('groups', GROUPS.map(({ members, ...g }) => ({ ...g, createdAt: daysAgo(30) })));
  storage.write('memberships', memberships);
  storage.write('tutorApplications', buildApplications());
  storage.write('tutoringRequests', buildRequests());
  storage.write('tickets', buildTickets());
  storage.write('messages', buildMessages());
  storage.write('surveys', [
    { id: 'srv-helena', studentId: 'u-helena', courseCode: 'SWEN 360', confidence: 'Medium', needs: ['Understanding concepts', 'Exam preparation'], submittedAt: daysAgo(5) },
  ]);
  storage.write('meta', { seedVersion: SEED_VERSION, seededAt: new Date().toISOString() });
}

/** Seeds only if this browser has no (or outdated) TutorCircle data. */
export async function seedIfEmpty(storage) {
  const meta = storage.read('meta', null);
  if (!meta || meta.seedVersion !== SEED_VERSION) {
    storage.clearAll?.();
    await seedDemoData(storage);
    return true;
  }
  return false;
}
