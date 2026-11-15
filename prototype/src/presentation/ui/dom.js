/**
 * Small DOM helpers for the Presentation Layer.
 * All dynamic text MUST go through esc() before it is placed in HTML.
 */
import { AppError } from '../../core/errors.js';
import { icon } from './icons.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for safe use inside HTML (prevents script injection). */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Join an array of HTML strings. */
export const join = (items, fn) => items.map(fn).join('');

export function initials(name) {
  return String(name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function avatar(name, size = '') {
  return `<span class="avatar ${size}" aria-hidden="true">${esc(initials(name))}</span>`;
}

/** Coloured pill. tone: success | warning | info | danger | neutral */
export function badge(text, tone = 'neutral') {
  return `<span class="badge badge-${tone}">${esc(text)}</span>`;
}

export function chip(text, extra = '') {
  return `<span class="chip ${extra}">${esc(text)}</span>`;
}

export function emptyState(title, text = '', actionHtml = '') {
  return `<div class="empty-state">${icon('search')}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${actionHtml}</div>`;
}

/**
 * Event delegation: run `handler(event, matchedElement)` for clicks (or other
 * events) on elements matching `selector` inside `root`.
 */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

/** Reads a <form> into a plain object. Checkbox groups become arrays. */
export function readForm(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.single === 'true') data[el.name] = el.checked;
      else {
        data[el.name] ??= [];
        if (el.checked) data[el.name].push(el.value);
      }
    } else if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
      else data[el.name] ??= '';
    } else {
      data[el.name] = el.value;
    }
  }
  return data;
}

/** Shows per-field validation messages under each input (aria-invalid for screen readers). */
export function showFieldErrors(form, fields = {}) {
  form.querySelectorAll('.field-error').forEach((el) => el.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
  for (const [name, message] of Object.entries(fields)) {
    const wrapper = form.querySelector(`[data-field="${name}"]`);
    const input = form.querySelector(`[name="${name}"]`);
    input?.setAttribute('aria-invalid', 'true');
    const host = wrapper ?? input?.parentElement;
    if (!host) continue;
    host.classList.add('has-error');
    const p = document.createElement('p');
    p.className = 'field-error';
    p.textContent = message;
    host.appendChild(p);
  }
  form.querySelector('[aria-invalid="true"]')?.focus();
}

/** Inline alert box HTML. tone: error | success | info | warning */
export function alertBox(message, tone = 'error') {
  const ic = { error: 'alert', success: 'check', info: 'info', warning: 'info' }[tone];
  return `<div class="alert alert-${tone}" role="${tone === 'error' ? 'alert' : 'status'}">${icon(ic)}<span>${esc(message)}</span></div>`;
}

// ---- toasts -----------------------------------------------------------------

export function toast(message, tone = 'success') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `${icon(tone === 'error' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
  host.appendChild(el);
  setTimeout(() => el.classList.add('leaving'), 3800);
  setTimeout(() => el.remove(), 4200);
}

/** Converts any error into a user-facing message. */
export function errorMessage(err) {
  if (err instanceof AppError) return err.message;
  console.error(err);
  return 'Something went wrong. Please try again.';
}

// ---- modal ------------------------------------------------------------------

/**
 * Opens a modal dialog. `render(body)` fills it and may call `close()`.
 * Returns { close, body }.
 */
export function openModal({ labelledBy = 'modal-title', wide = false, onClose } = {}) {
  const previouslyFocused = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}"></div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');
  const body = overlay.firstElementChild;

  function close() {
    overlay.remove();
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey);
    previouslyFocused?.focus?.();
    onClose?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  return { close, body, overlay };
}

/** Simple confirmation dialog. Resolves true/false. */
export function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const modal = openModal({ labelledBy: 'confirm-title', onClose: () => { if (!answered) resolve(false); } });
    modal.body.innerHTML = `
      <div class="modal-header"><h2 id="confirm-title">${esc(title)}</h2></div>
      <p class="muted">${esc(message)}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" data-answer="no">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-answer="yes">${esc(confirmText)}</button>
      </div>`;
    modal.body.querySelector('[data-answer="yes"]').focus();
    on(modal.body, 'click', '[data-answer]', (e, btn) => {
      answered = true;
      modal.close();
      resolve(btn.dataset.answer === 'yes');
    });
  });
}

/** <option> list helper. */
export function options(list, selected, { placeholder } = {}) {
  const head = placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '';
  return head + list.map((o) => {
    const value = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    return `<option value="${esc(value)}" ${String(value) === String(selected ?? '') ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}
