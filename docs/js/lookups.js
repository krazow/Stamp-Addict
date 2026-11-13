// Links that look a stamp up in the big online catalogues. They open a
// web search limited to that site, so they work for any country name.
import { CATALOG_SHORT } from './lists.js';

function terms(s) {
  const cat = (s.catalogNumbers ?? []).find((c) => c.number);
  return [s.country, s.year, s.faceValue, s.designSubject, cat ? `${CATALOG_SHORT[cat.catalog] || ''} ${cat.number}`.trim() : null]
    .filter((x) => x != null && String(x).trim() !== '').join(' ');
}

export const LOOKUP_SITES = [
  { name: 'Colnect', site: 'colnect.com/en/stamps' },
  { name: 'StampWorld', site: 'stampworld.com' },
];

/** A search on one catalogue site for what's known about the stamp so far. */
export function lookupUrl(site, stamp) {
  const q = `site:${site} ${terms(stamp) || 'stamps'}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export const hasLookupTerms = (stamp) => terms(stamp) !== '';
