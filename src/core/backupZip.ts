import JSZip from 'jszip';
import {
  BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BackupError, exportData, isSafePhotoPath, photoPaths,
  replaceAllData, summarize, validateData, type BackupData, type BackupSummary,
} from './backup';
import { stampsToCsv } from './csv';
import type { SqlDatabase } from './db';
import { SCHEMA_VERSION } from './migrations';

/**
 * A Stamp Addict backup file is an ordinary .zip:
 *
 *   manifest.json   what this file is, when it was made, how much is in it
 *   data.json       every record, exactly as stored (used to restore)
 *   stamps.csv      the collection as a spreadsheet, readable without the app
 *   photos/…        every stamp photo
 *   README.txt      what all of this is, for anyone who opens the zip
 *
 * So a backup is useful even to someone who never installs the app again.
 */

export interface Manifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  app: 'Stamp Addict';
  appVersion: string | null;
  schemaVersion: number;
  createdAt: string;
  counts: BackupSummary;
  missingPhotos: number;
}

export interface CreatedBackup {
  bytes: Uint8Array;
  manifest: Manifest;
  /** Photos the database lists but whose files couldn't be read. */
  missingPhotos: string[];
}

export interface ParsedBackup {
  manifest: Manifest;
  data: BackupData;
  photos: Map<string, Uint8Array>;
  /** Photos the backup's records mention but the file doesn't contain. */
  missingPhotos: string[];
}

const README = `Stamp Addict backup

This file is a complete copy of a Stamp Addict collection.

- To restore it: open Stamp Addict, go to Backup and restore, and choose this file.
- To look at it without the app: open stamps.csv in Excel, Google Sheets or
  Numbers. The photo columns name files in the photos folder.
- data.json holds every record exactly as stored; Stamp Addict uses it to restore.
`;

export async function createBackupZip(
  db: SqlDatabase,
  io: { readPhoto: (path: string) => Promise<Uint8Array | null> },
  opts: { appVersion?: string | null; now?: Date } = {},
): Promise<CreatedBackup> {
  const now = opts.now ?? new Date();
  const data = exportData(db, now);
  const zip = new JSZip();
  const missingPhotos: string[] = [];

  for (const path of photoPaths(data)) {
    let bytes: Uint8Array | null = null;
    try {
      bytes = await io.readPhoto(path);
    } catch {
      bytes = null;
    }
    if (bytes) zip.file(path, bytes, { compression: 'STORE' }); // JPEGs don't shrink further
    else missingPhotos.push(path);
  }

  const manifest: Manifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'Stamp Addict',
    appVersion: opts.appVersion ?? null,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now.toISOString(),
    counts: summarize(data),
    missingPhotos: missingPhotos.length,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('data.json', JSON.stringify(data));
  zip.file('stamps.csv', stampsToCsv(db));
  zip.file('README.txt', README);

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { bytes, manifest, missingPhotos };
}

/** Opens and checks a backup file without changing anything. Throws BackupError. */
export async function readBackupZip(bytes: Uint8Array): Promise<ParsedBackup> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new BackupError('This file is not a Stamp Addict backup (it is not a zip file).');
  }
  const manifestFile = zip.file('manifest.json');
  const dataFile = zip.file('data.json');
  if (!manifestFile || !dataFile) throw new BackupError('This file is not a Stamp Addict backup.');

  let manifest: Manifest;
  let rawData: unknown;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
    rawData = JSON.parse(await dataFile.async('string'));
  } catch {
    throw new BackupError('This backup is damaged and can\'t be read.');
  }
  if (manifest?.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Stamp Addict backup.');
  const data = validateData(rawData);

  const photos = new Map<string, Uint8Array>();
  const missingPhotos: string[] = [];
  for (const path of photoPaths(data)) {
    const f = zip.file(path);
    if (f) photos.set(path, await f.async('uint8array'));
    else missingPhotos.push(path);
  }
  return { manifest: { ...manifest, counts: summarize(data) }, data, photos, missingPhotos };
}

/**
 * Restores a parsed backup, replacing everything in the app. Photos are
 * written first; the records are swapped in one transaction, so a failure
 * leaves the current collection untouched.
 */
export async function restoreBackup(
  db: SqlDatabase,
  backup: ParsedBackup,
  io: { writePhoto: (path: string, bytes: Uint8Array) => Promise<void> | void },
): Promise<BackupSummary> {
  for (const [path, bytes] of backup.photos) {
    if (!isSafePhotoPath(path)) continue;
    await io.writePhoto(path, bytes);
  }
  return replaceAllData(db, backup.data);
}

/** Suggested file name, e.g. "Stamp Addict backup 2026-11-11.zip". */
export function backupFileName(now = new Date()): string {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return `Stamp Addict backup ${d}.zip`;
}
