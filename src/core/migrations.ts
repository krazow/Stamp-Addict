import type { SqlDatabase } from './db';
import { SCHEMA_V1 } from './schema.generated';

/** Version 2: a small key/value table for app settings (last backup time). */
const V2_APP_META = `
CREATE TABLE app_meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);`;

/**
 * Ordered list of schema migrations. The database's PRAGMA user_version
 * records how many have run. To change the schema later, append a new
 * migration; never edit one that has shipped.
 */
export const MIGRATIONS: string[] = [SCHEMA_V1, V2_APP_META];

export function migrate(db: SqlDatabase): number {
  const row = db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return MIGRATIONS.length;
}

/** The schema version this app writes (and the newest it can restore). */
export const SCHEMA_VERSION = MIGRATIONS.length;
