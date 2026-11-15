/**
 * Test helpers: a fresh, fully seeded TutorCircle backed by in-memory storage.
 */
import { MemoryStorageAdapter } from '../src/data/storage.js';
import { seedDemoData } from '../src/data/seed.js';
import { createServices } from '../src/business/index.js';

class MemorySession {
  constructor() { this.value = null; }
  get() { return this.value; }
  set(v) { this.value = v; }
  clear() { this.value = null; }
}

export async function setup() {
  const storage = new MemoryStorageAdapter();
  await seedDemoData(storage);
  const services = createServices(storage, new MemorySession());
  const user = (id) => services.repos.users.findById(id);
  return { storage, services, user };
}
