import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { BackupError, exportData, isSafePhotoPath } from '../backup';
import { readBackupZip, createBackupZip, restoreBackup, backupFileName } from '../backupZip';
import { CSV_HEADERS, csvCell, stampsToCsv } from '../csv';
import { META_LAST_BACKUP } from '../meta';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '../migrations';
import { openStampStore } from '../index';
import { openNodeDatabase } from './node-sqlite';

const bytes = (s: string) => new TextEncoder().encode(s);

/** A collection with a bit of everything, and fake photo files. */
function richCollection() {
  const store = openStampStore(openNodeDatabase());
  const files = new Map<string, Uint8Array>([
    ['photos/a-front.jpg', bytes('FRONT-JPEG')],
    ['photos/a-back.jpg', bytes('BACK-JPEG')],
    ['photos/b-front.jpg', bytes('B-FRONT')],
  ]);
  const set = store.sets.create({
    name: '1869 Pictorial Issue', country: 'United States', year: 1869,
    items: [
      { label: '1c Franklin', faceValue: '1c', catalog: 'scott', catalogNumber: '112' },
      { label: '3c Locomotive', faceValue: '3c', catalog: 'scott', catalogNumber: '114' },
    ],
  });
  const a = store.stamps.create({
    country: 'United States', year: 1869, faceValue: '3c', designSubject: 'Locomotive',
    perfHorizontal: 12, perfVertical: 12, mintStatus: 'used', centering: 'vf', hasCertificate: true,
    estimatedValue: 25, notes: 'Bought at the "spring" show, table 4',
    catalogNumbers: [{ catalog: 'scott', number: '114', catalogValue: 20 }, { catalog: 'michel', number: '28' }],
    photos: [{ role: 'front', uri: 'photos/a-front.jpg' }, { role: 'back', uri: 'photos/a-back.jpg' }],
    tags: ['Trains', 'Transport'],
  });
  store.sets.linkStamp(a.id, set.items[1].id);
  const b = store.stamps.create({
    country: 'Great Britain', year: 1840, faceValue: '1d', designSubject: '=HYPERLINK("http://x")',
    perfHorizontal: 11, perfVertical: 10.5, forTrade: true,
    photos: [{ role: 'front', uri: 'photos/b-front.jpg' }],
  });
  const want = store.wants.add({ description: '1c Franklin', catalog: 'scott', catalogNumber: '112', priority: 'high' });
  store.wants.add({ description: 'Penny Black, used', country: 'Great Britain' });
  store.wants.markAcquired(want.id, b.id);
  store.meta.set(META_LAST_BACKUP, '2026-01-01T00:00:00.000Z');
  return { store, files, a, b, set };
}

const tablesOf = (db: Parameters<typeof exportData>[0]) => exportData(db).tables;

test('backup round trip: every record and photo comes back exactly', async () => {
  const src = richCollection();
  const created = await createBackupZip(src.store.db, { readPhoto: async (p) => src.files.get(p) ?? null }, { appVersion: '0.1.0' });
  assert.deepEqual(created.manifest.counts, { stamps: 2, photos: 3, sets: 1, wants: 2 });
  assert.deepEqual(created.missingPhotos, []);
  assert.equal(created.manifest.schemaVersion, SCHEMA_VERSION);

  const target = openStampStore(openNodeDatabase());
  target.stamps.create({ country: 'To be replaced' });
  const written = new Map<string, Uint8Array>();
  const parsed = await readBackupZip(created.bytes);
  const summary = await restoreBackup(target.db, parsed, { writePhoto: (p, b) => { written.set(p, b); } });

  assert.deepEqual(summary, { stamps: 2, photos: 3, sets: 1, wants: 2 });
  assert.deepEqual(tablesOf(target.db), tablesOf(src.store.db));
  assert.deepEqual([...written.keys()].sort(), [...src.files.keys()].sort());
  for (const [p, b] of src.files) assert.deepEqual(written.get(p), b);

  // Restored data behaves: set completion, want list, Stamp Card
  assert.equal(target.sets.completion(src.set.id).owned, 1);
  assert.equal(target.stamps.get(src.a.id).tags.join(','), 'Trains,Transport');
  assert.equal(target.wants.list().length, 1);
});

test('the backup zip is readable without the app', async () => {
  const src = richCollection();
  const { bytes: zipBytes } = await createBackupZip(src.store.db, { readPhoto: async (p) => src.files.get(p) ?? null });
  const zip = await JSZip.loadAsync(zipBytes);
  const names = Object.keys(zip.files).sort();
  assert.deepEqual(names, ['README.txt', 'data.json', 'manifest.json', 'photos/', 'photos/a-back.jpg', 'photos/a-front.jpg', 'photos/b-front.jpg', 'stamps.csv']);
  const csv = await zip.file('stamps.csv')!.async('string');
  assert.ok(csv.includes('Locomotive'));
});

test('restore keeps app settings on this device', async () => {
  const src = richCollection();
  const created = await createBackupZip(src.store.db, { readPhoto: async (p) => src.files.get(p) ?? null });
  const target = openStampStore(openNodeDatabase());
  target.meta.set(META_LAST_BACKUP, '2026-11-01T00:00:00.000Z');
  await restoreBackup(target.db, await readBackupZip(created.bytes), { writePhoto: () => {} });
  assert.equal(target.meta.get(META_LAST_BACKUP), '2026-11-01T00:00:00.000Z');
});

test('a bad record leaves the current collection untouched', async () => {
  const src = richCollection();
  const created = await createBackupZip(src.store.db, { readPhoto: async (p) => src.files.get(p) ?? null });
  const zip = await JSZip.loadAsync(created.bytes);
  const data = JSON.parse(await zip.file('data.json')!.async('string'));
  data.tables.stamps[1].mint_status = 'bogus';
  zip.file('data.json', JSON.stringify(data));
  const broken = await zip.generateAsync({ type: 'uint8array' });

  const target = openStampStore(openNodeDatabase());
  const keep = target.stamps.create({ country: 'Keep me' });
  const parsed = await readBackupZip(broken);
  await assert.rejects(restoreBackup(target.db, parsed, { writePhoto: () => {} }), BackupError);
  assert.equal(target.stamps.get(keep.id).country, 'Keep me');
  assert.equal(target.stamps.list().length, 1);
});

test('files that are not backups are refused with a clear message', async () => {
  await assert.rejects(readBackupZip(bytes('hello')), /not a zip file/);

  const noManifest = new JSZip();
  noManifest.file('something.txt', 'x');
  await assert.rejects(readBackupZip(await noManifest.generateAsync({ type: 'uint8array' })), /not a Stamp Addict backup/);

  const src = richCollection();
  const created = await createBackupZip(src.store.db, { readPhoto: async () => null });
  const zip = await JSZip.loadAsync(created.bytes);
  const data = JSON.parse(await zip.file('data.json')!.async('string'));
  data.schemaVersion = SCHEMA_VERSION + 1;
  zip.file('data.json', JSON.stringify(data));
  await assert.rejects(readBackupZip(await zip.generateAsync({ type: 'uint8array' })), /newer version/);

  data.schemaVersion = SCHEMA_VERSION;
  data.tables.stamps[0].country = { evil: true };
  zip.file('data.json', JSON.stringify(data));
  await assert.rejects(readBackupZip(await zip.generateAsync({ type: 'uint8array' })), /damaged/);
});

test('photo paths that try to escape the photos folder are never written', async () => {
  assert.equal(isSafePhotoPath('photos/123-456.jpg'), true);
  assert.equal(isSafePhotoPath('photos/../../etc/passwd'), false);
  assert.equal(isSafePhotoPath('/etc/passwd'), false);
  assert.equal(isSafePhotoPath('photos/sub/dir.jpg'), false);

  const src = openStampStore(openNodeDatabase());
  src.stamps.create({ photos: [{ role: 'front', uri: 'photos/../../escape.jpg' }] });
  const created = await createBackupZip(src.db, { readPhoto: async () => bytes('x') });
  const written: string[] = [];
  await restoreBackup(openStampStore(openNodeDatabase()).db, await readBackupZip(created.bytes), { writePhoto: (p) => { written.push(p); } });
  assert.deepEqual(written, []);
});

test('missing photo files are reported, and the rest still backs up', async () => {
  const src = richCollection();
  src.files.delete('photos/a-back.jpg');
  const created = await createBackupZip(src.store.db, { readPhoto: async (p) => src.files.get(p) ?? null });
  assert.deepEqual(created.missingPhotos, ['photos/a-back.jpg']);
  assert.equal(created.manifest.missingPhotos, 1);
  const parsed = await readBackupZip(created.bytes);
  assert.deepEqual(parsed.missingPhotos, ['photos/a-back.jpg']);
  assert.equal(parsed.photos.size, 2);
});

test('an older backup without a newer table, or with an unknown column, still restores', async () => {
  const src = richCollection();
  const created = await createBackupZip(src.store.db, { readPhoto: async () => null });
  const zip = await JSZip.loadAsync(created.bytes);
  const data = JSON.parse(await zip.file('data.json')!.async('string'));
  delete data.tables.want_list;
  data.tables.stamps[0].some_future_field = 'ignored';
  zip.file('data.json', JSON.stringify(data));
  const target = openStampStore(openNodeDatabase());
  const summary = await restoreBackup(target.db, await readBackupZip(await zip.generateAsync({ type: 'uint8array' })), { writePhoto: () => {} });
  assert.deepEqual(summary, { stamps: 2, photos: 3, sets: 1, wants: 0 });
});

test('upgrading a version 1 database keeps its data and adds settings', () => {
  const db = openNodeDatabase();
  db.exec(MIGRATIONS[0]);
  db.exec('PRAGMA user_version = 1');
  db.run("INSERT INTO stamps (id, created_at, updated_at, country) VALUES ('s1', 'x', 'x', 'Peru')");
  assert.equal(migrate(db), 2);
  const store = openStampStore(db);
  assert.equal(store.stamps.get('s1').country, 'Peru');
  store.meta.set('k', 'v');
  assert.equal(store.meta.get('k'), 'v');
  store.meta.set('k', null);
  assert.equal(store.meta.get('k'), null);
});

/** Minimal CSV reader for checking our own output. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r') continue;
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  return rows;
}

test('CSV export: one row per stamp, readable labels, safe cells', () => {
  const { store } = richCollection();
  const csv = stampsToCsv(store.db);
  assert.ok(csv.startsWith('﻿'), 'starts with a byte-order mark for Excel');
  const rows = parseCsv(csv.slice(1));
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], CSV_HEADERS);
  const col = (r: string[], h: string) => r[CSV_HEADERS.indexOf(h)];
  const [, a, b] = rows;

  assert.equal(col(a, 'Country'), 'United States');
  assert.equal(col(a, 'Scott'), '114');
  assert.equal(col(a, 'Michel'), '28');
  assert.equal(col(a, 'Catalog value'), '20');
  assert.equal(col(a, 'Perforation'), '12');
  assert.equal(col(a, 'Mint or used'), 'Used');
  assert.equal(col(a, 'Centering'), 'Very fine (VF)');
  assert.equal(col(a, 'Certificate'), 'Yes');
  assert.equal(col(a, 'Set'), '1869 Pictorial Issue: 3c Locomotive');
  assert.equal(col(a, 'Tags'), 'Trains; Transport');
  assert.equal(col(a, 'Notes'), 'Bought at the "spring" show, table 4');
  assert.equal(col(a, 'Front photo'), 'photos/a-front.jpg');
  assert.equal(col(a, 'Back photo'), 'photos/a-back.jpg');

  assert.equal(col(b, 'Perforation'), '11 x 10½');
  assert.equal(col(b, 'For trade'), 'Yes');
  assert.equal(col(b, 'Design'), '\'=HYPERLINK("http://x")', 'formula neutralized');
});

test('CSV cells', () => {
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(12.5), '12.5');
  assert.equal(csvCell(true), 'Yes');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell('+1 555'), "'+1 555");
  assert.equal(csvCell('@sum'), "'@sum");
});

test('backup file name uses the local date', () => {
  assert.match(backupFileName(new Date(2026, 10, 11, 23, 30)), /^Stamp Addict backup 2026-11-11\.zip$/);
});
