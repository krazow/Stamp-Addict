// Stamp Cards, sets and the want list: the same rules as the phone app's
// data layer, working on the rows in store.js.
import { CATALOGS, CATALOG_SHORT, MINT_STATUSES, PRIORITIES } from './lists.js';
import { newId, nowIso } from './store.js';
import { NotFoundError, ValidationError, validateStampInput } from './validation.js';

/** App field name -> table column. Booleans are stored as 0/1. */
const COLUMN = {
  collectionId: 'collection_id', setItemId: 'set_item_id', issuerId: 'issuer_id',
  country: 'country', year: 'year', issueDate: 'issue_date', faceValue: 'face_value',
  currency: 'currency', colors: 'colors', designSubject: 'design_subject', stampType: 'stamp_type',
  designer: 'designer', engraver: 'engraver', printer: 'printer',
  perfHorizontal: 'perf_horizontal', perfVertical: 'perf_vertical', separation: 'separation',
  watermark: 'watermark', paperType: 'paper_type', printingMethod: 'printing_method', gum: 'gum',
  tagging: 'tagging', format: 'format', widthMm: 'width_mm', heightMm: 'height_mm',
  mintStatus: 'mint_status', centering: 'centering', grade: 'grade', cancellation: 'cancellation',
  faults: 'faults', hasCertificate: 'has_certificate',
  errorVariety: 'error_variety', plateNumber: 'plate_number', overprint: 'overprint', shade: 'shade',
  quantity: 'quantity', purchasePrice: 'purchase_price', purchaseCurrency: 'purchase_currency',
  purchaseDate: 'purchase_date', source: 'source', estimatedValue: 'estimated_value',
  storageLocation: 'storage_location', forTrade: 'for_trade', notes: 'notes',
};
export const STAMP_FIELDS = Object.keys(COLUMN);
const BOOLEAN_FIELDS = new Set(['hasCertificate', 'forTrade']);

function toCell(field, value) {
  if (value === undefined || value === null) return null;
  if (BOOLEAN_FIELDS.has(field)) return value ? 1 : 0;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t; // blank text means "not recorded"
  }
  return value;
}

function fromCell(field, value) {
  if (BOOLEAN_FIELDS.has(field)) return value === null || value === undefined ? null : value === 1;
  return value ?? null;
}

const sameText = (a, b) => a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();
const catalogOrder = (c) => CATALOGS.values.indexOf(c);
const roleOrder = (r) => (r === 'front' ? 0 : r === 'back' ? 1 : 2);

export class StampRepository {
  constructor(db) { this.db = db; }

  create(input = {}) {
    validateStampInput(input);
    const id = newId();
    const now = nowIso();
    this.db.transaction(() => {
      const values = { id, created_at: now, updated_at: now };
      for (const f of STAMP_FIELDS) if (input[f] !== undefined) values[COLUMN[f]] = toCell(f, input[f]);
      this.db.insert('stamps', values);
      if (input.catalogNumbers) this.replaceCatalogNumbers(id, input.catalogNumbers);
      if (input.photos) this.replacePhotos(id, input.photos);
      if (input.tags) this.replaceTags(id, input.tags);
    });
    return this.get(id);
  }

  get(id) {
    const row = this.db.find('stamps', (r) => r.id === id);
    if (!row) throw new NotFoundError('Stamp', id);
    const card = { id };
    for (const f of STAMP_FIELDS) card[f] = fromCell(f, row[COLUMN[f]]);
    card.createdAt = row.created_at;
    card.updatedAt = row.updated_at;
    card.catalogNumbers = this.db.filter('catalog_numbers', (c) => c.stamp_id === id)
      .sort((a, b) => catalogOrder(a.catalog) - catalogOrder(b.catalog) || String(a.number).localeCompare(String(b.number)))
      .map((c) => ({
        id: c.id, catalog: c.catalog, number: c.number, catalogLabel: c.catalog_label,
        catalogValue: c.catalog_value, valueCurrency: c.value_currency, edition: c.edition,
      }));
    card.photos = this.db.filter('photos', (p) => p.stamp_id === id)
      .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.sort_order - b.sort_order)
      .map((p) => ({ id: p.id, role: p.role, uri: p.uri, width: p.width, height: p.height, caption: p.caption, sortOrder: p.sort_order }));
    const tagIds = new Set(this.db.filter('stamp_tags', (st) => st.stamp_id === id).map((st) => st.tag_id));
    card.tags = this.db.filter('tags', (t) => tagIds.has(t.id)).map((t) => t.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return card;
  }

  /** Only fields that are given change; null clears a field; a given list replaces the current one. */
  update(id, patch) {
    validateStampInput(patch);
    this.db.transaction(() => {
      if (!this.db.find('stamps', (r) => r.id === id)) throw new NotFoundError('Stamp', id);
      const changes = { updated_at: nowIso() };
      for (const f of STAMP_FIELDS) if (patch[f] !== undefined) changes[COLUMN[f]] = toCell(f, patch[f]);
      if (changes.quantity === null) changes.quantity = 1;
      if (changes.for_trade === null) changes.for_trade = 0;
      this.db.update('stamps', (r) => r.id === id, changes);
      if (patch.catalogNumbers) this.replaceCatalogNumbers(id, patch.catalogNumbers);
      if (patch.photos) this.replacePhotos(id, patch.photos);
      if (patch.tags) this.replaceTags(id, patch.tags);
    });
    return this.get(id);
  }

  delete(id) {
    this.db.transaction(() => {
      if (!this.db.remove('stamps', (r) => r.id === id)) throw new NotFoundError('Stamp', id);
      this.db.remove('catalog_numbers', (r) => r.stamp_id === id);
      this.db.remove('photos', (r) => r.stamp_id === id);
      this.db.remove('stamp_tags', (r) => r.stamp_id === id);
      this.db.update('want_list', (w) => w.acquired_stamp_id === id, { acquired_stamp_id: null });
      this.dropUnusedTags();
    });
  }

  /** Rows for the collection grid / list, newest first. */
  list({ tag } = {}) {
    let rows = this.db.rows('stamps').map((r, i) => [r, i]);
    if (tag) {
      const t = this.db.find('tags', (x) => sameText(x.name, tag));
      const ids = new Set(t ? this.db.filter('stamp_tags', (st) => st.tag_id === t.id).map((st) => st.stamp_id) : []);
      rows = rows.filter(([r]) => ids.has(r.id));
    }
    rows.sort(([a, ai], [b, bi]) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : bi - ai));
    const fronts = new Map(this.db.filter('photos', (p) => p.role === 'front').map((p) => [p.stamp_id, p.uri]));
    const firstCat = new Map();
    const catsOf = new Map();
    for (const c of this.db.rows('catalog_numbers')) {
      if (!catsOf.has(c.stamp_id)) catsOf.set(c.stamp_id, []);
      catsOf.get(c.stamp_id).push(c);
      const cur = firstCat.get(c.stamp_id);
      if (!cur || (cur.catalog !== 'scott' && c.catalog === 'scott')) firstCat.set(c.stamp_id, c);
    }
    return rows.map(([r]) => {
      const c = firstCat.get(r.id);
      return {
        id: r.id, issuerId: r.issuer_id, country: r.country, year: r.year, faceValue: r.face_value, designSubject: r.design_subject,
        mintStatus: r.mint_status, thumbnailUri: fronts.get(r.id) ?? null,
        catalogs: (catsOf.get(r.id) ?? []).map((x) => x.catalog),
        catalogText: (catsOf.get(r.id) ?? []).map((x) => `${CATALOGS.labels[x.catalog] ?? x.catalog} ${x.number} ${CATALOG_SHORT[x.catalog] ?? ''} ${x.number}`).join(' '),
        primaryCatalog: c ? `${c.catalog === 'other' ? c.catalog_label || 'Other' : CATALOG_SHORT[c.catalog] ?? c.catalog} ${c.number}`.trim() : null,
      };
    });
  }

  /** Every tag name with how many stamps carry it. */
  allTags() {
    const counts = new Map();
    for (const st of this.db.rows('stamp_tags')) counts.set(st.tag_id, (counts.get(st.tag_id) ?? 0) + 1);
    return this.db.rows('tags').map((t) => ({ name: t.name, count: counts.get(t.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  replaceCatalogNumbers(stampId, list) {
    this.db.remove('catalog_numbers', (r) => r.stamp_id === stampId);
    const seen = new Set();
    for (const c of list) {
      const number = String(c.number).trim();
      const key = `${c.catalog}|${number}`;
      if (seen.has(key)) continue; // UNIQUE (stamp_id, catalog, number)
      seen.add(key);
      this.db.insert('catalog_numbers', {
        id: newId(), stamp_id: stampId, catalog: c.catalog, catalog_label: c.catalogLabel ?? null, number,
        catalog_value: c.catalogValue ?? null, value_currency: c.valueCurrency ?? null, edition: c.edition ?? null,
      });
    }
  }

  replacePhotos(stampId, list) {
    this.db.remove('photos', (r) => r.stamp_id === stampId);
    list.forEach((p, i) => this.db.insert('photos', {
      id: newId(), stamp_id: stampId, role: p.role, uri: p.uri, width: p.width ?? null,
      height: p.height ?? null, caption: p.caption ?? null, sort_order: i,
    }));
  }

  replaceTags(stampId, names) {
    this.db.remove('stamp_tags', (r) => r.stamp_id === stampId);
    const seen = new Set();
    for (const raw of names) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      let tag = this.db.find('tags', (t) => sameText(t.name, name));
      if (!tag) tag = this.db.insert('tags', { id: newId(), name });
      this.db.insert('stamp_tags', { stamp_id: stampId, tag_id: tag.id });
    }
    this.dropUnusedTags();
  }

  dropUnusedTags() {
    const used = new Set(this.db.rows('stamp_tags').map((st) => st.tag_id));
    this.db.remove('tags', (t) => !used.has(t.id));
  }
}

const toItem = (r) => ({
  id: r.id, position: r.position, label: r.label, faceValue: r.face_value,
  catalog: r.catalog, catalogNumber: r.catalog_number,
});

export class SetRepository {
  constructor(db) { this.db = db; }

  create(input) {
    if (!input.name?.trim()) throw new ValidationError('name', 'is required');
    if (!input.items?.length) throw new ValidationError('items', 'a set needs at least one stamp');
    input.items.forEach((it, i) => {
      if (!it.label?.trim()) throw new ValidationError(`items[${i}].label`, 'is required');
      if (it.catalog && !CATALOGS.values.includes(it.catalog)) {
        throw new ValidationError(`items[${i}].catalog`, `"${it.catalog}" is not a valid catalog`);
      }
    });
    const id = newId();
    this.db.transaction(() => {
      this.db.insert('stamp_sets', {
        id, name: input.name.trim(), country: input.country ?? null, year: input.year ?? null,
        description: input.description ?? null,
      });
      input.items.forEach((it, i) => this.db.insert('set_items', {
        id: newId(), set_id: id, position: i + 1, label: it.label.trim(), face_value: it.faceValue ?? null,
        catalog: it.catalog ?? null, catalog_number: it.catalogNumber?.trim() || null,
      }));
    });
    return this.get(id);
  }

  get(id) {
    const s = this.db.find('stamp_sets', (r) => r.id === id);
    if (!s) throw new NotFoundError('Set', id);
    const items = this.db.filter('set_items', (r) => r.set_id === id).sort((a, b) => a.position - b.position).map(toItem);
    return { id, name: s.name, country: s.country, year: s.year, description: s.description, items };
  }

  findItem(itemId) {
    const r = this.db.find('set_items', (x) => x.id === itemId);
    if (!r) return null;
    const s = this.db.find('stamp_sets', (x) => x.id === r.set_id);
    if (!s) return null;
    return { setId: s.id, setName: s.name, item: toItem(r), total: this.db.filter('set_items', (x) => x.set_id === s.id).length };
  }

  listWithItems() {
    return [...this.db.rows('stamp_sets')]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((s) => this.get(s.id));
  }

  delete(id) {
    this.db.transaction(() => {
      if (!this.db.remove('stamp_sets', (r) => r.id === id)) throw new NotFoundError('Set', id);
      const itemIds = new Set(this.db.filter('set_items', (r) => r.set_id === id).map((r) => r.id));
      this.db.remove('set_items', (r) => r.set_id === id);
      this.db.update('stamps', (r) => itemIds.has(r.set_item_id), { set_item_id: null });
      this.db.update('want_list', (r) => itemIds.has(r.set_item_id), { set_item_id: null });
    });
  }

  /** A slot is owned when a stamp is linked to it or carries its catalog number. */
  completion(setId) {
    const set = this.get(setId);
    const items = set.items.map((it) => {
      const ids = new Set(this.db.filter('stamps', (s) => s.set_item_id === it.id).map((s) => s.id));
      if (it.catalog && it.catalogNumber) {
        for (const c of this.db.rows('catalog_numbers')) {
          if (c.catalog === it.catalog && sameText(c.number, it.catalogNumber)) ids.add(c.stamp_id);
        }
      }
      return { ...it, owned: ids.size > 0, stampIds: [...ids] };
    });
    const owned = items.filter((i) => i.owned).length;
    return {
      setId, name: set.name, country: set.country ?? null, year: set.year ?? null,
      total: items.length, owned, percent: items.length ? Math.round((owned / items.length) * 100) : 0,
      items, missing: items.filter((i) => !i.owned),
    };
  }

  /** Every set with its progress, least complete first. */
  allCompletion() {
    return this.db.rows('stamp_sets').map((s) => this.completion(s.id))
      .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
  }

  completionByCountry() {
    const groups = new Map();
    for (const s of this.allCompletion()) {
      const key = s.country ?? 'Unknown';
      const g = groups.get(key) ?? { sets: 0, total: 0, owned: 0 };
      g.sets++; g.total += s.total; g.owned += s.owned;
      groups.set(key, g);
    }
    return [...groups.entries()]
      .map(([country, g]) => ({ country, ...g, percent: g.total ? Math.round((g.owned / g.total) * 100) : 0 }))
      .sort((a, b) => a.country.localeCompare(b.country));
  }
}

const toWant = (r) => ({
  id: r.id, description: r.description, country: r.country, year: r.year, catalog: r.catalog,
  catalogNumber: r.catalog_number, wantedCondition: r.wanted_condition, maxPrice: r.max_price,
  priority: r.priority, notes: r.notes, setItemId: r.set_item_id, acquiredStampId: r.acquired_stamp_id,
  acquiredAt: r.acquired_at, createdAt: r.created_at,
});

function validateWant(w) {
  if (!w.description?.trim()) throw new ValidationError('description', 'is required');
  if (w.catalog && !CATALOGS.values.includes(w.catalog)) throw new ValidationError('catalog', `"${w.catalog}" is not a valid catalog`);
  if (w.priority && !PRIORITIES.values.includes(w.priority)) throw new ValidationError('priority', `"${w.priority}" is not a valid priority`);
  if (w.wantedCondition && w.wantedCondition !== 'any' && !MINT_STATUSES.values.includes(w.wantedCondition)) {
    throw new ValidationError('wantedCondition', `"${w.wantedCondition}" is not a valid condition`);
  }
  if (w.maxPrice != null && (typeof w.maxPrice !== 'number' || Number.isNaN(w.maxPrice) || w.maxPrice < 0)) {
    throw new ValidationError('maxPrice', 'must be zero or more');
  }
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const byPriority = (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)
  || String(a.created_at).localeCompare(String(b.created_at));

export class WantListRepository {
  constructor(db) { this.db = db; }

  add(input) {
    validateWant(input);
    const row = this.db.insert('want_list', {
      id: newId(), set_item_id: input.setItemId ?? null, description: input.description.trim(),
      country: input.country ?? null, year: input.year ?? null, catalog: input.catalog ?? null,
      catalog_number: input.catalogNumber?.trim() || null, wanted_condition: input.wantedCondition ?? null,
      max_price: input.maxPrice ?? null, priority: input.priority ?? 'medium', notes: input.notes ?? null,
      created_at: nowIso(),
    });
    return toWant(row);
  }

  get(id) {
    const r = this.db.find('want_list', (x) => x.id === id);
    if (!r) throw new NotFoundError('Want', id);
    return toWant(r);
  }

  list({ includeAcquired = false } = {}) {
    return this.db.filter('want_list', (w) => includeAcquired || (!w.acquired_stamp_id && !w.acquired_at))
      .sort(byPriority).map(toWant);
  }

  remove(id) {
    if (!this.db.remove('want_list', (r) => r.id === id)) throw new NotFoundError('Want', id);
  }

  markAcquired(id, stampId = null) {
    this.get(id);
    this.db.update('want_list', (r) => r.id === id, { acquired_stamp_id: stampId, acquired_at: nowIso() });
    return this.get(id);
  }

  /** Adds every missing stamp of a set, skipping any already on the list. */
  addMissingFromSet(sets, setId, priority = 'medium') {
    const completion = sets.completion(setId);
    const added = [];
    this.db.transaction(() => {
      for (const item of completion.missing) {
        if (this.db.find('want_list', (w) => w.set_item_id === item.id && !w.acquired_at)) continue;
        added.push(this.add({
          description: `${completion.name}: ${item.label}`, country: completion.country, year: completion.year,
          catalog: item.catalog ?? null, catalogNumber: item.catalogNumber ?? null, setItemId: item.id, priority,
        }));
      }
    });
    return added;
  }

  /** Open wants a stamp fills: same set slot, or same catalog number. */
  matchesForStamp(stampId) {
    const stamp = this.db.find('stamps', (s) => s.id === stampId);
    if (!stamp) throw new NotFoundError('Stamp', stampId);
    const cats = this.db.filter('catalog_numbers', (c) => c.stamp_id === stampId);
    return this.db.filter('want_list', (w) => !w.acquired_at && (
      (w.set_item_id != null && w.set_item_id === stamp.set_item_id)
      || cats.some((c) => c.catalog === w.catalog && sameText(c.number, w.catalog_number))
    )).sort(byPriority).map(toWant);
  }
}

/** Catalog names people type, mapped to stored catalog keys. */
const CATALOG_ALIASES = {
  scott: 'scott', sc: 'scott',
  sg: 'stanley_gibbons', 'stanley gibbons': 'stanley_gibbons', gibbons: 'stanley_gibbons',
  michel: 'michel', mi: 'michel',
  yvert: 'yvert_tellier', 'yvert et tellier': 'yvert_tellier', yt: 'yvert_tellier',
  sakura: 'sakura', facit: 'facit', unitrade: 'unitrade', acsc: 'acsc', zumstein: 'zumstein', zum: 'zumstein',
  edifil: 'edifil', sassone: 'sassone', nvph: 'nvph', afa: 'afa', fischer: 'fischer', ank: 'ank',
  hellas: 'hellas', zagorski: 'zagorski', pofis: 'pofis', rhm: 'rhm', gj: 'gj', cob: 'cob',
};

/** Reads the "stamps in this set" box: one per line, like "1c Franklin | Scott 112". */
export function parseSetItems(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [label, cat] = line.split('|').map((x) => x.trim());
    const item = { label };
    const fv = label.match(/^(\S*\d\S*)\s/);
    if (fv) item.faceValue = fv[1];
    if (cat) {
      const m = cat.match(/^(.*?)\s*([A-Za-z]{0,3}\d[\w-]*)$/);
      const key = m ? CATALOG_ALIASES[m[1].trim().toLowerCase()] : undefined;
      if (m && key) { item.catalog = key; item.catalogNumber = m[2]; }
    }
    return item;
  });
}

export const META_LAST_BACKUP = 'last_backup_at';

export function openRepos(db) {
  return { db, stamps: new StampRepository(db), sets: new SetRepository(db), wants: new WantListRepository(db) };
}
