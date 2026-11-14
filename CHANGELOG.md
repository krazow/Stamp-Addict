# Changelog

Release notes for Stamp Addict. `/release now` adds a section here for every release, and the GitHub release notes
are taken from it.

## 0.6.0 (2026-11-14)

The first release of Stamp Addict as an installable web app. It runs in the browser on Windows, Android and iPhone,
with no account and no subscription, and keeps your collection on your device.

### Added
- **Stamp Cards** in five steps (Photos, Identify, Details, Condition, Collection). Every detail is optional, and a
  note on each card lists the key details still missing.
- **978 stamp issuers** to choose from, searchable by old and native names (Ceylon, Bayern, Siam), grouped by
  region. Choosing one suggests the catalog most collectors use for it and checks the year.
- **21 catalogs**: Scott, Stanley Gibbons, Michel and Yvert et Tellier, plus national catalogs such as Unitrade,
  Sassone, Facit and COB.
- **Read the stamp (experimental)**: reads the printed country name, face value and year from the photo, on the
  device, and suggests them.
- **Faster entry**: "Save and add the next one" keeps the country, year and catalog; "Tick off stamps I own" adds a
  set's stamps in one go; a warning before saving a likely duplicate, with "Add to its quantity".
- **Import from a spreadsheet** (CSV), including Stamp Addict's own export and Colnect exports.
- **Collection views**: grid or list, search, tags, filters by region, country, condition and catalog, and a
  Countries tab.
- **Sets** with completion tracking, and a **want list** that offers to check off a want when you add a match.
- **Statistics**: totals and breakdowns by region, country, condition and decade.
- **eBay prices**: links to current and sold listings, and a prompt to save a sold price as the stamp's value.
- **Look-up links** to Colnect and StampWorld.
- **Backup and restore** to one zip file (with a spreadsheet inside), a 30-day reminder, and a copy kept before
  each restore. Works offline after the first visit.
- A Windows installer with every release.
- A beta at `/beta/` with its own collection, so new versions can be tried without touching your stamps.
- A browser smoke test, run with the data-layer tests on every pull request.

### Changed
- Releases go through the shared Krazow release kit (`/release now`, then `/release promote`). Pushing to `main`
  no longer changes the live app.

### Fixed
- The service worker only clears Stamp Addict's own caches, never other krazow apps'.
