// Collection statistics, worked out from what the collector entered.
// Values are summed as entered: different currencies aren't converted.
import { issuerById } from './issuers.js';
import { MINT_STATUSES } from './lists.js';

const add = (map, key, by) => {
  const cur = map.get(key) ?? { count: 0, value: 0, cards: 0 };
  cur.count += by.count; cur.value += by.value; cur.cards += 1;
  map.set(key, cur);
};
const sorted = (map) => [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

export function collectionStats(repos) {
  const db = repos.db;
  const stamps = db.rows('stamps');
  const catValue = new Map();
  for (const c of db.rows('catalog_numbers')) {
    if (c.catalog_value != null && !catValue.has(c.stamp_id)) catValue.set(c.stamp_id, c.catalog_value);
  }
  const totals = { cards: stamps.length, stamps: 0, estimated: 0, estimatedCount: 0, paid: 0, paidCount: 0, catalogue: 0, catalogueCount: 0 };
  const byRegion = new Map();
  const byCountry = new Map();
  const byCondition = new Map();
  const byDecade = new Map();
  for (const s of stamps) {
    const qty = s.quantity ?? 1;
    totals.stamps += qty;
    const est = s.estimated_value != null ? s.estimated_value * qty : 0;
    if (s.estimated_value != null) { totals.estimated += est; totals.estimatedCount++; }
    if (s.purchase_price != null) { totals.paid += s.purchase_price; totals.paidCount++; }
    if (catValue.has(s.id)) { totals.catalogue += catValue.get(s.id) * qty; totals.catalogueCount++; }
    const i = issuerById(s.issuer_id);
    add(byRegion, i?.region ?? (s.country ? 'Typed in' : 'No country'), { count: qty, value: est });
    add(byCountry, i?.name ?? s.country ?? 'No country', { count: qty, value: est });
    add(byCondition, s.mint_status ? MINT_STATUSES.labels[s.mint_status] : 'Not recorded', { count: qty, value: est });
    add(byDecade, s.year ? `${Math.floor(s.year / 10) * 10}s` : 'No year', { count: qty, value: est });
  }
  const sets = repos.sets.allCompletion();
  const decades = sorted(byDecade).sort((a, b) => (a.name === 'No year') - (b.name === 'No year') || a.name.localeCompare(b.name));
  return {
    totals,
    countries: byCountry.size,
    byRegion: sorted(byRegion),
    byCountry: sorted(byCountry),
    byCondition: sorted(byCondition),
    byDecade: decades,
    sets: { total: sets.length, complete: sets.filter((x) => x.total && x.owned === x.total).length, owned: sets.reduce((n, x) => n + x.owned, 0), slots: sets.reduce((n, x) => n + x.total, 0) },
    wantsOpen: repos.wants.list().length,
  };
}
