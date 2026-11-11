import { NotFoundError, ValidationError, newId, nowIso, type SqlDatabase, type SqlValue } from './db';
import type { SetRepository } from './sets';
import { CATALOGS, MINT_STATUSES, PRIORITIES, type Catalog, type MintStatus, type Priority } from './types';

export interface WantInput {
  description: string;
  country?: string | null;
  year?: number | null;
  catalog?: Catalog | null;
  catalogNumber?: string | null;
  wantedCondition?: MintStatus | 'any' | null;
  maxPrice?: number | null;
  priority?: Priority;
  notes?: string | null;
  setItemId?: string | null;
}

export interface Want extends WantInput {
  id: string;
  priority: Priority;
  acquiredStampId: string | null;
  acquiredAt: string | null;
  createdAt: string;
}

type Row = Record<string, SqlValue>;

function toWant(r: Row): Want {
  return {
    id: r.id as string,
    description: r.description as string,
    country: r.country as string | null,
    year: r.year as number | null,
    catalog: r.catalog as Catalog | null,
    catalogNumber: r.catalog_number as string | null,
    wantedCondition: r.wanted_condition as Want['wantedCondition'],
    maxPrice: r.max_price as number | null,
    priority: r.priority as Priority,
    notes: r.notes as string | null,
    setItemId: r.set_item_id as string | null,
    acquiredStampId: r.acquired_stamp_id as string | null,
    acquiredAt: r.acquired_at as string | null,
    createdAt: r.created_at as string,
  };
}

function validate(w: WantInput) {
  if (!w.description?.trim()) throw new ValidationError('description', 'is required');
  if (w.catalog && !CATALOGS.values.includes(w.catalog)) {
    throw new ValidationError('catalog', `"${w.catalog}" is not a valid catalog`);
  }
  if (w.priority && !PRIORITIES.values.includes(w.priority)) {
    throw new ValidationError('priority', `"${w.priority}" is not a valid priority`);
  }
  if (w.wantedCondition && w.wantedCondition !== 'any' && !MINT_STATUSES.values.includes(w.wantedCondition)) {
    throw new ValidationError('wantedCondition', `"${w.wantedCondition}" is not a valid condition`);
  }
  if (w.maxPrice != null && (typeof w.maxPrice !== 'number' || w.maxPrice < 0)) {
    throw new ValidationError('maxPrice', 'must be zero or more');
  }
}

const PRIORITY_ORDER = `CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`;

/** Task 12.1: the want list. */
export class WantListRepository {
  constructor(private readonly db: SqlDatabase) {}

  add(input: WantInput): Want {
    validate(input);
    const id = newId();
    this.db.run(
      `INSERT INTO want_list (id, set_item_id, description, country, year, catalog, catalog_number,
         wanted_condition, max_price, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.setItemId ?? null, input.description.trim(), input.country ?? null, input.year ?? null,
        input.catalog ?? null, input.catalogNumber?.trim() || null, input.wantedCondition ?? null,
        input.maxPrice ?? null, input.priority ?? 'medium', input.notes ?? null],
    );
    return this.get(id);
  }

  get(id: string): Want {
    const r = this.db.get<Row>('SELECT * FROM want_list WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('Want', id);
    return toWant(r);
  }

  /** Open wants by priority; pass includeAcquired to see checked-off ones too. */
  list(opts: { includeAcquired?: boolean; priority?: Priority } = {}): Want[] {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (!opts.includeAcquired) where.push('acquired_stamp_id IS NULL AND acquired_at IS NULL');
    if (opts.priority) {
      where.push('priority = ?');
      params.push(opts.priority);
    }
    return this.db
      .all<Row>(
        `SELECT * FROM want_list ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY ${PRIORITY_ORDER}, created_at, rowid`,
        params,
      )
      .map(toWant);
  }

  update(id: string, patch: Partial<WantInput>): Want {
    const current = this.get(id);
    const merged = { ...current, ...patch };
    validate(merged);
    this.db.run(
      `UPDATE want_list SET description = ?, country = ?, year = ?, catalog = ?, catalog_number = ?,
         wanted_condition = ?, max_price = ?, priority = ?, notes = ?, set_item_id = ? WHERE id = ?`,
      [merged.description.trim(), merged.country ?? null, merged.year ?? null, merged.catalog ?? null,
        merged.catalogNumber ?? null, merged.wantedCondition ?? null, merged.maxPrice ?? null,
        merged.priority, merged.notes ?? null, merged.setItemId ?? null, id],
    );
    return this.get(id);
  }

  remove(id: string): void {
    const { changes } = this.db.run('DELETE FROM want_list WHERE id = ?', [id]);
    if (changes === 0) throw new NotFoundError('Want', id);
  }

  /** Check a want off, optionally recording which stamp filled it. */
  markAcquired(id: string, stampId: string | null = null): Want {
    this.get(id);
    this.db.run('UPDATE want_list SET acquired_stamp_id = ?, acquired_at = ? WHERE id = ?',
      [stampId, nowIso(), id]);
    return this.get(id);
  }

  /**
   * Adds every missing stamp of a set to the want list, skipping any
   * already on it. Returns the new entries.
   */
  addMissingFromSet(sets: SetRepository, setId: string, priority: Priority = 'medium'): Want[] {
    const completion = sets.completion(setId);
    const added: Want[] = [];
    this.db.transaction(() => {
      for (const item of completion.missing) {
        const already = this.db.get(
          'SELECT 1 AS x FROM want_list WHERE set_item_id = ? AND acquired_at IS NULL', [item.id]);
        if (already) continue;
        added.push(this.add({
          description: `${completion.name}: ${item.label}`,
          country: completion.country,
          year: completion.year,
          catalog: item.catalog ?? null,
          catalogNumber: item.catalogNumber ?? null,
          setItemId: item.id,
          priority,
        }));
      }
    });
    return added;
  }

  /**
   * Open wants that a stamp fills: same set slot, or same catalog number.
   * The app calls this after a Stamp Card is saved to offer "This was on
   * your want list. Check it off?"
   */
  matchesForStamp(stampId: string): Want[] {
    if (!this.db.get('SELECT 1 AS x FROM stamps WHERE id = ?', [stampId])) {
      throw new NotFoundError('Stamp', stampId);
    }
    return this.db
      .all<Row>(
        `SELECT DISTINCT w.* FROM want_list w
          WHERE w.acquired_at IS NULL AND (
            w.set_item_id = (SELECT set_item_id FROM stamps WHERE id = ?)
            OR EXISTS (SELECT 1 FROM catalog_numbers c
                        WHERE c.stamp_id = ? AND c.catalog = w.catalog
                          AND c.number = w.catalog_number COLLATE NOCASE))
          ORDER BY ${PRIORITY_ORDER}, w.created_at`,
        [stampId, stampId],
      )
      .map(toWant);
  }
}
