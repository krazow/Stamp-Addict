// The country / issuer drop-down: a searchable list of every stamp issuer,
// grouped by region, with the ones you use most at the top.
import { app } from '../app.js';
import { REGIONS, allIssuers, fold, groupedIssuers, issuerById, issuerSummary, searchIssuers } from '../issuers.js';
import { h, icon } from '../ui.js';

/** Issuers used on the most recently added stamps, newest first. */
export function recentIssuers(max = 6) {
  const seen = new Set();
  const out = [];
  const stamps = [...app.repos.db.rows('stamps')].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  for (const s of stamps) {
    const i = issuerById(s.issuer_id);
    if (i && !seen.has(i.id)) { seen.add(i.id); out.push(i); if (out.length === max) break; }
  }
  return out;
}

let lastRegion = '';

/**
 * Opens the picker. Resolves { id, name } for a choice, { id: null, name }
 * for a name typed by hand, { id: null, name: null } for "clear", or
 * undefined if closed without choosing.
 */
export function pickIssuer({ current = null, title = 'Country or issuer' } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'sheet', 'aria-label': title });
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const results = h('div', { class: 'sheet-list', role: 'listbox', 'aria-label': 'Issuers' });

    const option = (i, alias) => h('button', {
      type: 'button', role: 'option', class: `issuer-option${current?.id === i.id ? ' on' : ''}`,
      'aria-selected': String(current?.id === i.id), onclick: () => done({ id: i.id, name: i.name }),
    },
    h('span', { class: 'issuer-name' }, i.name, alias ? h('span', { class: 'muted' }, ` (${alias})`) : null),
    h('span', { class: 'issuer-sub' }, issuerSummary(i)));

    const search = h('input', { type: 'search', placeholder: 'Search, e.g. Ceylon, Bayern, Siam', 'aria-label': 'Search issuers', autocomplete: 'off' });
    const region = h('select', { 'aria-label': 'Region' }, h('option', { value: '' }, 'All regions'), REGIONS.map((r) => h('option', { value: r }, r)));
    region.value = lastRegion;

    const draw = () => {
      const q = search.value.trim();
      lastRegion = region.value;
      const inRegion = (i) => !region.value || i.region === region.value;
      if (q) {
        const found = searchIssuers(q, 80).filter((r) => inRegion(r.issuer));
        const exact = found.some((r) => fold(r.issuer.name) === fold(q));
        results.replaceChildren(...[
          ...found.map((r) => option(r.issuer, r.alias)),
          found.length ? null : h('p', { class: 'muted pad' }, region.value ? `No match in ${region.value}. Try All regions.` : 'No match in the list.'),
          exact ? null : h('button', { type: 'button', class: 'issuer-option typed', onclick: () => done({ id: null, name: q }) },
            h('span', { class: 'issuer-name' }, `Use “${q}”`), h('span', { class: 'issuer-sub' }, 'For an issuer that isn\'t in the list')),
        ].filter(Boolean));
        return;
      }
      const recent = recentIssuers().filter(inRegion);
      results.replaceChildren(...[
        current?.id || current?.name ? h('button', { type: 'button', class: 'issuer-option clear', onclick: () => done({ id: null, name: null }) },
          h('span', { class: 'issuer-name' }, 'No country or issuer')) : null,
        recent.length ? [h('div', { class: 'group-head' }, 'Recently used'), recent.map((i) => option(i))] : null,
        groupedIssuers(inRegion).map((g) => [
          region.value ? null : h('div', { class: 'region-head' }, g.region),
          g.subregions.map((s) => [h('div', { class: 'group-head' }, s.name), s.issuers.map((i) => option(i))]),
        ]),
      ].flat(Infinity).filter(Boolean));
    };
    search.addEventListener('input', draw);
    region.addEventListener('change', draw);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); results.querySelector('.issuer-option')?.click(); }
    });

    dlg.append(
      h('div', { class: 'sheet-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => done(undefined) }, icon('close'))),
      h('div', { class: 'sheet-tools' },
        h('label', { class: 'search' }, icon('search', 18), search),
        h('div', { class: 'select-wrap' }, region),
        h('div', { class: 'small muted' }, `${allIssuers().length.toLocaleString()} issuers`)),
      results,
    );
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(undefined); });
    document.body.append(dlg);
    dlg.showModal();
    draw();
    search.focus();
  });
}

/** The field that opens the picker: shows the chosen issuer and its years. */
export function issuerField(label, value, onChange, { hint } = {}) {
  let cur = value;
  const btn = h('button', { type: 'button', class: 'picker-btn' });
  const render = () => {
    const i = issuerById(cur?.id);
    btn.replaceChildren(
      h('span', { class: 'picker-text' },
        h('span', { class: cur?.name ? '' : 'muted' }, cur?.name || 'Choose…'),
        i ? h('span', { class: 'issuer-sub' }, `${i.subregion} · ${issuerSummary(i)}`) : cur?.name ? h('span', { class: 'issuer-sub' }, 'Not in the list') : null),
      icon('chevron', 18));
  };
  btn.addEventListener('click', async () => {
    const r = await pickIssuer({ current: cur, title: label });
    if (r === undefined) return;
    cur = r.name ? r : null;
    render();
    onChange(cur);
  });
  render();
  return h('div', { class: 'field' }, h('div', { class: 'label' }, label), btn, hint ? h('div', { class: 'hint' }, hint) : null);
}

