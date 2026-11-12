/**
 * SqlDatabase adapter for expo-sqlite (React Native / Expo).
 *
 * NOT YET COMPILED OR RUN: expo-sqlite could not be installed in the
 * workspace where this was written. Check it against the installed
 * expo-sqlite version when the Expo project is set up, and run the test
 * suite against it on a device or simulator.
 *
 * Usage:
 *   import { openExpoDatabase } from './adapters/expo-sqlite';
 *   import { openStampStore } from './index';
 *   const store = openStampStore(openExpoDatabase());
 */
import * as SQLite from 'expo-sqlite';
import type { SqlDatabase, SqlValue } from '../db';

export function openExpoDatabase(name = 'stamp-addict.db'): SqlDatabase {
  const db = SQLite.openDatabaseSync(name);
  db.execSync('PRAGMA foreign_keys = ON;');
  try {
    db.execSync('PRAGMA journal_mode = WAL;');
  } catch {
    // The browser build (web version) may not support WAL; it's only a speed-up.
  }
  let depth = 0;

  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params: SqlValue[] = []) => {
      const r = db.runSync(sql, params);
      return { changes: r.changes };
    },
    get: <T>(sql: string, params: SqlValue[] = []) =>
      (db.getFirstSync<T>(sql, params) ?? undefined) as T | undefined,
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllSync<T>(sql, params),
    transaction: <T>(fn: () => T): T => {
      // Same savepoint approach as the Node adapter, so nested saves roll back cleanly.
      const name = `sp${depth}`;
      db.execSync(depth === 0 ? 'BEGIN' : `SAVEPOINT ${name}`);
      depth++;
      try {
        const result = fn();
        depth--;
        db.execSync(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
        return result;
      } catch (err) {
        depth--;
        db.execSync(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
        throw err;
      }
    },
  };
}
