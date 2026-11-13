import { app, go } from '../app.js';
import { catalogLongName, perforationText, stampSubtitle, stampTitle } from '../format.js';
import {
  CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PHOTO_ROLES, PRINTING_METHODS, SEPARATIONS,
  STAMP_TYPES, TAGGINGS, labelOf,
} from '../lists.js';
import { photoUrl } from '../photos.js';
import { issuerById, issuerSummary } from '../issuers.js';
import { button, empty, h, icon } from '../ui.js';
import { lookupLinks } from './stampForm.js';

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
        card.tags.length || setInfo ? h('div', { class: 'pills' }, card.tags.map((t) => h('span', { class: 'pill' }, t)), setInfo ? h('span', { class: 'pill accent' }, setInfo) : null) : null),
      sections.map(([title, rows]) => h('section', { class: 'card' }, h('h3', {}, title),
        h('dl', {}, rows.map(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])))),
      card.notes ? h('section', { class: 'card' }, h('h3', {}, 'Notes'), h('p', { class: 'notes' }, card.notes)) : null),
  };
}
