// Tests for the web app's data layer: node --test tests/web
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  BackupError, backupFileName, createBackupZip, readBackupZip, restoreBackup, stampsToCsv, validateData,
} from '../../docs/js/backup.js';
import { openRepos, parseSetItems } from '../../docs/js/repos.js';
import { Store } from '../../docs/js/store.js';
import { ValidationError, formatPerforation, parsePerforation } from '../../docs/js/validation.js';
import { openZip } from '../../docs/js/zip.js';

const fresh = () => openRepos(new Store());

test('a Stamp Card with every list round-trips', () => {
  const { stamps } = fresh();
  const c = stamps.create({
    country: ' United States ', year: 1869, faceValue: '3c', designSubject: 'Locomotive', mintStatus: 'used',
    perfHorizontal: 12, perfVertical: 12, forTrade: true, notes: '',
    catalogNumbers: [{ catalog: 'scott', number: '114' }, { catalog: 'stanley_gibbons', number: '117' }],
    photos: [{ role: 'front', uri: 'photos/a.jpg', width: 10, height: 12 }],
    tags: ['Trains', 'trains', 'Pictorial'],
  });
  assert.equal(c.country, 'United States');
  assert.equal(c.notes, null);
  assert.equal(c.forTrade, true);
  assert.equal(c.quantity, 1);
  assert.deepEqual(c.tags, ['Pictorial', 'Trains']);
  assert.equal(c.catalogNumbers[0].catalog, 'scott');
  const list = stamps.list();
  assert.equal(list[0].thumbnailUri, 'photos/a.jpg');
  assert.equal(list[0].primaryCatalog, 'Scott 114');
});

test('validation rejects bad values and keeps the store unchanged', () => {
  const { stamps, db } = fresh();
  assert.throws(() => stamps.create({ year: 1700 }), ValidationError);
  assert.throws(() => stamps.create({ mintStatus: 'nope' }), ValidationError);
  assert.throws(() => stamps.create({ photos: [{ role: 'front', uri: 'a' }, { role: 'front', uri: 'b' }] }), ValidationError);
  assert.equal(db.rows('stamps').length, 0);
});

test('update replaces given lists, keeps others; delete cascades', () => {
  const { stamps, wants, db } = fresh();
  const c = stamps.create({ tags: ['A'], catalogNumbers: [{ catalog: 'scott', number: '1' }] });
  const u = stamps.update(c.id, { year: 1900, tags: ['B'] });
  assert.equal(u.year, 1900);
  assert.deepEqual(u.tags, ['B']);
  assert.equal(u.catalogNumbers.length, 1);
  assert.equal(db.rows('tags').length, 1);
  const w = wants.add({ description: 'x', catalog: 'scott', catalogNumber: '1' });
  wants.markAcquired(w.id, c.id);
  stamps.delete(c.id);
  assert.equal(db.rows('catalog_numbers').length, 0);
  assert.equal(db.rows('tags').length, 0);
  assert.equal(wants.get(w.id).acquiredStampId, null);
});

test('transactions roll back fully', () => {
  const { db } = fresh();
  assert.throws(() => db.transaction(() => { db.insert('tags', { id: '1', name: 'x' }); throw new Error('boom'); }));
  assert.equal(db.rows('tags').length, 0);
});

test('set completion by link and by catalog number; want matches', () => {
  const { stamps, sets, wants } = fresh();
  const set = sets.create({ name: '1869 Pictorial', country: 'US', year: 1869, items: parseSetItems('1c Franklin | Scott 112\n2c Post Rider | SG 2\n3c Locomotive') });
  assert.equal(set.items[0].faceValue, '1c');
  assert.equal(set.items[1].catalog, 'stanley_gibbons');
  stamps.create({ catalogNumbers: [{ catalog: 'scott', number: '112' }] });
  const linked = stamps.create({ setItemId: set.items[2].id });
  let comp = sets.completion(set.id);
  assert.equal(comp.owned, 2);
  assert.equal(comp.percent, 67);
  const added = wants.addMissingFromSet(sets, set.id);
  assert.equal(added.length, 1);
  assert.equal(wants.addMissingFromSet(sets, set.id).length, 0);
  const got = stamps.create({ catalogNumbers: [{ catalog: 'stanley_gibbons', number: '2' }] });
  assert.equal(wants.matchesForStamp(got.id).length, 1);
  comp = sets.completion(set.id);
  assert.equal(comp.percent, 100);
  assert.equal(sets.completionByCountry()[0].percent, 100);
  sets.delete(set.id);
  assert.equal(stamps.get(linked.id).setItemId, null);
});

test('perforation parsing', () => {
  assert.deepEqual(parsePerforation('11 x 10½'), { horizontal: 11, vertical: 10.5 });
  assert.equal(formatPerforation(12, 12), '12');
  assert.equal(parsePerforation('abc'), null);
});

test('backup round trip restores records and photos', async () => {
  const a = fresh();
  a.stamps.create({ country: 'Canada', photos: [{ role: 'front', uri: 'photos/f1.jpg' }], tags: ['Ships'] });
  a.stamps.create({ country: '=cmd', photos: [{ role: 'front', uri: 'photos/missing.jpg' }] });
  const photo = new Uint8Array([1, 2, 3, 255]);
  const made = await createBackupZip(a.db, { readPhoto: async (p) => (p === 'photos/f1.jpg' ? photo : null) }, { appVersion: '0.2.0' });
  assert.deepEqual(made.missingPhotos, ['photos/missing.jpg']);
  const parsed = await readBackupZip(made.bytes);
  assert.equal(parsed.manifest.counts.stamps, 2);
  const b = fresh();
  b.stamps.create({ country: 'Old' });
  const written = new Map();
  const summary = await restoreBackup(b.db, parsed, { writePhoto: async (p, bytes) => written.set(p, bytes) });
  assert.equal(summary.stamps, 2);
  assert.deepEqual([...written.get('photos/f1.jpg')], [...photo]);
  assert.deepEqual(b.stamps.list().map((s) => s.country).sort(), ['=cmd', 'Canada']);
  const csv = stampsToCsv(b.db);
  assert.ok(csv.startsWith('﻿Country,Year'));
  assert.ok(csv.includes("'=cmd"));
  assert.match(backupFileName(), /^Stamp Addict backup \d{4}-\d{2}-\d{2}\.zip$/);
});

test('our zips open in a standard zip tool, and its zips open here', async () => {
  const { db, stamps } = fresh();
  stamps.create({ country: 'Österreich', photos: [{ role: 'front', uri: 'photos/p.jpg' }] });
  const made = await createBackupZip(db, { readPhoto: async () => new Uint8Array(5000).fill(7) });
  const dir = mkdtempSync(join(tmpdir(), 'sa-'));
  writeFileSync(join(dir, 'ours.zip'), made.bytes);
  const py = `
import zipfile, json, sys
z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
d = json.loads(z.read('data.json')); assert d['tables']['stamps'][0]['country'] == 'Österreich'
out = zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED)
for n in z.namelist(): out.writestr(n, z.read(n))
out.close()`;
  execFileSync('python3', ['-c', py, join(dir, 'ours.zip'), join(dir, 'theirs.zip')]);
  const parsed = await readBackupZip(new Uint8Array(readFileSync(join(dir, 'theirs.zip'))));
  assert.equal(parsed.data.tables.stamps[0].country, 'Österreich');
  assert.equal(parsed.photos.get('photos/p.jpg').length, 5000);
});

test('bad files are refused with a clear message', async () => {
  await assert.rejects(readBackupZip(new Uint8Array([1, 2, 3])), BackupError);
  assert.throws(() => validateData({ format: 'x' }), BackupError);
  assert.throws(() => validateData({ format: 'stamp-addict-backup', formatVersion: 9, schemaVersion: 1, tables: {} }), /newer version/);
  const ok = validateData({ format: 'stamp-addict-backup', formatVersion: 1, schemaVersion: 2, tables: { stamps: [{ id: 'a', extra: 'ignored' }] } });
  assert.equal(ok.tables.stamps[0].quantity, 1);
  assert.equal('extra' in ok.tables.stamps[0], false);
  assert.ok(openZip);
});
