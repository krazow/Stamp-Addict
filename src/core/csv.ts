import type { SqlDatabase } from './db';
import { SetRepository } from './sets';
import { StampRepository } from './stamps';
import {
  CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PRINTING_METHODS, SEPARATIONS, STAMP_TYPES, TAGGINGS,
  type StampCard,
} from './types';
import { formatPerforation } from './validation';

type Cell = string | number | boolean | null | undefined;

const label = (list: { labels: Record<string, string> }, v: string | null | undefined) => (v ? list.labels[v] ?? v : '');
const numbersFor = (c: StampCard, catalog: string) =>
  c.catalogNumbers.filter((n) => n.catalog === catalog).map((n) => n.number).join('; ');

/**
 * One column per field, in the order a collector reads a card. Spreadsheet
 * apps (Excel, Google Sheets, Numbers) and other collection software import
 * this directly.
 */
const COLUMNS: Array<[header: string, value: (c: StampCard, set: string) => Cell]> = [
  ['Country', (c) => c.country],
  ['Year', (c) => c.year],
  ['Face value', (c) => c.faceValue],
  ['Design', (c) => c.designSubject],
  ['Scott', (c) => numbersFor(c, 'scott')],
  ['Stanley Gibbons', (c) => numbersFor(c, 'stanley_gibbons')],
  ['Michel', (c) => numbersFor(c, 'michel')],
  ['Yvert et Tellier', (c) => numbersFor(c, 'yvert_tellier')],
  ['Other catalog numbers', (c) => c.catalogNumbers
    .filter((n) => !['scott', 'stanley_gibbons', 'michel', 'yvert_tellier'].includes(n.catalog))
    .map((n) => `${n.catalog === 'other' ? n.catalogLabel || 'Other' : n.catalog === 'sakura' ? 'Sakura' : 'Facit'} ${n.number}`)
    .join('; ')],
  ['Catalog value', (c) => c.catalogNumbers.find((n) => n.catalogValue != null)?.catalogValue],
  ['Issue date', (c) => c.issueDate],
  ['Currency', (c) => c.currency],
  ['Colors', (c) => c.colors],
  ['Stamp type', (c) => label(STAMP_TYPES, c.stampType)],
  ['Perforation', (c) => (c.perfHorizontal != null || c.perfVertical != null
    ? formatPerforation(c.perfHorizontal ?? c.perfVertical!, c.perfVertical ?? c.perfHorizontal!) : '')],
  ['Separation', (c) => label(SEPARATIONS, c.separation)],
  ['Watermark', (c) => c.watermark],
  ['Paper', (c) => label(PAPER_TYPES, c.paperType)],
  ['Printing method', (c) => label(PRINTING_METHODS, c.printingMethod)],
  ['Gum', (c) => label(GUMS, c.gum)],
  ['Tagging', (c) => label(TAGGINGS, c.tagging)],
  ['Format', (c) => label(FORMATS, c.format)],
  ['Width (mm)', (c) => c.widthMm],
  ['Height (mm)', (c) => c.heightMm],
  ['Designer', (c) => c.designer],
  ['Engraver', (c) => c.engraver],
  ['Printer', (c) => c.printer],
  ['Mint or used', (c) => label(MINT_STATUSES, c.mintStatus)],
  ['Centering', (c) => label(CENTERINGS, c.centering)],
  ['Grade', (c) => c.grade],
  ['Cancellation', (c) => c.cancellation],
  ['Faults', (c) => c.faults],
  ['Certificate', (c) => c.hasCertificate],
  ['Error or variety', (c) => c.errorVariety],
  ['Plate number', (c) => c.plateNumber],
  ['Overprint', (c) => c.overprint],
  ['Shade', (c) => c.shade],
  ['Set', (_c, set) => set],
  ['Quantity', (c) => c.quantity],
  ['Purchase price', (c) => c.purchasePrice],
  ['Purchase currency', (c) => c.purchaseCurrency],
  ['Purchase date', (c) => c.purchaseDate],
  ['Bought from', (c) => c.source],
  ['Estimated value', (c) => c.estimatedValue],
  ['Stored in', (c) => c.storageLocation],
  ['For trade', (c) => c.forTrade],
  ['Tags', (c) => c.tags.join('; ')],
  ['Notes', (c) => c.notes],
  ['Front photo', (c) => c.photos.find((p) => p.role === 'front')?.uri],
  ['Back photo', (c) => c.photos.find((p) => p.role === 'back')?.uri],
  ['Other photos', (c) => c.photos.filter((p) => p.role !== 'front' && p.role !== 'back').map((p) => p.uri).join('; ')],
  ['Stamp ID', (c) => c.id],
  ['Added', (c) => c.createdAt],
  ['Updated', (c) => c.updatedAt],
];

export const CSV_HEADERS = COLUMNS.map(([h]) => h);

/** One CSV cell: quoted when needed, and made safe from spreadsheet formula injection. */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = v;
  // A text cell starting with = + - @ (or tab/CR) would run as a formula in Excel or Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The whole collection as CSV, one row per stamp, oldest first. Starts with a
 * byte-order mark so Excel reads ½, é, ü and other characters correctly.
 */
export function stampsToCsv(db: SqlDatabase): string {
  const stamps = new StampRepository(db);
  const sets = new SetRepository(db);
  const ids = db.all<{ id: string }>('SELECT id FROM stamps ORDER BY created_at, rowid').map((r) => r.id);
  const lines = [CSV_HEADERS.map(csvCell).join(',')];
  for (const id of ids) {
    const card = stamps.get(id);
    const found = card.setItemId ? sets.findItem(card.setItemId) : null;
    const set = found ? `${found.setName}: ${found.item.label}` : '';
    lines.push(COLUMNS.map(([, f]) => csvCell(f(card, set))).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
