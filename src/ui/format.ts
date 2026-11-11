import { CATALOGS, formatPerforation, type StampCard } from '../core';

const SHORT_CATALOG: Record<string, string> = {
  scott: 'Scott', stanley_gibbons: 'SG', michel: 'Michel', yvert_tellier: 'Yvert',
  sakura: 'Sakura', facit: 'Facit', other: '',
};

/** "Scott 114", or the custom catalog name for "other". */
export function catalogText(c: { catalog: string; number: string; catalogLabel?: string | null }): string {
  const name = c.catalog === 'other' ? c.catalogLabel || 'Other' : SHORT_CATALOG[c.catalog] ?? c.catalog;
  return `${name} ${c.number}`.trim();
}

export function catalogLongName(key: string): string {
  return (CATALOGS.labels as Record<string, string>)[key] ?? key;
}

/** Heading for a Stamp Card: the design if known, else face value and country. */
export function stampTitle(s: Pick<StampCard, 'designSubject' | 'faceValue' | 'country'>): string {
  if (s.designSubject && s.faceValue) return `${s.faceValue} ${s.designSubject}`;
  return s.designSubject || s.faceValue || s.country || 'Untitled stamp';
}

/** "United States · 1869 · Scott 114" (skips whatever is missing). */
export function stampSubtitle(s: StampCard): string {
  const parts = [s.country, s.year?.toString(), s.catalogNumbers[0] ? catalogText(s.catalogNumbers[0]) : null];
  return parts.filter(Boolean).join(' · ');
}

export function perforationText(h?: number | null, v?: number | null): string | null {
  if (h == null && v == null) return null;
  return formatPerforation(h ?? (v as number), v ?? (h as number));
}

/** Text box → number: '' becomes null; anything else is passed on for validation to check. */
export function toNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  return t === '' ? null : Number(t);
}

export function toText(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}
