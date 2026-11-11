import { NotFoundError, ValidationError, newId, type SqlDatabase, type SqlValue } from './db';
import { CATALOGS, type Catalog } from './types';

export interface SetItemInput {
  label: string;
  faceValue?: string | null;
  catalog?: Catalog | null;
  catalogNumber?: string | null;
}

export interface SetItem extends SetItemInput {
  id: string;
  position: number;
}

export interface StampSetInput {
  name: string;
  country?: string | null;
  year?: number | null;
  description?: string | null;
  items: SetItemInput[];
}

export interface StampSet extends Omit<StampSetInput, 'items'> {
  id: string;
  items: SetItem[];
}

export interface SetItemStatus extends SetItem {
  owned: boolean;
  /** Stamps that fill this slot: linked directly, or matched by catalog number. */
  stampIds: string[];
}

export interface SetCompletion {
  setId: string;
  name: string;
  country: string | null;
  year: number | null;
  total: number;
  owned: number;
  percent: number;
  items: SetItemStatus[];
  missing: SetItem[];
}

type Row = Record<string, SqlValue>;

function toItem(r: Row): SetItem {
  return {
    id: r.id as string,
    position: r.position as number,
    label: r.label as string,
    faceValue: r.face_value as string | null,
    catalog: r.catalog as Catalog | null,
    catalogNumber: r.catalog_number as string | null,
  };
}

/** Task 12.2: sets and how complete they are. */
export class SetRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: StampSetInput): StampSet {
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
      this.db.run(
        'INSERT INTO stamp_sets (id, name, country, year, description) VALUES (?, ?, ?, ?, ?)',
        [id, input.name.trim(), input.country ?? null, input.year ?? null, input.description ?? null],
      );
      input.items.forEach((it, i) => {
        this.db.run(
          `INSERT INTO set_items (id, set_id, position, label, face_value, catalog, catalog_number)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), id, i + 1, it.label.trim(), it.faceValue ?? null, it.catalog ?? null,
            it.catalogNumber?.trim() || null],
        );
      });
    });
    return this.get(id);
  }

  get(id: string): StampSet {
    const s = this.db.get<Row>('SELECT * FROM stamp_sets WHERE id = ?', [id]);
    if (!s) throw new NotFoundError('Set', id);
    const items = this.db
      .all<Row>('SELECT * FROM set_items WHERE set_id = ? ORDER BY position', [id])
      .map(toItem);
    return {
      id,
      name: s.name as string,
      country: s.country as string | null,
      year: s.year as number | null,
      description: s.description as string | null,
      items,
    };
  }

  /** Which set a slot belongs to, for showing "1869 Pictorial Issue · 3c" on a Stamp Card. */
  findItem(itemId: string): { setId: string; setName: string; item: SetItem; total: number } | null {
    const r = this.db.get<Row>(
      `SELECT si.*, s.name AS set_name,
              (SELECT COUNT(*) FROM set_items x WHERE x.set_id = si.set_id) AS total
         FROM set_items si JOIN stamp_sets s ON s.id = si.set_id
        WHERE si.id = ?`,
      [itemId],
    );
    if (!r) return null;
    return { setId: r.set_id as string, setName: r.set_name as string, item: toItem(r), total: r.total as number };
  }

  /** Every set with its slots, for the "put this stamp in a set" picker. */
  listWithItems(): StampSet[] {
    return this.db
      .all<{ id: string }>('SELECT id FROM stamp_sets ORDER BY name COLLATE NOCASE')
      .map(({ id }) => this.get(id));
  }

  delete(id: string): void {
    const { changes } = this.db.run('DELETE FROM stamp_sets WHERE id = ?', [id]);
    if (changes === 0) throw new NotFoundError('Set', id);
  }

  /** Put a stamp in a set slot (task 1.3.7). Pass null to unlink. */
  linkStamp(stampId: string, setItemId: string | null): void {
    if (setItemId && !this.db.get('SELECT 1 AS x FROM set_items WHERE id = ?', [setItemId])) {
      throw new NotFoundError('Set item', setItemId);
    }
    const { changes } = this.db.run('UPDATE stamps SET set_item_id = ? WHERE id = ?', [setItemId, stampId]);
    if (changes === 0) throw new NotFoundError('Stamp', stampId);
  }

  /**
   * How complete a set is. A slot counts as owned when a stamp is linked
   * to it, or when a stamp carries the slot's catalog number, so stamps
   * entered with a catalog number fill sets without extra work.
   */
  completion(setId: string): SetCompletion {
    const set = this.get(setId);
    const owners = this.db.all<{ item_id: string; stamp_id: string }>(
      `SELECT si.id AS item_id, s.id AS stamp_id
         FROM set_items si JOIN stamps s ON s.set_item_id = si.id
        WHERE si.set_id = ?
       UNION
       SELECT si.id, cn.stamp_id
         FROM set_items si
         JOIN catalog_numbers cn
           ON cn.catalog = si.catalog AND cn.number = si.catalog_number COLLATE NOCASE
        WHERE si.set_id = ? AND si.catalog IS NOT NULL`,
      [setId, setId],
    );
    const byItem = new Map<string, string[]>();
    for (const o of owners) {
      const list = byItem.get(o.item_id) ?? [];
      list.push(o.stamp_id);
      byItem.set(o.item_id, list);
    }
    const items: SetItemStatus[] = set.items.map((it) => {
      const stampIds = byItem.get(it.id) ?? [];
      return { ...it, owned: stampIds.length > 0, stampIds };
    });
    const owned = items.filter((i) => i.owned).length;
    return {
      setId,
      name: set.name,
      country: set.country ?? null,
      year: set.year ?? null,
      total: items.length,
      owned,
      percent: Math.round((owned / items.length) * 100),
      items,
      missing: items.filter((i) => !i.owned).map(({ owned: _o, stampIds: _s, ...it }) => it),
    };
  }

  /** Every set with its progress, least complete first. */
  allCompletion(): Array<Omit<SetCompletion, 'items' | 'missing'>> {
    const ids = this.db.all<{ id: string }>('SELECT id FROM stamp_sets');
    return ids
      .map(({ id }) => {
        const { items: _i, missing: _m, ...summary } = this.completion(id);
        return summary;
      })
      .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
  }

  /** Progress rolled up by country ("missing stamps by country"). */
  completionByCountry(): Array<{ country: string; sets: number; total: number; owned: number; percent: number }> {
    const groups = new Map<string, { sets: number; total: number; owned: number }>();
    for (const s of this.allCompletion()) {
      const key = s.country ?? 'Unknown';
      const g = groups.get(key) ?? { sets: 0, total: 0, owned: 0 };
      g.sets++;
      g.total += s.total;
      g.owned += s.owned;
      groups.set(key, g);
    }
    return [...groups.entries()]
      .map(([country, g]) => ({ country, ...g, percent: Math.round((g.owned / g.total) * 100) }))
      .sort((a, b) => a.country.localeCompare(b.country));
  }
}
