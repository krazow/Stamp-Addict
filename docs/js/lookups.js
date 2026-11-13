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

/**
 * eBay searches in the Stamps category (260). The search uses the country
 * and catalogue number when there is one, which collectors put in listing
 * titles; otherwise the year, face value and design.
 */
export function ebayTerms(s) {
  const cat = (s.catalogNumbers ?? []).find((c) => c.number && c.catalog !== 'other');
  const parts = cat
    ? [s.country, `${CATALOG_SHORT[cat.catalog] || ''} ${cat.number}`.trim()]
    : [s.country, s.year, s.faceValue, s.designSubject];
  return parts.filter((x) => x != null && String(x).trim() !== '').join(' ');
}

export function ebayUrl(stamp, { sold = false } = {}) {
  const q = encodeURIComponent(ebayTerms(stamp) || 'stamp');
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=260${sold ? '&LH_Sold=1&LH_Complete=1' : ''}`;
}
