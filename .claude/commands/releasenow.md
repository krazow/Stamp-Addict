---
description: Build, test and release this app (beta, then production) with the shared Krazow release kit
argument-hint: "[patch|minor|major] | promote | all | status | rollback [vX.Y.Z]"
---

# /releasenow

Release this app with the shared Krazow release kit (github.com/krazow/release-kit). This repo's
`.github/workflows/release.yml` calls the kit's pipeline. You start it by pushing a **branch** (this works from
every Claude session, including cloud sessions, which can't push tags). The pipeline makes the release tags itself:

- push to `release/beta`: the next beta of `VERSION` (tag `vX.Y.Z-beta.N`). QA, then every platform in
  `release.json` is built, the beta is published (web at `/beta/`, a GitHub pre-release with the beta APK/installer)
  and smoke-tested live. The production downloads wait in a draft release.
- push to `release/production`: promotes the beta at that commit (tag `vX.Y.Z`). The web app goes to the main
  address and the draft release becomes Latest.
- push to `release/rollback/vX.Y.Z`: puts that earlier production version back at the main web address.

The arguments are: `$ARGUMENTS`

## Before anything

1. Run `git status`. If there are uncommitted changes, list them and ask whether to commit them as part of this
   release. Don't release with a dirty tree. Work on `main`: `git checkout main && git pull --rebase`.
2. Run `git fetch --tags --force` and read `VERSION`, `release.json` and the last tags
   (`git tag --list 'v*' --sort=-v:refname | head`).
3. If Node is available and `npm install` works here, run `npm test` and stop on failures. If not, say so in one line
   and rely on the QA stage on GitHub.

## Modes

**No argument, `patch`, `minor` or `major`: cut a new beta.**
1. Work out the version. If the newest tag is a beta of a version that was never promoted (no plain `vX.Y.Z`
   tag), this is the next beta of that same version: keep `VERSION` (unless I named `patch`/`minor`/`major`).
   Otherwise bump `VERSION` (patch by default, or the part named).
2. Update the version wherever the app shows it to people, if `release.json` "version" doesn't already cover it
   (for example a What's new list, or a date next to the version), as earlier releases in this repo did.
3. Add a dated entry at the top of `CHANGELOG.md` (create it if missing), headed `## X.Y.Z (YYYY-MM-DD)`, covering
   every change since the last release in plain language, grouped as Added / Changed / Fixed. Read the commits
   (`git log <last-tag>..HEAD`) and the diffs, not only the commit titles. Replace an `## Unreleased` heading with it.
   For a further beta of the same version, add to that version's entry.
4. Commit as "Release X.Y.Z", push `main`, then start the beta: `git push --force origin HEAD:refs/heads/release/beta`.
5. Follow the run (see "Following the run"). On success, tell me in plain language: the beta web address
   (`https://<owner>.github.io/<repo>/beta/`), the pre-release page with the APK and installer, and what's in it.
   End with: "When you've tried it, run /releasenow promote."

**`promote`: put the newest beta into production.**
1. Find the newest `vX.Y.Z-beta.N` tag. Refuse if `vX.Y.Z` already exists or that beta's run didn't succeed.
2. If commits came after that beta, list them and say they won't be included (they go in the next release).
3. `git push --force origin <beta-tag>^{commit}:refs/heads/release/production`. Follow the run, then give me the
   live address and the release page.

**`all`: the whole chain without waiting for testers** (for hotfixes or changes already tested).
Do the beta steps, wait for the run to finish, including the live beta smoke test, then do `promote`.
Stop and explain if anything fails.

**`status`**: show what's on production and on beta (tags, dates, web addresses), whether a draft is waiting, and
the result of the last Release and CI runs. Change nothing.

**`rollback [vX.Y.Z]`**: put an earlier production version back at the main web address. Default to the
production tag before the newest one, and confirm with me before running:
`git push --force origin main:refs/heads/release/rollback/vX.Y.Z`. It doesn't change any tags or releases.

## Following the run

If `gh` works here: `gh run list --workflow release.yml -L 3` to find the run, then `gh run watch <id> --exit-status`
(or check `gh run view <id>` every minute). Otherwise give me the link `https://github.com/<owner>/<repo>/actions`
and check back by fetching tags (`git fetch --tags`): the beta tag appears when the run starts.

If it fails, read the failing job's log (`gh run view <id> --log-failed`) and tell me in plain language what broke
and how you'd fix it. Common one-time fixes:
- **Pages wouldn't publish**: Settings → Pages → Source must be "GitHub Actions".
- **"throwaway key" or "no signing key" warning on Android**: add the `ANDROID_KEYSTORE_B64`,
  `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS` secrets (Settings → Secrets and variables → Actions).
- **"permission denied" pushing the tag**: Settings → Actions → General → Workflow permissions → "Read and write".

Then fix it and push `release/beta` again: the next beta number is used, so nothing needs deleting.
Never move or delete a production tag that was already promoted, and never force-push `main`.
