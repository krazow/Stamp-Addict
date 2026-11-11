/**
 * A small database interface so the app's data layer does not depend on
 * one SQLite library. The mobile app supplies an adapter for the SQLite
 * library of the chosen platform (task 1.5); tests use Node's built-in
 * SQLite (see adapters/node-sqlite.ts).
 */
export type SqlValue = string | number | null;

export interface SqlDatabase {
  /** Run one or more statements with no parameters. */
  exec(sql: string): void;
  /** Run one statement; returns the number of rows changed. */
  run(sql: string, params?: SqlValue[]): { changes: number };
  get<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T | undefined;
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[];
  /** Run fn inside a transaction; roll back if it throws. */
  transaction<T>(fn: () => T): T;
}

export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(what: string, id: string) {
    super(`${what} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

let idGenerator: (() => string) | null = null;

/**
 * Lets the app supply its own UUID generator. React Native has no
 * built-in crypto.randomUUID, so the app passes expo-crypto's.
 */
export function setIdGenerator(fn: () => string): void {
  idGenerator = fn;
}

export function newId(): string {
  if (idGenerator) return idGenerator();
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Last-resort version 4 UUID; IDs only need to be unique, not secret.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}
