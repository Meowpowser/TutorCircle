/**
 * Login, Sign Up and Forgot Password screens (Figma section "Login").
 */
import { DEMO_ACCOUNTS } from '../../data/seed.js';
import { esc, on, readForm, showFieldErrors, alertBox, toast, errorMessage, confirmDialog } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { AppError, ErrorCodes } from '../../core/errors.js';

const ROLE_TABS = [
  { role: 'student', label: 'Student' },
  { role: 'tutor', label: 'Tutor' },
  { role: 'admin', label: 'Admin' },
];

function authLayout(cardHtml, { showDemo = false } = {}) {
  return `
    <div class="auth">
      <section class="auth-hero">
        <div class="auth-hero-inner">
          ${icon('cap', 'hero-icon')}
          <h1>TutorCircle</h1>
          <p>Peer tutoring and study groups for AUBH students</p>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-card">${cardHtml}</div>
        ${showDemo ? demoPanel() : ''}
      </section>
    </div>`;
}

function demoPanel() {
  return `
    <aside class="demo-panel" aria-label="Demo accounts">
      <div class="demo-head">${icon('info')}<strong>Demo accounts (fictional)</strong></div>
      <ul>
        ${DEMO_ACCOUNTS.map((a) => `
          <li>
            <div><span class="demo-role">${esc(a.role)}</span> ${esc(a.name)}<br><code>${esc(a.email)}</code> · <code>${esc(a.password)}</code></div>
            <button type="button" class="btn btn-outline btn-sm" data-action="fill-demo" data-role="${a.role}" data-email="${esc(a.email)}" data-password="${esc(a.password)}">Use</button>
          </li>`).join('')}
      </ul>
      <p class="demo-note">Prototype only: AUBH sign-in is simulated and data is stored in this browser.</p>
      <button type="button" class="link-btn" data-action="reset-demo">${icon('refresh')} Reset demo data</button>
    </aside>`;
}

export function loginPage(ctx) {
  let role = ['student', 'tutor', 'admin'].includes(ctx.query.role) ? ctx.query.role : 'student';
  const next = ctx.query.next ?? '';
  const info = next === '/student/apply'
    ? alertBox('To apply as a tutor, log in with your student account first. You will go straight to the application form.', 'info')
    : '';

  ctx.root.innerHTML = authLayout(`
    <div class="tabs tabs-auth" role="tablist" aria-label="Log in as">
      ${ROLE_TABS.map((t) => `<button type="button" role="tab" class="tab ${t.role === role ? 'active' : ''}" aria-selected="${t.role === role}" data-role="${t.role}">${t.label}</button>`).join('')}
    </div>
    <h2 class="auth-title">Log in to your account</h2>
    <p class="muted small">Use your AUBH email to continue.</p>
    <div data-slot="message">${info}</div>
    <form novalidate data-form="login">
      <div class="field" data-field="email">
        <label for="login-email">Email</label>
        <input id="login-email" name="email" type="email" autocomplete="username" placeholder="Enter your AUBH email" required>
      </div>
      <div class="field" data-field="password">
        <label for="login-password">Password</label>
        <div class="input-with-action">
          <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required>
          <button type="button" class="input-action" data-action="toggle-password" aria-label="Show password">Show</button>
        </div>
      </div>
      <div class="row-end"><a href="#/forgot-password" class="link small">Forgot password?</a></div>
      <button type="submit" class="btn btn-primary btn-block">Log in</button>
    </form>
    <p class="auth-foot">Don't have an account? <a class="link strong" href="#/signup">Sign up</a></p>
    <p class="auth-foot">Want to tutor? <a class="link strong" href="#/login?role=student&next=/student/apply">Apply to be a tutor</a></p>
  `, { showDemo: true });

  const root = ctx.root;
  const form = root.querySelector('[data-form="login"]');
  const message = root.querySelector('[data-slot="message"]');

  on(root, 'click', '[role="tab"]', (e, tab) => {
    role = tab.dataset.role;
    root.querySelectorAll('[role="tab"]').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    message.innerHTML = '';
  });

  on(root, 'click', '[data-action="toggle-password"]', (e, btn) => {
    const input = form.querySelector('[name="password"]');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  on(root, 'click', '[data-action="fill-demo"]', (e, btn) => {
    form.email.value = btn.dataset.email;
    form.password.value = btn.dataset.password;
    root.querySelector(`[role="tab"][data-role="${btn.dataset.role}"]`).click();
    form.querySelector('button[type="submit"]').focus();
  });

  on(root, 'click', '[data-action="reset-demo"]', async () => {
    const ok = await confirmDialog({
      title: 'Reset demo data?',
      message: 'All changes made in this browser (joined groups, tickets, messages, new accounts) will be replaced with the original demo data.',
      confirmText: 'Reset data',
      danger: true,
    });
    if (!ok) return;
    await ctx.services.demo.reset();
    toast('Demo data has been reset.');
    ctx.rerender();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.innerHTML = '';
    showFieldErrors(form, {});
    const data = readForm(form);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await ctx.services.auth.login({ ...data, role });
      toast('Welcome back!');
      const home = role === 'admin' ? '/admin/dashboard' : `/${role}/home`;
      ctx.navigate(next.startsWith(`/${role}/`) ? next : home);
    } catch (err) {
      submit.disabled = false;
      if (err instanceof AppError && err.code === ErrorCodes.VALIDATION) showFieldErrors(form, err.fields);
      else {
        message.innerHTML = alertBox(errorMessage(err));
        if (err.code === ErrorCodes.INVALID_CREDENTIALS) {
          ['email', 'password'].forEach((n) => form[n].setAttribute('aria-invalid', 'true'));
          root.querySelectorAll('[data-field="email"],[data-field="password"]').forEach((f) => f.classList.add('has-error'));
        }
      }
    }
  });
}

export function signupPage(ctx) {
  ctx.root.innerHTML = authLayout(`
    <h2 class="auth-title">Create your account</h2>
    <p class="muted small">Use your AUBH email to join TutorCircle.</p>
    <div data-slot="message"></div>
    <form novalidate data-form="signup">
      <div class="field" data-field="name">
        <label for="su-name">Full name</label>
        <input id="su-name" name="name" autocomplete="name" placeholder="Enter your full name" required>
      </div>
      <div class="field" data-field="email">
        <label for="su-email">AUBH email</label>
        <input id="su-email" name="email" type="email" autocomplete="email" placeholder="Enter your AUBH email" required>
      </div>
      <div class="field" data-field="password">
        <label for="su-password">Password</label>
        <div class="input-with-action">
          <input id="su-password" name="password" type="password" autocomplete="new-password" placeholder="Create a password" required>
          <button type="button" class="input-action" data-action="toggle-password" aria-label="Show password">Show</button>
        </div>
        <p class="hint">At least 8 characters, with letters and a number.</p>
      </div>
      <div class="field" data-field="confirmPassword">
        <label for="su-confirm">Confirm password</label>
        <input id="su-confirm" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Re-enter your password" required>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Create account</button>
    </form>
    <p class="auth-foot">Already have an account? <a class="link strong" href="#/login">Log in</a></p>
  `);

  const form = ctx.root.querySelector('form');
  const message = ctx.root.querySelector('[data-slot="message"]');
  on(ctx.root, 'click', '[data-action="toggle-password"]', (e, btn) => {
    const input = form.password;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.innerHTML = '';
    try {
      await ctx.services.auth.signUp(readForm(form));
      toast('Account created. Welcome to TutorCircle!');
      ctx.navigate('/student/survey');
    } catch (err) {
      if (err.fields) showFieldErrors(form, err.fields);
      else message.innerHTML = alertBox(errorMessage(err));
    }
  });
}

export function forgotPasswordPage(ctx) {
  const render = (sentTo = '') => {
    ctx.root.innerHTML = authLayout(sentTo ? `
      <div class="success-icon">${icon('check')}</div>
      <h2 class="auth-title">Check your email</h2>
      <p class="muted">If an account exists for <strong>${esc(sentTo)}</strong>, we've sent a link to reset your password.</p>
      ${alertBox('Prototype: no email is actually sent. Use the demo accounts on the login page.', 'info')}
      <a class="btn btn-primary btn-block" href="#/login">Back to log in</a>
    ` : `
      <h2 class="auth-title">Forgot your password?</h2>
      <p class="muted small">Enter your AUBH email and we'll send you a reset link.</p>
      <form novalidate data-form="forgot">
        <div class="field" data-field="email">
          <label for="fp-email">AUBH email</label>
          <input id="fp-email" name="email" type="email" autocomplete="email" placeholder="Enter your AUBH email" required>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Send reset link</button>
      </form>
      <p class="auth-foot"><a class="link strong" href="#/login">Back to log in</a></p>
    `);
    const form = ctx.root.querySelector('form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const { sentTo: to } = ctx.services.auth.requestPasswordReset(form.email.value);
        render(to);
      } catch (err) {
        showFieldErrors(form, err.fields ?? { email: errorMessage(err) });
      }
    });
  };
  render();
}
