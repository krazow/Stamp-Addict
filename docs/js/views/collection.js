import { app, go, installApp, refresh } from '../app.js';
import { backupIsDue, lastBackupAt } from '../backupfiles.js';
import { photoUrl } from '../photos.js';
import { issuerById, REGIONS, fold } from '../issuers.js';
import { CATALOGS, MINT_STATUSES } from '../lists.js';
import { button, empty, h, icon, optionsOf, select } from '../ui.js';

// Kept between visits so search and filters survive opening a stamp.
const state = { query: '', tag: null, mode: localStorageGet('sa-view') ?? 'grid', region: null, issuer: null, condition: null, catalog: null, filtersOpen: false };

/** Opens the collection filtered to one issuer (used by the Countries tab). */
export function showIssuer(issuerKey) {
  Object.assign(state, { issuer: issuerKey, region: null, tag: null, query: '' });
}

const issuerKeyOf = (s) => s.issuerId ?? (s.country ? `name:${fold(s.country)}` : null);

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* not important */ } }

export function thumb(uri, cls = 'thumb') {
  const url = photoUrl(uri);
  return url
    ? h('img', { class: cls, src: url, alt: '', loading: 'lazy' })
    : h('div', { class: `${cls} placeholder`, 'aria-hidden': 'true' }, icon('stamp', 28));
}

export function collectionView() {
  const { stamps } = app.repos;
  const all = stamps.list({ tag: state.tag ?? undefined });
  const tags = stamps.allTags();
  const total = app.repos.db.rows('stamps').length;

  const listEl = h('div');
  // Filters from the drop-downs; search and tags apply on top.
  const filtered = all.filter((s) => {
    const i = issuerById(s.issuerId);
    if (state.region && i?.region !== state.region) return false;
    if (state.issuer && issuerKeyOf(s) !== state.issuer) return false;
    if (state.condition && s.mintStatus !== state.condition) return false;
    if (state.catalog && !s.catalogs.includes(state.catalog)) return false;
    return true;
  });
  const activeFilters = ['region', 'issuer', 'condition', 'catalog'].filter((k) => state[k]).length;
  const draw = () => {
    const q = fold(state.query);
    const shown = q ? filtered.filter((s) => [s.country, s.year?.toString(), s.faceValue, s.designSubject, s.catalogText, ...(issuerById(s.issuerId)?.aliases ?? [])]
      .some((v) => v && fold(v).includes(q))) : filtered;
    if (!shown.length) { listEl.replaceChildren(h('p', { class: 'muted center' }, 'No stamps match.')); return; }
    listEl.replaceChildren(state.mode === 'grid'
      ? h('div', { class: 'grid' }, shown.map((s) => h('a', { class: 'cell', href: `#/stamp/${s.id}`, onclick: (e) => { e.preventDefault(); go(`stamp/${s.id}`); } },
        thumb(s.thumbnailUri),
        h('div', { class: 'cell-title' }, [s.faceValue, s.country].filter(Boolean).join(' · ') || 'Untitled'),
        h('div', { class: 'cell-sub' }, [s.year, s.primaryCatalog].filter(Boolean).join(' · ')))))
      : h('div', { class: 'rows' }, shown.map((s) => h('a', { class: 'row', href: `#/stamp/${s.id}`, onclick: (e) => { e.preventDefault(); go(`stamp/${s.id}`); } },
        thumb(s.thumbnailUri, 'thumb-small'),
        h('div', { class: 'row-text' },
          h('div', { class: 'row-title' }, s.designSubject || [s.faceValue, s.country].filter(Boolean).join(' ') || 'Untitled stamp'),
          h('div', { class: 'row-sub' }, [s.country, s.year, s.primaryCatalog].filter(Boolean).join(' · '))),
        icon('chevron', 18)))));
  };

  const remind = backupIsDue(app.repos)
    ? h('a', { class: 'banner', href: '#/backup', onclick: (e) => { e.preventDefault(); go('backup'); } }, icon('cloud'),
      h('span', {}, lastBackupAt(app.repos) ? 'Last backup was over 30 days ago. Back up now' : 'Your collection isn\'t backed up yet. Back it up now'),
      icon('chevron', 18))
    : null;

  const install = app.installPrompt
    ? h('div', { class: 'banner banner-soft' }, h('span', {}, 'Install Stamp Addict as an app on this device.'), button('Install', installApp, 'secondary'))
    : null;

  const body = total === 0 ? h('div', {}, install, empty('Start your collection',
    'Photograph a stamp to make its Stamp Card. Every detail is optional; you can add them later.',
    button('Add a stamp', () => go('add'))))
    : h('div', { class: 'stack' },
      install, remind,
      h('div', { class: 'search-row' },
        h('label', { class: 'search' }, icon('search', 18),
          h('input', { type: 'search', placeholder: 'Search country, year, catalog #', 'aria-label': 'Search stamps', value: state.query,
            oninput: (e) => { state.query = e.target.value; draw(); } })),
        h('button', { type: 'button', class: `icon-btn boxed${activeFilters ? ' active' : ''}`, 'aria-label': 'Filters', 'aria-expanded': String(state.filtersOpen), title: 'Filters',
          onclick: () => { state.filtersOpen = !state.filtersOpen; refresh(); } }, icon('filter'), activeFilters ? h('span', { class: 'badge' }, String(activeFilters)) : null),
        h('button', { type: 'button', class: 'icon-btn boxed', 'aria-label': state.mode === 'grid' ? 'Show as list' : 'Show as grid',
          onclick: () => { state.mode = state.mode === 'grid' ? 'list' : 'grid'; localStorageSet('sa-view', state.mode); refresh(); } },
          icon(state.mode === 'grid' ? 'list' : 'grid'))),
      filterPanel(all, activeFilters),
      tags.length ? h('div', { class: 'chips scroll' }, [{ name: 'All' }, ...tags].map((t) => {
        const on = t.name === 'All' ? state.tag === null : state.tag === t.name;
        return h('button', { type: 'button', class: `chip${on ? ' on' : ''}`, 'aria-pressed': String(on),
          onclick: () => { state.tag = t.name === 'All' ? null : t.name; refresh(); } }, t.name);
      })) : null,
      listEl);
  if (total) draw();

  return {
    title: 'My collection',
    actions: [h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Backup and restore', title: 'Backup and restore', onclick: () => go('backup') }, icon('cloud'))],
    body: h('div', {}, body, total ? h('button', { type: 'button', class: 'fab', 'aria-label': 'Add a stamp', onclick: () => go('add') }, icon('plus', 30)) : null),
  };
}

function filterPanel(all, activeFilters) {
  if (!state.filtersOpen && !activeFilters) return null;
  const set = (k) => (v) => { state[k] = v; refresh(); };
  if (!state.filtersOpen) {
    return h('div', { class: 'filter-summary' }, h('span', {}, `${activeFilters} filter${activeFilters === 1 ? '' : 's'} on`),
      button('Change', () => { state.filtersOpen = true; refresh(); }, 'text'),
      button('Clear', () => { Object.assign(state, { region: null, issuer: null, condition: null, catalog: null }); refresh(); }, 'text'));
  }
  // Only offer what's in the collection.
  const issuers = new Map();
  for (const s of all) {
    const key = issuerKeyOf(s);
    if (!key || issuers.has(key)) continue;
    const i = issuerById(s.issuerId);
    if (state.region && i?.region !== state.region) continue;
    issuers.set(key, { value: key, label: i?.name ?? s.country, group: i?.region ?? 'Not in the list' });
  }
  const issuerOpts = [...issuers.values()].sort((a, b) => (REGIONS.indexOf(a.group) + 1 || 99) - (REGIONS.indexOf(b.group) + 1 || 99) || a.label.localeCompare(b.label));
  const regions = REGIONS.filter((r) => all.some((s) => issuerById(s.issuerId)?.region === r));
  const catalogs = CATALOGS.values.filter((c) => all.some((s) => s.catalogs.includes(c)));
  return h('div', { class: 'filters' },
    h('div', { class: 'two' },
      select('Region', regions.map((r) => ({ value: r, label: r })), state.region, (v) => { state.region = v; state.issuer = null; refresh(); }, { placeholder: 'All regions' }),
      select('Country or issuer', issuerOpts, state.issuer, set('issuer'), { placeholder: 'All' })),
    h('div', { class: 'two' },
      select('Condition', optionsOf(MINT_STATUSES), state.condition, set('condition'), { placeholder: 'Any condition' }),
      select('Catalog', catalogs.map((c) => ({ value: c, label: CATALOGS.labels[c] })), state.catalog, set('catalog'), { placeholder: 'Any catalog' })),
    h('div', { class: 'filter-actions' },
      activeFilters ? button('Clear filters', () => { Object.assign(state, { region: null, issuer: null, condition: null, catalog: null }); refresh(); }, 'text') : h('span'),
      button('Done', () => { state.filtersOpen = false; refresh(); }, 'text')));
}
