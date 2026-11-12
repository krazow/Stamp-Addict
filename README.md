# Stamp Addict

A mobile app for cataloging a stamp collection. Each stamp gets a **Stamp Card**:
photos plus any details you want to record (all optional). Built with
React Native and Expo.

## The app: plain web app in `docs/` (no build tools)

Stamp Addict is now a plain web app: HTML, CSS and JavaScript files the browser runs directly. There's no npm, Expo or build step, and nothing to install on a computer to use or change it.

- **Use it:** open the published page (GitHub Pages serves the `docs/` folder at https://krazow.github.io/Stamp-Addict/ once Pages is turned on), then install it: Edge or Chrome on Windows (**Install app** in the address bar or menu), Chrome on Android (**Add to Home screen / Install app**), Safari on iPhone (**Share > Add to Home Screen**).
- **Works offline** after the first visit (`docs/sw.js`).
- **Storage:** everything stays on the device, in the browser's IndexedDB: the same tables and columns as the phone app's database, plus photos and the copies kept before a restore. Clearing the browser's site data deletes it, so back up.
- **Backups:** the same zip format as the phone app (`manifest.json`, `data.json`, `stamps.csv`, `photos/`, `README.txt`), so a backup moves a collection between devices. The zip code (`docs/js/zip.js`) uses the browser's built-in compression; there are no third-party libraries.
- **Photos:** big camera photos are shrunk to 2400 px on the long side (JPEG) to save space. There's no crop step.
- **Issuers:** `docs/js/data/issuers.json` lists every country, colony, territory, city-state, occupation and agency that has issued stamps: name, other names, type, region, years, parent, successor and the catalogue most collectors use for it. It's built from the region files in `data/issuers/` (format in `data/issuers/SPEC.md`) with `node tools/merge-issuers.mjs`, which checks every entry and merges duplicates. A stamp stores the issuer's id (`issuer_id`) and its name (`country`), so older backups and typed-in names still work.
- **Catalogues:** Scott, Stanley Gibbons, Michel and Yvert et Tellier, plus the national standards (Unitrade, ACSC, Zumstein, Edifil, Sassone, NVPH, AFA, Fischer, ANK, Hellas, Zagorski, Pofis, RHM, GJ, COB). Catalogue values are not included: they're the publishers' copyright, so collectors enter their own.
- **Tests:** `node --test tests/web/*.test.mjs` (data layer, set completion, want matching, backup round trip, zip compatibility).

Layout of `docs/`: `index.html`, `app.css`, `manifest.json`, `sw.js`, icons, and `js/` — `store.js` (tables), `repos.js` (Stamp Cards, sets, want list), `validation.js`, `lists.js` (pick lists), `backup.js` + `zip.js` (backup files and CSV), `idb.js` (browser storage), `photos.js`, `backupfiles.js`, `ui.js`, `app.js` (navigation) and `views/` (one file per screen).

The Expo / React Native version below is no longer the main app. It's kept for reference.

## What's in this version

- **Collection**: grid and list views, search, filter by tag
- **Add a stamp**: take or choose a front and back photo (with crop), then quick details;
  "Save and add another" for entering a whole album page
- **Stamp Card**: photos, tags, set membership, and every filled-in detail
- **Edit**: all fields, grouped into sections that open and close; delete a stamp
- **Sets**: track a set's completion; stamps with matching catalog numbers count automatically;
  add a set's missing stamps to the want list in one tap
- **Want list**: by priority; saving a Stamp Card that matches a want offers to check it off
- **Offline**: everything is stored on the phone in SQLite
- **Backup and restore**: one .zip file with every record and photo, saved anywhere through the
  phone's share sheet; restore replaces the collection after saving a safety copy on the phone

## Run it on your phone

You need Node.js (LTS), Git, and the **Expo Go** app on your phone. See the help document
for step-by-step instructions.

```bash
git clone https://github.com/krazow/Stamp-Addict.git
cd Stamp-Addict
npm install
npm run setup      # makes every package version match the project's Expo SDK
npx expo start
```

Scan the QR code with your phone (iPhone: Camera app; Android: Expo Go) to open the app.

The first `npx expo start` may offer to install TypeScript: say yes.

This project uses **Expo SDK 58** (React Native 0.88), the version the current Expo Go app supports.
If `npx expo install --check` reports mismatches, run `npx expo install --fix`; if npm then reports
`ERESOLVE`, delete `node_modules` and `package-lock.json` and run `npm install` again.

## Run it on a computer (web version)

The same app runs in Edge or Chrome and can be installed as a Windows app.

```
npm install
npm run web
```

The app opens in the browser. To install it, choose **Install Stamp Addict** from the browser's menu (in Edge: the "App available" icon in the address bar, or **... > Apps > Install this site as an app**).

How the web version differs from the phone app:

- Stamp records are kept in the browser's SQLite database (expo-sqlite's web build); photos and the "before restore" copies are kept in IndexedDB. Clearing the browser's site data deletes the collection, so back up.
- Backups use the same zip format, so a backup made on a phone restores in the browser and the other way round.
- There's no crop step for photos; both photo buttons open the file chooser on a computer.
- The database needs a cross-origin isolated page. The dev server sets the two headers in `metro.config.js`; for hosting, `public/_headers` covers Netlify and Cloudflare Pages, and `app.json` covers Expo's own hosting.
- `npm run build:web` writes the site to `dist/`.

## Project layout

```
app/                   Screens (Expo Router: each file is a screen)
  (tabs)/              Collection, Sets, Want list tabs
  add.tsx              Add a stamp
  stamp/[id].tsx       Stamp Card
  stamp/edit/[id].tsx  Edit a Stamp Card
  set/new.tsx          New set
  want/new.tsx         Add a want
src/core/              Data layer: schema, Stamp Cards, sets, want list, validation (no UI)
src/data/              App glue: database setup, photo storage
src/ui/                Shared controls, colors, formatting
```

## Tests

The data layer has its own tests (33), which run with Node 22+ outside the app:

```bash
npm run test:core
```

After editing `src/core/schema.sql`, run `npm run schema` to regenerate the embedded copy.

## Backup file format

A backup is an ordinary zip, so it stays useful without the app:

| File | What it holds |
| --- | --- |
| `manifest.json` | Format name and version, app and schema version, date, counts |
| `data.json` | Every record of every table, exactly as stored (used to restore) |
| `stamps.csv` | The collection as a spreadsheet, one row per stamp (UTF-8 with BOM, opens in Excel) |
| `photos/` | Every stamp photo, referenced by the CSV's photo columns |
| `README.txt` | Plain-language explanation for anyone who opens the zip |

Restores are all-or-nothing (one database transaction), refuse files from newer app versions,
ignore unknown columns from future versions, and never write photo files outside `photos/`.
App settings such as the last backup date are device-specific and not included.

## Status

- The data layer is tested.
- The screens were written without being able to run them (the build environment couldn't
  install React Native), so the first run on a real phone is their first test. Expect small fixes.
- Not built yet: automatic cloud backup and sync, accounts, perforation gauge, photo identification,
  album pages, value tracking, import. See the project to-do list.
