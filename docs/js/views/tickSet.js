// Tick off a set: add the stamps you own from a set in one go, with the
// country, year, face value and catalogue number filled in from the set.
import { app, back } from '../app.js';
import { matchIssuer } from '../importcsv.js';
import { CATALOG_SHORT, MINT_STATUSES } from '../lists.js';
import { ask, button, empty, h, optionsOf, select, toast } from '../ui.js';

export function tickSetView(setId) {
  const { sets, stamps, wants } = app.repos;
  let set;
  try { set = sets.completion(setId); } catch {
    return { title: 'Tick off a set', body: empty('Set not found', 'It may have been deleted.') };
  }
  const chosen = new Set();
  let condition = null;
  const count = h('span');
  const addBtn = button('Add stamps', null, 'primary', { disabled: true });
  const update = () => {
    addBtn.textContent = chosen.size ? `Add ${chosen.size} ${chosen.size === 1 ? 'stamp' : 'stamps'}` : 'Add stamps';
    addBtn.disabled = !chosen.size;
    count.textContent = `${chosen.size} ticked`;
  };
  const issuer = matchIssuer(set.country);

  addBtn.addEventListener('click', async () => {
    const created = [];
    app.repos.db.transaction(() => {
      for (const item of set.missing.filter((it) => chosen.has(it.id))) {
        const design = item.faceValue && item.label.startsWith(item.faceValue) ? item.label.slice(item.faceValue.length).trim() : item.label;
        created.push(stamps.create({
          issuerId: issuer?.id ?? null, country: issuer?.name ?? set.country ?? null, year: set.year ?? null,
          faceValue: item.faceValue ?? null, designSubject: design || null, setItemId: item.id, mintStatus: condition,
          catalogNumbers: item.catalog && item.catalogNumber ? [{ catalog: item.catalog, number: item.catalogNumber }] : [],
        }).id);
      }
    });
    const matches = new Map();
    for (const id of created) for (const w of wants.matchesForStamp(id)) if (!matches.has(w.id)) matches.set(w.id, { want: w, stampId: id });
    if (matches.size) {
      const yes = await ask('On your want list', `${matches.size} of these ${matches.size === 1 ? 'is' : 'are'} on your want list. Check ${matches.size === 1 ? 'it' : 'them'} off?`, [
        { text: 'Not now', style: 'cancel' }, { text: 'Check off', value: true },
      ]);
      if (yes) for (const { want, stampId } of matches.values()) wants.markAcquired(want.id, stampId);
    }
    toast(`Added ${created.length} ${created.length === 1 ? 'stamp' : 'stamps'}. Add photos and details any time.`);
    back();
  });

  return {
    title: 'Tick off a set',
    body: h('div', { class: 'stack' },
      h('div', {}, h('h2', { class: 'card-title' }, set.name), h('div', { class: 'muted' }, [set.country, set.year, `${set.owned} of ${set.total} owned`].filter(Boolean).join(' · '))),
      h('p', { class: 'muted' }, 'Tick the stamps you have. Each becomes a Stamp Card with the country, year, face value and catalogue number filled in. Add photos and details later.'),
      set.missing.length ? h('div', { class: 'rows' }, set.missing.map((it) => {
        const box = h('input', { type: 'checkbox', onchange: () => { if (box.checked) chosen.add(it.id); else chosen.delete(it.id); update(); } });
        return h('label', { class: 'row tick-row' }, box,
          h('div', { class: 'row-text' }, h('div', { class: 'row-title' }, it.label),
            it.catalog && it.catalogNumber ? h('div', { class: 'row-sub' }, `${CATALOG_SHORT[it.catalog] || it.catalog} ${it.catalogNumber}`) : null));
      })) : empty('Nothing missing', 'You already have every stamp in this set.'),
      set.missing.length ? h('div', { class: 'two end' },
        button('Tick all', () => { document.querySelectorAll('.tick-row input').forEach((b) => { b.checked = true; }); set.missing.forEach((it) => chosen.add(it.id)); update(); }, 'secondary'),
        count) : null,
      set.missing.length ? select('Condition for all of them', optionsOf(MINT_STATUSES), null, (v) => { condition = v; }, { placeholder: 'Not recorded' }) : null,
      set.missing.length ? addBtn : null),
  };
}
