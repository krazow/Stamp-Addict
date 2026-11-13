// Importing a collection from a spreadsheet saved as CSV: Stamp Addict's
// own stamps.csv, a Colnect export, or a collector's own sheet. Columns
// are matched by name; anything not recognised can be mapped by hand.
import { allIssuers, fold } from './issuers.js';
import {
  CATALOGS, CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PRINTING_METHODS,
  SEPARATIONS, STAMP_TYPES, TAGGINGS,
} from './lists.js';
import { ValidationError, parsePerforation } from './validation.js';

// ---- CSV ---------------------------------------------------------------

/** Splits CSV text into rows of cells. Handles quotes, "" escapes, CRLF, a BOM, and ; or tab separators. */
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const nl = text.indexOf('\n');
  const firstLine = nl === -1 ? text : text.slice(0, nl);
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length]);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

// ---- What each column can become ---------------------------------------

/** Fields a column can be imported into, with the column names that match them. */
export const IMPORT_FIELDS = [
  ['country', 'Country or issuer', ['country', 'issuer', 'issuing country', 'land', 'pays', 'nation']],
  ['year', 'Year', ['year', 'year of issue', 'issue year', 'jahr', 'annee']],
  ['issueDate', 'Issue date', ['issue date', 'issued on', 'issued', 'date of issue', 'release date']],
  ['faceValue', 'Face value', ['face value', 'facevalue', 'denomination', 'nominal', 'value printed']],
  ['designSubject', 'Design / subject', ['design', 'name', 'title', 'subject', 'description', 'stamp']],
  ['series', 'Series (kept in notes)', ['series', 'set name', 'issue']],
  ['colors', 'Colors', ['colors', 'colours', 'color', 'colour']],
  ['stampType', 'Stamp type', ['stamp type', 'type', 'emission', 'category']],
  ['catalogCodes', 'Catalogue codes (Colnect style: "Mi:AU 1931, Sn:AU 1842")', ['catalog codes', 'catalogue codes', 'catalog numbers', 'catalogue numbers', 'catalog no', 'catalogue no', 'cat no']],
  ['cat:scott', 'Scott number', ['scott', 'scott number', 'scott no', 'scott #', 'sc', 'sn']],
  ['cat:stanley_gibbons', 'Stanley Gibbons number', ['stanley gibbons', 'sg', 'sg number', 'sg no', 'gibbons']],
  ['cat:michel', 'Michel number', ['michel', 'mi', 'michel number', 'michel no', 'mi nr']],
  ['cat:yvert_tellier', 'Yvert et Tellier number', ['yvert et tellier', 'yvert', 'yt', 'y t', 'yvert no']],
  ['otherCatalogs', 'Other catalogue numbers ("Facit 12; NVPH 3")', ['other catalog numbers', 'other catalogue numbers']],
  ['catalogValue', 'Catalogue value', ['catalog value', 'catalogue value', 'cat value', 'cv']],
  ['perforation', 'Perforation', ['perforation', 'perf', 'perfs', 'perforations']],
  ['separation', 'Separation', ['separation']],
  ['watermark', 'Watermark', ['watermark', 'wmk']],
  ['paperType', 'Paper', ['paper']],
  ['printingMethod', 'Printing method', ['printing method', 'printing', 'print method', 'process']],
  ['gum', 'Gum', ['gum']],
  ['tagging', 'Tagging', ['tagging', 'phosphor']],
  ['format', 'Format', ['format']],
  ['size', 'Size ("43 x 36 mm")', ['size', 'dimensions']],
  ['widthMm', 'Width (mm)', ['width mm', 'width']],
  ['heightMm', 'Height (mm)', ['height mm', 'height']],
  ['designer', 'Designer', ['designer', 'designers', 'design by']],
  ['engraver', 'Engraver', ['engraver', 'engravers', 'engraving']],
  ['printer', 'Printer', ['printer', 'printers', 'printed by']],
  ['mintStatus', 'Mint or used', ['mint or used', 'condition', 'mint used', 'state', 'status mint']],
  ['centering', 'Centering', ['centering', 'centring']],
  ['grade', 'Grade (1–100)', ['grade']],
  ['cancellation', 'Cancellation', ['cancellation', 'cancel', 'postmark']],
  ['faults', 'Faults', ['faults', 'defects', 'flaws']],
  ['hasCertificate', 'Certificate (yes/no)', ['certificate', 'cert', 'expertized']],
  ['errorVariety', 'Error or variety', ['error or variety', 'error', 'variety', 'varieties']],
  ['plateNumber', 'Plate number', ['plate number', 'plate', 'plate no']],
  ['overprint', 'Overprint', ['overprint', 'surcharge']],
  ['shade', 'Shade', ['shade']],
  ['quantity', 'Quantity', ['quantity', 'qty', 'count', 'number owned', 'copies']],
  ['purchasePrice', 'Purchase price', ['purchase price', 'price paid', 'paid', 'cost', 'buy price']],
  ['purchaseCurrency', 'Purchase currency', ['purchase currency']],
  ['purchaseDate', 'Purchase date', ['purchase date', 'date bought', 'bought on', 'acquired']],
  ['source', 'Bought from', ['bought from', 'source', 'seller', 'dealer']],
  ['estimatedValue', 'Estimated value', ['estimated value', 'value', 'est value', 'my value', 'market value']],
  ['storageLocation', 'Stored in', ['stored in', 'location', 'album', 'storage', 'storage location']],
  ['forTrade', 'For trade (yes/no)', ['for trade', 'trade', 'swap']],
  ['tags', 'Tags ("Birds; Ships")', ['tags', 'tag', 'themes', 'theme', 'topics', 'topic']],
  ['notes', 'Notes', ['notes', 'note', 'comments', 'comment', 'remarks']],
  ['currency', 'Currency', ['currency']],
];
const FIELD_LABELS = Object.fromEntries(IMPORT_FIELDS.map(([k, l]) => [k, l]));
export const fieldLabel = (k) => FIELD_LABELS[k] ?? k;

const norm = (s) => fold(s).replace(/[^a-z0-9#]+/g, ' ').trim();
const HEADER_INDEX = new Map();
for (const [key, , names] of IMPORT_FIELDS) for (const n of names) if (!HEADER_INDEX.has(norm(n))) HEADER_INDEX.set(norm(n), key);
/** Columns that only Stamp Addict's own export has, and that aren't imported. */
const IGNORED = new Set(['front photo', 'back photo', 'other photos', 'stamp id', 'added', 'updated', 'issuer id', 'set']);

/** The field a column header most likely means, or null. */
export function guessField(header) {
  const n = norm(header);
  if (!n || IGNORED.has(n)) return null;
  if (HEADER_INDEX.has(n)) return HEADER_INDEX.get(n);
  const noNum = n.replace(/\s*(no|nr|number|#)$/, '').trim();
  return HEADER_INDEX.get(noNum) ?? null;
}

// ---- Turning cells into Stamp Card fields -------------------------------

/** Colnect's catalogue prefixes. */
const COLNECT_PREFIX = { mi: 'michel', sn: 'scott', sc: 'scott', yt: 'yvert_tellier', sg: 'stanley_gibbons', un: 'sassone', sa: 'sassone', fa: 'facit', afa: 'afa', zum: 'zumstein', ed: 'edifil', nvph: 'nvph', sak: 'sakura', jpc: 'sakura', ank: 'ank', fi: 'fischer', pof: 'pofis', rhm: 'rhm', gj: 'gj', cob: 'cob', ut: 'unitrade', acsc: 'acsc', hel: 'hellas', zag: 'zagorski' };
const NAME_TO_CATALOG = {
  scott: 'scott', sc: 'scott', sn: 'scott', 'stanley gibbons': 'stanley_gibbons', sg: 'stanley_gibbons', gibbons: 'stanley_gibbons',
  michel: 'michel', mi: 'michel', 'yvert et tellier': 'yvert_tellier', yvert: 'yvert_tellier', yt: 'yvert_tellier',
  sakura: 'sakura', facit: 'facit', unitrade: 'unitrade', acsc: 'acsc', zumstein: 'zumstein', zum: 'zumstein', edifil: 'edifil',
  sassone: 'sassone', unificato: 'sassone', nvph: 'nvph', afa: 'afa', fischer: 'fischer', ank: 'ank', hellas: 'hellas',
  zagorski: 'zagorski', pofis: 'pofis', rhm: 'rhm', gj: 'gj', cob: 'cob',
};

/** "Mi:AU 1931, Sn:AU 1842, Sev:AU 1837" -> catalogue numbers (unknown catalogues kept as "other"). */
export function parseCatalogCodes(text) {
  const out = [];
  for (const part of String(text).split(/[,;]+/)) {
    const m = part.trim().match(/^([A-Za-z]+)\s*:\s*(?:[A-Z]{2,3}\s+)?(.+)$/);
    if (!m) continue;
    const key = COLNECT_PREFIX[m[1].toLowerCase()];
    const number = m[2].trim();
    if (!number) continue;
    out.push(key ? { catalog: key, number } : { catalog: 'other', catalogLabel: m[1], number });
  }
  return out;
}

/** "Facit 12; NVPH 3" or "SG 368" -> catalogue numbers. */
function parseNamedNumbers(text) {
  const out = [];
  for (const part of String(text).split(/[;,]+/)) {
    const m = part.trim().match(/^(.*?)\s*([A-Za-z]{0,3}\d[\w./-]*)$/);
    if (!m) continue;
    const key = NAME_TO_CATALOG[norm(m[1])];
    if (key) out.push({ catalog: key, number: m[2] });
    else if (m[1].trim()) out.push({ catalog: 'other', catalogLabel: m[1].trim(), number: m[2] });
  }
  return out;
}

/** A pick-list value from a stored key, its label, or a word inside the text. */
function pickFrom(list, text, extra = {}) {
  const t = fold(text).trim();
  if (!t) return null;
  if (list.values.includes(t.replace(/\s+/g, '_'))) return t.replace(/\s+/g, '_');
  for (const v of list.values) if (fold(list.labels[v]) === t) return v;
  for (const [word, v] of Object.entries(extra)) if (t.includes(word)) return v;
  for (const v of list.values) if (t.includes(fold(list.labels[v]).split(' (')[0])) return v;
  return null;
}
const MINT_WORDS = { 'never hinged': 'mnh', mnh: 'mnh', '**': 'mnh', 'lightly hinged': 'mlh', mlh: 'mlh', hinged: 'mh', mh: 'mh', 'no gum': 'mint_no_gum', cto: 'cto', 'cancelled to order': 'cto', used: 'used', 'postally used': 'used', mint: 'mh' };
const PRINTING_WORDS = { recess: 'engraved', intaglio: 'engraved', engrav: 'engraved', 'offset lithography': 'offset', offset: 'offset', litho: 'lithography', photogravure: 'photogravure', gravure: 'photogravure', letterpress: 'typography', typograph: 'typography', emboss: 'embossed' };
const TYPE_WORDS = { commemorative: 'commemorative', definitive: 'definitive', airmail: 'airmail', 'air mail': 'airmail', 'postage due': 'postage_due', 'semi postal': 'semi_postal', charity: 'semi_postal', official: 'official', revenue: 'revenue', 'special delivery': 'special_delivery', parcel: 'parcel_post' };
const FORMAT_WORDS = { 'souvenir sheet': 'souvenir_sheet', 'mini sheet': 'souvenir_sheet', 'miniature sheet': 'souvenir_sheet', 'booklet': 'booklet_pane', 'first day cover': 'fdc', fdc: 'fdc', cover: 'cover', block: 'block', pair: 'pair', strip: 'strip', coil: 'coil', sheet: 'sheet', stamp: 'single' };
const GUM_WORDS = { 'self adhesive': 'self_adhesive', 'self-adhesive': 'self_adhesive', regum: 'regummed', 'no gum': 'no_gum', 'without gum': 'ungummed', original: 'original', pva: 'original', 'gum arabic': 'original', dextrin: 'original' };

const yes = (t) => /^(y|yes|true|1|x|ja|oui|si)$/i.test(String(t).trim());
function num(t) {
  const s = String(t ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Finds an issuer in the list by name or any of its other names. */
export function matchIssuer(name) {
  const t = fold(name);
  if (!t) return null;
  return allIssuers().find((i) => i._keys?.includes(t)) ?? null;
}

/** Turns one row into a Stamp Card input. mapping: column index -> field key (or null). */
export function rowToStamp(cells, mapping) {
  const s = { catalogNumbers: [], tags: [] };
  const notes = [];
  let catalogValue = null;
  mapping.forEach((field, i) => {
    const raw = cells[i] ?? '';
    const t = String(raw).trim();
    if (!field || !t) return;
    if (field.startsWith('cat:')) { s.catalogNumbers.push({ catalog: field.slice(4), number: t.replace(/^#/, '') }); return; }
    switch (field) {
      case 'country': s.country = t; break;
      case 'year': { const y = t.match(/\d{4}/); if (y) s.year = Number(y[0]); break; }
      case 'issueDate': {
        const d = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (d) s.issueDate = d[0];
        const y = t.match(/\d{4}/);
        if (y && s.year == null) s.year = Number(y[0]);
        break;
      }
      case 'catalogCodes': s.catalogNumbers.push(...parseCatalogCodes(t)); break;
      case 'otherCatalogs': s.catalogNumbers.push(...parseNamedNumbers(t)); break;
      case 'catalogValue': catalogValue = num(t); break;
      case 'series': notes.push(`Series: ${t}`); break;
      case 'stampType': s.stampType = pickFrom(STAMP_TYPES, t, TYPE_WORDS); break;
      case 'separation': s.separation = pickFrom(SEPARATIONS, t, { imperf: 'imperforate', roulett: 'rouletted', 'die cut': 'die_cut', perf: 'perforated' }); break;
      case 'paperType': { const v = pickFrom(PAPER_TYPES, t); if (v) s.paperType = v; else notes.push(`Paper: ${t}`); break; }
      case 'printingMethod': { const v = pickFrom(PRINTING_METHODS, t, PRINTING_WORDS); if (v) s.printingMethod = v; else notes.push(`Printing: ${t}`); break; }
      case 'gum': { const v = pickFrom(GUMS, t, GUM_WORDS); if (v) s.gum = v; else notes.push(`Gum: ${t}`); break; }
      case 'tagging': s.tagging = pickFrom(TAGGINGS, t, { phosphor: 'phosphor_bands', untagged: 'untagged', tagged: 'tagged' }); break;
      case 'format': s.format = pickFrom(FORMATS, t, FORMAT_WORDS); break;
      case 'mintStatus': s.mintStatus = pickFrom(MINT_STATUSES, t, MINT_WORDS); break;
      case 'centering': s.centering = pickFrom(CENTERINGS, t, { superb: 'superb', 'extremely fine': 'xf', xf: 'xf', 'very fine': 'vf', vf: 'vf', 'very good': 'vg', vg: 'vg', fine: 'f', good: 'g' }); break;
      case 'perforation': {
        const p = parsePerforation(t.replace(/^[a-z ]*?(?=\d)/i, ''));
        if (p) { s.perfHorizontal = p.horizontal; s.perfVertical = p.vertical; } else notes.push(`Perforation: ${t}`);
        if (/imperf/i.test(t)) s.separation = 'imperforate';
        break;
      }
      case 'size': { const m = t.match(/([\d.,]+)\s*[x×]\s*([\d.,]+)/); if (m) { s.widthMm = num(m[1]); s.heightMm = num(m[2]); } break; }
      case 'widthMm': case 'heightMm': case 'grade': case 'purchasePrice': case 'estimatedValue': s[field] = num(t); break;
      case 'quantity': { const n = num(t); if (n != null) s.quantity = Math.max(0, Math.round(n)); break; }
      case 'hasCertificate': case 'forTrade': s[field] = yes(t); break;
      case 'purchaseDate': { const d = t.match(/^\d{4}-\d{2}-\d{2}/); if (d) s.purchaseDate = d[0]; else notes.push(`Bought: ${t}`); break; }
      case 'tags': s.tags.push(...t.split(/[;|,]+/).map((x) => x.trim()).filter(Boolean)); break;
      case 'notes': notes.unshift(t); break;
      default: s[field] = t;
    }
  });
  if (catalogValue != null && s.catalogNumbers[0]) s.catalogNumbers[0].catalogValue = catalogValue;
  if (s.country) {
    const i = matchIssuer(s.country);
    if (i) { s.issuerId = i.id; s.country = i.name; }
  }
  if (notes.length) s.notes = notes.join('\n');
  // Keep the per-stamp limits (one tag spelling, 50 characters).
  s.tags = [...new Map(s.tags.map((t) => [t.toLowerCase(), t.slice(0, 50)])).values()];
  return s;
}

/** A row worth importing has something in it beyond an empty card. */
const hasContent = (s) => Object.entries(s).some(([k, v]) => (Array.isArray(v) ? v.length : v != null && v !== '' && k !== 'quantity'));

/**
 * Adds every row as a new stamp, in one go. A value that fails a check
 * (a year of 1700, say) is left out of that stamp and reported, rather than
 * losing the whole row.
 */
export function importRows(repos, rows, mapping) {
  const result = { added: 0, skipped: 0, fixes: [], matchedIssuers: 0, typedIssuers: new Set() };
  repos.db.transaction(() => {
    rows.forEach((cells, n) => {
      const input = rowToStamp(cells, mapping);
      if (!hasContent(input)) { result.skipped++; return; }
      for (let tries = 0; tries < 12; tries++) {
        try {
          repos.stamps.create(input);
          result.added++;
          if (input.issuerId) result.matchedIssuers++;
          else if (input.country) result.typedIssuers.add(input.country);
          return;
        } catch (e) {
          if (!(e instanceof ValidationError)) throw e;
          const field = e.field.replace(/\[.*$/, '');
          result.fixes.push(`Row ${n + 2}: left out ${fieldLabel(field) === field ? field : fieldLabel(field)} (${e.detail})`);
          if (field === 'catalogNumbers' || field === 'photos' || field === 'tags') input[field] = [];
          else delete input[field];
          if (field === 'perfHorizontal' || field === 'perfVertical') { delete input.perfHorizontal; delete input.perfVertical; }
        }
      }
      result.skipped++;
    });
  });
  return result;
}
