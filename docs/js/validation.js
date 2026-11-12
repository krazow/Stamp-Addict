import {
  CATALOGS, CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PHOTO_ROLES,
  PRINTING_METHODS, SEPARATIONS, STAMP_TYPES, TAGGINGS,
} from './lists.js';

export class ValidationError extends Error {
  constructor(field, message) {
    super(`${field}: ${message}`);
    this.name = 'ValidationError';
    this.field = field;
    this.detail = message;
  }
}

export class NotFoundError extends Error {
  constructor(what, id) {
    super(`${what} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

const PICK_LISTS = {
  stampType: STAMP_TYPES.values, separation: SEPARATIONS.values, paperType: PAPER_TYPES.values,
  printingMethod: PRINTING_METHODS.values, gum: GUMS.values, tagging: TAGGINGS.values,
  format: FORMATS.values, mintStatus: MINT_STATUSES.values, centering: CENTERINGS.values,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkRange(field, v, min, max, integer = false) {
  if (v === null || v === undefined) return;
  if (typeof v !== 'number' || Number.isNaN(v)) throw new ValidationError(field, 'must be a number');
  if (integer && !Number.isInteger(v)) throw new ValidationError(field, 'must be a whole number');
  if (v < min || v > max) throw new ValidationError(field, `must be between ${min} and ${max}`);
}

function checkDate(field, v) {
  if (v === null || v === undefined) return;
  if (typeof v !== 'string' || !ISO_DATE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ValidationError(field, 'must be a date written YYYY-MM-DD');
  }
}

/** Checks a Stamp Card before saving. Every field is optional; present values are checked. */
export function validateStampInput(input) {
  for (const [field, allowed] of Object.entries(PICK_LISTS)) {
    const v = input[field];
    if (v !== null && v !== undefined && !allowed.includes(v)) {
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
    if (!c.number || !String(c.number).trim()) throw new ValidationError(`catalogNumbers[${i}].number`, 'is required');
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

const FRACTIONS = { '¼': 0.25, '½': 0.5, '¾': 0.75 };

function parseGauge(s) {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*([¼½¾])?$/);
  if (!m) return null;
  return Number(m[1]) + (m[2] ? FRACTIONS[m[2]] : 0);
}

/** Reads perforation as collectors write it: "11", "11 x 10½", "12½x13", "10.5 x 11". */
export function parsePerforation(text) {
  const parts = text.toLowerCase().replace(/^perf\.?\s*/, '').split(/\s*[x×]\s*/);
  if (parts.length < 1 || parts.length > 2) return null;
  const h = parseGauge(parts[0]);
  const v = parts.length === 2 ? parseGauge(parts[1]) : h;
  if (h === null || v === null) return null;
  return { horizontal: h, vertical: v };
}

/** Writes a gauge pair the way collectors read it: "11 x 10½". */
export function formatPerforation(horizontal, vertical) {
  const fmt = (n) => {
    const whole = Math.floor(n);
    const frac = Math.round((n - whole) * 100) / 100;
    const sym = Object.entries(FRACTIONS).find(([, v]) => v === frac)?.[0];
    if (frac === 0) return String(whole);
    return sym ? `${whole}${sym}` : String(n);
  };
  return horizontal === vertical ? fmt(horizontal) : `${fmt(horizontal)} x ${fmt(vertical)}`;
}
