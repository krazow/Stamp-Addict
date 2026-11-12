// Stamp issuers: every country, territory, colony, city-state and other
// "realm" that has issued stamps, with the names collectors search by.
// The list lives in data/issuers.json (built from data/issuers/*.json).

export const REGIONS = ['Americas', 'Europe', 'Africa', 'Asia', 'Oceania', 'Atlantic & Antarctic', 'International'];
export const SUBREGIONS = {
  Americas: ['North America', 'Central America', 'Caribbean', 'South America'],
  Europe: ['Western Europe', 'Northern Europe', 'Central Europe', 'Eastern Europe', 'Southern Europe'],
  Africa: ['North Africa', 'West Africa', 'Central Africa', 'East Africa', 'Southern Africa', 'Indian Ocean'],
  Asia: ['Middle East', 'Central Asia', 'South Asia', 'East Asia', 'Southeast Asia'],
  Oceania: ['Oceania'],
  'Atlantic & Antarctic': ['Atlantic', 'Antarctic'],
  International: ['International'],
};
export const TYPE_LABELS = {
  country: 'Country', colony: 'Colony', territory: 'Territory', protectorate: 'Protectorate',
  mandate: 'Mandate', occupation: 'Occupation', city_state: 'City-state', princely_state: 'Princely state',
  state: 'State', local: 'Local post', agency: 'Agency', other: 'Other',
};

let list = [];
let byId = new Map();

/** Folds case and accents so "cote d'ivoire" finds "Côte d'Ivoire". */
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").trim();

export function setIssuers(data) {
  list = [...data].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  for (const i of list) i._keys = [i.name, ...(i.aliases ?? [])].map(fold);
  byId = new Map(list.map((i) => [i.id, i]));
}

export async function loadIssuers() {
  const res = await fetch(new URL('./data/issuers.json', import.meta.url));
  if (!res.ok) throw new Error('The list of countries couldn\'t be loaded.');
  setIssuers(await res.json());
}

export const allIssuers = () => list;
export const issuerById = (id) => (id ? byId.get(id) ?? null : null);

/** Best matches first: name starts with the text, then a word starts with it, then anywhere. */
export function searchIssuers(text, limit = 60) {
  const q = fold(text);
  if (!q) return [];
  const scored = [];
  for (const i of list) {
    let best = null;
    i._keys.forEach((k, n) => {
      const score = k === q ? 0 : k.startsWith(q) ? 1 : k.split(/[\s\-(/]+/).some((w) => w.startsWith(q)) ? 2 : k.includes(q) ? 3 : null;
      if (score !== null && (!best || score < best.score)) best = { score: score + (n > 0 ? 0.5 : 0), alias: n > 0 ? i.aliases[n - 1] : null };
    });
    if (best) scored.push({ issuer: i, ...best });
  }
  scored.sort((a, b) => a.score - b.score || a.issuer.name.localeCompare(b.issuer.name));
  return scored.slice(0, limit);
}

/** Issuers grouped for browsing: [{ region, subregions: [{ name, issuers }] }]. */
export function groupedIssuers(filter = () => true) {
  return REGIONS.map((region) => ({
    region,
    subregions: SUBREGIONS[region]
      .map((name) => ({ name, issuers: list.filter((i) => i.region === region && i.subregion === name && filter(i)) }))
      .filter((s) => s.issuers.length),
  })).filter((r) => r.subregions.length);
}

export function yearsText(i) {
  if (!i?.from) return '';
  return i.to ? (i.to === i.from ? String(i.from) : `${i.from}–${i.to}`) : `${i.from}–present`;
}

/** One line describing an issuer: "Colony of Great Britain · 1840–1948 · became Sri Lanka". */
export function issuerSummary(i) {
  if (!i) return '';
  const kind = TYPE_LABELS[i.type] ?? '';
  return [
    i.parent && i.type !== 'country' ? `${kind} (${i.parent})` : kind,
    yearsText(i),
    i.successor ? `became ${i.successor}` : null,
  ].filter(Boolean).join(' · ');
}

/** True when a year falls outside the issuer's stamp-issuing years (with a year of slack). */
export function yearOutsideIssuer(i, year) {
  if (!i || year == null || !i.from) return false;
  return year < i.from - 1 || (i.to != null && year > i.to + 1);
}
