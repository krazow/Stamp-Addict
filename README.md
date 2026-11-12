# Stamp Addict

A mobile app for cataloging a stamp collection. Each stamp gets a **Stamp Card**:
photos plus any details you want to record (all optional). Built with
React Native and Expo.

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
