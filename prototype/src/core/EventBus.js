/**
 * EventBus — Observer pattern.
 *
 * Services in the Business Logic Layer publish an event AFTER a change has
 * been saved successfully. Interface components in the Presentation Layer
 * subscribe to the events they care about and refresh themselves.
 *
 * Example (US-08): when a tutor accepts a request, RequestService saves the new
 * status and publishes Events.REQUESTS. Both the request list and the status
 * panel (tab counts) are subscribed, so both show the same saved status.
 * If the save fails, nothing is published, so both keep the previous status.
 */
export const Events = Object.freeze({
  USERS: 'users:changed',
  GROUPS: 'groups:changed',
  APPLICATIONS: 'applications:changed',
  REQUESTS: 'requests:changed',
  TICKETS: 'tickets:changed',
  MESSAGES: 'messages:changed',
  SURVEYS: 'surveys:changed',
  SESSION: 'session:changed',
  /** Data was changed in another browser tab (via the `storage` event). */
  EXTERNAL: 'data:external-change',
});

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * Register a listener. Returns a function that removes it again.
   * @param {string} event
   * @param {(payload: any) => void} listener
   */
  subscribe(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  /** Notify every listener of `event`. One failing listener never blocks the others. */
  publish(event, payload) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[EventBus] listener for "${event}" failed`, err);
      }
    }
  }

  /** Number of listeners for an event (used in tests). */
  count(event) {
    return this.listeners.get(event)?.size ?? 0;
  }
}
