import { NotFoundError, newId, nowIso, type SqlDatabase, type SqlValue } from './db';
import type {
  CatalogNumber, CatalogNumberInput, Photo, PhotoInput, StampCard, StampCardInput,
  StampFields, StampSummary,
} from './types';
import { CATALOGS } from './types';
import { validateStampInput } from './validation';

/** App field name → database column. Booleans are stored as 0/1. */
const COLUMNS: Record<keyof StampFields, string> = {
  collectionId: 'collection_id',
  setItemId: 'set_item_id',
  country: 'country',
  year: 'year',
  issueDate: 'issue_date',
  faceValue: 'face_value',
  currency: 'currency',
  colors: 'colors',
  designSubject: 'design_subject',
  stampType: 'stamp_type',
  designer: 'designer',
  engraver: 'engraver',
  printer: 'printer',
  perfHorizontal: 'perf_horizontal',
  perfVertical: 'perf_vertical',
  separation: 'separation',
  watermark: 'watermark',
  paperType: 'paper_type',
  printingMethod: 'printing_method',
  gum: 'gum',
  tagging: 'tagging',
  format: 'format',
  widthMm: 'width_mm',
  heightMm: 'height_mm',
  mintStatus: 'mint_status',
  centering: 'centering',
  grade: 'grade',
  cancellation: 'cancellation',
  faults: 'faults',
  hasCertificate: 'has_certificate',
  errorVariety: 'error_variety',
  plateNumber: 'plate_number',
  overprint: 'overprint',
  shade: 'shade',
  quantity: 'quantity',
  purchasePrice: 'purchase_price',
  purchaseCurrency: 'purchase_currency',
  purchaseDate: 'purchase_date',
  source: 'source',
  estimatedValue: 'estimated_value',
  storageLocation: 'storage_location',
  forTrade: 'for_trade',
  notes: 'notes',
};
const BOOLEAN_FIELDS = new Set<keyof StampFields>(['hasCertificate', 'forTrade']);
const FIELD_NAMES = Object.keys(COLUMNS) as Array<keyof StampFields>;

function toSql(field: keyof StampFields, value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (BOOLEAN_FIELDS.has(field)) return value ? 1 : 0;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' ? null : t; // blank text means "not recorded"
  }
  return value as SqlValue;
}

function fromSql(field: keyof StampFields, value: SqlValue): unknown {
  if (BOOLEAN_FIELDS.has(field)) return value === null ? null : value === 1;
  return value;
}

type Row = Record<string, SqlValue>;

export class StampRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Task 5.1: create a Stamp Card. Every field is optional. */
  create(input: StampCardInput = {}): StampCard {
    validateStampInput(input);
    const id = newId();
    const now = nowIso();
    this.db.transaction(() => {
      const fields = FIELD_NAMES.filter((f) => input[f] !== undefined);
      const cols = ['id', 'created_at', 'updated_at', ...fields.map((f) => COLUMNS[f])];
      const vals: SqlValue[] = [id, now, now, ...fields.map((f) => toSql(f, input[f]))];
      this.db.run(
        `INSERT INTO stamps (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        vals,
      );
      if (input.catalogNumbers) this.replaceCatalogNumbers(id, input.catalogNumbers);
      if (input.photos) this.replacePhotos(id, input.photos);
      if (input.tags) this.replaceTags(id, input.tags);
    });
    return this.get(id);
  }

  /** Task 5.2: load a full Stamp Card for the view screen. */
  get(id: string): StampCard {
    const row = this.db.get<Row>('SELECT * FROM stamps WHERE id = ?', [id]);
    if (!row) throw new NotFoundError('Stamp', id);

    const card: Record<string, unknown> = { id };
    for (const f of FIELD_NAMES) card[f] = fromSql(f, row[COLUMNS[f]]);
    card.createdAt = row.created_at;
    card.updatedAt = row.updated_at;

    card.catalogNumbers = this.db
      .all<Row>(
        `SELECT * FROM catalog_numbers WHERE stamp_id = ?
         ORDER BY CASE catalog ${CATALOGS.values.map((c, i) => `WHEN '${c}' THEN ${i}`).join(' ')} END, number`,
        [id],
      )
      .map((r): CatalogNumber => ({
        id: r.id as string,
        catalog: r.catalog as CatalogNumber['catalog'],
        number: r.number as string,
        catalogLabel: r.catalog_label as string | null,
        catalogValue: r.catalog_value as number | null,
        valueCurrency: r.value_currency as string | null,
        edition: r.edition as string | null,
      }));

    card.photos = this.db
      .all<Row>(
        `SELECT * FROM photos WHERE stamp_id = ?
         ORDER BY CASE role WHEN 'front' THEN 0 WHEN 'back' THEN 1 ELSE 2 END, sort_order`,
        [id],
      )
      .map((r): Photo => ({
        id: r.id as string,
        role: r.role as Photo['role'],
        uri: r.uri as string,
        width: r.width as number | null,
        height: r.height as number | null,
        caption: r.caption as string | null,
        sortOrder: r.sort_order as number,
      }));

    card.tags = this.db
      .all<{ name: string }>(
        `SELECT t.name FROM tags t JOIN stamp_tags st ON st.tag_id = t.id
         WHERE st.stamp_id = ? ORDER BY t.name COLLATE NOCASE`,
        [id],
      )
      .map((r) => r.name);

    return card as unknown as StampCard;
  }

  /**
   * Task 5.3: edit a Stamp Card. Only fields that are given change.
   * Set a field to null to clear it. A list that is given replaces the
   * current list; a list left out is kept.
   */
  update(id: string, patch: StampCardInput): StampCard {
    validateStampInput(patch);
    this.db.transaction(() => {
      const exists = this.db.get('SELECT 1 AS x FROM stamps WHERE id = ?', [id]);
      if (!exists) throw new NotFoundError('Stamp', id);
      const fields = FIELD_NAMES.filter((f) => patch[f] !== undefined);
      const sets = [...fields.map((f) => `${COLUMNS[f]} = ?`), 'updated_at = ?'];
      const vals = [...fields.map((f) => toSql(f, patch[f])), nowIso(), id];
      this.db.run(`UPDATE stamps SET ${sets.join(', ')} WHERE id = ?`, vals);
      if (patch.catalogNumbers) this.replaceCatalogNumbers(id, patch.catalogNumbers);
      if (patch.photos) this.replacePhotos(id, patch.photos);
      if (patch.tags) this.replaceTags(id, patch.tags);
    });
    return this.get(id);
  }

  delete(id: string): void {
    const { changes } = this.db.run('DELETE FROM stamps WHERE id = ?', [id]);
    if (changes === 0) throw new NotFoundError('Stamp', id);
  }

  /** Rows for the collection grid / list (task 3.3), newest first. */
  list(opts: { collectionId?: string; tag?: string; limit?: number; offset?: number } = {}): StampSummary[] {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (opts.collectionId) {
      where.push('s.collection_id = ?');
      params.push(opts.collectionId);
    }
    if (opts.tag) {
      where.push(`EXISTS (SELECT 1 FROM stamp_tags st JOIN tags t ON t.id = st.tag_id
                   WHERE st.stamp_id = s.id AND t.name = ? COLLATE NOCASE)`);
      params.push(opts.tag);
    }
    params.push(opts.limit ?? 100, opts.offset ?? 0);
    return this.db
      .all<Row>(
        `SELECT s.id, s.country, s.year, s.face_value, s.design_subject, s.mint_status,
           (SELECT uri FROM photos p WHERE p.stamp_id = s.id AND p.role = 'front') AS thumb,
           (SELECT c.catalog || ' ' || c.number FROM catalog_numbers c WHERE c.stamp_id = s.id
              ORDER BY CASE c.catalog WHEN 'scott' THEN 0 ELSE 1 END LIMIT 1) AS cat
         FROM stamps s
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY s.created_at DESC, s.rowid DESC
         LIMIT ? OFFSET ?`,
        params,
      )
      .map((r) => {
        const cat = r.cat as string | null;
        let primaryCatalog: string | null = null;
        if (cat) {
          const [key, ...num] = cat.split(' ');
          const label = (CATALOGS.labels as Record<string, string>)[key] ?? key;
          primaryCatalog = `${label} ${num.join(' ')}`;
        }
        return {
          id: r.id as string,
          country: r.country as string | null,
          year: r.year as number | null,
          faceValue: r.face_value as string | null,
          designSubject: r.design_subject as string | null,
          mintStatus: r.mint_status as StampSummary['mintStatus'],
          thumbnailUri: r.thumb as string | null,
          primaryCatalog,
        };
      });
  }

  /** All tag names in use, with how many stamps carry each (for tag pickers). */
  allTags(): Array<{ name: string; count: number }> {
    return this.db.all<{ name: string; count: number }>(
      `SELECT t.name, COUNT(st.stamp_id) AS count FROM tags t
       LEFT JOIN stamp_tags st ON st.tag_id = t.id
       GROUP BY t.id ORDER BY t.name COLLATE NOCASE`,
    );
  }

  private replaceCatalogNumbers(stampId: string, list: CatalogNumberInput[]) {
    this.db.run('DELETE FROM catalog_numbers WHERE stamp_id = ?', [stampId]);
    for (const c of list) {
      this.db.run(
        `INSERT INTO catalog_numbers (id, stamp_id, catalog, catalog_label, number, catalog_value, value_currency, edition)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), stampId, c.catalog, c.catalogLabel ?? null, c.number.trim(),
          c.catalogValue ?? null, c.valueCurrency ?? null, c.edition ?? null],
      );
    }
  }

  private replacePhotos(stampId: string, list: PhotoInput[]) {
    this.db.run('DELETE FROM photos WHERE stamp_id = ?', [stampId]);
    list.forEach((p, i) => {
      this.db.run(
        `INSERT INTO photos (id, stamp_id, role, uri, width, height, caption, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), stampId, p.role, p.uri, p.width ?? null, p.height ?? null, p.caption ?? null, i],
      );
    });
  }

  private replaceTags(stampId: string, names: string[]) {
    this.db.run('DELETE FROM stamp_tags WHERE stamp_id = ?', [stampId]);
    const seen = new Set<string>();
    for (const raw of names) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let tag = this.db.get<{ id: string }>('SELECT id FROM tags WHERE name = ? COLLATE NOCASE', [name]);
      if (!tag) {
        tag = { id: newId() };
        this.db.run('INSERT INTO tags (id, name) VALUES (?, ?)', [tag.id, name]);
      }
      this.db.run('INSERT INTO stamp_tags (stamp_id, tag_id) VALUES (?, ?)', [stampId, tag.id]);
    }
    // Drop tags no stamp uses any more so pickers stay tidy.
    this.db.run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM stamp_tags)');
  }
}
