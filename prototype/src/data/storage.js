/**
 * Storage adapters — the lowest part of the Data Layer.
 *
 * Repositories only talk to an adapter, never to localStorage directly.
 * This means the storage technology can be replaced later (for example with a
 * real database behind an API) without rewriting any business rules.
 */
import { AppError, ErrorCodes } from '../core/errors.js';

const NAMESPACE = 'tutorcircle:';

/** Browser adapter: saves JSON in window.localStorage so data survives refreshes. */
export class LocalStorageAdapter {
  constructor(store = globalThis.localStorage, namespace = NAMESPACE) {
    this.store = store;
    this.namespace = namespace;
  }

  read(key, fallback = null) {
    try {
      const raw = this.store.getItem(this.namespace + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  write(key, value) {
    try {
      this.store.setItem(this.namespace + key, JSON.stringify(value));
    } catch (err) {
      // e.g. storage quota exceeded or storage blocked by the browser
      throw new AppError(ErrorCodes.SAVE_FAILED, 'Your change could not be saved in this browser.');
    }
  }

  remove(key) {
    this.store.removeItem(this.namespace + key);
  }

  clearAll() {
    const keys = [];
    for (let i = 0; i < this.store.length; i++) {
      const k = this.store.key(i);
      if (k && k.startsWith(this.namespace)) keys.push(k);
    }
    keys.forEach((k) => this.store.removeItem(k));
  }

  /**
   * Calls `callback(key)` when ANOTHER tab changes TutorCircle data.
   * This is how two open tabs (e.g. a student and a tutor) stay in sync.
   */
  onExternalChange(callback) {
    if (typeof window === 'undefined') return () => {};
    const handler = (e) => {
      if (e.key && e.key.startsWith(this.namespace)) callback(e.key.slice(this.namespace.length));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}

/** In-memory adapter used by the automated tests (no browser needed). */
export class MemoryStorageAdapter {
  constructor() {
    this.data = new Map();
    this.failWrites = false; // tests can simulate a failed save
  }

  read(key, fallback = null) {
    return this.data.has(key) ? structuredClone(this.data.get(key)) : fallback;
  }

  write(key, value) {
    if (this.failWrites) throw new AppError(ErrorCodes.SAVE_FAILED, 'Simulated save failure.');
    this.data.set(key, structuredClone(value));
  }

  remove(key) {
    this.data.delete(key);
  }

  clearAll() {
    this.data.clear();
  }

  onExternalChange() {
    return () => {};
  }
}

/** Session storage for "who is logged in" — kept per browser tab. */
export class SessionStore {
  constructor(store = globalThis.sessionStorage, key = NAMESPACE + 'session') {
    this.store = store;
    this.key = key;
    this.memory = null;
  }
  get() {
    try {
      const raw = this.store?.getItem(this.key);
      return raw ? JSON.parse(raw) : this.memory;
    } catch {
      return this.memory;
    }
  }
  set(value) {
    this.memory = value;
    try { this.store?.setItem(this.key, JSON.stringify(value)); } catch { /* memory fallback */ }
  }
  clear() {
    this.memory = null;
    try { this.store?.removeItem(this.key); } catch { /* ignore */ }
  }
}
