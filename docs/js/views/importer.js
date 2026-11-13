// Import stamps from a spreadsheet saved as CSV. Choose the file, check
// which column goes where, then add the rows as new Stamp Cards.
import { app, go } from '../app.js';
import { stampTitle } from '../format.js';
import { IMPORT_FIELDS, guessField, importRows, parseCsv, rowToStamp } from '../importcsv.js';
import { CATALOG_SHORT } from '../lists.js';
import { button, chooseFile, h, icon, select, tell } from '../ui.js';

let pending = null; // { name, header, rows, mapping }

const FIELD_OPTIONS = IMPORT_FIELDS.map(([value, label]) => ({ value, label }));

export function importView() {
  const body = h('div', { class: 'stack' });
  const draw = () => body.replaceChildren(...(pending ? mappingStep() : chooseStep()));

  const choose = async () => {
    const file = await chooseFile('.csv,text/csv,.txt,.tsv');
    if (!file) return;
    if (/\.(xlsx?|numbers|ods)$/i.test(file.name)) {
      tell('Save it as CSV first', 'This file is a spreadsheet workbook. In Excel choose File > Save As > CSV; in Google Sheets, File > Download > CSV; in Numbers, File > Export To > CSV. Then choose that file.');
      return;
    }
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { tell('Nothing to import', 'The file needs a header row with column names, and at least one row of stamps.'); return; }
    const width = Math.max(...rows.map((r) => r.length));
    const header = Array.from({ length: width }, (_, i) => rows[0][i] ?? `Column ${i + 1}`);
    pending = { name: file.name, header, rows: rows.slice(1), mapping: header.map(guessField) };
    draw();
  };

  const chooseStep = () => [
    h('p', {}, 'Add stamps from a spreadsheet saved as a CSV file. It can be the stamps.csv inside a Stamp Addict backup, a collection exported from Colnect, or your own sheet with column names in the first row.'),
    h('ul', { class: 'plain-list small' },
      h('li', {}, 'Imported stamps are added to your collection. Nothing already there is changed.'),
      h('li', {}, 'Countries are matched to the list of issuers, including old names. Colnect catalogue codes such as "Mi:AU 1931, Sn:AU 1842" are understood.'),
      h('li', {}, 'Photos aren\'t imported; add them to each Stamp Card afterwards.')),
    button(h('span', { class: 'with-icon' }, icon('download', 20), 'Choose a CSV file'), choose),
    h('p', { class: 'small muted' }, 'Working in Excel, Numbers or Google Sheets? Save or download the sheet as CSV first.'),
  ];

  const mappingStep = () => {
    const { header, rows, mapping, name } = pending;
    const sample = (i) => rows.map((r) => (r[i] ?? '').trim()).find(Boolean) ?? '';
    const preview = h('div', { class: 'rows' });
    const drawPreview = () => preview.replaceChildren(...rows.slice(0, 3).map((r) => {
      const s = rowToStamp(r, mapping);
      const cat = s.catalogNumbers[0];
      return h('div', { class: 'row' }, h('div', { class: 'row-text' },
        h('div', { class: 'row-title' }, stampTitle(s)),
        h('div', { class: 'row-sub' }, [s.country, s.year, cat ? `${CATALOG_SHORT[cat.catalog] || cat.catalogLabel || ''} ${cat.number}`.trim() : null, s.issuerId ? null : s.country ? 'country not in the list' : null].filter(Boolean).join(' · '))));
    }));
    drawPreview();
    const recognised = mapping.filter(Boolean).length;
    const doImport = () => {
      if (!mapping.some(Boolean)) { tell('Nothing to import', 'Choose what at least one column holds.'); return; }
      const result = importRows(app.repos, rows, mapping);
      pending = null;
      const lines = [`Added ${result.added} ${result.added === 1 ? 'stamp' : 'stamps'}.`];
      if (result.matchedIssuers) lines.push(`${result.matchedIssuers} matched to a country in the list.`);
      if (result.typedIssuers.size) lines.push(`Not in the list, kept as typed: ${[...result.typedIssuers].slice(0, 6).join(', ')}${result.typedIssuers.size > 6 ? ', …' : ''}.`);
      if (result.skipped) lines.push(`${result.skipped} empty or unusable ${result.skipped === 1 ? 'row was' : 'rows were'} skipped.`);
      if (result.fixes.length) lines.push(`${result.fixes.length} ${result.fixes.length === 1 ? 'value was' : 'values were'} left out because the app couldn't accept ${result.fixes.length === 1 ? 'it' : 'them'}, for example: ${result.fixes[0]}.`);
      tell('Import finished', lines.join(' ')).then(() => go('', { replace: true }));
    };
    return [
      h('div', { class: 'filter-summary' }, h('span', {}, `${name}: ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}, ${recognised} of ${header.length} columns recognised.`),
        button('Choose another', () => { pending = null; draw(); }, 'text')),
      h('p', { class: 'small muted' }, 'Check what each column holds. Choose "Don\'t import" for columns you don\'t need.'),
      h('div', { class: 'map-list' }, header.map((col, i) => h('div', { class: 'map-row' },
        h('div', { class: 'map-col' }, h('div', { class: 'strong small' }, col), h('div', { class: 'small muted ellipsis' }, sample(i) || 'empty')),
        select(null, FIELD_OPTIONS, mapping[i], (v) => { mapping[i] = v; drawPreview(); }, { placeholder: 'Don\'t import' })))),
      h('h3', { class: 'heading' }, 'First stamps, as they\'ll be added'),
      preview,
      button(`Import ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`, doImport),
    ];
  };

  draw();
  return { title: 'Import from a spreadsheet', body };
}
