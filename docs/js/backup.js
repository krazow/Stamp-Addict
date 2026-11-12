// Backup files: the same .zip the phone app makes, so a backup from
// either one restores on the other.
//
//   manifest.json  what the file is, when it was made, how much is in it
//   data.json      every record exactly as stored (used to restore)
//   stamps.csv     the collection as a spreadsheet, readable without the app
//   photos/...     every stamp photo
//   README.txt     what all of this is
import {
  CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PRINTING_METHODS, SEPARATIONS,
  STAMP_TYPES, TAGGINGS, labelOf,
} from './lists.js';
import { SetRepository, StampRepository } from './repos.js';
import { COLUMNS, REQUIRED, SCHEMA_VERSION, TABLES, makeRow } from './store.js';
import { formatPerforation } from './validation.js';
import { ZipError, createZip, openZip } from './zip.js';

export const BACKUP_FORMAT = 'stamp-addict-backup';
export const BACKUP_FORMAT_VERSION = 1;

export class BackupError extends Error {
  constructor(message) { super(message); this.name = 'BackupError'; }
}

export function summarizeTables(tables) {
  return {
    stamps: tables.stamps?.length ?? 0, photos: tables.photos?.length ?? 0,
    sets: tables.stamp_sets?.length ?? 0, wants: tables.want_list?.length ?? 0,
  };
}

export function exportData(db, now = new Date()) {
  const tables = {};
  for (const t of TABLES) tables[t] = db.rows(t);
  return { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables };
}

const NEWER = 'This backup was made by a newer version of Stamp Addict. Update the app, then try again.';

/** Checks that parsed JSON really is a backup this version can restore. */
export function validateData(d) {
  if (!d || typeof d !== 'object' || d.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Stamp Addict backup.');
  if (typeof d.formatVersion !== 'number' || d.formatVersion > BACKUP_FORMAT_VERSION) throw new BackupError(NEWER);
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > SCHEMA_VERSION) throw new BackupError(NEWER);
  if (!d.tables || typeof d.tables !== 'object') throw new BackupError('This backup is damaged: it has no data.');
  const tables = {};
  for (const t of TABLES) {
    const rows = d.tables[t] ?? [];
    if (!Array.isArray(rows)) throw new BackupError(`This backup is damaged (${t}).`);
    tables[t] = rows.map((r) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw new BackupError(`This backup is damaged (${t}).`);
      for (const v of Object.values(r)) {
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') throw new BackupError(`This backup is damaged (${t}).`);
      }
      // Columns this version doesn't know are dropped; missing ones get defaults.
      const row = makeRow(t, r);
      for (const col of REQUIRED[t]) {
        if (row[col] === null || row[col] === undefined) {
          throw new BackupError(`This backup couldn't be restored: a record in ${t} is missing ${col}. Nothing was changed.`);
        }
      }
      return row;
    });
  }
  return { format: BACKUP_FORMAT, formatVersion: d.formatVersion, schemaVersion: d.schemaVersion, exportedAt: String(d.exportedAt ?? ''), tables };
}

/** Replaces every record with the backup's, all at once. */
export function replaceAllData(db, data) {
  db.transaction(() => {
    for (const t of TABLES) {
      db.t[t] = data.tables[t].map((r) => ({ ...r }));
      db.dirty.add(t);
    }
  });
  return summarizeTables(db.t);
}

/** Only plain file names inside photos/: blocks paths like ../../something. */
export function isSafePhotoPath(path) {
  return /^photos\/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/.test(path) && !path.includes('..');
}

export function photoPaths(tables) {
  const out = new Set();
  for (const p of tables.photos ?? []) if (typeof p.uri === 'string' && isSafePhotoPath(p.uri)) out.add(p.uri);
  return [...out];
}

// ---- CSV ---------------------------------------------------------------

const numbersFor = (c, catalog) => c.catalogNumbers.filter((n) => n.catalog === catalog).map((n) => n.number).join('; ');

const CSV_COLUMNS = [
  ['Country', (c) => c.country],
  ['Year', (c) => c.year],
  ['Face value', (c) => c.faceValue],
  ['Design', (c) => c.designSubject],
  ['Scott', (c) => numbersFor(c, 'scott')],
  ['Stanley Gibbons', (c) => numbersFor(c, 'stanley_gibbons')],
  ['Michel', (c) => numbersFor(c, 'michel')],
  ['Yvert et Tellier', (c) => numbersFor(c, 'yvert_tellier')],
  ['Other catalog numbers', (c) => c.catalogNumbers
    .filter((n) => !['scott', 'stanley_gibbons', 'michel', 'yvert_tellier'].includes(n.catalog))
    .map((n) => `${n.catalog === 'other' ? n.catalogLabel || 'Other' : n.catalog === 'sakura' ? 'Sakura' : 'Facit'} ${n.number}`)
    .join('; ')],
  ['Catalog value', (c) => c.catalogNumbers.find((n) => n.catalogValue != null)?.catalogValue],
  ['Issue date', (c) => c.issueDate],
  ['Currency', (c) => c.currency],
  ['Colors', (c) => c.colors],
  ['Stamp type', (c) => labelOf(STAMP_TYPES, c.stampType)],
  ['Perforation', (c) => (c.perfHorizontal != null || c.perfVertical != null
    ? formatPerforation(c.perfHorizontal ?? c.perfVertical, c.perfVertical ?? c.perfHorizontal) : '')],
  ['Separation', (c) => labelOf(SEPARATIONS, c.separation)],
  ['Watermark', (c) => c.watermark],
  ['Paper', (c) => labelOf(PAPER_TYPES, c.paperType)],
  ['Printing method', (c) => labelOf(PRINTING_METHODS, c.printingMethod)],
  ['Gum', (c) => labelOf(GUMS, c.gum)],
  ['Tagging', (c) => labelOf(TAGGINGS, c.tagging)],
  ['Format', (c) => labelOf(FORMATS, c.format)],
  ['Width (mm)', (c) => c.widthMm],
  ['Height (mm)', (c) => c.heightMm],
  ['Designer', (c) => c.designer],
  ['Engraver', (c) => c.engraver],
  ['Printer', (c) => c.printer],
  ['Mint or used', (c) => labelOf(MINT_STATUSES, c.mintStatus)],
  ['Centering', (c) => labelOf(CENTERINGS, c.centering)],
  ['Grade', (c) => c.grade],
  ['Cancellation', (c) => c.cancellation],
  ['Faults', (c) => c.faults],
  ['Certificate', (c) => c.hasCertificate],
  ['Error or variety', (c) => c.errorVariety],
  ['Plate number', (c) => c.plateNumber],
  ['Overprint', (c) => c.overprint],
  ['Shade', (c) => c.shade],
  ['Set', (_c, set) => set],
  ['Quantity', (c) => c.quantity],
  ['Purchase price', (c) => c.purchasePrice],
  ['Purchase currency', (c) => c.purchaseCurrency],
  ['Purchase date', (c) => c.purchaseDate],
  ['Bought from', (c) => c.source],
  ['Estimated value', (c) => c.estimatedValue],
  ['Stored in', (c) => c.storageLocation],
  ['For trade', (c) => c.forTrade],
  ['Tags', (c) => c.tags.join('; ')],
  ['Notes', (c) => c.notes],
  ['Front photo', (c) => c.photos.find((p) => p.role === 'front')?.uri],
  ['Back photo', (c) => c.photos.find((p) => p.role === 'back')?.uri],
  ['Other photos', (c) => c.photos.filter((p) => p.role !== 'front' && p.role !== 'back').map((p) => p.uri).join('; ')],
  ['Stamp ID', (c) => c.id],
  ['Added', (c) => c.createdAt],
  ['Updated', (c) => c.updatedAt],
];

export const CSV_HEADERS = CSV_COLUMNS.map(([h]) => h);

/** One CSV cell, quoted when needed and safe from spreadsheet formula injection. */
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The collection as CSV, oldest first, with a byte-order mark so Excel reads ½ and é. */
export function stampsToCsv(db) {
  const stamps = new StampRepository(db);
  const sets = new SetRepository(db);
  const ordered = db.rows('stamps').map((r, i) => [r, i])
    .sort(([a, ai], [b, bi]) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : ai - bi));
  const lines = [CSV_HEADERS.map(csvCell).join(',')];
  for (const [r] of ordered) {
    const card = stamps.get(r.id);
    const found = card.setItemId ? sets.findItem(card.setItemId) : null;
    const set = found ? `${found.setName}: ${found.item.label}` : '';
    lines.push(CSV_COLUMNS.map(([, f]) => csvCell(f(card, set))).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---- Zip ---------------------------------------------------------------

const README = `Stamp Addict backup

This file is a complete copy of a Stamp Addict collection.

- To restore it: open Stamp Addict, go to Backup and restore, and choose this file.
- To look at it without the app: open stamps.csv in Excel, Google Sheets or
  Numbers. The photo columns name files in the photos folder.
- data.json holds every record exactly as stored; Stamp Addict uses it to restore.
`;

export async function createBackupZip(db, { readPhoto }, { appVersion = null, now = new Date() } = {}) {
  const data = exportData(db, now);
  const entries = [];
  const missingPhotos = [];
  for (const path of photoPaths(data.tables)) {
    let bytes = null;
    try { bytes = await readPhoto(path); } catch { bytes = null; }
    if (bytes) entries.push({ name: path, data: bytes });
    else missingPhotos.push(path);
  }
  const manifest = {
    format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, app: 'Stamp Addict', appVersion,
    schemaVersion: SCHEMA_VERSION, createdAt: now.toISOString(), counts: summarizeTables(data.tables),
    missingPhotos: missingPhotos.length,
  };
  entries.push(
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2), compress: true },
    { name: 'data.json', data: JSON.stringify(data), compress: true },
    { name: 'stamps.csv', data: stampsToCsv(db), compress: true },
    { name: 'README.txt', data: README, compress: true },
  );
  return { bytes: await createZip(entries, now), manifest, missingPhotos };
}

/** Opens and checks a backup file without changing anything. Throws BackupError. */
export async function readBackupZip(bytes) {
  let files;
  try {
    files = openZip(bytes);
  } catch (e) {
    if (e instanceof ZipError) throw new BackupError('This file is not a Stamp Addict backup (it is not a zip file).');
    throw e;
  }
  const manifestFile = files.get('manifest.json');
  const dataFile = files.get('data.json');
  if (!manifestFile || !dataFile) throw new BackupError('This file is not a Stamp Addict backup.');
  let manifest;
  let raw;
  try {
    const text = new TextDecoder();
    manifest = JSON.parse(text.decode(await manifestFile.read()));
    raw = JSON.parse(text.decode(await dataFile.read()));
  } catch {
    throw new BackupError('This backup is damaged and can\'t be read.');
  }
  if (manifest?.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Stamp Addict backup.');
  const data = validateData(raw);
  const photos = new Map();
  const missingPhotos = [];
  for (const path of photoPaths(data.tables)) {
    const f = files.get(path);
    if (f) photos.set(path, await f.read());
    else missingPhotos.push(path);
  }
  return { manifest: { ...manifest, counts: summarizeTables(data.tables) }, data, photos, missingPhotos };
}

/** Writes the photos, then swaps in the records in one go. */
export async function restoreBackup(db, backup, { writePhoto }) {
  for (const [path, bytes] of backup.photos) {
    if (isSafePhotoPath(path)) await writePhoto(path, bytes);
  }
  return replaceAllData(db, backup.data);
}

export function backupFileName(now = new Date()) {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return `Stamp Addict backup ${d}.zip`;
}

export { COLUMNS };
