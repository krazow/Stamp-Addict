// Turns text read from a stamp photo into suggestions: the issuer (from
// its printed name, old names and native names included), face value and
// year. Small reading errors ("BAYER" for "BAYERN") are allowed for.
import { allIssuers, fold, issuerById } from './issuers.js';

/** Inscriptions printed on stamps that aren't already an issuer's name or other name. */
const INSCRIPTIONS = {
  'u s postage': 'united-states', 'us postage': 'united-states', 'united states postage': 'united-states',
  'deutsche bundespost': 'germany', 'deutsche post': 'germany', 'deutsches reich': 'germany',
  magyar: 'hungary', 'posta romana': 'romania', romana: 'romania', 'poste italiane': 'italy',
  'correos espana': 'spain', 'posta shqiptare': 'albania', 'republica portuguesa': 'portugal',
};

const clean = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();

let index = null;
function getIndex() {
  if (index && index.size === allIssuers().length) return index.entries;
  const entries = [];
  for (const i of allIssuers()) {
    for (const k of [i.name, ...(i.aliases ?? [])]) {
      const key = clean(k);
      if (key.length >= 4) entries.push({ key, words: key.split(' '), issuer: i });
    }
  }
  for (const [k, id] of Object.entries(INSCRIPTIONS)) {
    const i = issuerById(id);
    if (i) entries.push({ key: k, words: k.split(' '), issuer: i });
  }
  index = { size: allIssuers().length, entries };
  return entries;
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

const UNIT = {
  CENTAVOS: 'c', CENTIMES: 'c', CENTESIMI: 'c', CENTS: 'c', CENT: 'c', CTS: 'c', CT: 'c', C: 'c',
  PENCE: 'd', PENNY: 'd', D: 'd', ANNAS: 'a', ANNA: 'a', AN: 'a',
};
const UNITS = 'CENTAVOS|CENTIMES|CENTESIMI|CENTS|CENT|CTS|CT|PENCE|PENNY|PFENNIG|PF|KREUZER|KR|ORE|ÖRE|ANNAS|ANNA|AN|HELLER|HALER|GROSZY|GR|KOPEKS|KOP|LIRE|LEI|DIN|ZL|FT|SH|FR|RS|C|D|P|F|L|S|K|R|H|A';

/** Face values like "2c", "2½d", "6 Kr", "$1". Four-digit numbers (years) are skipped. */
export function findFaceValues(text) {
  const out = [];
  const add = (v) => { if (v && !out.includes(v)) out.push(v); };
  const up = String(text).toUpperCase().replace(/[|]/g, '1');
  const re = new RegExp(`(?<![\\d.])(\\d{1,3}(?:[.,]\\d{1,2})?\\s?[½¼¾]?|[½¼¾])\\s?(${UNITS})(?![A-Z])`, 'g');
  for (const m of up.matchAll(re)) {
    const n = m[1].replace(/\s+/g, '').replace(',', '.');
    const unit = m[2];
    add(UNIT[unit] ? `${n}${UNIT[unit]}` : `${n} ${unit[0]}${unit.slice(1).toLowerCase()}`);
  }
  for (const m of up.matchAll(/([$£€¢])\s?(\d{1,3}(?:[.,]\d{1,2})?)/g)) add(m[1] === '¢' ? `${m[2]}c` : `${m[1]}${m[2]}`);
  for (const m of up.matchAll(/(\d{1,3})\s?¢/g)) add(`${m[1]}c`);
  return out.slice(0, 3);
}

export function findYears(text) {
  return [...new Set([...String(text).matchAll(/(?<!\d)(18[4-9]\d|19\d\d|20[0-2]\d)(?!\d)/g)].map((m) => Number(m[1])))].slice(0, 3);
}

/** Issuers whose printed name (or a close reading of it) appears in the text, best first. */
export function findIssuers(text, years = []) {
  const t = ` ${clean(text)} `;
  const words = t.trim().split(' ').filter((w) => w.length >= 4);
  const best = new Map();
  const note = (issuer, via, score) => {
    const cur = best.get(issuer.id);
    if (!cur || score > cur.score) best.set(issuer.id, { issuer, via, score });
  };
  for (const e of getIndex()) {
    if (t.includes(` ${e.key} `)) { note(e.issuer, e.key, 100 + e.key.length); continue; }
    if (e.words.length === 1 && e.key.length >= 5) {
      const allowed = e.key.length >= 8 ? 2 : 1;
      for (const w of words) {
        const d = distance(w, e.key);
        if (d <= allowed) note(e.issuer, e.key, 50 + e.key.length - 10 * d);
      }
    }
  }
  const year = years[0];
  const fits = (i) => year == null || !i.from || (year >= i.from - 1 && (i.to == null || year <= i.to + 1));
  return [...best.values()]
    .map((m) => ({ ...m, score: m.score + (year == null ? 0 : fits(m.issuer) ? 30 : -30) }))
    .sort((a, b) => b.score - a.score || a.issuer.name.localeCompare(b.issuer.name))
    .slice(0, 4);
}

/** Everything suggested by the text on one stamp. */
export function identifyFromText(text) {
  const years = findYears(text);
  return { text: String(text).trim(), years, faceValues: findFaceValues(text), issuers: findIssuers(text, years) };
}
