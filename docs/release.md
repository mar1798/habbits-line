# Shipping a release

The single document on how the app gets into the App Store. It describes what is in the
repository; if the order changes, this file is edited in the same commit.

The build is local; only the upload goes to the cloud. EAS works here as an uploader,
not a builder. No build minutes are spent.

## One-time setup

| What | Where | Ends up in |
|---|---|---|
| Apple Developer Program | developer.apple.com | Team ID → `eas.json` |
| App record | App Store Connect, bundle id `com.mar1798.habbits-line`, default language `ru`, iPhone-only | `ascAppId` → `eas.json` |
| App Store Connect API key, App Manager role | App Store Connect → Users and Access → Keys | `.p8` **outside the repository** |
| Expo account | expo.dev | `extra.eas.projectId` in `app.json`, via `npx eas-cli@latest init` |
| GitHub Pages from `docs/` | Settings → Pages → Deploy from a branch → `/docs` | privacy policy URL |

The `.p8` key never goes into the repository: `.gitignore` covers `*.p8`, and `eas.json`
deliberately does **not** contain `ascApiKeyPath`; the key path is passed via the
environment.

## Release order

### 1. Bump the numbers, together with prebuild

`ios/` is generated and sits in `.gitignore`. An edit to `app.json` does not reach the
build by itself, so the bump and the prebuild are one step, not two:

```bash
# version: only when something the user sees changes;
# ios.buildNumber: before every upload, including a re-upload of the same version
$EDITOR app.json
npx expo prebuild --platform ios --clean
plutil -p ios/HabbitsLine/Info.plist | grep -E 'CFBundleShortVersionString|CFBundleVersion'
```

Both lines of the output must match `app.json`. If they don't, the old build is being made.

### 2. Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:tz     # if lib/date.ts was touched
```

### 3. Build the archive

```bash
open ios/HabbitsLine.xcworkspace
```

Scheme `HabbitsLine`, Release configuration, destination "Any iOS Device" →
Product → Archive → Distribute App → App Store Connect → Export → `.ipa`.
`*.ipa` is covered by `.gitignore`.

### 4. On-device acceptance

Only what passed the whole list is shipped, on a **physical device**, not the simulator:

- [ ] clean install, cold start: empty state, no calls to Metro and no debug overlays;
- [ ] a reminder arrives at the scheduled time, and tapping it opens the right habit;
- [ ] backup export via the share sheet and import back, with nothing lost;
- [ ] every screen in light and dark theme, in Russian and English: no truncated text
      and no untranslated strings;
- [ ] the About section in settings shows the same numbers as the archive's `Info.plist`.

If something fails: fix it, bump `ios.buildNumber`, and start again from step 1.

### 5. Upload

```bash
export EXPO_ASC_API_KEY_PATH=~/keys/AuthKey_XXXXXXXXXX.p8
export EXPO_ASC_API_KEY_ISSUER_ID=…
export EXPO_ASC_API_KEY_ID=XXXXXXXXXX
npx eas-cli@latest submit -p ios --path /path/to/HabbitsLine.ipa
```

The build must be processed in App Store Connect **without** the "Missing Compliance"
status. That is handled by `ios.config.usesNonExemptEncryption: false` in `app.json`,
which prebuild writes into `Info.plist` as `ITSAppUsesNonExemptEncryption`.

### 6. Listing

The source of truth is [`store.config.json`](../store.config.json): names, subtitles,
descriptions, keywords, release notes for `ru` and `en-US`, categories, age rating,
review contacts.

- **First release**: the fields are filled in App Store Connect by hand, copied from
  this file. `eas metadata:push` does not work for a new app: it requires a binary to
  have been submitted already.
- **From the second release on**: `npx eas-cli@latest metadata:push` after step 5. The
  feature is in preview; if it breaks, the file is still what the fields are filled
  from by hand.

`eas metadata` never uploads screenshots; that is manual only, from
`assets/store/screenshots/`.

### 7. Screenshots

```bash
npx expo run:ios --device "iPhone 17 Pro Max"   # Debug: Metro is needed for Fast Refresh
./scripts/screenshots.sh prepare ru
```

A set is needed for each localization, so the whole run happens twice, `ru` and `en`.
The language is a row in the database read once at launch, so switching the language is
another `prepare`, not a tap in settings.

Then one frame per tab. Deep links cannot switch the tab: iOS 26 puts a system "Open in
app?" dialog over the frame for any custom scheme, including `simctl openurl`. The URL is
still delivered and the app navigates, but the dialog cannot be removed from the frame
(synthetic taps do not work, and it ignores Escape). So the tab is set in code, via Fast
Refresh: the technique from [AGENTS.md](../AGENTS.md) for state a deep link cannot reach.

Temporarily, in `src/app/(tabs)/_layout.tsx`, inside `TabsLayout`:

```tsx
useEffect(() => {
  router.replace('/stats');
}, []);
```

Save, wait for Fast Refresh, shoot, and repeat four times:

| route | frame name |
|---|---|
| `/` | `01-habits` |
| `/expenses` | `02-expenses` |
| `/stats` | `03-stats` |
| `/settings` | `04-settings` |

```bash
./scripts/screenshots.sh shoot 03-stats ru
```

At the end of a language:

```bash
./scripts/screenshots.sh finish
git checkout "src/app/(tabs)/_layout.tsx"     # mandatory: the edit is temporary
```

And the same once more with `prepare en` / `shoot <name> en`.

Frames land in `assets/store/screenshots/<language>/` at 1320 × 2868, the only size the
App Store requires for iPhone. The script checks the resolution and fails if the shots
were taken on the wrong device.

The data comes from [`scripts/seed-demo-db.mjs`](../scripts/seed-demo-db.mjs). It is
deterministic but tied to today's date: two runs on the same day produce identical files,
a run tomorrow shifts the history by a day. That is intended: the screenshot should show
today. The schema in the seed is a transcription of `db/migrations.ts` at
`user_version 3`: when a new migration appears, the seed is updated too, otherwise the
app will open the database and show an empty screen.

The seed takes the language as its second argument. Three things depend on it: the
`language` row, the habit names (user data, not translated) and the currency: `₽` as a
suffix for `ru`, `$` as a prefix and amounts ten times smaller for `en`, so a month looks
like a plausible month rather than a fortune. Category names in the database are always
Russian: `lib/category-name.ts` maps the eight starter ones back by name and translates
them at render time.

A Debug build is not a compromise here but a requirement: Release has nothing to attach
Fast Refresh to. It draws the same screens, and the dev menu does not get into the frame.

Mandatory after reshooting: go through the description in `store.config.json` point by
point and make sure every promised screen is in the set, and that nothing the app lacks
has crept into the description.

### 8. Submit for review

App Store Connect → pick the build → fill in "What's New" → Submit for Review.

`release.automaticRelease` in `store.config.json` is `false`: the release is published
manually after approval.

## Privacy

Three sources must say the same thing; a mismatch between them is grounds for rejection:

| Source | What it says |
|---|---|
| [`docs/privacy-policy.ru.md`](privacy-policy.ru.md) / [`.en.md`](privacy-policy.en.md) | collects no data, no tracking; data leaves the device only as a backup file on the user's action |
| `ios/HabbitsLine/PrivacyInfo.xcprivacy` (generated by prebuild) | `NSPrivacyTracking false`, `NSPrivacyCollectedDataTypes` empty |
| App Privacy questionnaire in App Store Connect | "Data Not Collected", no tracking |

Verified by the absence of any network call in `src` and of any third-party analytics or
advertising library in `package.json`:

```bash
grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|axios" src   # empty, except tests
```

When the first network call appears, all three are updated: policy, manifest and
questionnaire.
