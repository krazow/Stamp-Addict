// Tests for duplicate checks, statistics and spreadsheet import.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { stampsToCsv } from '../../docs/js/backup.js';
import { guessField, importRows, parseCatalogCodes, parseCsv, rowToStamp } from '../../docs/js/importcsv.js';
import { setIssuers } from '../../docs/js/issuers.js';
import { openRepos } from '../../docs/js/repos.js';
import { collectionStats } from '../../docs/js/stats.js';
import { Store } from '../../docs/js/store.js';

setIssuers(JSON.parse(readFileSync(new URL('../../docs/js/data/issuers.json', import.meta.url), 'utf8')));
const fresh = () => openRepos(new Store());

test('duplicates: same issuer and a shared catalogue number', () => {
  const r = fresh();
  const a = r.stamps.create({ issuerId: 'ceylon', country: 'Ceylon', catalogNumbers: [{ catalog: 'stanley_gibbons', number: '368' }] });
  r.stamps.create({ issuerId: 'great-britain', country: 'Great Britain', catalogNumbers: [{ catalog: 'stanley_gibbons', number: '368' }] });
  assert.deepEqual(r.stamps.findDuplicates({ issuerId: 'ceylon', catalogNumbers: [{ catalog: 'stanley_gibbons', number: ' 368 ' }] }), [a.id]);
  assert.deepEqual(r.stamps.findDuplicates({ issuerId: 'ceylon', catalogNumbers: [{ catalog: 'stanley_gibbons', number: '368' }] }, a.id), []);
  assert.deepEqual(r.stamps.findDuplicates({ issuerId: 'ceylon', catalogNumbers: [] }), []);
  const typed = r.stamps.create({ country: 'Atlantis', catalogNumbers: [{ catalog: 'scott', number: '1' }] });
  assert.deepEqual(r.stamps.findDuplicates({ country: 'atlantis', catalogNumbers: [{ catalog: 'scott', number: '1' }] }), [typed.id]);
  r.stamps.addQuantity(a.id, 2);
  assert.equal(r.stamps.get(a.id).quantity, 3);
});

test('statistics add up quantities and entered values', () => {
  const r = fresh();
  r.stamps.create({ issuerId: 'ceylon', country: 'Ceylon', year: 1935, quantity: 2, estimatedValue: 1.5, mintStatus: 'used', catalogNumbers: [{ catalog: 'stanley_gibbons', number: '368', catalogValue: 4 }] });
  r.stamps.create({ issuerId: 'united-states', country: 'United States', year: 1869, estimatedValue: 10, purchasePrice: 6 });
  r.stamps.create({ country: 'Atlantis' });
  const s = collectionStats(r);
  assert.equal(s.totals.stamps, 4);
  assert.equal(s.totals.cards, 3);
  assert.equal(s.totals.estimated, 13);
  assert.equal(s.totals.catalogue, 8);
  assert.equal(s.totals.paid, 6);
  assert.equal(s.countries, 3);
  assert.equal(s.byRegion[0].name, 'Asia');
  assert.deepEqual(s.byDecade.map((d) => d.name), ['1860s', '1930s', 'No year']);
});

test('CSV parsing: quotes, semicolons, BOM, blank lines', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\n\n1,2'), [['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']]);
  assert.deepEqual(parseCsv('Country;Year\nCeylon;1935'), [['Country', 'Year'], ['Ceylon', '1935']]);
});

test('Colnect catalogue codes and column names', () => {
  assert.deepEqual(parseCatalogCodes('Mi:AU 1931, Sn:AU 1842, Yt:AU 1831, Sg:AU 1985, Sev:AU 1837'), [
    { catalog: 'michel', number: '1931' }, { catalog: 'scott', number: '1842' }, { catalog: 'yvert_tellier', number: '1831' },
    { catalog: 'stanley_gibbons', number: '1985' }, { catalog: 'other', catalogLabel: 'Sev', number: '1837' }]);
  assert.equal(guessField('Catalog codes'), 'catalogCodes');
  assert.equal(guessField('Scott #'), 'cat:scott');
  assert.equal(guessField('Face value'), 'faceValue');
  assert.equal(guessField('Stamp ID'), null);
  const headers = ['Name', 'Country', 'Series', 'Catalog codes', 'Issued on', 'Size', 'Printing', 'Perforation', 'Emission', 'Condition'];
  const s = rowToStamp(['Palm tree', 'Ceylon', '1935 Pictorials', 'Sg:LK 368, Mi:LK 214', '1935-05-01', '24 x 30 mm', 'Recess', 'Comb 13½ x 14', 'Definitive', 'Used'], headers.map(guessField));
  assert.equal(s.issuerId, 'ceylon');
  assert.equal(s.year, 1935);
  assert.equal(s.issueDate, '1935-05-01');
  assert.equal(s.printingMethod, 'engraved');
  assert.equal(s.stampType, 'definitive');
  assert.equal(s.mintStatus, 'used');
  assert.equal(s.perfHorizontal, 13.5);
  assert.equal(s.widthMm, 24);
  assert.match(s.notes, /Series: 1935 Pictorials/);
});

test('our own CSV export imports back', () => {
  const a = fresh();
  a.stamps.create({ issuerId: 'bavaria', country: 'Bavaria', year: 1849, faceValue: '1 Kr', perfHorizontal: 11, perfVertical: 10.5, paperType: 'wove', mintStatus: 'mh', forTrade: true,
    catalogNumbers: [{ catalog: 'michel', number: '1' }, { catalog: 'scott', number: '1' }], tags: ['Classics', 'Black'], notes: 'Four margins', quantity: 2, estimatedValue: 900 });
  a.stamps.create({ country: 'Atlantis', year: 1900 });
  const rows = parseCsv(stampsToCsv(a.db));
  const yearCol = rows[0].indexOf('Year');
  rows.find((r) => r[0] === 'Atlantis')[yearCol] = '1700'; // a value the app refuses
  const b = fresh();
  const result = importRows(b, rows.slice(1), rows[0].map(guessField));
  assert.equal(result.added, 2);
  const cards = b.stamps.list().map((x) => b.stamps.get(x.id));
  const bav = cards.find((c) => c.country === 'Bavaria');
  assert.equal(bav.issuerId, 'bavaria');
  assert.equal(bav.perfVertical, 10.5);
  assert.equal(bav.paperType, 'wove');
  assert.equal(bav.mintStatus, 'mh');
  assert.equal(bav.forTrade, true);
  assert.equal(bav.quantity, 2);
  assert.deepEqual(bav.tags, ['Black', 'Classics']);
  assert.deepEqual(bav.catalogNumbers.map((c) => `${c.catalog} ${c.number}`).sort(), ['michel 1', 'scott 1']);
  assert.equal(cards.find((c) => c.country === 'Atlantis').year, null);
  assert.equal(result.fixes.length, 1);
});

test('eBay searches use the stamps category, and sold listings when asked', async () => {
  const { ebayUrl, ebayTerms } = await import('../../docs/js/lookups.js');
  const withCat = { country: 'Ceylon', year: 1935, faceValue: '2c', catalogNumbers: [{ catalog: 'stanley_gibbons', number: '368' }] };
  assert.equal(ebayTerms(withCat), 'Ceylon SG 368');
  assert.equal(ebayTerms({ country: 'Bavaria', year: 1849, faceValue: '6 Kr', designSubject: 'Crown', catalogNumbers: [] }), 'Bavaria 1849 6 Kr Crown');
  const sold = new URL(ebayUrl(withCat, { sold: true }));
  assert.equal(sold.hostname, 'www.ebay.com');
  assert.equal(sold.searchParams.get('_nkw'), 'Ceylon SG 368');
  assert.equal(sold.searchParams.get('_sacat'), '260');
  assert.equal(sold.searchParams.get('LH_Sold'), '1');
  assert.equal(new URL(ebayUrl(withCat)).searchParams.get('LH_Sold'), null);
});
