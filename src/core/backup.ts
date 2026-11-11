import type { SqlDatabase, SqlValue } from './db';
import { SCHEMA_VERSION } from './migrations';

/**
 * Full-fidelity snapshot of everything the user has entered: every row of
 * every table, exactly as stored. Restoring it gives back the same
 * collection, IDs included. App settings (app_meta) are left out on purpose.
 */
export const BACKUP_FORMAT = 'stamp-addict-backup';
export const BACKUP_FORMAT_VERSION = 1;

/** Parents before children, so foreign keys hold while rows go back in. */
export const BACKUP_TABLES = [
  'collections', 'stamp_sets', 'set_items', 'stamps', 'catalog_numbers',
  'photos', 'tags', 'stamp_tags', 'want_list',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Row = Record<string, SqlValue>;

export interface BackupData {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<BackupTable, Row[]>;
}

export interface BackupSummary {
  stamps: number;
  photos: number;
  sets: number;
  wants: number;
}

/** Something about a backup file stops it being restored. The message is written for the user. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export function exportData(db: SqlDatabase, now = new Date()): BackupData {
  const tables = {} as Record<BackupTable, Row[]>;
  for (const t of BACKUP_TABLES) tables[t] = db.all<Row>(`SELECT * FROM ${t} ORDER BY rowid`);
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    tables,
  };
}

export function summarize(data: Pick<BackupData, 'tables'>): BackupSummary {
  return {
    stamps: data.tables.stamps?.length ?? 0,
    photos: data.tables.photos?.length ?? 0,
    sets: data.tables.stamp_sets?.length ?? 0,
    wants: data.tables.want_list?.length ?? 0,
  };
}

export function summarizeDatabase(db: SqlDatabase): BackupSummary {
  const n = (t: string) => db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)?.n ?? 0;
  return { stamps: n('stamps'), photos: n('photos'), sets: n('stamp_sets'), wants: n('want_list') };
}

/**
 * Checks that something read from a file really is a Stamp Addict backup
 * this version can restore. Throws BackupError with a message for the user.
 */
export function validateData(value: unknown): BackupData {
  const d = value as Partial<BackupData> | null;
  if (!d || typeof d !== 'object' || d.format !== BACKUP_FORMAT) {
    throw new BackupError('This file is not a Stamp Addict backup.');
  }
  if (typeof d.formatVersion !== 'number' || d.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError('This backup was made by a newer version of Stamp Addict. Update the app, then try again.');
  }
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('This backup was made by a newer version of Stamp Addict. Update the app, then try again.');
  }
  if (!d.tables || typeof d.tables !== 'object') throw new BackupError('This backup is damaged: it has no data.');
  for (const t of BACKUP_TABLES) {
    const rows = (d.tables as Record<string, unknown>)[t];
    if (rows === undefined) continue; // an older backup may lack a newer table
    if (!Array.isArray(rows)) throw new BackupError(`This backup is damaged (${t}).`);
    for (const r of rows) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw new BackupError(`This backup is damaged (${t}).`);
      for (const v of Object.values(r)) {
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') {
          throw new BackupError(`This backup is damaged (${t}).`);
        }
      }
    }
  }
  const tables = {} as Record<BackupTable, Row[]>;
  for (const t of BACKUP_TABLES) tables[t] = ((d.tables as Record<string, Row[]>)[t] ?? []) as Row[];
  return { format: BACKUP_FORMAT, formatVersion: d.formatVersion, schemaVersion: d.schemaVersion, exportedAt: String(d.exportedAt ?? ''), tables };
}

/**
 * Replaces everything in the database with the backup's contents, all or
 * nothing: if any row is rejected, the database is left exactly as it was.
 * Columns the backup has but this version doesn't are ignored; columns this
 * version has but the backup doesn't get their defaults.
 */
export function replaceAllData(db: SqlDatabase, data: BackupData): BackupSummary {
  const columns = new Map<BackupTable, Set<string>>();
  for (const t of BACKUP_TABLES) {
    columns.set(t, new Set(db.all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name)));
  }
  db.transaction(() => {
    for (const t of [...BACKUP_TABLES].reverse()) db.run(`DELETE FROM ${t}`);
    for (const t of BACKUP_TABLES) {
      const known = columns.get(t)!;
      for (const row of data.tables[t]) {
        const cols = Object.keys(row).filter((c) => known.has(c));
        if (!cols.length) continue;
        try {
          db.run(
            `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            cols.map((c) => row[c]),
          );
        } catch (e) {
          throw new BackupError(`This backup couldn't be restored: a record in ${t} was rejected (${(e as Error).message}). Nothing was changed.`);
        }
      }
    }
  });
  return summarizeDatabase(db);
}

/** Photo paths the data refers to that can be packed into a backup (relative, inside photos/). */
export function photoPaths(data: Pick<BackupData, 'tables'>): string[] {
  const out = new Set<string>();
  for (const p of data.tables.photos ?? []) {
    const uri = p.uri;
    if (typeof uri === 'string' && isSafePhotoPath(uri)) out.add(uri);
  }
  return [...out];
}

/** Only plain file names inside photos/: blocks paths like ../../something. */
export function isSafePhotoPath(path: string): boolean {
  return /^photos\/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(path) && !path.includes('..');
}
