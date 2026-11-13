// Collection statistics: totals, then breakdowns by region, country,
// condition and decade, drawn as simple bars.
import { app } from '../app.js';
import { collectionStats } from '../stats.js';
import { empty, h } from '../ui.js';

const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function bars(title, rows, { max = 12, showValue = false } = {}) {
  if (!rows.length) return null;
  const shown = rows.slice(0, max);
  const top = Math.max(...shown.map((r) => r.count), 1);
  return h('section', { class: 'card' }, h('h3', {}, title),
    h('div', { class: 'bars' }, shown.map((r) => h('div', { class: 'bar-row' },
      h('div', { class: 'bar-label' }, r.name),
      h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${Math.max(2, (r.count / top) * 100)}%` } })),
      h('div', { class: 'bar-num' }, String(r.count), showValue && r.value ? h('span', { class: 'muted' }, ` · ${fmt(r.value)}`) : null)))),
    rows.length > max ? h('div', { class: 'small muted' }, `and ${rows.length - max} more`) : null);
}

export function statsView() {
  const s = collectionStats(app.repos);
  if (!s.totals.cards) return { title: 'Statistics', body: empty('No stamps yet', 'Statistics appear once you add stamps.') };
  const t = s.totals;
  const tile = (label, value, note) => h('div', { class: 'tile' }, h('div', { class: 'tile-num' }, value), h('div', { class: 'small' }, label), note ? h('div', { class: 'small muted' }, note) : null);
  const valueNote = (n) => (n < t.cards ? `${n} of ${t.cards} cards have one` : null);
  return {
    title: 'Statistics',
    body: h('div', { class: 'stack' },
      h('div', { class: 'tiles' },
        tile('stamps', fmt(t.stamps), t.stamps !== t.cards ? `on ${t.cards} Stamp Cards` : null),
        tile('countries and issuers', fmt(s.countries)),
        t.estimatedCount ? tile('estimated value', fmt(t.estimated), valueNote(t.estimatedCount)) : null,
        t.catalogueCount ? tile('catalogue value', fmt(t.catalogue), valueNote(t.catalogueCount)) : null,
        t.paidCount ? tile('paid', fmt(t.paid), valueNote(t.paidCount)) : null,
        s.sets.total ? tile('sets complete', `${s.sets.complete} of ${s.sets.total}`, `${s.sets.owned} of ${s.sets.slots} set stamps owned`) : null,
        tile('wants open', fmt(s.wantsOpen))),
      t.estimatedCount || t.paidCount || t.catalogueCount ? h('p', { class: 'small muted' }, 'Values are added up as you entered them. Different currencies aren\'t converted.') : null,
      bars('By region', s.byRegion, { showValue: !!t.estimatedCount }),
      bars('Top countries and issuers', s.byCountry, { showValue: !!t.estimatedCount }),
      bars('By condition', s.byCondition),
      bars('By decade', s.byDecade, { max: 30 })),
  };
}
