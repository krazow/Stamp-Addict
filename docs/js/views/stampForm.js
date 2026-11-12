// Add a stamp, or edit one: every Stamp Card field, grouped like the phone app.
import { app, back, go } from '../app.js';
import { catalogText, perforationText, toNumber, toText } from '../format.js';
import {
  CATALOGS, CENTERINGS, FORMATS, GUMS, MINT_STATUSES, PAPER_TYPES, PHOTO_ROLES, PRINTING_METHODS,
  SEPARATIONS, STAMP_TYPES, TAGGINGS,
} from '../lists.js';
import { addPhotoFile, deletePhoto } from '../photos.js';
import { ValidationError, parsePerforation } from '../validation.js';
import {
  ask, button, chips, chooseFile, confirmAction, empty, field, h, icon, optionsOf, section, tell, toggle,
} from '../ui.js';
import { thumb } from './collection.js';

const NUMBER_FIELDS = ['year', 'grade', 'quantity', 'purchasePrice', 'estimatedValue', 'widthMm', 'heightMm'];
const FRIENDLY = {
  year: 'Year', grade: 'Grade', quantity: 'Quantity', perforation: 'Perforation', issueDate: 'Issue date',
  purchaseDate: 'Purchase date', purchasePrice: 'Purchase price', estimatedValue: 'Estimated value',
  widthMm: 'Width', heightMm: 'Height', photos: 'Photos', tags: 'Tags',
};

export function stampForm(id) {
  const { stamps, sets, wants } = app.repos;
  let original = null;
  if (id) {
    try { original = stamps.get(id); } catch {
      return { title: 'Edit stamp', body: empty('Stamp not found', 'It may have been deleted.') };
    }
  }
  // The form keeps numbers as text while typing; they're converted on save.
  const form = original ? {
    ...original,
    ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f, toText(original[f])])),
    perforation: perforationText(original.perfHorizontal, original.perfVertical) ?? '',
    photos: original.photos.map(({ role, uri, width, height, caption }) => ({ role, uri, width, height, caption })),
    catalogNumbers: original.catalogNumbers.map(({ id: _id, ...n }) => n),
  } : { quantity: '1', photos: [], catalogNumbers: [], tags: [], perforation: '' };
  const added = []; // photos added in this visit, removed again if the form isn't saved

  const fields = {};
  const text = (key, label, opts = {}) => {
    const f = field(label, { value: form[key] ?? '', ...opts, oninput: (e) => { form[key] = e.target.value; f.setError(null); } });
    fields[key] = f;
    return f.el;
  };
  const pick = (key, label, list) => chips(label, optionsOf(list), form[key], (v) => { form[key] = v; });
  const two = (a, b) => h('div', { class: 'two' }, a, b);

  // ---- Photos
  let nextRole = form.photos.some((p) => p.role === 'front') ? (form.photos.some((p) => p.role === 'back') ? 'detail' : 'back') : 'front';
  const photoRow = h('div', { class: 'photo-row' });
  const drawPhotos = () => photoRow.replaceChildren(...form.photos.map((p, i) => h('div', { class: 'photo-edit' },
    thumb(p.uri, 'thumb-edit'), h('div', { class: 'small muted' }, PHOTO_ROLES.labels[p.role]),
    h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Remove ${PHOTO_ROLES.labels[p.role]} photo`,
      onclick: () => { form.photos.splice(i, 1); drawPhotos(); } }, icon('close', 18)))));
  drawPhotos();
  const roleChips = h('div');
  const drawRoleChips = () => roleChips.replaceChildren(chips('Next photo is the', optionsOf(PHOTO_ROLES), nextRole, (v) => { nextRole = v; }, { allowClear: false }));
  drawRoleChips();
  const addPhoto = async () => {
    const file = await chooseFile('image/*');
    if (!file) return;
    try {
      const p = await addPhotoFile(file);
      added.push(p.uri);
      // Only one front and one back: a new one replaces the old.
      if (nextRole === 'front' || nextRole === 'back') form.photos = form.photos.filter((x) => x.role !== nextRole);
      form.photos.push({ role: nextRole, ...p });
      if (nextRole === 'front') nextRole = form.photos.some((x) => x.role === 'back') ? 'detail' : 'back';
      else if (nextRole === 'back') nextRole = 'detail';
      drawPhotos();
      drawRoleChips();
    } catch (e) {
      tell('Couldn\'t add the photo', String(e?.message ?? e));
    }
  };

  // ---- Catalog numbers
  let newCatalog = 'scott';
  const catList = h('div', { class: 'stack-tight' });
  const drawCats = () => catList.replaceChildren(...form.catalogNumbers.map((c, i) => h('div', { class: 'list-row' },
    h('span', {}, catalogText(c)),
    h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Remove ${catalogText(c)}`,
      onclick: () => { form.catalogNumbers.splice(i, 1); drawCats(); } }, icon('close', 18)))));
  drawCats();
  const catNumber = field('Number', { autocapitalize: 'characters', onenter: () => addCat() });
  const addCat = () => {
    const number = catNumber.input.value.trim();
    if (!number) return;
    form.catalogNumbers.push({ catalog: newCatalog, number });
    catNumber.input.value = '';
    drawCats();
  };

  // ---- Tags
  const known = stamps.allTags().map((t) => t.name);
  const tagRow = h('div', { class: 'pills' });
  const drawTags = () => {
    const unused = known.filter((k) => !form.tags.some((t) => t.toLowerCase() === k.toLowerCase()));
    tagRow.replaceChildren(
      ...form.tags.map((t) => h('button', { type: 'button', class: 'pill removable', 'aria-label': `Remove tag ${t}`,
        onclick: () => { form.tags = form.tags.filter((x) => x !== t); drawTags(); } }, t, icon('close', 14))),
      ...unused.map((t) => h('button', { type: 'button', class: 'pill ghost', 'aria-label': `Add tag ${t}`,
        onclick: () => { form.tags.push(t); drawTags(); } }, '+ ', t)),
    );
  };
  drawTags();
  const newTag = field('New tag', { placeholder: 'Birds', onenter: () => addTag() });
  const addTag = () => {
    const t = newTag.input.value.trim();
    if (t && !form.tags.some((x) => x.toLowerCase() === t.toLowerCase())) form.tags.push(t);
    newTag.input.value = '';
    drawTags();
  };

  // ---- Set
  const setChoices = sets.listWithItems().flatMap((st) => st.items.map((it) => ({ value: it.id, label: `${st.name}: ${it.faceValue || it.label}` })));

  // ---- Save / delete
  const showError = (fieldName, message) => {
    const target = fields[fieldName];
    if (target) {
      target.el.closest('details')?.setAttribute('open', '');
      target.setError(message);
    }
    tell('Check the form', `${FRIENDLY[fieldName] ?? fieldName}: ${message}`);
  };

  const save = async () => {
    // Values typed but not yet added with their Add button still count.
    if (catNumber.input.value.trim()) addCat();
    if (newTag.input.value.trim()) addTag();
    let perfHorizontal = null;
    let perfVertical = null;
    if (String(form.perforation ?? '').trim()) {
      const p = parsePerforation(form.perforation);
      if (!p) { showError('perforation', 'Write it like 12, or 11 x 10½.'); return; }
      perfHorizontal = p.horizontal;
      perfVertical = p.vertical;
    }
    const { perforation: _p, id: _id, createdAt: _c, updatedAt: _u, ...rest } = form;
    const input = {
      ...rest,
      ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f, toNumber(form[f])])),
      perfHorizontal, perfVertical,
    };
    if (input.quantity === null) input.quantity = 1;
    let saved;
    try {
      saved = original ? stamps.update(original.id, input) : stamps.create(input);
    } catch (e) {
      if (e instanceof ValidationError) {
        const f = e.field === 'perfHorizontal' || e.field === 'perfVertical' ? 'perforation' : e.field;
        showError(f, e.detail);
      } else {
        tell('Couldn\'t save', String(e?.message ?? e));
      }
      return;
    }
    // Remove files of photos taken off the card.
    const kept = new Set(form.photos.map((p) => p.uri));
    [...(original?.photos.map((p) => p.uri) ?? []), ...added].filter((u) => !kept.has(u)).forEach(deletePhoto);
    added.length = 0;
    saving = true;
    await offerWantCheckOff(saved.id);
    if (original) back();
    else go(`stamp/${saved.id}`, { replace: true });
  };

  const remove = async () => {
    if (!(await confirmAction('Delete this stamp?', 'Its Stamp Card and photos will be removed. This can\'t be undone.', 'Delete', true))) return;
    stamps.delete(original.id);
    [...original.photos.map((p) => p.uri), ...added].forEach(deletePhoto);
    saving = true;
    go('', { replace: true });
  };

  // Leaving without saving: drop photos added in this visit.
  let saving = false;
  const onLeave = () => {
    window.removeEventListener('hashchange', onLeave);
    if (!saving) added.forEach(deletePhoto);
  };
  window.addEventListener('hashchange', onLeave);

  const body = h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); save(); } },
    section('Photos', null, true,
      photoRow, roleChips,
      button(h('span', { class: 'with-icon' }, icon('camera', 20), 'Add photo'), addPhoto, 'secondary'),
      h('div', { class: 'hint' }, 'On a phone you can take the photo now or pick one; on a computer, choose an image file.')),
    section('Basics', null, true,
      text('country', 'Country', { autocapitalize: 'words' }),
      two(text('year', 'Year', { inputmode: 'numeric' }), text('faceValue', 'Face value', { placeholder: '3c' })),
      text('designSubject', 'Design / subject', { placeholder: 'Locomotive' }),
      two(text('issueDate', 'Issue date', { placeholder: '1869-03-27' }), text('currency', 'Currency')),
      text('colors', 'Color(s)', { placeholder: 'Ultramarine' }),
      pick('stampType', 'Stamp type', STAMP_TYPES),
      h('div', { class: 'field' }, h('div', { class: 'label' }, 'Catalog numbers'), catList,
        chips(null, optionsOf(CATALOGS).filter((o) => o.value !== 'other'), newCatalog, (v) => { newCatalog = v; }, { allowClear: false }),
        h('div', { class: 'two end' }, catNumber.el, button('Add', addCat, 'secondary'))),
      h('div', { class: 'field' }, h('div', { class: 'label' }, 'Tags'), tagRow,
        h('div', { class: 'two end' }, newTag.el, button('Add', addTag, 'secondary')))),
    section('Physical details', 'Perforation, watermark, paper, printing, gum', false,
      text('perforation', 'Perforation', { placeholder: '11 x 10½', hint: 'One number, or two like 11 x 10½ (sides, then top and bottom).' }),
      pick('separation', 'Separation', SEPARATIONS),
      text('watermark', 'Watermark', { placeholder: 'None' }),
      pick('paperType', 'Paper', PAPER_TYPES),
      pick('printingMethod', 'Printing method', PRINTING_METHODS),
      pick('gum', 'Gum', GUMS),
      pick('tagging', 'Tagging', TAGGINGS),
      pick('format', 'Format', FORMATS),
      two(text('widthMm', 'Width (mm)', { inputmode: 'decimal' }), text('heightMm', 'Height (mm)', { inputmode: 'decimal' })),
      two(text('designer', 'Designer'), text('engraver', 'Engraver')),
      text('printer', 'Printer')),
    section('Condition', 'Mint or used, centering, grade, faults', false,
      pick('mintStatus', 'Mint or used', MINT_STATUSES),
      pick('centering', 'Centering', CENTERINGS),
      text('grade', 'Grade (1–100)', { inputmode: 'numeric' }),
      text('cancellation', 'Cancellation'),
      text('faults', 'Faults', { placeholder: 'Thin, short perf…' }),
      toggle('Has a certificate', form.hasCertificate, (v) => { form.hasCertificate = v; })),
    section('Varieties and errors', 'Errors, plate number, overprint, shade', false,
      text('errorVariety', 'Error or variety', { placeholder: 'Inverted center' }),
      text('plateNumber', 'Plate number'),
      text('overprint', 'Overprint / surcharge'),
      text('shade', 'Shade')),
    section('Collection and value', 'Quantity, purchase, value, where it\'s kept', false,
      two(text('quantity', 'Quantity', { inputmode: 'numeric' }), text('estimatedValue', 'Estimated value', { inputmode: 'decimal' })),
      two(text('purchasePrice', 'Purchase price', { inputmode: 'decimal' }), text('purchaseCurrency', 'Currency', { placeholder: 'USD' })),
      text('purchaseDate', 'Purchase date', { placeholder: '2026-11-12' }),
      text('source', 'Bought from'),
      text('storageLocation', 'Stored in', { placeholder: 'Album 1, page 4' }),
      toggle('Available for trade', form.forTrade, (v) => { form.forTrade = v; })),
    section('Set', setChoices.length ? 'Which set this stamp belongs to' : 'Create a set on the Sets tab first', false,
      setChoices.length ? chips(null, setChoices, form.setItemId, (v) => { form.setItemId = v; }) : h('p', { class: 'muted small' }, 'No sets yet. Create one on the Sets tab.')),
    section('Notes', 'Anything else', false, text('notes', 'Notes', { multiline: true })),
    button(original ? 'Save' : 'Save stamp', null, 'primary', { type: 'submit' }),
    original ? button('Delete stamp', remove, 'danger') : null,
  );

  return {
    title: original ? 'Edit stamp' : 'New stamp',
    actions: [button('Save', save, 'text')],
    body,
  };
}

/** If the stamp fills something on the want list, offer to check it off. */
async function offerWantCheckOff(stampId) {
  const matches = app.repos.wants.matchesForStamp(stampId);
  if (!matches.length) return;
  const yes = await ask('On your want list', `This stamp matches: ${matches.map((m) => m.description).join(', ')}. Check it off?`, [
    { text: 'Not now', style: 'cancel' }, { text: 'Check off', value: true },
  ]);
  if (yes) matches.forEach((m) => app.repos.wants.markAcquired(m.id, stampId));
}
