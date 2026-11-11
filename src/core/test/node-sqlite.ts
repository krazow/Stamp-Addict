import { DatabaseSync } from 'node:sqlite';
import type { SqlDatabase, SqlValue } from '../db';

/** SqlDatabase adapter for Node's built-in SQLite. Used by tests and tools. */
export function openNodeDatabase(path = ':memory:'): SqlDatabase {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  let depth = 0;

  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    // node:sqlite returns rows with a null prototype; copy to plain objects.
    get: <T>(sql: string, params: SqlValue[] = []) => {
      const row = db.prepare(sql).get(...params);
      return (row ? { ...row } : undefined) as T | undefined;
    },
    all: <T>(sql: string, params: SqlValue[] = []) =>
      db.prepare(sql).all(...params).map((r) => ({ ...r })) as T[],
    transaction: <T>(fn: () => T): T => {
      // Nested calls use savepoints so an inner failure rolls back cleanly.
      const name = `sp${depth}`;
      db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${name}`);
      depth++;
      try {
        const result = fn();
        depth--;
        db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
        return result;
      } catch (err) {
        depth--;
        db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
        throw err;
      }
    },
  };
}
