// Add a stamp, or edit one, in five steps:
// Photos → Identify → Details → Condition → Collection. Save works from any step.
import { app, back, go, refresh } from '../app.js';
import { catalogText, perforationText, toNumber, toText } from '../format.js';
import { issuerById, yearOutsideIssuer, yearsText } from '../issuers.js';
import {
  CATALOGS, CATALOG_REGIONS, CENTERINGS, FORMATS, GUMS, MAIN_CATALOGS, MINT_STATUSES, PAPER_TYPES, PHOTO_ROLES,
  PRINTING_METHODS, SEPARATIONS, STAMP_TYPES, TAGGINGS,
} from '../lists.js';
import { addPhotoFile, deletePhoto, photoBlob } from '../photos.js';
import { readStampText } from '../ocr.js';
import { identifyFromText } from '../stampid.js';
import { LOOKUP_SITES, hasLookupTerms, lookupUrl } from '../lookups.js';
import { stampTitle } from '../format.js';
import { ValidationError, parsePerforation } from '../validation.js';
import {
  ask, button, chips, chooseFile, confirmAction, empty, field, h, icon, optionsOf, select, tell, toast, toggle,
} from '../ui.js';
import { thumb } from './collection.js';
import { issuerField } from './issuerPicker.js';

const NUMBER_FIELDS = ['year', 'grade', 'quantity', 'purchasePrice', 'estimatedValue', 'widthMm', 'heightMm'];
const FRIENDLY = {
  year: 'Year', grade: 'Grade', quantity: 'Quantity', perforation: 'Perforation', issueDate: 'Issue date',
  purchaseDate: 'Purchase date', purchasePrice: 'Purchase price', estimatedValue: 'Estimated value',
  widthMm: 'Width', heightMm: 'Height', photos: 'Photos', tags: 'Tags', catalogNumbers: 'Catalog numbers',
};
const STEPS = ['Photos', 'Identify', 'Details', 'Condition', 'Collection'];
/** Which step holds each field, so an error can open the right one. */
const STEP_OF = {
  photos: 0, year: 1, faceValue: 1, currency: 1, designSubject: 1, catalogNumbers: 1, tags: 1,
  issueDate: 2, colors: 2, perforation: 2, widthMm: 2, heightMm: 2, designer: 2, engraver: 2, printer: 2, watermark: 2,
  grade: 3, cancellation: 3, faults: 3,
  quantity: 4, purchasePrice: 4, purchaseDate: 4, estimatedValue: 4,
};

/** Catalogue drop-down options: the four big ones first, then the rest. */
export function catalogOptions() {
  const label = (k) => `${CATALOGS.labels[k]} — ${CATALOG_REGIONS[k]}`;
  return [
    ...MAIN_CATALOGS.map((k) => ({ value: k, label: label(k), group: 'Most used' })),
    ...CATALOGS.values.filter((k) => !MAIN_CATALOGS.includes(k)).map((k) => ({ value: k, label: label(k), group: 'National and regional' })),
  ];
}

let lastStep = 0;

/** Opens a stamp's edit form at a given step (0 Photos … 4 Collection). */
export function editAtStep(id, step) {
  lastStep = step;
  go(`stamp/${id}/edit`);
}

/** Quick-add: what the last stamp leaves for the next one (country, year, catalogue, tags). */
let carry = null;

export function stampForm(id) {
  const { stamps, sets } = app.repos;
  let original = null;
  if (id) {
    try { original = stamps.get(id); } catch {
      return { title: 'Edit stamp', body: empty('Stamp not found', 'It may have been deleted.') };
    }
  }
  // Numbers stay as text while typing; they're converted on save.
  const form = original ? {
    ...original,
    ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f, toText(original[f])])),
    perforation: perforationText(original.perfHorizontal, original.perfVertical) ?? '',
    photos: original.photos.map(({ role, uri, width, height, caption }) => ({ role, uri, width, height, caption })),
    catalogNumbers: original.catalogNumbers.map(({ id: _id, ...n }) => n),
  } : {
    quantity: '1', photos: [], catalogNumbers: [], tags: [...(carry?.tags ?? [])], perforation: '',
    ...(carry ? { issuerId: carry.issuerId, country: carry.country, year: carry.year ?? '' } : {}),
  };
  const added = []; // photos added in this visit; removed again if the form isn't saved

  const fields = {};
  const text = (key, label, opts = {}) => {
    const f = field(label, { value: form[key] ?? '', ...opts, oninput: (e) => { form[key] = e.target.value; f.setError(null); opts.after?.(); } });
    fields[key] = f;
    return f.el;
  };
  const pick = (key, label, list, opts) => select(label, optionsOf(list), form[key], (v) => { form[key] = v; }, opts);
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
      // One front and one back: a new one replaces the old.
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

  // ---- Issuer and year
  const yearNote = h('div', { class: 'hint' });
  const checkYear = () => {
    const i = issuerById(form.issuerId);
    const y = toNumber(form.year);
    yearNote.textContent = i && yearOutsideIssuer(i, y) ? `Check the year: ${i.name} issued stamps ${yearsText(i)}.` : i ? `${i.name} issued stamps ${yearsText(i)}.` : '';
    yearNote.classList.toggle('warn', !!(i && yearOutsideIssuer(i, y)));
  };
  let catalogTouched = form.catalogNumbers.length > 0 || !!(!original && carry?.catalog);
  let newCatalog = (!original && carry?.catalog) || issuerById(form.issuerId)?.catalog || 'scott';
  const catalogSelectSlot = h('div');
  const drawCatalogSelect = () => catalogSelectSlot.replaceChildren(select('Catalog', catalogOptions(), newCatalog, (v) => { newCatalog = v ?? 'scott'; catalogTouched = true; }, {
    allowEmpty: false,
    hint: issuerById(form.issuerId) ? `Most collectors of ${issuerById(form.issuerId).name} use ${CATALOGS.labels[issuerById(form.issuerId).catalog]}.` : null,
  }));
  drawCatalogSelect();
  const issuer = issuerField('Country or issuer', form.country ? { id: form.issuerId ?? null, name: form.country } : null, (v) => {
    form.issuerId = v?.id ?? null;
    form.country = v?.name ?? null;
    const i = issuerById(form.issuerId);
    if (i && !catalogTouched) newCatalog = i.catalog;
    drawCatalogSelect();
    checkYear();
  }, { hint: 'Search by any name, including old ones (Ceylon, Siam, Bayern).' });

  // ---- Identify from the photo (reads the printed text, on the device)
  const idSlot = h('div', { class: 'identify' });
  const setField = (key, value) => {
    form[key] = value;
    if (fields[key]) { fields[key].input.value = value ?? ''; fields[key].setError(null); }
  };
  const suggestionRow = (label, items, apply, fmt = String) => (items.length ? h('div', { class: 'suggest-row' },
    h('div', { class: 'small strong' }, label),
    h('div', { class: 'pills' }, items.map((it) => h('button', { type: 'button', class: 'pill suggest', onclick: (e) => { apply(it); e.currentTarget.classList.add('used'); toast('Added. Check it on the Identify step.'); } }, fmt(it))))) : null);
  const identify = async () => {
    const photo = form.photos.find((p) => p.role === 'front') ?? form.photos[0];
    if (!photo) { tell('Add a photo first', 'Reading the stamp needs a photo of the front.'); return; }
    idSlot.replaceChildren(h('div', { class: 'busy' }, h('div', { class: 'spinner' }), h('span', {}, 'Reading the stamp… The first time, this downloads the text reader (about 5 MB).')));
    try {
      const blob = await photoBlob(photo.uri);
      if (!blob) throw new Error('The photo couldn\'t be opened.');
      const { text } = await readStampText(blob);
      const r = identifyFromText(text);
      const found = r.issuers.length || r.faceValues.length || r.years.length;
      idSlot.replaceChildren(h('div', { class: 'card' },
        h('h3', {}, found ? 'Suggestions from the photo (experimental)' : 'Nothing recognised'),
        found ? h('p', { class: 'small muted' }, 'Tap a suggestion to use it. Check it before saving: the reader only sees the printed text.') :
          h('p', { class: 'small' }, 'No country name or value could be read. It works best when the stamp fills the photo, the light is even, and the text is in the Latin alphabet. Stamps without a country name, like British ones, can\'t be identified this way.'),
        suggestionRow('Country or issuer', r.issuers, (m) => { issuer.setValue({ id: m.issuer.id, name: m.issuer.name }); }, (m) => `${m.issuer.name}${m.issuer.from ? ` (${yearsText(m.issuer)})` : ''}`),
        suggestionRow('Face value', r.faceValues, (v) => setField('faceValue', v)),
        suggestionRow('Year', r.years, (y) => { setField('year', String(y)); checkYear(); }),
        found ? button('Use the first of each', () => {
          if (r.issuers[0]) issuer.setValue({ id: r.issuers[0].issuer.id, name: r.issuers[0].issuer.name });
          if (r.faceValues[0]) setField('faceValue', r.faceValues[0]);
          if (r.years[0]) { setField('year', String(r.years[0])); checkYear(); }
          showStep(1);
        }, 'secondary') : null,
        r.text ? h('details', { class: 'small' }, h('summary', {}, 'Text it read'), h('pre', { class: 'ocr-text' }, r.text)) : null));
    } catch (e) {
      idSlot.replaceChildren(h('p', { class: 'small danger' }, `Couldn't read the photo: ${e?.message ?? e}`));
    }
  };

  // ---- Catalog numbers
  const catList = h('div', { class: 'stack-tight' });
  const drawCats = () => catList.replaceChildren(...form.catalogNumbers.map((c, i) => h('div', { class: 'list-row' },
    h('span', {}, catalogText(c), c.catalogValue != null ? h('span', { class: 'muted' }, ` · value ${c.catalogValue}`) : null),
    h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Remove ${catalogText(c)}`,
      onclick: () => { form.catalogNumbers.splice(i, 1); drawCats(); } }, icon('close', 18)))));
  drawCats();
  const catNumber = field('Number', { autocapitalize: 'characters', placeholder: '114', onenter: () => addCat() });
  const catValue = field('Catalog value', { inputmode: 'decimal', placeholder: 'Optional', onenter: () => addCat() });
  const addCat = () => {
    const number = catNumber.input.value.trim();
    if (!number) return;
    const v = toNumber(catValue.input.value);
    form.catalogNumbers.push({ catalog: newCatalog, number, catalogValue: Number.isFinite(v) ? v : null });
    catNumber.input.value = '';
    catValue.input.value = '';
    catalogTouched = true;
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

  // ---- Set (grouped by set in the drop-down)
  const setOptions = sets.listWithItems().flatMap((st) => st.items.map((it) => ({
    value: it.id, label: [it.faceValue && !it.label.startsWith(it.faceValue) ? it.faceValue : null, it.label].filter(Boolean).join(' '), group: st.name,
  })));

  // ---- Steps
  const panels = [
    h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Start with a photo of the front. Add the back, a close-up, the watermark or a certificate if you have them.'),
      photoRow, roleChips,
      button(h('span', { class: 'with-icon' }, icon('camera', 20), 'Add photo'), addPhoto, 'secondary'),
      h('div', { class: 'hint' }, 'On a phone you can take the photo now or pick one; on a computer, choose an image file.'),
      h('div', { class: 'group' },
        h('div', { class: 'strong with-badge' }, 'Identify from the photo', h('span', { class: 'badge-experimental' }, 'Experimental')),
        h('p', { class: 'small muted' }, 'Reads the country name, face value and year printed on the stamp, on this device. This is an early feature: suggestions can be wrong or missing, so check them before you use them.'),
        button(h('span', { class: 'with-icon' }, icon('search', 20), 'Read the stamp'), identify, 'secondary'),
        idSlot)),
    h('div', { class: 'stack' },
      issuer,
      lookupLinks(() => ({ ...form, year: toNumber(form.year), catalogNumbers: form.catalogNumbers })),
      two(h('div', { class: 'field' }, text('year', 'Year', { inputmode: 'numeric', after: checkYear }), yearNote), text('faceValue', 'Face value', { placeholder: '3c' })),
      text('designSubject', 'Design / subject', { placeholder: 'Locomotive' }),
      two(pick('stampType', 'Stamp type', STAMP_TYPES), text('currency', 'Currency', { placeholder: 'Cents' })),
      h('fieldset', { class: 'group' }, h('legend', {}, 'Catalog numbers'), catList, catalogSelectSlot,
        h('div', { class: 'three' }, catNumber.el, catValue.el, button('Add', addCat, 'secondary'))),
      setOptions.length
        ? select('Part of a set', setOptions, form.setItemId, (v) => { form.setItemId = v; }, { placeholder: 'Not part of a set', hint: 'Sets are on the Sets tab.' })
        : null,
      h('fieldset', { class: 'group' }, h('legend', {}, 'Tags'), tagRow,
        h('div', { class: 'two end' }, newTag.el, button('Add', addTag, 'secondary')))),
    h('div', { class: 'stack' },
      two(text('issueDate', 'Issue date', { placeholder: 'YYYY-MM-DD' }), text('colors', 'Color(s)', { placeholder: 'Ultramarine' })),
      text('perforation', 'Perforation', { placeholder: '11 x 10½', hint: 'One number, or two like 11 x 10½ (top and bottom, then sides).' }),
      two(pick('separation', 'Separation', SEPARATIONS), text('watermark', 'Watermark', { placeholder: 'None' })),
      two(pick('paperType', 'Paper', PAPER_TYPES), pick('printingMethod', 'Printing method', PRINTING_METHODS)),
      two(pick('gum', 'Gum', GUMS), pick('tagging', 'Tagging', TAGGINGS)),
      pick('format', 'Format', FORMATS),
      two(text('widthMm', 'Width (mm)', { inputmode: 'decimal' }), text('heightMm', 'Height (mm)', { inputmode: 'decimal' })),
      h('div', { class: 'three' }, text('designer', 'Designer'), text('engraver', 'Engraver'), text('printer', 'Printer'))),
    h('div', { class: 'stack' },
      two(pick('mintStatus', 'Mint or used', MINT_STATUSES), pick('centering', 'Centering', CENTERINGS)),
      two(text('grade', 'Grade (1–100)', { inputmode: 'numeric' }), text('cancellation', 'Cancellation')),
      text('faults', 'Faults', { placeholder: 'Thin, short perf…' }),
      toggle('Has a certificate', form.hasCertificate, (v) => { form.hasCertificate = v; }),
      h('fieldset', { class: 'group' }, h('legend', {}, 'Varieties and errors'),
        two(text('errorVariety', 'Error or variety', { placeholder: 'Inverted center' }), text('plateNumber', 'Plate number')),
        two(text('overprint', 'Overprint / surcharge'), text('shade', 'Shade')))),
    h('div', { class: 'stack' },
      two(text('quantity', 'Quantity', { inputmode: 'numeric' }), text('estimatedValue', 'Estimated value', { inputmode: 'decimal' })),
      two(text('purchasePrice', 'Purchase price', { inputmode: 'decimal' }), text('purchaseCurrency', 'Currency', { placeholder: 'USD' })),
      two(text('purchaseDate', 'Purchase date', { placeholder: 'YYYY-MM-DD' }), text('source', 'Bought from')),
      text('storageLocation', 'Stored in', { placeholder: 'Album 1, page 4' }),
      toggle('Available for trade', form.forTrade, (v) => { form.forTrade = v; }),
      text('notes', 'Notes', { multiline: true })),
  ];
  checkYear();

  let step = original ? Math.min(lastStep, STEPS.length - 1) : 0;
  const stepBar = h('nav', { class: 'steps', 'aria-label': 'Form steps' });
  const panelSlot = h('div');
  const nav = h('div', { class: 'step-nav' });
  const showStep = (n) => {
    step = n;
    lastStep = n;
    stepBar.replaceChildren(...STEPS.map((name, i) => h('button', {
      type: 'button', class: `step${i === step ? ' on' : ''}`, 'aria-current': i === step ? 'step' : null, onclick: () => showStep(i),
    }, h('span', { class: 'step-num' }, String(i + 1)), h('span', { class: 'step-name' }, name))));
    panelSlot.replaceChildren(h('h2', { class: 'step-title' }, STEPS[step]), panels[step]);
    nav.replaceChildren(
      step > 0 ? button(`← ${STEPS[step - 1]}`, () => showStep(step - 1), 'secondary') : h('span'),
      step < STEPS.length - 1 ? button(`${STEPS[step + 1]} →`, () => showStep(step + 1), 'secondary') : h('span'),
    );
    window.scrollTo(0, 0);
  };

  // ---- Save / delete
  const showError = (fieldName, message) => {
    if (STEP_OF[fieldName] !== undefined) showStep(STEP_OF[fieldName]);
    fields[fieldName]?.setError(message);
    tell('Check the form', `${FRIENDLY[fieldName] ?? fieldName}: ${message}`);
  };

  let saving = false;
  const save = async ({ next = false } = {}) => {
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
    const input = { ...rest, ...Object.fromEntries(NUMBER_FIELDS.map((f) => [f, toNumber(form[f])])), perfHorizontal, perfVertical };
    if (input.quantity === null) input.quantity = 1;
    // Same country and catalogue number as a stamp already in the collection?
    const dupes = stamps.findDuplicates(input, original?.id ?? null);
    if (dupes.length) {
      const other = stamps.get(dupes[0]);
      const choice = await ask('You may already have this stamp', `"${stampTitle(other)}" has the same country and catalogue number.`, [
        { text: 'Cancel', style: 'cancel' },
        ...(original ? [] : [{ text: 'Add to its quantity', value: 'qty' }]),
        { text: 'Save anyway', value: 'save' },
      ]);
      if (!choice) return;
      if (choice === 'qty') {
        stamps.addQuantity(other.id, input.quantity ?? 1);
        added.forEach(deletePhoto);
        added.length = 0;
        saving = true;
        finish(next, input, other.id);
        return;
      }
    }
    let saved;
    try {
      saved = original ? stamps.update(original.id, input) : stamps.create(input);
    } catch (e) {
      if (e instanceof ValidationError) {
        const f = e.field === 'perfHorizontal' || e.field === 'perfVertical' ? 'perforation' : e.field.replace(/\[.*$/, '');
        showError(f, e.detail);
      } else {
        tell('Couldn\'t save', String(e?.message ?? e));
      }
      return;
    }
    const kept = new Set(form.photos.map((p) => p.uri));
    [...(original?.photos.map((p) => p.uri) ?? []), ...added].filter((u) => !kept.has(u)).forEach(deletePhoto);
    added.length = 0;
    saving = true;
    await offerWantCheckOff(saved.id);
    finish(next, input, saved.id);
  };

  /** After saving: the next blank form (quick-add) or the Stamp Card. */
  const finish = (next, input, id) => {
    window.removeEventListener('hashchange', onLeave);
    if (next) {
      carry = { issuerId: input.issuerId ?? null, country: input.country ?? null, year: input.year ?? null, catalog: newCatalog, tags: input.tags ?? [] };
      lastStep = 0;
      go('add', { replace: true });
      refresh();
      toast('Saved. Ready for the next stamp.');
      return;
    }
    carry = null;
    if (original) back();
    else go(`stamp/${id}`, { replace: true });
  };

  const remove = async () => {
    if (!(await confirmAction('Delete this stamp?', 'Its Stamp Card and photos will be removed. This can\'t be undone.', 'Delete', true))) return;
    stamps.delete(original.id);
    [...original.photos.map((p) => p.uri), ...added].forEach(deletePhoto);
    saving = true;
    go('', { replace: true });
  };

  // Leaving without saving drops photos added in this visit.
  const onLeave = () => {
    window.removeEventListener('hashchange', onLeave);
    if (!saving) { added.forEach(deletePhoto); carry = null; }
  };
  window.addEventListener('hashchange', onLeave);

  showStep(step);
  return {
    title: original ? 'Edit stamp' : 'New stamp',
    actions: [button('Save', save, 'text')],
    body: h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); save(); } },
      !original && carry ? h('div', { class: 'filter-summary' },
        h('span', {}, `Quick add: kept ${[carry.country, carry.year, CATALOGS.labels[carry.catalog]].filter(Boolean).join(' · ')} from the last stamp.`),
        button('Clear', () => { carry = null; refresh(); }, 'text')) : null,
      stepBar, panelSlot, nav,
      button(original ? 'Save changes' : 'Save stamp', null, 'primary', { type: 'submit' }),
      original ? null : button('Save and add the next one', () => save({ next: true }), 'secondary'),
      h('p', { class: 'hint center' }, 'Every field is optional. Save whenever you like.'),
      original ? button('Delete stamp', remove, 'danger') : null),
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

/** "Look it up: Colnect · StampWorld", using whatever the form holds when tapped. */
export function lookupLinks(getStamp) {
  return h('div', { class: 'lookups small' },
    h('span', { class: 'muted' }, 'Look it up:'),
    LOOKUP_SITES.map((site) => h('a', {
      href: lookupUrl(site.site, {}), target: '_blank', rel: 'noopener noreferrer',
      onclick: (e) => {
        const st = getStamp();
        if (!hasLookupTerms(st)) { e.preventDefault(); tell('Nothing to look up yet', 'Choose the country, or add the year or catalogue number, first.'); return; }
        e.currentTarget.href = lookupUrl(site.site, st);
      },
    }, site.name, icon('chevron', 14))));
}
