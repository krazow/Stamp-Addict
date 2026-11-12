// The collection's data: the same tables and columns as the phone app's
// SQLite database, kept as arrays of rows in memory and saved to the
// browser's IndexedDB after each change (see idb.js). Rows are never
// changed in place, only replaced, so a transaction can roll back by
// putting the old arrays back.

export const SCHEMA_VERSION = 2;

/** Tables in parent-before-child order, as the backup format lists them. */
export const TABLES = [
  'collections', 'stamp_sets', 'set_items', 'stamps', 'catalog_numbers',
  'photos', 'tags', 'stamp_tags', 'want_list',
];

const NOW = () => new Date().toISOString();

/** Columns of each table, and defaults for columns a row may leave out. */
export const COLUMNS = {
  collections: { id: null, name: null, description: null, created_at: NOW, updated_at: NOW },
  stamp_sets: { id: null, name: null, country: null, year: null, description: null, created_at: NOW },
  set_items: { id: null, set_id: null, position: null, label: null, face_value: null, catalog: null, catalog_number: null },
  stamps: {
    id: null, collection_id: null, set_item_id: null,
    country: null, year: null, issue_date: null, face_value: null, currency: null, colors: null,
    design_subject: null, stamp_type: null, designer: null, engraver: null, printer: null,
    perf_horizontal: null, perf_vertical: null, separation: null, watermark: null, paper_type: null,
    printing_method: null, gum: null, tagging: null, format: null, width_mm: null, height_mm: null,
    mint_status: null, centering: null, grade: null, cancellation: null, faults: null, has_certificate: null,
    error_variety: null, plate_number: null, overprint: null, shade: null,
    quantity: () => 1, purchase_price: null, purchase_currency: null, purchase_date: null, source: null,
    estimated_value: null, storage_location: null, for_trade: () => 0, notes: null,
    created_at: NOW, updated_at: NOW,
  },
  catalog_numbers: {
    id: null, stamp_id: null, catalog: null, catalog_label: null, number: null,
    catalog_value: null, value_currency: null, edition: null,
  },
  photos: {
    id: null, stamp_id: null, role: null, uri: null, width: null, height: null, caption: null,
    sort_order: () => 0, created_at: NOW,
  },
  tags: { id: null, name: null },
  stamp_tags: { stamp_id: null, tag_id: null },
  want_list: {
    id: null, set_item_id: null, description: null, country: null, year: null, catalog: null,
    catalog_number: null, wanted_condition: null, max_price: null, priority: () => 'medium', notes: null,
    acquired_stamp_id: null, acquired_at: null, created_at: NOW,
  },
};

/** Columns that must have a value (NOT NULL in the phone database). */
export const REQUIRED = {
  collections: ['id', 'name'], stamp_sets: ['id', 'name'], set_items: ['id', 'set_id', 'position', 'label'],
  stamps: ['id'], catalog_numbers: ['id', 'stamp_id', 'catalog', 'number'],
  photos: ['id', 'stamp_id', 'role', 'uri'], tags: ['id', 'name'], stamp_tags: ['stamp_id', 'tag_id'],
  want_list: ['id', 'description'],
};

/** A full row for a table: known columns only, defaults filled in. */
export function makeRow(table, values) {
  const row = {};
  for (const [col, def] of Object.entries(COLUMNS[table])) {
    const v = values[col];
    row[col] = v !== undefined && v !== null ? v : typeof def === 'function' ? def() : def;
  }
  return row;
}

let idGenerator = null;
export function setIdGenerator(fn) { idGenerator = fn; }
export function newId() {
  if (idGenerator) return idGenerator();
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
export const nowIso = NOW;

export class Store {
  /**
   * @param tables  initial rows per table (missing tables start empty)
   * @param meta    device settings, e.g. when the last backup was made
   * @param saver   called with { tables: {name: rows}, meta } after each change
   */
  constructor(tables = {}, meta = {}, saver = null) {
    this.t = {};
    for (const name of TABLES) this.t[name] = Array.isArray(tables[name]) ? tables[name] : [];
    this.meta = { ...meta };
    this.saver = saver;
    this.depth = 0;
    this.dirty = new Set();
    this.metaDirty = false;
    this.pending = Promise.resolve();
  }

  rows(table) { return this.t[table]; }

  find(table, pred) { return this.t[table].find(pred); }

  filter(table, pred) { return this.t[table].filter(pred); }

  insert(table, values) {
    const row = makeRow(table, values);
    this.t[table] = [...this.t[table], row];
    this.dirty.add(table);
    this.scheduleSave();
    return row;
  }

  /** Replaces matching rows with changed copies; returns how many changed. */
  update(table, pred, changes) {
    let n = 0;
    const next = this.t[table].map((r) => {
      if (!pred(r)) return r;
      n++;
      return { ...r, ...(typeof changes === 'function' ? changes(r) : changes) };
    });
    if (n) { this.t[table] = next; this.dirty.add(table); this.scheduleSave(); }
    return n;
  }

  remove(table, pred) {
    const before = this.t[table].length;
    this.t[table] = this.t[table].filter((r) => !pred(r));
    const n = before - this.t[table].length;
    if (n) { this.dirty.add(table); this.scheduleSave(); }
    return n;
  }

  getMeta(key) { return this.meta[key] ?? null; }

  setMeta(key, value) {
    if (value === null) delete this.meta[key];
    else this.meta[key] = value;
    this.metaDirty = true;
    this.scheduleSave();
  }

  /** Runs fn as one change: all of it is kept, or none of it if it throws. */
  transaction(fn) {
    const snapshot = this.depth === 0 ? { ...this.t } : null;
    const dirtyBefore = this.depth === 0 ? new Set(this.dirty) : null;
    this.depth++;
    try {
      const result = fn();
      this.depth--;
      if (this.depth === 0) this.scheduleSave();
      return result;
    } catch (e) {
      this.depth--;
      if (snapshot) { this.t = snapshot; this.dirty = dirtyBefore; }
      throw e;
    }
  }

  scheduleSave() {
    if (!this.saver || this.depth > 0) return;
    if (!this.dirty.size && !this.metaDirty) return;
    const tables = {};
    for (const name of this.dirty) tables[name] = this.t[name];
    const meta = this.metaDirty ? { ...this.meta } : null;
    this.dirty = new Set();
    this.metaDirty = false;
    this.pending = this.pending.then(() => this.saver({ tables, meta })).catch((e) => {
      console.error('Saving failed', e);
      this.onSaveError?.(e);
    });
  }

  /** Waits until every change so far is written to storage. */
  flush() { return this.pending; }
}
