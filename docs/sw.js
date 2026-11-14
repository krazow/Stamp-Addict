// Lets Stamp Addict open without an internet connection. Always tries the
// network first, so updates show up as soon as you're online; falls back
// to the saved copy when offline.
// The release kit (github.com/krazow/release-kit) stamps the version in at every release.
const CACHE_PREFIX = 'stampaddict-';   // the kit makes this 'stampaddictbeta-' in the beta
const VERSION = CACHE_PREFIX + '0.6.0';
const CACHE = VERSION;
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.json', 'favicon.png', 'icon-192.png', 'icon-512.png',
  'js/app.js', 'js/backup.js', 'js/backupfiles.js', 'js/format.js', 'js/idb.js', 'js/lists.js', 'js/photos.js',
  'js/repos.js', 'js/store.js', 'js/ui.js', 'js/validation.js', 'js/zip.js', 'js/issuers.js', 'js/data/issuers.json', 'js/importcsv.js', 'js/lookups.js', 'js/stats.js', 'js/ocr.js', 'js/ocr-worker.js', 'js/stampid.js',
  'js/views/backup.js', 'js/views/collection.js', 'js/views/countries.js', 'js/views/issuerPicker.js', 'js/views/importer.js', 'js/views/stats.js', 'js/views/tickSet.js', 'js/views/sets.js', 'js/views/stamp.js',
  'js/views/stampForm.js', 'js/views/wants.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith(CACHE_PREFIX) || (CACHE_PREFIX === 'stampaddict-' && /^stamp-addict-v\d+$/.test(k))) && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit ?? caches.match('index.html'))),
  );
});
