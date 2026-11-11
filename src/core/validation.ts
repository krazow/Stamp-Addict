import { ValidationError } from './db';
import {
  CATALOGS, CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PHOTO_ROLES,
  PRINTING_METHODS, SEPARATIONS, STAMP_TYPES, TAGGINGS,
  type StampCardInput,
} from './types';

const PICK_LISTS: Record<string, readonly string[]> = {
  stampType: STAMP_TYPES.values,
  separation: SEPARATIONS.values,
  paperType: PAPER_TYPES.values,
  printingMethod: PRINTING_METHODS.values,
  gum: GUMS.values,
  tagging: TAGGINGS.values,
  format: FORMATS.values,
  mintStatus: MINT_STATUSES.values,
  centering: CENTERINGS.values,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkRange(field: string, v: unknown, min: number, max: number, integer = false) {
  if (v === null || v === undefined) return;
  if (typeof v !== 'number' || Number.isNaN(v)) throw new ValidationError(field, 'must be a number');
  if (integer && !Number.isInteger(v)) throw new ValidationError(field, 'must be a whole number');
  if (v < min || v > max) throw new ValidationError(field, `must be between ${min} and ${max}`);
}

function checkDate(field: string, v: unknown) {
  if (v === null || v === undefined) return;
  if (typeof v !== 'string' || !ISO_DATE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ValidationError(field, 'must be a date written YYYY-MM-DD');
  }
}

/**
 * Checks a Stamp Card before it is saved. Every field is optional; only
 * values that are present are checked. Throws ValidationError with the
 * field name so the edit form can show the message next to that field.
 */
export function validateStampInput(input: StampCardInput): void {
  for (const [field, allowed] of Object.entries(PICK_LISTS)) {
    const v = (input as Record<string, unknown>)[field];
    if (v !== null && v !== undefined && !allowed.includes(v as string)) {
      throw new ValidationError(field, `"${String(v)}" is not a valid choice`);
    }
  }
  checkRange('year', input.year, 1840, 2100, true);
  checkRange('perfHorizontal', input.perfHorizontal, 5, 20);
  checkRange('perfVertical', input.perfVertical, 5, 20);
  checkRange('grade', input.grade, 1, 100, true);
  checkRange('quantity', input.quantity, 0, 1_000_000, true);
  checkRange('purchasePrice', input.purchasePrice, 0, Number.MAX_SAFE_INTEGER);
  checkRange('estimatedValue', input.estimatedValue, 0, Number.MAX_SAFE_INTEGER);
  checkRange('widthMm', input.widthMm, 1, 500);
  checkRange('heightMm', input.heightMm, 1, 500);
  checkDate('issueDate', input.issueDate);
  checkDate('purchaseDate', input.purchaseDate);

  input.catalogNumbers?.forEach((c, i) => {
    if (!CATALOGS.values.includes(c.catalog)) {
      throw new ValidationError(`catalogNumbers[${i}].catalog`, `"${c.catalog}" is not a valid catalog`);
    }
    if (!c.number || !c.number.trim()) {
      throw new ValidationError(`catalogNumbers[${i}].number`, 'is required');
    }
    checkRange(`catalogNumbers[${i}].catalogValue`, c.catalogValue, 0, Number.MAX_SAFE_INTEGER);
  });

  let fronts = 0;
  let backs = 0;
  input.photos?.forEach((p, i) => {
    if (!PHOTO_ROLES.values.includes(p.role)) {
      throw new ValidationError(`photos[${i}].role`, `"${p.role}" is not a valid photo type`);
    }
    if (!p.uri) throw new ValidationError(`photos[${i}].uri`, 'is required');
    if (p.role === 'front') fronts++;
    if (p.role === 'back') backs++;
  });
  if (fronts > 1) throw new ValidationError('photos', 'only one front photo is allowed');
  if (backs > 1) throw new ValidationError('photos', 'only one back photo is allowed');

  input.tags?.forEach((t, i) => {
    if (!t.trim()) throw new ValidationError(`tags[${i}]`, 'cannot be empty');
    if (t.length > 50) throw new ValidationError(`tags[${i}]`, 'must be 50 characters or fewer');
  });
}

const FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };

function parseGauge(s: string): number | null {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*([¼½¾])?$/);
  if (!m) return null;
  return Number(m[1]) + (m[2] ? FRACTIONS[m[2]] : 0);
}

/**
 * Reads perforation as collectors write it: "11", "11 x 10½", "12½x13",
 * "10.5 x 11". One number means the same gauge on all sides.
 * Returns null if the text can't be read.
 */
export function parsePerforation(text: string): { horizontal: number; vertical: number } | null {
  const parts = text.toLowerCase().replace(/^perf\.?\s*/, '').split(/\s*[x×]\s*/);
  if (parts.length < 1 || parts.length > 2) return null;
  const h = parseGauge(parts[0]);
  const v = parts.length === 2 ? parseGauge(parts[1]) : h;
  if (h === null || v === null) return null;
  return { horizontal: h, vertical: v };
}

/** Writes a gauge pair back the way collectors read it: "11 x 10½". */
export function formatPerforation(horizontal: number, vertical: number): string {
  const fmt = (n: number) => {
    const whole = Math.floor(n);
    const frac = Math.round((n - whole) * 100) / 100;
    const sym = Object.entries(FRACTIONS).find(([, v]) => v === frac)?.[0];
    if (frac === 0) return String(whole);
    return sym ? `${whole}${sym}` : String(n);
  };
  return horizontal === vertical ? fmt(horizontal) : `${fmt(horizontal)} x ${fmt(vertical)}`;
}
