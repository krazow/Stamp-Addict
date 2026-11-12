import { app, back, go, refresh } from '../app.js';
import { toNumber } from '../format.js';
import { CATALOGS, MINT_STATUSES, PRIORITIES } from '../lists.js';
import { ValidationError } from '../validation.js';
import { button, chips, confirmAction, empty, field, h, icon, optionsOf, select, tell } from '../ui.js';
import { issuerById } from '../issuers.js';
import { issuerField } from './issuerPicker.js';
import { catalogOptions } from './stampForm.js';

const GROUPS = [['high', 'High priority'], ['medium', 'Medium priority'], ['low', 'Low priority']];
let showDone = false;

export function wantsView() {
  const { wants } = app.repos;
  const all = wants.list({ includeAcquired: true });
  const add = () => go('wants/new');
  if (!all.length) {
    return {
      title: 'Want list',
      body: empty('Your want list is empty', 'Add stamps you\'re looking for. When you save a Stamp Card that matches one, the app offers to check it off.', button('Add a want', add)),
    };
  }
  const open = all.filter((w) => !w.acquiredAt);
  const done = all.filter((w) => w.acquiredAt);

  const row = (w) => h('div', { class: 'want' },
    w.acquiredAt
      ? h('span', { class: 'check on', 'aria-label': 'Checked off' }, icon('check', 18))
      : h('button', { type: 'button', class: 'check', role: 'checkbox', 'aria-checked': 'false', 'aria-label': `Got it: ${w.description}`,
        onclick: () => { wants.markAcquired(w.id); refresh(); } }),
    h('div', { class: 'want-text' },
      h('div', { class: `want-title${w.acquiredAt ? ' done' : ''}` }, w.description),
      h('div', { class: 'small muted' }, [w.country, w.year, w.catalog && w.catalogNumber ? `${CATALOGS.labels[w.catalog]} ${w.catalogNumber}` : null,
        w.maxPrice != null ? `up to ${w.maxPrice}` : null].filter(Boolean).join(' · '))),
    h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Remove ${w.description}`, title: 'Remove',
      onclick: async () => { if (await confirmAction('Remove from want list?', w.description, 'Remove', true)) { wants.remove(w.id); refresh(); } } }, icon('trash', 18)));

  return {
    title: 'Want list',
    body: h('div', { class: 'stack' },
      button('Add a want', add),
      GROUPS.map(([key, title]) => {
        const items = open.filter((w) => w.priority === key);
        return items.length ? h('div', { class: 'stack-tight' }, h('h2', { class: 'heading' }, title), items.map(row)) : null;
      }),
      done.length ? button(showDone ? 'Hide checked-off stamps' : `Show checked-off stamps (${done.length})`, () => { showDone = !showDone; refresh(); }, 'text') : null,
      showDone && done.length ? h('div', { class: 'stack-tight' }, h('h2', { class: 'heading' }, 'Checked off'), done.map(row)) : null),
  };
}

export function newWantView() {
  const v = { catalog: 'scott', condition: null, priority: 'medium' };
  const description = field('What are you looking for?', { placeholder: 'Inverted Jenny' });
  let country = null;
  let catalogTouched = false;
  const catalogSlot = h('div');
  const drawCatalog = () => catalogSlot.replaceChildren(select('Catalog', catalogOptions(), v.catalog, (c) => { v.catalog = c ?? 'scott'; catalogTouched = true; }, { allowEmpty: false }));
  drawCatalog();
  const countryField = issuerField('Country or issuer', null, (c) => {
    country = c;
    const i = issuerById(c?.id);
    if (i && !catalogTouched) { v.catalog = i.catalog; drawCatalog(); }
  });
  const year = field('Year', { inputmode: 'numeric' });
  const number = field('Catalog number', { autocapitalize: 'characters', hint: 'With a catalog number, the app spots this want when you add the stamp.' });
  const maxPrice = field('Most you\'d pay', { inputmode: 'decimal' });
  const notes = field('Notes', { multiline: true });
  const save = () => {
    try {
      app.repos.wants.add({
        description: description.input.value, country: country?.name ?? null, year: toNumber(year.input.value),
        catalog: number.input.value.trim() ? v.catalog : null, catalogNumber: number.input.value.trim() || null,
        wantedCondition: v.condition, maxPrice: toNumber(maxPrice.input.value), priority: v.priority,
        notes: notes.input.value.trim() || null,
      });
      back();
    } catch (e) {
      if (!(e instanceof ValidationError)) { tell('Couldn\'t save', String(e?.message ?? e)); return; }
      if (e.field === 'description') description.setError('Describe the stamp you want.');
      else if (e.field === 'maxPrice') maxPrice.setError('Enter an amount, like 25.');
      else tell('Check the form', e.message);
    }
  };
  return {
    title: 'Add a want',
    actions: [button('Save', save, 'text')],
    body: h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); save(); } },
      description.el, countryField, year.el,
      catalogSlot,
      number.el,
      select('Condition wanted', optionsOf(MINT_STATUSES), null, (c) => { v.condition = c; }, { placeholder: 'Any condition' }),
      maxPrice.el,
      chips('Priority', optionsOf(PRIORITIES), 'medium', (p) => { v.priority = p; }, { allowClear: false }),
      notes.el,
      button('Save', null, 'primary', { type: 'submit' })),
  };
}
