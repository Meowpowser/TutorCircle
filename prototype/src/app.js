/**
 * TutorCircle — application entry point.
 *
 * Layered architecture:
 *   Presentation Layer   src/presentation/  (pages, layout, router)
 *   Business Logic Layer src/business/      (services, rules, permissions, validation)
 *   Data Layer           src/data/          (repositories + storage adapter + seed data)
 * Shared helpers          src/core/          (Observer EventBus, errors, time)
 */
import { EventBus, Events } from './core/EventBus.js';
import { LocalStorageAdapter, SessionStore } from './data/storage.js';
import { seedIfEmpty, seedDemoData } from './data/seed.js';
import { createServices } from './business/index.js';
import { Router } from './presentation/router.js';
import { loginPage, signupPage, forgotPasswordPage } from './presentation/pages/auth.js';
import {
  studentHomePage, studentGroupsPage, studentChatPage, findTutorsPage, tutorProfileForStudentPage,
  surveyPage, surveyDonePage, studentTicketsPage, studentProfilePage, applyTutorPage,
} from './presentation/pages/student.js';
import {
  tutorHomePage, tutorRequestsPage, availabilityPage, tutorGroupsPage, tutorMessagesPage, tutorProfilePage,
} from './presentation/pages/tutor.js';
import {
  adminDashboardPage, approvalsPage, approvalDetailPage, adminTicketsPage, adminTicketDetailPage,
  adminGroupsPage, adminGroupDetailPage, adminChatPage, adminUsersPage, adminUserDetailPage,
} from './presentation/pages/admin.js';
import { searchPage } from './presentation/pages/search.js';

/** Which storage key belongs to which Observer event (for changes made in other tabs). */
const KEY_EVENTS = {
  users: Events.USERS,
  tutorProfiles: Events.USERS,
  groups: Events.GROUPS,
  memberships: Events.GROUPS,
  tutorApplications: Events.APPLICATIONS,
  tutoringRequests: Events.REQUESTS,
  tickets: Events.TICKETS,
  messages: Events.MESSAGES,
  surveys: Events.SURVEYS,
};

const ROUTES = [
  { path: '/login', page: loginPage, public: true, redirectIfLoggedIn: true, title: 'Log in' },
  { path: '/signup', page: signupPage, public: true, redirectIfLoggedIn: true, title: 'Sign up' },
  { path: '/forgot-password', page: forgotPasswordPage, public: true, title: 'Forgot password' },

  { path: '/student/home', page: studentHomePage, role: 'student', title: 'Home' },
  { path: '/student/groups', page: studentGroupsPage, role: 'student', title: 'My Groups' },
  { path: '/student/chat', page: studentChatPage, role: 'student', title: 'Group Chat' },
  { path: '/student/chat/:groupId', page: studentChatPage, role: 'student', title: 'Group Chat' },
  { path: '/student/tutors', page: findTutorsPage, role: 'student', title: 'Find Tutors' },
  { path: '/student/tutors/:tutorId', page: tutorProfileForStudentPage, role: 'student', title: 'Tutor Profile' },
  { path: '/student/survey', page: surveyPage, role: 'student', title: 'Needs Survey' },
  { path: '/student/survey/done', page: surveyDonePage, role: 'student', title: 'Survey Submitted' },
  { path: '/student/tickets', page: studentTicketsPage, role: 'student', title: 'Support Ticket' },
  { path: '/student/profile', page: studentProfilePage, role: 'student', title: 'Profile' },
  { path: '/student/apply', page: applyTutorPage, role: 'student', title: 'Apply to be a Tutor' },
  { path: '/student/search', page: searchPage, role: 'student', title: 'Search' },

  { path: '/tutor/home', page: tutorHomePage, role: 'tutor', title: 'Tutor Home' },
  { path: '/tutor/requests', page: tutorRequestsPage, role: 'tutor', title: 'Tutoring Requests' },
  { path: '/tutor/availability', page: availabilityPage, role: 'tutor', title: 'Availability' },
  { path: '/tutor/groups', page: tutorGroupsPage, role: 'tutor', title: 'My Groups' },
  { path: '/tutor/messages', page: tutorMessagesPage, role: 'tutor', title: 'Messages' },
  { path: '/tutor/messages/:groupId', page: tutorMessagesPage, role: 'tutor', title: 'Messages' },
  { path: '/tutor/profile', page: tutorProfilePage, role: 'tutor', title: 'Profile' },
  { path: '/tutor/search', page: searchPage, role: 'tutor', title: 'Search' },

  { path: '/admin/dashboard', page: adminDashboardPage, role: 'admin', title: 'Dashboard' },
  { path: '/admin/approvals', page: approvalsPage, role: 'admin', title: 'Tutor Approvals' },
  { path: '/admin/approvals/:id', page: approvalDetailPage, role: 'admin', title: 'Tutor Application' },
  { path: '/admin/tickets', page: adminTicketsPage, role: 'admin', title: 'Support Tickets' },
  { path: '/admin/tickets/:id', page: adminTicketDetailPage, role: 'admin', title: 'Ticket' },
  { path: '/admin/groups', page: adminGroupsPage, role: 'admin', title: 'Manage Groups' },
  { path: '/admin/groups/:id', page: adminGroupDetailPage, role: 'admin', title: 'Group Details' },
  { path: '/admin/chat/:groupId', page: adminChatPage, role: 'admin', title: 'Group Chat' },
  { path: '/admin/users', page: adminUsersPage, role: 'admin', title: 'Users' },
  { path: '/admin/users/:id', page: adminUserDetailPage, role: 'admin', title: 'User Details' },
  { path: '/admin/search', page: searchPage, role: 'admin', title: 'Search' },
];

async function main() {
  const root = document.getElementById('app');
  const storage = new LocalStorageAdapter();
  const bus = new EventBus();
  const services = createServices(storage, new SessionStore(), bus);

  try {
    await seedIfEmpty(storage);
  } catch (err) {
    root.innerHTML = `<div class="fatal"><h1>TutorCircle could not start</h1><p>This browser blocked local storage or secure hashing. Open the app from <code>http://localhost</code> (see README) and allow site data.</p></div>`;
    console.error(err);
    return;
  }

  services.demo = {
    async reset() {
      storage.clearAll();
      await seedDemoData(storage);
      services.auth.logout();
    },
  };

  // Observer bridge: data changed in ANOTHER tab → publish the matching event here.
  storage.onExternalChange((key) => {
    const event = KEY_EVENTS[key];
    if (event) bus.publish(event, { external: true, key });
  });

  const router = new Router({ root, services, routes: ROUTES });
  // If the session becomes invalid (e.g. account deactivated in another tab), go to login.
  bus.subscribe(Events.USERS, () => {
    if (location.hash !== '#/login' && !services.auth.currentUser() && !location.hash.startsWith('#/signup') && !location.hash.startsWith('#/forgot')) {
      router.navigate('/login');
    }
  });
  router.start();
}

main();
