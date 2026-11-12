import { CATALOGS } from './lists.js';
import { formatPerforation } from './validation.js';

const SHORT_CATALOG = {
  scott: 'Scott', stanley_gibbons: 'SG', michel: 'Michel', yvert_tellier: 'Yvert', sakura: 'Sakura', facit: 'Facit', other: '',
};

/** "Scott 114", or the custom catalog name for "other". */
export function catalogText(c) {
  const name = c.catalog === 'other' ? c.catalogLabel || 'Other' : SHORT_CATALOG[c.catalog] ?? c.catalog;
  return `${name} ${c.number}`.trim();
}

export const catalogLongName = (key) => CATALOGS.labels[key] ?? key;

/** Heading for a Stamp Card: the design if known, else face value and country. */
export function stampTitle(s) {
  if (s.designSubject && s.faceValue) return `${s.faceValue} ${s.designSubject}`;
  return s.designSubject || s.faceValue || s.country || 'Untitled stamp';
}

/** "United States · 1869 · Scott 114" (skips whatever is missing). */
export function stampSubtitle(s) {
  return [s.country, s.year?.toString(), s.catalogNumbers?.[0] ? catalogText(s.catalogNumbers[0]) : null].filter(Boolean).join(' · ');
}

export function perforationText(h, v) {
  if (h == null && v == null) return null;
  return formatPerforation(h ?? v, v ?? h);
}

/** Text box -> number: '' becomes null; anything else goes on to validation. */
export function toNumber(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  return t === '' ? null : Number(t);
}

export const toText = (n) => (n == null ? '' : String(n));

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
