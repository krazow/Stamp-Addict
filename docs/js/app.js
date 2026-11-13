// Stamp Addict: start-up, navigation between screens, and the page frame.
import { askForPersistentStorage, loadAll, saveChanges } from './idb.js';
import { deletePhoto, loadPhotoUrls, storedPhotoPaths } from './photos.js';
import { openRepos } from './repos.js';
import { Store } from './store.js';
import { loadSafetyCopies } from './backupfiles.js';
import { loadIssuers } from './issuers.js';
import { button, h, icon, tell } from './ui.js';
import { collectionView } from './views/collection.js';
import { stampView } from './views/stamp.js';
import { stampForm } from './views/stampForm.js';
import { setsView, newSetView } from './views/sets.js';
import { wantsView, newWantView } from './views/wants.js';
import { backupView } from './views/backup.js';
import { countriesView } from './views/countries.js';
import { importView } from './views/importer.js';
import { statsView } from './views/stats.js';
import { tickSetView } from './views/tickSet.js';

export const app = { repos: null, installPrompt: null };

const ROUTES = [
  [/^$/, collectionView, 'collection'],
  [/^countries$/, countriesView, 'countries'],
  [/^sets$/, setsView, 'sets'],
  [/^wants$/, wantsView, 'wants'],
  [/^add$/, () => stampForm(null)],
  [/^stamp\/([^/]+)$/, (id) => stampView(id)],
  [/^stamp\/([^/]+)\/edit$/, (id) => stampForm(id)],
  [/^sets\/new$/, newSetView],
  [/^sets\/([^/]+)\/tick$/, (id) => tickSetView(id)],
  [/^stats$/, statsView],
  [/^import$/, importView],
  [/^wants\/new$/, newWantView],
  [/^backup$/, backupView],
];

let depth = 0;
/** Opens a screen. replace: true swaps the current screen instead of stacking. */
export function go(path, { replace = false } = {}) {
  const hash = `#/${path}`;
  if (replace) { location.replace(hash); return; }
  depth++;
  location.hash = hash;
}
export function back() {
  if (depth > 0) { depth--; history.back(); } else go('', { replace: true });
}
/** Re-draws the current screen with fresh data. */
export const refresh = () => render();

const TABS = [
  ['', 'Collection', 'stamp'],
  ['countries', 'Countries', 'globe'],
  ['sets', 'Sets', 'sets'],
  ['wants', 'Want list', 'heart'],
];

function render() {
  const path = location.hash.replace(/^#\/?/, '');
  let match = null;
  for (const [re, view, tab] of ROUTES) {
    const m = path.match(re);
    if (m) { match = { view, tab, args: m.slice(1).map(decodeURIComponent) }; break; }
  }
  if (!match) { go('', { replace: true }); return; }
  let screen;
  try {
    screen = match.view(...match.args);
  } catch (e) {
    console.error(e);
    screen = { title: 'Something went wrong', body: h('div', { class: 'empty' }, h('p', {}, String(e?.message ?? e))) };
  }
  const header = h('header', { class: 'topbar' },
    match.tab ? null : h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Back', onclick: back }, icon('back')),
    h('h1', {}, screen.title),
    h('div', { class: 'topbar-actions' }, screen.actions ?? null),
  );
  const tabs = match.tab ? h('nav', { class: 'tabbar', 'aria-label': 'Sections' }, TABS.map(([p, label, ic]) =>
    h('a', { href: `#/${p}`, class: match.tab === (p || 'collection') ? 'on' : '', 'aria-current': match.tab === (p || 'collection') ? 'page' : null, onclick: () => { depth = 0; } },
      icon(ic), h('span', {}, label)))) : null;
  document.getElementById('app').replaceChildren(header, h('main', { id: 'main' }, screen.body), tabs ?? '');
  document.title = match.tab ? 'Stamp Addict' : `${screen.title} · Stamp Addict`;
  if (!match.tab || screen.keepScroll !== true) window.scrollTo(0, 0);
}

async function start() {
  const root = document.getElementById('app');
  try {
    if (!('indexedDB' in window)) throw new Error('This browser can\'t store data for websites. Try Edge, Chrome, Safari or Firefox.');
    const saved = await loadAll();
    const store = new Store(saved.tables, saved.meta, saveChanges);
    store.onSaveError = (e) => tell('Couldn\'t save your last change', `${e?.message ?? e}. Check that the device has free space, then try again.`);
    app.repos = openRepos(store);
    // The issuer list is a file; without it the app still works with typed-in names.
    await Promise.all([loadPhotoUrls(), loadSafetyCopies(), loadIssuers().catch((e) => console.warn(e))]);
    // Photos added to a form that was never saved: remove them.
    const used = new Set(store.rows('photos').map((p) => p.uri));
    for (const path of storedPhotoPaths()) if (!used.has(path)) deletePhoto(path);
    askForPersistentStorage();
  } catch (e) {
    root.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, 'Stamp Addict can\'t open your collection'), h('p', {}, String(e?.message ?? e))));
    return;
  }
  window.addEventListener('hashchange', render);
  // Make sure the last change is written if the window closes.
  window.addEventListener('pagehide', () => app.repos.db.flush());
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); app.installPrompt = e; if (!location.hash.replace(/^#\/?/, '')) render(); });
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

export async function installApp() {
  const p = app.installPrompt;
  if (!p) return;
  app.installPrompt = null;
  await p.prompt();
  render();
}

export { button };
start();
