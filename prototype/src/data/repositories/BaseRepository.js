/**
 * BaseRepository — Repository pattern.
 *
 * Each repository owns one collection (an array of records saved under one
 * storage key). Business services ask repositories for data and never know
 * HOW it is stored.
 */
import { AppError, ErrorCodes } from '../../core/errors.js';

export function generateId(prefix) {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}${rand}`;
}

export class BaseRepository {
  /**
   * @param {import('../storage.js').LocalStorageAdapter} storage
   * @param {string} collection storage key, e.g. "users"
   * @param {string} idPrefix prefix for generated ids
   */
  constructor(storage, collection, idPrefix) {
    this.storage = storage;
    this.collection = collection;
    this.idPrefix = idPrefix;
  }

  /** Always reads fresh data so changes from other tabs are seen. */
  findAll() {
    return this.storage.read(this.collection, []);
  }

  findById(id) {
    return this.findAll().find((item) => item.id === id) ?? null;
  }

  findWhere(predicate) {
    return this.findAll().filter(predicate);
  }

  saveAll(items) {
    this.storage.write(this.collection, items);
  }

  insert(entity) {
    const items = this.findAll();
    const record = { id: entity.id ?? generateId(this.idPrefix), ...entity };
    items.push(record);
    this.saveAll(items);
    return record;
  }

  update(id, patch) {
    const items = this.findAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new AppError(ErrorCodes.NOT_FOUND, `${this.collection} record not found.`);
    items[index] = { ...items[index], ...patch, id };
    this.saveAll(items);
    return items[index];
  }

  remove(id) {
    const items = this.findAll();
    this.saveAll(items.filter((item) => item.id !== id));
  }
}
