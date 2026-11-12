// Browse by country: every issuer in the collection, grouped by region,
// with how many stamps you have from each and the years you cover.
import { app, go } from '../app.js';
import { REGIONS, SUBREGIONS, fold, issuerById, issuerSummary } from '../issuers.js';
import { button, empty, h, icon } from '../ui.js';
import { showIssuer } from './collection.js';
import { pickIssuer } from './issuerPicker.js';

export function countriesView() {
  const rows = app.repos.db.rows('stamps');
  const groups = new Map();
  for (const s of rows) {
    const i = issuerById(s.issuer_id);
    const key = i ? i.id : s.country ? `name:${fold(s.country)}` : null;
    if (!key) continue;
    const g = groups.get(key) ?? { key, issuer: i, name: i?.name ?? s.country, count: 0, years: [] };
    g.count += s.quantity ?? 1;
    if (s.year) g.years.push(s.year);
    groups.set(key, g);
  }
  const open = (key) => { showIssuer(key); go('', { replace: false }); };
  const browseAll = async () => {
    const r = await pickIssuer({ title: 'Look up an issuer' });
    if (r?.name) open(r.id ?? `name:${fold(r.name)}`);
  };

  if (!groups.size) {
    return {
      title: 'Countries',
      body: empty('No countries yet', 'Choose the country or issuer when you add a stamp, and your collection is grouped here by region.',
        button('Look up an issuer', browseAll, 'secondary')),
    };
  }
  const item = (g) => h('a', { class: 'row', href: '#/', onclick: (e) => { e.preventDefault(); open(g.key); } },
    h('div', { class: 'row-text' },
      h('div', { class: 'row-title' }, g.name),
      h('div', { class: 'row-sub' }, [g.issuer ? issuerSummary(g.issuer) : 'Not in the list',
        g.years.length ? `you have ${Math.min(...g.years)}${Math.max(...g.years) !== Math.min(...g.years) ? `–${Math.max(...g.years)}` : ''}` : null].filter(Boolean).join(' · '))),
    h('span', { class: 'count' }, String(g.count)), icon('chevron', 18));

  const all = [...groups.values()];
  const sections = REGIONS.flatMap((region) => {
    const inRegion = all.filter((g) => g.issuer?.region === region);
    if (!inRegion.length) return [];
    const total = inRegion.reduce((n, g) => n + g.count, 0);
    return [h('details', { class: 'region', open: true },
      h('summary', {}, h('span', {}, region), h('span', { class: 'muted small' }, `${inRegion.length} ${inRegion.length === 1 ? 'issuer' : 'issuers'} · ${total} ${total === 1 ? 'stamp' : 'stamps'}`)),
      SUBREGIONS[region].map((sub) => {
        const list = inRegion.filter((g) => g.issuer.subregion === sub).sort((a, b) => a.name.localeCompare(b.name));
        return list.length ? [h('div', { class: 'group-head' }, sub), h('div', { class: 'rows' }, list.map(item))] : null;
      }))];
  });
  const loose = all.filter((g) => !g.issuer).sort((a, b) => a.name.localeCompare(b.name));
  return {
    title: 'Countries',
    actions: [h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Look up an issuer', title: 'Look up an issuer', onclick: browseAll }, icon('search'))],
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, `${all.length} ${all.length === 1 ? 'country or issuer' : 'countries and issuers'} in your collection. Tap one to see its stamps.`),
      sections,
      loose.length ? h('details', { class: 'region', open: true }, h('summary', {}, h('span', {}, 'Typed in (not in the list)')), h('div', { class: 'rows' }, loose.map(item))) : null),
  };
}
