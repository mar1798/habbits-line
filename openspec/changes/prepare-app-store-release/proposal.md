## Why

The app is functionally ready, but it has never been built in release form and has none
of what App Store Connect requires: a build number, an export encryption declaration, a
privacy policy, listing metadata and screenshots. Right now `app.json` has no
`buildNumber`, the `expo-notifications` plugin has been removed from it locally, and
neither `eas.json` nor `store.config.json` exists in the repository, so the very first
upload attempt to App Store Connect will hit missing fields.

## What Changes

- **Build configuration.** The `expo-notifications` plugin returns to `app.json`, and
  `ios.buildNumber`, `ios.config.usesNonExemptEncryption: false`, `description` and an
  explicit `ios.supportsTablet: false` are added. Run `expo prebuild` and check
  `Info.plist`, per the rule in [pitfalls](../../../docs/pitfalls.md).
- **Release pipeline.** An `eas.json` appears with `appVersionSource: "local"`, a
  `production` build profile and a `submit.production.ios` profile for the App Store
  Connect API key. The build stays local (Xcode archive / `eas build --local`); only the
  upload via `eas submit` goes to the cloud. `eas-cli` is not pinned in the repository;
  it is invoked via `npx eas-cli@latest`.
- **Release configuration check.** A Release build is installed on the simulator and on
  a device and walks through every screen: cold start, reminder via tap, backup
  export/import, both themes, both languages.
- **Privacy policy.** Text in Russian and English in `docs/`, published via GitHub Pages,
  plus a link to it and the version number in an About section on the settings screen.
- **Listing metadata.** `store.config.json` with `ru` and `en-US` localizations: name,
  subtitle, description, keywords, categories, age rating, review contacts, links to the
  policy and support.
- **Screenshots.** A script that takes a 6.9″ (1320×2868) set from the simulator on a
  prepared demo database; the result goes into `assets/store/` and is uploaded to App
  Store Connect by hand (EAS Metadata does not upload screenshots).
- **Documentation.** `docs/release.md`, the single document describing the release
  order: what gets bumped, what builds it, what submits it, what is filled in by hand.

## Capabilities

### New Capabilities
- `app-store-release`: everything that makes a build publishable: versioning and
  declarations in the app config, the release build and submit pipeline, listing
  artifacts (metadata, screenshots, privacy policy) and the About section in settings.

### Modified Capabilities
<!-- None: there are no capabilities in `openspec/specs/` yet. -->

## Impact

- **Config:** `app.json` (plugins, `ios.*`, `description`), a new `eas.json`, a new
  `store.config.json`, `.gitignore` (the `.p8` key must not get into the repository).
- **Code:** `src/app/(tabs)/settings.tsx`, an About section (version + policy link);
  `src/i18n/ru.ts` and `src/i18n/en.ts`, new keys. App logic, the DB schema and
  calculations are not affected.
- **Dependencies:** no new dependencies in `package.json`. `expo-constants` and
  `expo-linking` are already installed and cover the version and opening the link.
- **Native:** a mandatory `expo prebuild --platform ios` after edits to `app.json`;
  `ios/` is in `.gitignore`, so the check goes against the generated `Info.plist`.
- **External (outside the repository, needs an account):** the paid Apple Developer
  Program, an app record in App Store Connect with bundle id `com.mar1798.habbits-line`,
  an App Store Connect API key, GitHub Pages enabled to host the policy.
- **Documents:** a new `docs/release.md`; `README.md` and `docs/pitfalls.md` get a link
  to it.
