import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openNodeDatabase } from './node-sqlite';
import { NotFoundError, ValidationError, openStampStore } from '../index';

function store() {
  return openStampStore(openNodeDatabase());
}

function pictorialSet(sets: ReturnType<typeof store>['sets']) {
  return sets.create({
    name: '1869 Pictorial Issue',
    country: 'United States',
    year: 1869,
    items: [
      { label: '1c Franklin', faceValue: '1c', catalog: 'scott', catalogNumber: '112' },
      { label: '2c Post Rider', faceValue: '2c', catalog: 'scott', catalogNumber: '113' },
      { label: '3c Locomotive', faceValue: '3c', catalog: 'scott', catalogNumber: '114' },
      { label: '6c Washington', faceValue: '6c' }, // no catalog number: must be linked by hand
    ],
  });
}

test('set completion: counts linked stamps and catalog-number matches', () => {
  const { sets, stamps } = store();
  const set = pictorialSet(sets);

  let c = sets.completion(set.id);
  assert.equal(c.total, 4);
  assert.equal(c.owned, 0);
  assert.equal(c.percent, 0);

  // Matched automatically by catalog number (capitals ignored)
  stamps.create({ catalogNumbers: [{ catalog: 'scott', number: '114' }] });
  // Linked by hand
  const washington = stamps.create({ designSubject: 'Washington' });
  sets.linkStamp(washington.id, set.items[3].id);

  c = sets.completion(set.id);
  assert.equal(c.owned, 2);
  assert.equal(c.percent, 50);
  assert.deepEqual(c.missing.map((m) => m.label), ['1c Franklin', '2c Post Rider']);
  assert.deepEqual(c.items.find((i) => i.label === '6c Washington')?.stampIds, [washington.id]);

  // A Michel number with the same digits does not count
  stamps.create({ catalogNumbers: [{ catalog: 'michel', number: '112' }] });
  assert.equal(sets.completion(set.id).owned, 2);
});

test('deleting a stamp frees its set slot', () => {
  const { sets, stamps } = store();
  const set = pictorialSet(sets);
  const s = stamps.create();
  sets.linkStamp(s.id, set.items[0].id);
  assert.equal(sets.completion(set.id).owned, 1);
  stamps.delete(s.id);
  assert.equal(sets.completion(set.id).owned, 0);
});

test('progress across all sets and by country', () => {
  const { sets, stamps } = store();
  const us = pictorialSet(sets);
  sets.create({ name: 'Penny Black', country: 'Great Britain', year: 1840,
    items: [{ label: '1d black', catalog: 'stanley_gibbons', catalogNumber: '2' }] });
  stamps.create({ catalogNumbers: [{ catalog: 'stanley_gibbons', number: '2' }] });
  stamps.create({ catalogNumbers: [{ catalog: 'scott', number: '112' }] });

  const all = sets.allCompletion();
  assert.deepEqual(all.map((s) => [s.name, s.percent]), [['1869 Pictorial Issue', 25], ['Penny Black', 100]]);
  assert.deepEqual(sets.completionByCountry(), [
    { country: 'Great Britain', sets: 1, total: 1, owned: 1, percent: 100 },
    { country: 'United States', sets: 1, total: 4, owned: 1, percent: 25 },
  ]);
  sets.delete(us.id);
  assert.equal(sets.allCompletion().length, 1);
});

test('find which set a slot belongs to, and list sets with their slots', () => {
  const { sets } = store();
  const set = pictorialSet(sets);
  const found = sets.findItem(set.items[2].id);
  assert.equal(found?.setName, '1869 Pictorial Issue');
  assert.equal(found?.item.label, '3c Locomotive');
  assert.equal(found?.total, 4);
  assert.equal(sets.findItem('nope'), null);
  assert.deepEqual(sets.listWithItems().map((s) => s.items.length), [4]);
});

test('set validation', () => {
  const { sets } = store();
  assert.throws(() => sets.create({ name: '', items: [{ label: 'x' }] }), ValidationError);
  assert.throws(() => sets.create({ name: 'Empty', items: [] }), ValidationError);
  assert.throws(() => sets.linkStamp('nope', null), NotFoundError);
});

test('want list: add, order by priority, edit, remove', () => {
  const { wants } = store();
  wants.add({ description: 'Inverted Jenny', catalog: 'scott', catalogNumber: 'C3a', priority: 'low', maxPrice: 2_000_000 });
  const b = wants.add({ description: 'Bluenose', country: 'Canada', priority: 'high', wantedCondition: 'mnh' });
  wants.add({ description: 'Any Penny Red' });

  assert.deepEqual(wants.list().map((w) => w.description), ['Bluenose', 'Any Penny Red', 'Inverted Jenny']);
  assert.deepEqual(wants.list({ priority: 'high' }).map((w) => w.id), [b.id]);

  const edited = wants.update(b.id, { maxPrice: 150, notes: 'From a dealer with a certificate' });
  assert.equal(edited.maxPrice, 150);
  assert.equal(edited.description, 'Bluenose');

  wants.remove(b.id);
  assert.equal(wants.list().length, 2);
  assert.throws(() => wants.add({ description: ' ' }), ValidationError);
  assert.throws(() => wants.add({ description: 'x', priority: 'urgent' as never }), ValidationError);
});

test('want list: add a set\'s missing stamps once, without duplicates', () => {
  const { wants, sets, stamps } = store();
  const set = pictorialSet(sets);
  stamps.create({ catalogNumbers: [{ catalog: 'scott', number: '113' }] });

  const added = wants.addMissingFromSet(sets, set.id, 'high');
  assert.deepEqual(added.map((w) => w.description), [
    '1869 Pictorial Issue: 1c Franklin',
    '1869 Pictorial Issue: 3c Locomotive',
    '1869 Pictorial Issue: 6c Washington',
  ]);
  assert.equal(added[0].country, 'United States');
  assert.equal(added[0].catalogNumber, '112');
  assert.equal(wants.addMissingFromSet(sets, set.id).length, 0); // already listed
});

test('want list: a new stamp finds the wants it fills, and can check them off', () => {
  const { wants, sets, stamps } = store();
  const set = pictorialSet(sets);
  wants.addMissingFromSet(sets, set.id);
  const jenny = wants.add({ description: 'Inverted Jenny', catalog: 'scott', catalogNumber: 'C3a' });

  const s = stamps.create({ catalogNumbers: [{ catalog: 'scott', number: 'c3A' }] });
  const matches = wants.matchesForStamp(s.id);
  assert.deepEqual(matches.map((w) => w.id), [jenny.id]);

  const done = wants.markAcquired(jenny.id, s.id);
  assert.equal(done.acquiredStampId, s.id);
  assert.ok(done.acquiredAt);
  assert.equal(wants.list().some((w) => w.id === jenny.id), false);
  assert.equal(wants.list({ includeAcquired: true }).some((w) => w.id === jenny.id), true);
  assert.deepEqual(wants.matchesForStamp(s.id), []); // already checked off

  // Matching by set slot
  const w = stamps.create();
  sets.linkStamp(w.id, set.items[3].id);
  assert.deepEqual(wants.matchesForStamp(w.id).map((m) => m.description), ['1869 Pictorial Issue: 6c Washington']);
});

test('set list text: one stamp per line, optional catalog number', async () => {
  const { parseSetItems } = await import('../setText');
  assert.deepEqual(parseSetItems('1c Franklin | Scott 112\n\n 2½d Rose | SG 62 \nPenny Black\n90c Lincoln | Mystery 9\nAirmail | Scott C3a'), [
    { label: '1c Franklin', faceValue: '1c', catalog: 'scott', catalogNumber: '112' },
    { label: '2½d Rose', faceValue: '2½d', catalog: 'stanley_gibbons', catalogNumber: '62' },
    { label: 'Penny Black' },
    { label: '90c Lincoln', faceValue: '90c' },
    { label: 'Airmail', catalog: 'scott', catalogNumber: 'C3a' },
  ]);
});
