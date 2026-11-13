# Stamp Addict

A catalog for a stamp collection. Each stamp gets a **Stamp Card**: photos plus any details you
want to record (all optional). Stamp Addict is a plain web app: HTML, CSS and JavaScript the
browser runs directly. There's no build step and no framework; the only third-party code is the
Tesseract text reader in `docs/vendor/`, and nothing
to install on a computer to use or change it.

- **Use it:** https://krazow.github.io/Stamp-Addict/ (GitHub Pages serves the `docs/` folder).
- **Install it as an app:** Edge or Chrome on Windows (**Install app** in the address bar or
  menu), Chrome on Android (**Install app** / **Add to Home screen**), Safari on iPhone
  (**Share > Add to Home Screen**).
- **Help for collectors:** the Stamp Addict help document.

## What it does

- **Stamp Cards** in five steps: Photos, Identify, Details, Condition, Collection. Every field is
  optional; pick lists are drop-downs.
- **978 stamp issuers** (countries, colonies, territories, states, occupations, city-states,
  princely states, local posts, agencies), searchable by any name including old ones (Ceylon,
  Bayern, Siam), grouped by region. Choosing one suggests its usual catalogue and checks the year.
- **21 catalogues:** Scott, Stanley Gibbons, Michel, Yvert et Tellier, plus the national
  standards (Unitrade, ACSC, Zumstein, Edifil, Sassone, NVPH, AFA, Fischer, ANK, Hellas,
  Zagorski, Pofis, RHM, GJ, COB, Sakura, Facit). Catalogue values aren't included (they're the
  publishers' copyright); collectors enter their own.
- **Collection** as a grid or list, with search, tags, and filters by region, issuer, condition
  and catalogue. A **Countries** tab groups the collection by region and issuer.
- **Sets** with completion (a slot counts as owned when a stamp is linked to it or has its
  catalogue number), and **Want list** with priorities; saving a matching stamp offers to check
  the want off.
- **Faster entry:** **Save and add the next one** keeps the country, year, catalogue and tags for the next stamp; **Tick off stamps I own** adds a set's stamps in one go; saving a stamp with the same country and catalogue number as one you have offers to add to its quantity instead.
- **Import** a spreadsheet saved as CSV: Stamp Addict's own `stamps.csv`, a Colnect export (catalogue codes like `Mi:AU 1931, Sn:AU 1842` are read), or any sheet with column names. Columns are matched by name and can be changed before importing; countries are matched to the issuer list.
- **Statistics:** stamps, countries, estimated, catalogue and paid totals (as entered, currencies not converted), set progress, and breakdowns by region, country, condition and decade.
- **Look-up links** on the Identify step and the Stamp Card open a web search limited to Colnect or StampWorld for what's known about the stamp.
- **eBay prices:** each Stamp Card links to eBay's Stamps category: current listings, and sold listings (closed auctions and sales) for what similar stamps went for. Coming back from the sold listings, the app asks whether to save a price as the stamp's estimated value, with a dated note.
- **Read the stamp (experimental):** on the Photos step, reads the text printed on the front photo on the device (Tesseract OCR in a web worker, `docs/vendor/tesseract`, loaded on first use, about 5 MB) and suggests the issuer (printed names, old and native names, small misreadings allowed), face value and year. Suggestions only; nothing is filled in until tapped, and the photo never leaves the device.
- **Missing details note** on each Stamp Card lists the key details not recorded yet (front photo, country, year, face value, catalogue number, condition, estimated value), with a button to the right form step. Every detail stays optional.
- **Backup and restore** to a single zip file, with a reminder after 30 days and a copy kept
  before each restore. Works offline after the first visit.

## Where things are

| Path | What it is |
| --- | --- |
| `docs/index.html`, `docs/app.css` | The page and its styles |
| `docs/manifest.json`, `docs/sw.js`, icons | Install-as-app settings and offline support |
| `docs/js/app.js` | Start-up, navigation, page frame |
| `docs/js/views/` | One file per screen, plus the issuer picker |
| `docs/js/store.js`, `docs/js/repos.js` | The data: tables, Stamp Cards, sets, want list |
| `docs/js/validation.js`, `docs/js/lists.js` | Field checks and pick lists |
| `docs/js/issuers.js`, `docs/js/data/issuers.json` | The issuer list and its search |
| `docs/js/backup.js`, `docs/js/zip.js`, `docs/js/backupfiles.js` | Backup files, CSV export, zip reading and writing |
| `docs/js/idb.js`, `docs/js/photos.js` | Browser storage (IndexedDB) and photos |
| `docs/js/importcsv.js`, `docs/js/stats.js`, `docs/js/lookups.js` | Spreadsheet import, statistics, look-up links |
| `docs/js/ocr.js`, `docs/js/ocr-worker.js`, `docs/js/stampid.js`, `docs/vendor/tesseract/` | Reading a stamp's printed text and turning it into suggestions (vendored Tesseract, Apache 2.0) |
| `data/issuers/` | The issuer list by region, and its format (`SPEC.md`) |
| `tools/merge-issuers.mjs` | Checks the region files and builds `docs/js/data/issuers.json` |
| `tests/web/` | Tests for the data layer, backups and zip compatibility |

## Working on it

- **Run it locally:** `npm run serve` (or any static file server pointed at `docs/`), then open
  http://localhost:8000.
- **Tests:** `npm test` (Node 22 or later).
- **Change the issuer list:** edit the region file in `data/issuers/`, then `npm run issuers`.
  The script reports anything it fixed or skipped.
- **After changing files the app loads**, add new ones to the list in `docs/sw.js` and raise its
  `CACHE` version, so installed copies pick up the change.

## Storage

Everything stays on the device, in the browser's IndexedDB: the tables (`collections`,
`stamp_sets`, `set_items`, `stamps`, `catalog_numbers`, `photos`, `tags`, `stamp_tags`,
`want_list`), device settings, photos, and the copies kept before a restore. Each browser on each
device has its own collection. Clearing the browser's site data deletes it, so back up.
A stamp stores both the issuer's id (`issuer_id`) and its name (`country`), so typed-in names
still work.

## Backup file format

A backup is an ordinary zip, so it stays useful without the app:

| File | What it holds |
| --- | --- |
| `manifest.json` | Format name and version, app and schema version, date, counts |
| `data.json` | Every record of every table, exactly as stored (used to restore) |
| `stamps.csv` | The collection as a spreadsheet, one row per stamp (UTF-8 with BOM, opens in Excel) |
| `photos/` | Every stamp photo, referenced by the CSV's photo columns |
| `README.txt` | Plain-language explanation for anyone who opens the zip |

Restores replace everything at once, refuse files from newer app versions, ignore unknown columns,
and never write photos outside `photos/`. The zip code uses the browser's built-in compression.

## History

The first version was a React Native / Expo app. It was replaced by this web app so it would
install simply on Windows as well as phones, with no tools needed. The Expo code is in the Git
history (before version 0.3.0) if it's ever needed.

## Not built yet

Sync between devices, sharing a Stamp Card as an image, perforation gauge, album pages, import from other apps.
