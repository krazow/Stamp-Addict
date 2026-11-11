import type { SqlDatabase } from './db';
import { SCHEMA_V1 } from './schema.generated';

/**
 * Ordered list of schema migrations. The database's PRAGMA user_version
 * records how many have run. To change the schema later, append a new
 * migration; never edit one that has shipped.
 */
export const MIGRATIONS: string[] = [SCHEMA_V1];

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
