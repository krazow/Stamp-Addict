import type { SqlDatabase } from './db';

/**
 * Small app settings stored in the database (e.g. when the last backup was
 * made). Device-specific: never included in backups.
 */
export class MetaRepository {
  constructor(private readonly db: SqlDatabase) {}

  get(key: string): string | null {
    return this.db.get<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [key])?.value ?? null;
  }

  set(key: string, value: string | null): void {
    if (value === null) this.db.run('DELETE FROM app_meta WHERE key = ?', [key]);
    else this.db.run('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }
}

export const META_LAST_BACKUP = 'last_backup_at';
