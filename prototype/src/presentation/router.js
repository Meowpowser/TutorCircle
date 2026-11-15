/**
 * Hash router (#/student/home). Also the presentation-side permission guard:
 * each route declares which role may open it. The business services check
 * permissions AGAIN, so hiding a button is never the only protection.
 */
import { toast } from './ui/dom.js';

function compile(pattern) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  return { regex, keys };
}

export class Router {
  /**
   * @param {{root: HTMLElement, services: object, routes: Array<{path:string, page:Function, role?:string, public?:boolean}>}} opts
   */
  constructor({ root, services, routes }) {
    this.root = root;
    this.services = services;
    this.routes = routes.map((r) => ({ ...r, ...compile(r.path) }));
    this.cleanups = [];
    this.renderId = 0;
  }

  start() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }

  navigate(path) {
    if (location.hash === `#${path}`) this.resolve();
    else location.hash = path;
  }

  homeFor(role) {
    return role === 'admin' ? '/admin/dashboard' : `/${role}/home`;
  }

  parse() {
    const raw = location.hash.replace(/^#/, '') || '/login';
    const [path, queryString = ''] = raw.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryString));
    return { path, query };
  }

  /** Removes observers registered by the previous page. */
  cleanup() {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  resolve({ keepScroll = false } = {}) {
    const { path, query } = this.parse();
    const user = this.services.auth.currentUser();
    const role = this.services.auth.activeRole();

    let match = null;
    let params = {};
    for (const route of this.routes) {
      const m = route.regex.exec(path);
      if (m) {
        match = route;
        params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        break;
      }
    }

    if (!match) return this.navigate(user ? this.homeFor(role) : '/login');
    if (match.public && user && match.redirectIfLoggedIn) return this.navigate(this.homeFor(role));
    if (!match.public) {
      if (!user) {
        if (path !== '/login') toast('Please log in to continue.', 'error');
        return this.navigate('/login');
      }
      if (match.role && match.role !== role) {
        toast("You don't have permission to open that page.", 'error');
        return this.navigate(this.homeFor(role));
      }
    }

    this.cleanup();
    if (!keepScroll) {
      document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
      document.body.classList.remove('no-scroll');
    }
    const scrollY = window.scrollY;
    const renderId = ++this.renderId;
    const ctx = {
      root: this.root,
      services: this.services,
      user,
      role,
      params,
      query,
      path,
      navigate: (p) => this.navigate(p),
      rerender: () => this.resolve({ keepScroll: true }),
      /** Observer subscription that is removed automatically when the page changes. */
      subscribe: (event, fn) => {
        const off = this.services.bus.subscribe(event, (payload) => { if (renderId === this.renderId) fn(payload); });
        this.cleanups.push(off);
        return off;
      },
      /**
       * Re-render the whole page when any of `events` fires — unless the user
       * is typing, so their unsaved input is never wiped.
       */
      liveRefresh: (events, { externalOnly = false } = {}) => {
        events.forEach((ev) => ctx.subscribe(ev, (payload) => {
          if (externalOnly && !payload?.external) return;
          // Deferred so the action that caused the change finishes first.
          setTimeout(() => {
            if (renderId !== this.renderId) return;
            const el = document.activeElement;
            const typing = el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && el.closest('form');
            if (!typing && !document.querySelector('.modal-overlay')) this.resolve({ keepScroll: true });
          }, 0);
        }));
      },
    };

    try {
      match.page(ctx);
      document.title = `TutorCircle${match.title ? ` · ${match.title}` : ''}`;
    } catch (err) {
      console.error(err);
      this.root.innerHTML = `<div class="fatal"><h1>Something went wrong</h1><p>${String(err.message ?? err).replace(/</g, '&lt;')}</p><a class="btn btn-primary" href="#/login">Back to start</a></div>`;
    }
    if (keepScroll) window.scrollTo(0, scrollY);
    else window.scrollTo(0, 0);
  }
}
