/**
 * App shell: dark sidebar navigation + top search bar (Figma layout).
 * On small screens the sidebar becomes a slide-in menu.
 */
import { Events } from '../../core/EventBus.js';
import { esc, avatar, on, toast, errorMessage } from './dom.js';
import { icon } from './icons.js';

export const NAV = {
  student: [
    { path: '/student/home', label: 'Home', icon: 'home' },
    { path: '/student/groups', label: 'My Groups', icon: 'users' },
    { path: '/student/tutors', label: 'Find Tutors', icon: 'search' },
    { path: '/student/survey', label: 'Survey', icon: 'clipboard' },
    { path: '/student/tickets', label: 'Support Ticket', icon: 'message' },
    { path: '/student/profile', label: 'Profile', icon: 'user' },
  ],
  tutor: [
    { path: '/tutor/home', label: 'Home', icon: 'home' },
    { path: '/tutor/groups', label: 'My Groups', icon: 'users' },
    { path: '/tutor/requests', label: 'Requests', icon: 'clipboard', badge: 'requests' },
    { path: '/tutor/availability', label: 'Availability', icon: 'calendar' },
    { path: '/tutor/messages', label: 'Messages', icon: 'message' },
    { path: '/tutor/profile', label: 'Profile', icon: 'user' },
  ],
  admin: [
    { path: '/admin/dashboard', label: 'Dashboard', icon: 'grid' },
    { path: '/admin/approvals', label: 'Tutor Approvals', icon: 'userCheck', badge: 'approvals' },
    { path: '/admin/tickets', label: 'Support Tickets', icon: 'ticket', badge: 'tickets' },
    { path: '/admin/groups', label: 'Manage Groups', icon: 'users' },
    { path: '/admin/users', label: 'Users', icon: 'user' },
  ],
};

const SEARCH_PLACEHOLDER = {
  student: 'Search courses, tutors, groups...',
  tutor: 'Search your groups and requests...',
  admin: 'Search users, groups, tickets...',
};

function badgeCount(ctx, kind) {
  const { services, user } = ctx;
  try {
    if (kind === 'requests') return services.requests.countsForTutor(user.id).pending;
    if (kind === 'approvals') return services.tutors.listApplications('pending').length;
    if (kind === 'tickets') return services.tickets.counts(user).open;
  } catch { /* ignore */ }
  return 0;
}

function navHtml(ctx, active) {
  return NAV[ctx.role].map((item) => {
    const count = item.badge ? badgeCount(ctx, item.badge) : 0;
    const isActive = active === item.path;
    return `<a class="nav-link ${isActive ? 'active' : ''}" href="#${item.path}" ${isActive ? 'aria-current="page"' : ''}>
      ${icon(item.icon)}<span>${esc(item.label)}</span>
      ${item.badge ? `<span class="nav-badge" data-nav-badge="${item.badge}" ${count ? '' : 'hidden'}>${count}</span>` : ''}
    </a>`;
  }).join('');
}

/**
 * Renders the shell into ctx.root and returns the <main> element where the
 * page should place its content.
 */
export function renderShell(ctx, { active, content = '' }) {
  const { user, role } = ctx;
  const otherRole = role === 'student' && user.roles.includes('tutor') ? 'tutor'
    : role === 'tutor' ? 'student' : null;
  const profilePath = role === 'admin' ? null : `/${role}/profile`;

  ctx.root.innerHTML = `
    <div class="shell">
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <a class="brand" href="#/${role}/${role === 'admin' ? 'dashboard' : 'home'}">${icon('cap')}<span>TutorCircle</span></a>
        <nav class="nav">${navHtml(ctx, active)}</nav>
        <button type="button" class="nav-link logout" data-action="logout">${icon('logout')}<span>Log out</span></button>
      </aside>
      <div class="sidebar-backdrop" data-action="close-menu"></div>
      <div class="main-col">
        <header class="topbar">
          <button type="button" class="icon-btn menu-btn" data-action="open-menu" aria-label="Open menu" aria-controls="sidebar">${icon('menu')}</button>
          <form class="search" role="search" data-role="global-search">
            ${icon('search')}
            <label class="sr-only" for="global-search">Search</label>
            <input id="global-search" name="q" type="search" placeholder="${esc(SEARCH_PLACEHOLDER[role])}" value="${esc(ctx.query.q ?? '')}" autocomplete="off">
          </form>
          <div class="user-menu">
            <button type="button" class="avatar-btn" data-action="toggle-user-menu" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${icon('user')}</button>
            <div class="dropdown" role="menu" hidden>
              <div class="dropdown-head">${avatar(user.name, 'sm')}<div><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span><span class="role-tag">${esc(role)} view</span></div></div>
              ${profilePath ? `<a role="menuitem" href="#${profilePath}">${icon('user')} Profile</a>` : ''}
              ${otherRole ? `<button type="button" role="menuitem" data-action="switch-role" data-role="${otherRole}">${icon('refresh')} Switch to ${otherRole} view</button>` : ''}
              <button type="button" role="menuitem" data-action="logout">${icon('logout')} Log out</button>
            </div>
          </div>
        </header>
        <main class="content" id="main" tabindex="-1">${content}</main>
      </div>
    </div>`;

  const shell = ctx.root.querySelector('.shell');
  const sidebar = shell.querySelector('.sidebar');
  const dropdown = shell.querySelector('.dropdown');
  const avatarBtn = shell.querySelector('.avatar-btn');

  on(shell, 'click', '[data-action="open-menu"]', () => shell.classList.add('menu-open'));
  on(shell, 'click', '[data-action="close-menu"]', () => shell.classList.remove('menu-open'));
  on(sidebar, 'click', '.nav-link', () => shell.classList.remove('menu-open'));
  on(shell, 'click', '[data-action="toggle-user-menu"]', () => {
    const open = dropdown.hidden;
    dropdown.hidden = !open;
    avatarBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function closeDropdown(e) {
    if (!shell.isConnected) return document.removeEventListener('click', closeDropdown);
    if (!e.target.closest('.user-menu')) { dropdown.hidden = true; avatarBtn.setAttribute('aria-expanded', 'false'); }
  });
  on(shell, 'click', '[data-action="logout"]', () => {
    ctx.services.auth.logout();
    toast('You have been logged out.');
    ctx.navigate('/login');
  });
  on(shell, 'click', '[data-action="switch-role"]', (e, btn) => {
    try {
      ctx.services.auth.switchRole(btn.dataset.role);
      ctx.navigate(`/${btn.dataset.role}/home`);
      toast(`Switched to ${btn.dataset.role} view.`);
    } catch (err) { toast(errorMessage(err), 'error'); }
  });
  shell.querySelector('[data-role="global-search"]').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q').toString().trim();
    ctx.navigate(`/${role}/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  });

  // Observer: keep the sidebar counters in sync with saved data.
  const refreshBadges = () => {
    shell.querySelectorAll('[data-nav-badge]').forEach((el) => {
      const count = badgeCount(ctx, el.dataset.navBadge);
      el.textContent = String(count);
      el.hidden = !count;
    });
  };
  ctx.subscribe(Events.REQUESTS, refreshBadges);
  ctx.subscribe(Events.APPLICATIONS, refreshBadges);
  ctx.subscribe(Events.TICKETS, refreshBadges);

  return shell.querySelector('main');
}

/** Standard page header (title + subtitle + optional actions). */
export function pageHeader(title, subtitle = '', actions = '') {
  return `<div class="page-header"><div><h1>${esc(title)}</h1>${subtitle ? `<p class="muted">${esc(subtitle)}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
}

export function backLink(path, label) {
  return `<a class="back-link" href="#${path}">${icon('arrowLeft')} ${esc(label)}</a>`;
}
