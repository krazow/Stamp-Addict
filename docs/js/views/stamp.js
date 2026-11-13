import { app, go, refresh } from '../app.js';
import { catalogLongName, perforationText, stampSubtitle, stampTitle } from '../format.js';
import {
  CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PHOTO_ROLES, PRINTING_METHODS, SEPARATIONS,
  STAMP_TYPES, TAGGINGS, labelOf,
} from '../lists.js';
import { photoUrl } from '../photos.js';
import { issuerById, issuerSummary } from '../issuers.js';
import { ebayUrl } from '../lookups.js';
import { askAmount, button, empty, h, icon, toast } from '../ui.js';
import { editAtStep, lookupLinks } from './stampForm.js';

/** The details a Stamp Card is most useful with, and the form step each is on. */
const KEY_DETAILS = [
  ['a front photo', (c) => c.photos.some((p) => p.role === 'front'), 0],
  ['country', (c) => !!c.country, 1],
  ['year', (c) => c.year != null, 1],
  ['face value', (c) => !!c.faceValue, 1],
  ['catalogue number', (c) => c.catalogNumbers.length > 0, 1],
  ['condition (mint or used)', (c) => !!c.mintStatus, 3],
  ['estimated value', (c) => c.estimatedValue != null, 4],
];

export function missingDetails(card) {
  return KEY_DETAILS.filter(([, has]) => !has(card));
}

// After "eBay sold listings" opens in another tab or window, coming back
// to the app asks whether to save a price as the stamp's value.
let pendingEbay = null;
async function onReturn() {
  if (!pendingEbay || document.visibilityState !== 'visible' || Date.now() - pendingEbay.at < 1500) return;
  const { id } = pendingEbay;
  pendingEbay = null;
  let card;
  try { card = app.repos.stamps.get(id); } catch { return; }
  await offerEbayValue(card);
}
document.addEventListener('visibilitychange', onReturn);
window.addEventListener('focus', onReturn);

/** Asks for a price seen on eBay and saves it as the estimated value, with a note. */
export async function offerEbayValue(card) {
  const value = await askAmount('Add an eBay price as this stamp\'s value?',
    `If the sold listings showed what this stamp (${[stampTitle(card), stampSubtitle(card)].filter(Boolean).join(', ')}) goes for, enter it. It's saved as the estimated value, with a note that it came from eBay. Every value is optional.`,
    { label: 'Estimated value', yes: 'Save value', hint: card.estimatedValue != null ? `Now: ${card.estimatedValue}` : 'Use the currency you keep your values in.' });
  if (value == null) return;
  const date = new Date().toISOString().slice(0, 10);
  const note = `Estimated value ${value} from eBay sold listings, ${date}.`;
  app.repos.stamps.update(card.id, { estimatedValue: value, notes: card.notes ? `${card.notes}\n${note}` : note });
  toast('Value saved.');
  refresh();
}

export function stampView(id) {
  let card;
  try { card = app.repos.stamps.get(id); } catch {
    return { title: 'Stamp Card', body: empty('Stamp not found', 'It may have been deleted.') };
  }
  const found = card.setItemId ? app.repos.sets.findItem(card.setItemId) : null;
  const setInfo = found ? `${found.setName} · ${found.item.faceValue || found.item.label}` : null;

  let index = 0;
  const big = h('div', { class: 'photo-big' });
  const caption = h('div', { class: 'muted small center' });
  const thumbs = h('div', { class: 'photo-thumbs', role: 'tablist' });
  const show = () => {
    const p = card.photos[index];
    const url = p && photoUrl(p.uri);
    big.replaceChildren(url ? h('img', { src: url, alt: `${PHOTO_ROLES.labels[p.role]} photo` }) : h('div', { class: 'placeholder big' }, icon('stamp', 48)));
    caption.textContent = p && card.photos.length > 1 ? PHOTO_ROLES.labels[p.role] : '';
    thumbs.replaceChildren(...(card.photos.length > 1 ? card.photos.map((ph, i) => {
      const u = photoUrl(ph.uri);
      return h('button', { type: 'button', role: 'tab', 'aria-selected': String(i === index), 'aria-label': PHOTO_ROLES.labels[ph.role],
        class: `photo-thumb${i === index ? ' on' : ''}`, onclick: () => { index = i; show(); } },
      u ? h('img', { src: u, alt: '' }) : h('div', { class: 'placeholder' }, icon('stamp', 18)));
    }) : []));
  };
  show();

  const sections = [
    ['Identification', [
      ['Country or issuer', card.country],
      ['About the issuer', issuerById(card.issuerId) ? `${issuerById(card.issuerId).subregion} · ${issuerSummary(issuerById(card.issuerId))}` : null], ['Year', card.year], ['Issue date', card.issueDate], ['Face value', card.faceValue],
      ['Currency', card.currency], ['Color', card.colors], ['Design', card.designSubject],
      ['Type', labelOf(STAMP_TYPES, card.stampType)], ['Designer', card.designer], ['Engraver', card.engraver], ['Printer', card.printer],
    ]],
    ['Catalog numbers', card.catalogNumbers.map((c) => [
      c.catalog === 'other' ? c.catalogLabel || 'Other' : catalogLongName(c.catalog),
      [c.number, c.catalogValue != null ? `value ${c.catalogValue}${c.valueCurrency ? ' ' + c.valueCurrency : ''}` : null, c.edition ? `(${c.edition})` : null].filter(Boolean).join(' · '),
    ])],
    ['Physical details', [
      ['Perforation', perforationText(card.perfHorizontal, card.perfVertical)], ['Separation', labelOf(SEPARATIONS, card.separation)],
      ['Watermark', card.watermark], ['Paper', labelOf(PAPER_TYPES, card.paperType)], ['Printing', labelOf(PRINTING_METHODS, card.printingMethod)],
      ['Gum', labelOf(GUMS, card.gum)], ['Tagging', labelOf(TAGGINGS, card.tagging)], ['Format', labelOf(FORMATS, card.format)],
      ['Size', card.widthMm && card.heightMm ? `${card.widthMm} × ${card.heightMm} mm` : null],
    ]],
    ['Condition', [
      ['Mint or used', labelOf(MINT_STATUSES, card.mintStatus)], ['Centering', labelOf(CENTERINGS, card.centering)],
      ['Grade', card.grade], ['Cancellation', card.cancellation], ['Faults', card.faults],
      ['Certificate', card.hasCertificate == null ? null : card.hasCertificate ? 'Yes' : 'No'],
    ]],
    ['Varieties', [['Error or variety', card.errorVariety], ['Plate number', card.plateNumber], ['Overprint', card.overprint], ['Shade', card.shade]]],
    ['Collection', [
      ['Quantity', card.quantity],
      ['Purchase price', card.purchasePrice != null ? `${card.purchasePrice}${card.purchaseCurrency ? ' ' + card.purchaseCurrency : ''}` : null],
      ['Purchase date', card.purchaseDate], ['Bought from', card.source], ['Estimated value', card.estimatedValue],
      ['Stored in', card.storageLocation], ['For trade', card.forTrade ? 'Yes' : null],
    ]],
  ].map(([title, rows]) => [title, rows.filter(([, v]) => v !== null && v !== undefined && v !== '')]).filter(([, rows]) => rows.length);

  const subtitle = stampSubtitle(card);
  return {
    title: 'Stamp Card',
    actions: [button('Edit', () => go(`stamp/${card.id}/edit`), 'text')],
    body: h('div', { class: 'stack' },
      h('div', { class: 'photo-area' }, big, thumbs, caption),
      h('div', { class: 'stack-tight' },
        h('h2', { class: 'card-title' }, stampTitle(card)),
        subtitle ? h('div', { class: 'muted' }, subtitle) : null,
        lookupLinks(() => card),
        missingBox(card),
        card.tags.length || setInfo ? h('div', { class: 'pills' }, card.tags.map((t) => h('span', { class: 'pill' }, t)), setInfo ? h('span', { class: 'pill accent' }, setInfo) : null) : null),
      sections.map(([title, rows]) => h('section', { class: 'card' }, h('h3', {}, title),
        h('dl', {}, rows.map(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])))),
      marketSection(card),
      card.notes ? h('section', { class: 'card' }, h('h3', {}, 'Notes'), h('p', { class: 'notes' }, card.notes)) : null),
  };
}

function missingBox(card) {
  const missing = missingDetails(card);
  if (!missing.length) return null;
  const names = missing.map(([n]) => n);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return h('div', { class: 'missing', role: 'note' },
    icon('alert', 20),
    h('div', { class: 'missing-text' },
      h('div', {}, h('strong', {}, 'Missing details: '), `${list}.`),
      h('div', { class: 'small muted' }, 'Every detail is optional; these make a Stamp Card easier to identify and value.')),
    button('Add', () => editAtStep(card.id, missing[0][2]), 'text'));
}

function marketSection(card) {
  const link = (text, sold) => h('a', {
    class: 'btn btn-secondary', href: ebayUrl(card, { sold }), target: '_blank', rel: 'noopener noreferrer',
    onclick: () => { if (sold) pendingEbay = { id: card.id, at: Date.now() }; },
  }, text, icon('external', 16));
  return h('section', { class: 'card' },
    h('h3', {}, 'Market value'),
    h('p', { class: 'small' }, card.estimatedValue != null ? `Estimated value: ${card.estimatedValue}` : 'No estimated value yet.'),
    h('div', { class: 'market-buttons' }, link('Sold on eBay', true), link('Search eBay', false)),
    h('p', { class: 'small muted' }, 'Sold listings show what similar stamps actually went for. When you come back, the app asks whether to save a price as this stamp\'s value.'),
    button('Enter a value from eBay', () => offerEbayValue(card), 'text'));
}
