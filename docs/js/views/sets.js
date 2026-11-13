import { app, back, go, refresh } from '../app.js';
import { toNumber } from '../format.js';
import { parseSetItems } from '../repos.js';
import { ValidationError } from '../validation.js';
import { button, confirmAction, empty, field, h, icon, tell } from '../ui.js';
import { issuerField } from './issuerPicker.js';

export function setsView() {
  const { sets, wants } = app.repos;
  const all = sets.allCompletion();
  const countries = sets.completionByCountry();

  const newSet = () => go('sets/new');
  if (!all.length) {
    return {
      title: 'Sets',
      body: empty('Track a set', 'Add a stamp issue and the stamps it contains. Stamps you own with matching catalog numbers count automatically.',
        button('New set', newSet)),
    };
  }

  const addMissing = (set) => {
    const added = wants.addMissingFromSet(sets, set.setId);
    tell(added.length ? 'Added to want list' : 'Already on your want list', added.length
      ? `${added.length} missing ${added.length === 1 ? 'stamp' : 'stamps'} from ${set.name} added.`
      : `Every missing stamp from ${set.name} is already on your want list.`);
  };
  const remove = async (set) => {
    if (await confirmAction('Delete set?', `${set.name} will be removed. Your stamps stay in your collection.`, 'Delete', true)) {
      sets.delete(set.setId);
      refresh();
    }
  };

  return {
    title: 'Sets',
    body: h('div', { class: 'stack' },
      button('New set', newSet, 'secondary'),
      countries.length > 1 ? h('div', { class: 'stack-tight' }, h('h2', { class: 'heading' }, 'By country'),
        h('div', { class: 'country-cards' }, countries.map((c) => h('div', { class: 'country-card' },
          h('div', { class: 'small' }, c.country), h('div', { class: 'big-number' }, `${c.percent}%`), h('div', { class: 'small muted' }, `${c.owned} of ${c.total}`))))) : null,
      h('h2', { class: 'heading' }, 'Least complete first'),
      all.map((set) => h('section', { class: 'card' },
        h('div', { class: 'card-head' },
          h('div', {}, h('div', { class: 'set-name' }, set.name), h('div', { class: 'small muted' }, [set.country, set.year].filter(Boolean).join(' · '))),
          h('div', { class: 'counts' }, `${set.owned} of ${set.total}`)),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(set.percent), 'aria-label': `${set.name} completion` },
          h('div', { class: 'bar-fill', style: { width: `${set.percent}%` } })),
        h('div', { class: 'slots' }, set.items.map((it) => h('span', { class: `slot ${it.owned ? 'owned' : 'missing'}`, title: it.owned ? 'Owned' : 'Missing' }, it.faceValue || it.label))),
        h('div', { class: 'card-actions' },
          set.missing.length ? h('div', { class: 'row-buttons' },
            button('Tick off stamps I own', () => go(`sets/${set.setId}/tick`), 'text'),
            button('Add missing to want list', () => addMissing(set), 'text')) : h('span', { class: 'small muted' }, 'Complete'),
          h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Delete ${set.name}`, title: 'Delete set', onclick: () => remove(set) }, icon('trash', 18)))))),
  };
}

export function newSetView() {
  const name = field('Set name', { placeholder: '1869 Pictorial Issue' });
  let country = null;
  const countryField = issuerField('Country or issuer', null, (v) => { country = v; });
  const year = field('Year', { placeholder: '1869', inputmode: 'numeric' });
  const items = field('Stamps in the set', {
    multiline: true, placeholder: '1c Franklin | Scott 112\n2c Post Rider | Scott 113\n3c Locomotive | Scott 114',
    hint: 'One stamp per line. Add | and a catalog number (Scott 112, SG 2, Michel 28) so stamps you own fill in automatically.',
  });
  items.input.rows = 8;
  const save = () => {
    try {
      app.repos.sets.create({ name: name.input.value, country: country?.name ?? null, year: toNumber(year.input.value), items: parseSetItems(items.input.value) });
      back();
    } catch (e) {
      if (!(e instanceof ValidationError)) { tell('Couldn\'t save the set', String(e?.message ?? e)); return; }
      if (e.field === 'name') name.setError('Give the set a name.');
      else items.setError(e.field === 'items' ? 'Add at least one stamp, one per line.' : e.detail);
    }
  };
  return {
    title: 'New set',
    actions: [button('Save', save, 'text')],
    body: h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); save(); } },
      name.el, countryField, year.el, items.el, button('Save set', null, 'primary', { type: 'submit' })),
  };
}
