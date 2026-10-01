## Context

The motivation is in [proposal.md](proposal.md), the requirements are in
[specs/app-store-release/spec.md](specs/app-store-release/spec.md). This file holds only
what, from the current state, shapes the solution:

- `ios/` is generated and sits in `.gitignore`. Everything from `app.json` reaches the
  build only through `expo prebuild`; see [pitfalls](../../../docs/pitfalls.md).
- `Info.plist` currently carries `CFBundleShortVersionString 1.0.0` and
  `CFBundleVersion 1`; `buildNumber` is not set in `app.json`, so the one is a default,
  not a decision.
- The privacy manifest (`ios/HabbitsLine/PrivacyInfo.xcprivacy`) is already generated
  and already correct: `NSPrivacyTracking false`, `NSPrivacyCollectedDataTypes` empty,
  three API access reasons from Expo libraries.
- `TARGETED_DEVICE_FAMILY = 1`: the app is iPhone-only; iPad screenshots are not needed.
- In the working copy the `expo-notifications` plugin was removed from `app.json`; by the
  owner's decision this is reverted, since reminders are part of the first release.
- The project has no `eas.json`, no `eas-cli` and no Expo account. `openspec/specs/` is
  empty: this is the project's first capability.
- No new dependencies without separate permission (a rule from `AGENTS.md`), so the
  About section is built on the already installed `expo-constants` and `expo-linking`.

## Goals / Non-Goals

**Goals:**

- One documented path from `app.json` to a build in App Store Connect, repeatable six
  months later from a single document.
- Listing artifacts (metadata, screenshots, policy) live in the repository and are
  versioned together with the code.
- Nothing secret in the repository.

**Non-Goals:**

- EAS Build cloud builds and their credentials: the build stays local, EAS is used only
  as an uploader.
- CI automation of the release: the existing `ci.yml` stays as is, and a release is
  started by hand.
- EAS Update / OTA: out of scope for this task.
- Android and web: deliberately unsupported (`"platforms": ["ios"]`).
- Changes to app logic, the DB schema or calculations.

## Decisions

### Local build, submission via `eas submit`

**Revised:** the publisher builds his other app with EAS Build and submits it with an
Apple ID login, and that is the usual route here too: `eas build -p ios --profile
production`, then `eas submit -p ios --latest`. `submit.production.ios` in `eas.json` now
names the App Store Connect record the first submission creates (name, primary language
`ru`, SKU) instead of holding `ascAppId` / `appleTeamId`. The local route below stays as
the fallback that spends no build minutes.

Xcode builds and signs the archive (automatic signing under the Apple Developer
account), the export yields an `.ipa`, then `npx eas-cli@latest submit -p ios --path <ipa>`.

Why not EAS Build: cloud builds mean paid minutes and a second credential management
system for a single developer who already has a working local `expo run:ios`.
Why not uploading straight from the Xcode Organizer: the upload parameters (which app,
which team) stay as clicks in a GUI rather than lines in the repository, and the
submission reproducibility requirement is exactly about that. `eas submit` puts them in
`eas.json`.

The price: `eas submit` requires linking the project. `eas init` will add
`extra.eas.projectId` to `app.json` and requires an Expo account. Submission does not
spend build minutes.

The alternative, in case an Expo account turns out to be undesirable: `xcrun altool` /
Transporter with the same App Store Connect API key. Then `eas.json` is not needed, and
the upload parameters move into an `npm run submit:ios` script. The decision is
reversible: in both cases the input is an `.ipa` and the key is the same.

### `appVersionSource: "local"`, build number by hand

EAS remote versioning counts numbers by its own builds. There will be no builds in EAS,
so the source of truth is `app.json`, and `ios.buildNumber` is bumped by hand as a step
of the release order. `autoIncrement` does not apply: it lives in `eas build`.

With EAS Build now in use (see above), `app.json` stays the source of truth anyway: both
routes then agree on the numbers, and the bump remains a step of the release order.

This is also where the main pitfall of the order comes from: `buildNumber` changes in
`app.json` but reaches the binary only through `prebuild`. In `docs/release.md` the bump
and the prebuild are one step, not two.

### The App Store Connect API key stays outside the repository, via environment variables

In `eas.json` the `submit.production.ios` profile sets `ascAppId` and `appleTeamId`
(identifiers, not secrets), and the key itself is passed via `EXPO_ASC_API_KEY_PATH`,
`EXPO_ASC_API_KEY_ISSUER_ID`, `EXPO_ASC_API_KEY_ID`. We do not write an `ascApiKeyPath`
into `eas.json`: it invites putting the `.p8` next to the project. `.gitignore` already
covers `*.p8`; that remains a safety net, not the mechanism.

The alternative, an Apple ID with an app-specific password, was rejected: a password in
the environment and 2FA at every step versus a one-time key.

On the EAS route no key is needed: `eas submit` logs into the Apple ID interactively and
caches the session. The key remains for uploading an `.ipa` without that login.

### Metadata: `store.config.json` in the repository, first release by hand

`store.config.json` is written right away and becomes the source of truth for the name,
subtitle, description, keywords, categories, rating and contacts in `ru` and `en-US`.
But `eas metadata:push` is in preview and requires a binary to have been submitted
already, so the **first** filling of App Store Connect is done by hand, copying from this
file, and `metadata:push` comes in from the second release. The document describes both
states.

The positioning the copy is written from: an offline habit and expense tracker, no
accounts and no network. "Collects no data" is the only real differentiator in a crowded
category, so it goes into the subtitle, not the end of the description. Categories:
`PRODUCTIVITY` primary, `HEALTH_AND_FITNESS` secondary. People look for a habit tracker
in both, but habits plus expenses are closer to productivity than to fitness.

### Screenshots: seed database + `simctl`, iPhone 17 Pro Max

The required size is 6.9″, 1320 × 2868; among the installed simulators, iPhone 17 Pro
Max matches it. iPad is not needed (`TARGETED_DEVICE_FAMILY = 1`).

**Revised on upload:** the iPhone tab of App Store Connect takes only the 6.5″ sizes
(1242 × 2688 or 1284 × 2778) and refused the 6.9″ frames. No installed simulator shoots
6.5″, so the script scales each 6.9″ frame evenly to 1284 wide and crops it to 2778,
losing only rows of background; that `-6.5` set is the one uploaded.

Shooting is reproducible only with fixed data, so the script: terminates the app →
replaces `Documents/SQLite/habits.db` in the simulator container with a generated demo
database → launches the app with a deep link to the right screen →
`xcrun simctl io booted screenshot`. It is the same technique `AGENTS.md` already
describes for checking screens; here it becomes a script, and the demo database is
generated from a deterministic seed rather than stored as a binary in the repository.

A limitation accepted deliberately: screens a deep link cannot reach (open sheets, a
selected category) are not in the set, since synthetic taps do not work in the
simulator. The set is built from the root screens of the tabs.

### Privacy policy: the publisher's general page

The first plan was markdown in `docs/` in two languages, served by GitHub Pages of this
repository. It fell through on access, not on the text: enabling Pages takes admin
rights on `mar1798/habbits-line`, and the app is published from an account whose owner
does not have them.

That account already has a public policy written for all of its apps,
`dastanlo.github.io/become-smarter-daily-privacy/privacy-policy.html`, and a general
support page next to it. Apple accepts one policy for several apps, and its claims (no
accounts, no personal data, no analytics, ads or tracking, content on the device, local
notifications) hold for this one. So both the listing and the link in Settings point
there: one English page, no infrastructure to add. The app-specific text stays in
`docs/` unpublished; serving it later changes only the URLs, not the other tasks.

### About section: `expo-constants`, no new dependency

The version and build number are read from `Constants.expoConfig` (`version`,
`ios.buildNumber`), and the link is opened with `Linking.openURL`. The canonical source
for native numbers is `expo-application` (`nativeApplicationVersion` /
`nativeBuildVersion`), and `Constants.nativeAppVersion` is deprecated in its favor, but
that is a new dependency, and the rule says to ask. `Constants.expoConfig` is not
deprecated and reads the manifest embedded in the build, produced from the same
`app.json` from which prebuild writes `Info.plist`.

The price: if `prebuild` is not run after an edit to `app.json`, the screen will show
the new numbers while the binary carries the old ones. Acceptance compares what is on
screen with the built archive's `Info.plist`, and that is exactly why this item is on
the checklist.

The section goes at the end of the settings screen: it is reference information, not a
setting.

## Risks / Trade-offs

- **`prebuild` not run after an edit to `app.json`** → the build ships with an old
  `buildNumber` or without the notifications plugin, and App Store Connect rejects it
  with "bundle version must be higher". Mitigation: the bump and prebuild are one step
  in `docs/release.md`, and checking `Info.plist` is a mandatory acceptance item.
- **An Expo account just for `eas submit`** → an extra dependency on an external service
  in a project that prides itself on having no network. Mitigation: the decision is
  reversible, the fallback (`altool` with the same key) is described above; what EAS
  leaves in the repository is `eas.json` and `extra.eas.projectId`.
- **Pages cannot be enabled for this repository** → no URL for the app-specific policy.
  Handled: the publisher's general policy is used instead (see above).
- **`eas metadata:push` is in preview** → it may change or break. Mitigation: the file
  stays useful as the source for manual filling; the release order does not depend on
  whether `push` works.
- **Review rejection for "minimum functionality" (Guideline 4.2)** → a risk for any
  simple tracker. Mitigation: the screenshots and description show habits, expenses,
  budget and statistics together, not a single screen with a list.
- **The demo database diverges from real behavior** → screenshots show what the app does
  not have. Mitigation: the seed goes into the database through the same tables and the
  same validity rules as the app, and the screenshots are taken from a real build, not
  drawn.
- **The About section is the only UI change** → it touches a file otherwise unrelated to
  the task. Mitigation: a localized addition at the end of the screen, with no edits to
  existing sections.

## Migration Plan

There is no data migration: the DB schema, calculations and existing screens do not
change, and the app has no users yet. The rollout order is the first release itself,
described in `docs/release.md`. Rollback before submission is a plain `git revert` plus
`prebuild`; after submission the build in App Store Connect is withdrawn ("Reject this
build") and replaced by the next one with a bumped `buildNumber`.

## Open Questions

- The values of `ascAppId` and `appleTeamId` for `eas.json` will exist only after the
  app record is created in App Store Connect. Until then the fields keep explicit
  placeholders; this does not affect the shape of the solution.
- The final wording of the name and subtitle (30 characters each per language) is
  settled while filling in `store.config.json`; checking the lengths is part of the task.
