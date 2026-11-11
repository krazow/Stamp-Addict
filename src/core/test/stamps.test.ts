import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { openNodeDatabase } from './node-sqlite';
import { migrate, MIGRATIONS } from '../migrations';
import { SCHEMA_V1 } from '../schema.generated';
import { NotFoundError, ValidationError, formatPerforation, openStampStore, parsePerforation } from '../index';

function store() {
  const db = openNodeDatabase();
  return openStampStore(db);
}

test('embedded schema matches db/schema.sql', () => {
  const file = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  assert.equal(SCHEMA_V1, file, 'run: npm run schema');
});

test('migrations run once and record the version', () => {
  const db = openNodeDatabase();
  assert.equal(migrate(db), MIGRATIONS.length);
  assert.equal(migrate(db), MIGRATIONS.length); // second run is a no-op
  assert.equal(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version, MIGRATIONS.length);
});

test('a Stamp Card can be created with no details at all', () => {
  const { stamps } = store();
  const card = stamps.create();
  assert.equal(card.country, null);
  assert.equal(card.quantity, 1);
  assert.equal(card.forTrade, false);
  assert.deepEqual(card.catalogNumbers, []);
  assert.deepEqual(card.photos, []);
  assert.deepEqual(card.tags, []);
});

test('create and read back a full Stamp Card', () => {
  const { stamps } = store();
  const card = stamps.create({
    country: 'United States',
    year: 1869,
    faceValue: '3c',
    colors: 'ultramarine',
    designSubject: 'Locomotive',
    stampType: 'definitive',
    perfHorizontal: 12,
    perfVertical: 12,
    separation: 'perforated',
    printingMethod: 'engraved',
    mintStatus: 'used',
    centering: 'vf',
    grade: 80,
    hasCertificate: true,
    estimatedValue: 25,
    catalogNumbers: [
      { catalog: 'michel', number: '28' },
      { catalog: 'scott', number: '114', catalogValue: 20, valueCurrency: 'USD', edition: '2027' },
    ],
    photos: [
      { role: 'detail', uri: 'file:///p/grill.jpg', caption: 'Grill' },
      { role: 'back', uri: 'file:///p/back.jpg' },
      { role: 'front', uri: 'file:///p/front.jpg', width: 800, height: 900 },
    ],
    tags: ['Trains', ' Transport ', 'trains'],
  });

  const again = stamps.get(card.id);
  assert.equal(again.country, 'United States');
  assert.equal(again.year, 1869);
  assert.equal(again.hasCertificate, true);
  assert.equal(again.perfHorizontal, 12);
  // Scott listed first, then Michel
  assert.deepEqual(again.catalogNumbers.map((c) => `${c.catalog} ${c.number}`), ['scott 114', 'michel 28']);
  assert.equal(again.catalogNumbers[0].catalogValue, 20);
  // Front, then back, then the rest
  assert.deepEqual(again.photos.map((p) => p.role), ['front', 'back', 'detail']);
  // Tags trimmed and de-duplicated regardless of capitals
  assert.deepEqual(again.tags, ['Trains', 'Transport']);
});

test('blank text is stored as "not recorded"', () => {
  const { stamps } = store();
  const card = stamps.create({ country: '   ', notes: '' });
  assert.equal(card.country, null);
  assert.equal(card.notes, null);
});

test('edit changes only the given fields, and lists replace when given', () => {
  const { stamps } = store();
  const card = stamps.create({
    country: 'Canada', year: 1851, tags: ['Animals'],
    photos: [{ role: 'front', uri: 'a.jpg' }],
    catalogNumbers: [{ catalog: 'scott', number: '1' }],
  });
  const edited = stamps.update(card.id, { year: 1852, notes: 'Beaver', tags: ['Animals', 'Beavers'] });
  assert.equal(edited.country, 'Canada'); // untouched
  assert.equal(edited.year, 1852);
  assert.equal(edited.notes, 'Beaver');
  assert.deepEqual(edited.tags, ['Animals', 'Beavers']);
  assert.equal(edited.photos.length, 1); // list left out is kept
  assert.equal(edited.catalogNumbers.length, 1);

  const cleared = stamps.update(card.id, { year: null, photos: [] });
  assert.equal(cleared.year, null);
  assert.deepEqual(cleared.photos, []);
});

test('back-of-stamp photo: one front and one back per stamp', () => {
  const { stamps } = store();
  assert.throws(
    () => stamps.create({ photos: [{ role: 'back', uri: 'a' }, { role: 'back', uri: 'b' }] }),
    (e: unknown) => e instanceof ValidationError && e.field === 'photos',
  );
  const card = stamps.create({ photos: [{ role: 'detail', uri: 'a' }, { role: 'detail', uri: 'b' }] });
  assert.equal(card.photos.length, 2); // any number of close-ups
});

test('validation names the field that is wrong', () => {
  const { stamps } = store();
  const cases: Array<[Parameters<typeof stamps.create>[0], string]> = [
    [{ year: 1700 }, 'year'],
    [{ perfHorizontal: 30 }, 'perfHorizontal'],
    [{ grade: 101 }, 'grade'],
    [{ centering: 'amazing' as never }, 'centering'],
    [{ issueDate: '12/1/1900' }, 'issueDate'],
    [{ catalogNumbers: [{ catalog: 'scott', number: ' ' }] }, 'catalogNumbers[0].number'],
    [{ tags: [''] }, 'tags[0]'],
  ];
  for (const [input, field] of cases) {
    assert.throws(() => stamps.create(input), (e: unknown) => e instanceof ValidationError && e.field === field, field);
  }
});

test('a failed save leaves nothing half-written', () => {
  const { stamps, db } = store();
  const card = stamps.create({ country: 'France', tags: ['Art'] });
  // Database rejects a duplicate catalog number inside one save
  assert.throws(() => stamps.update(card.id, {
    country: 'Belgium',
    catalogNumbers: [{ catalog: 'scott', number: '5' }, { catalog: 'scott', number: '5' }],
  }));
  assert.equal(stamps.get(card.id).country, 'France');
  assert.equal(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM stamps')?.n, 1);
});

test('delete removes the card with its photos, numbers and unused tags', () => {
  const { stamps, db } = store();
  const card = stamps.create({ photos: [{ role: 'front', uri: 'x' }], catalogNumbers: [{ catalog: 'scott', number: '9' }], tags: ['Ships'] });
  stamps.update(card.id, { tags: [] });
  assert.deepEqual(stamps.allTags(), []);
  stamps.delete(card.id);
  assert.throws(() => stamps.get(card.id), NotFoundError);
  assert.equal(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM photos')?.n, 0);
  assert.equal(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM catalog_numbers')?.n, 0);
  assert.throws(() => stamps.delete(card.id), NotFoundError);
});

test('list gives grid rows with thumbnail and main catalog number, filterable by tag', () => {
  const { stamps } = store();
  stamps.create({ country: 'Norway', designSubject: 'Lion', tags: ['Heraldry'] });
  stamps.create({
    country: 'Japan', year: 1949, designSubject: 'Crane', tags: ['Birds'],
    photos: [{ role: 'front', uri: 'crane.jpg' }],
    catalogNumbers: [{ catalog: 'sakura', number: 'C140' }, { catalog: 'scott', number: '476' }],
  });
  const all = stamps.list();
  assert.equal(all.length, 2);
  assert.equal(all[0].country, 'Japan'); // newest first
  assert.equal(all[0].thumbnailUri, 'crane.jpg');
  assert.equal(all[0].primaryCatalog, 'Scott 476');
  const birds = stamps.list({ tag: 'BIRDS' });
  assert.deepEqual(birds.map((s) => s.designSubject), ['Crane']);
  assert.deepEqual(stamps.allTags(), [{ name: 'Birds', count: 1 }, { name: 'Heraldry', count: 1 }]);
});

test('perforation is read and written the way collectors write it', () => {
  assert.deepEqual(parsePerforation('11'), { horizontal: 11, vertical: 11 });
  assert.deepEqual(parsePerforation('11 x 10½'), { horizontal: 11, vertical: 10.5 });
  assert.deepEqual(parsePerforation('Perf 12½x13'), { horizontal: 12.5, vertical: 13 });
  assert.deepEqual(parsePerforation('10.5 × 11'), { horizontal: 10.5, vertical: 11 });
  assert.equal(parsePerforation('about eleven'), null);
  assert.equal(formatPerforation(11, 10.5), '11 x 10½');
  assert.equal(formatPerforation(12, 12), '12');
  assert.equal(formatPerforation(13.25, 13.75), '13¼ x 13¾');
});
