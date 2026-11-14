# Changelog

Release notes for Stamp Addict. `/release now` adds a section here for every release, and the GitHub release notes
are taken from it.

## Unreleased

### Added
- An Android app (APK) and a Windows installer with every release.
- A beta at `/beta/` with its own collection, so new versions can be tried without touching your stamps.
- A browser smoke test, run with the data-layer tests on every pull request.

### Changed
- Releases go through the shared Krazow release kit (`/release now`, then `/release promote`). Pushing to `main`
  no longer changes the live app.
- The service worker only clears Stamp Addict's own caches, never other krazow apps'.
