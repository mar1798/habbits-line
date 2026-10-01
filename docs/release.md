# Shipping a release

The single document on how the app gets into the App Store. It describes what is in the
repository; if the order changes, this file is edited in the same commit.

Two routes from the same `app.json`. The usual one is EAS: two commands build the app in
the cloud and upload it to App Store Connect, logging into the publisher's Apple ID. The
other builds the archive locally in Xcode and uploads it from there. A cloud build counts
against the Expo plan's build quota; a local one costs nothing.

## One-time setup

| What | Where | Ends up in |
|---|---|---|
| Apple Developer Program | developer.apple.com | the Apple ID EAS logs into; the team Xcode signs with |
| Expo account | expo.dev, then `npx eas-cli@latest init` in the project | `extra.eas.projectId` in `app.json` |
| App record | App Store Connect, bundle id `com.dastan.habbitsline`, primary language `ru`, iPhone-only. The first `eas submit` creates it from `submit.production.ios` in `eas.json` (name, language, SKU); on the Xcode route it is created by hand | — |
| Privacy policy and support pages | the publisher's general pages, already public: `dastanlo.github.io/become-smarter-daily-privacy/privacy-policy.html`, `dastanlo.github.io/support-page/support.html` | `privacyPolicyUrl` / `supportUrl` in `store.config.json`, `PRIVACY_POLICY_URL` in `src/app/(tabs)/settings.tsx` |

Signing needs nothing in the repository: EAS creates the distribution certificate and
the provisioning profile on the first build and keeps them in the Expo account, and
Xcode's automatic signing does the same on its side.

An App Store Connect API key (`.p8`) is needed only to upload an `.ipa` without logging
into the Apple ID. It never goes into the repository: `.gitignore` covers `*.p8`, and
`eas.json` deliberately does **not** contain `ascApiKeyPath`; the key path is passed via
the environment.

## Release order

### 1. Bump the numbers

`version` changes only when something the user sees changes; `ios.buildNumber` changes
before every upload, including a re-upload of the same version. `appVersionSource` in
`eas.json` is `"local"`: the numbers come from `app.json`, EAS does not count them.

`ios/` is generated and sits in `.gitignore`, so EAS does not upload it and runs prebuild
on its server. An Xcode build, though, is made from the local folder, and an edit to
`app.json` does not reach it by itself: there the bump and the prebuild are one step, not
two. The same prebuild is also the quickest check of what the numbers came out as:

```bash
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

### 3. Build

**EAS:**

```bash
npx eas-cli@latest build -p ios --profile production
```

The first run logs into the Apple ID, registers the bundle id and creates the
certificate and the profile. The project goes up as the working tree minus `.gitignore`,
uncommitted changes included, so what is built should be what is committed. The question
about a Push Notifications key is switched off (`cli.promptToConfigurePushNotifications:
false` in `eas.json`): reminders are local and need no APNs key. With `--auto-submit` the
build goes on to step 5 by itself.

**Xcode:**

```bash
open ios/HabbitsLine.xcworkspace
```

Target `HabbitsLine` → Signing & Capabilities: "Automatically manage signing" with the
publisher's team. Prebuild regenerates the project, so the team is picked again after
every `--clean`. Then scheme `HabbitsLine`, Release configuration, destination
"Any iOS Device" → Product → Archive → Distribute App → App Store Connect → Export →
`.ipa`. `*.ipa` is covered by `.gitignore`.

Distribute App → App Store Connect → **Upload** instead sends the archive straight from
Xcode, signed with the team's account; step 5 is then skipped.

### 4. On-device acceptance

Only what passed the whole list is shipped, on a **physical device**, not the simulator.
A cloud build reaches the device through TestFlight, so on the EAS route this step comes
after step 5: internal testing needs no review, and only then does the version go to
review in step 8.

- [ ] clean install, cold start: empty state, no calls to Metro and no debug overlays;
- [ ] a reminder arrives at the scheduled time, and tapping it opens the right habit;
- [ ] backup export via the share sheet and import back, with nothing lost;
- [ ] every screen in light and dark theme, in Russian and English: no truncated text
      and no untranslated strings;
- [ ] the About section in settings shows the same numbers as the archive's `Info.plist`.

If something fails: fix it, bump `ios.buildNumber`, and start again from step 1.

### 5. Upload

**EAS:**

```bash
npx eas-cli@latest submit -p ios --latest
```

It takes the latest build from step 3, logs into the same Apple ID and, on the first
run, creates the App Store Connect record from `submit.production.ios` in `eas.json`.

**An `.ipa` exported from Xcode**, with the API key instead of the Apple ID:

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
`assets/store/screenshots/ru-6.5/` and `en-6.5/` (see step 7).

### 7. Screenshots

```bash
npx expo run:ios --device "iPhone 17 Pro Max"   # Debug: Metro is needed for Fast Refresh
./scripts/screenshots.sh prepare ru
```

A set is needed for each localization, so the whole run happens twice, `ru` and `en`.
The language is a row in the database read once at launch, so switching the language is
another `prepare`, not a tap in settings.

Then one frame per tab, switched with a tap on the tab in the Simulator window; give it a
second to settle before shooting. Deep links cannot switch the tab: iOS 26 puts a system
"Open in app?" dialog over the frame for any custom scheme, including `simctl openurl`.
The URL is still delivered and the app navigates, but the dialog cannot be removed from
the frame (it ignores Escape). Taps synthesized through AppleScript or CGEvent do not
reach the simulator either, so where no one can tap, the tab is set in code, via Fast
Refresh: the technique from [AGENTS.md](../AGENTS.md) for state a deep link cannot reach.

Temporarily, in `src/app/(tabs)/_layout.tsx`, inside `TabsLayout`:

```tsx
useEffect(() => {
  router.replace('/stats');
}, []);
```

Save, wait for Fast Refresh, shoot. Either way, four frames:

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
git checkout "src/app/(tabs)/_layout.tsx"     # if the tab was set in code: the edit is temporary
```

And the same once more with `prepare en` / `shoot <name> en`.

Frames land in `assets/store/screenshots/<language>/` at 1320 × 2868 (6.9"), the size
the device shoots natively, and in `assets/store/screenshots/<language>-6.5/` at
1284 × 2778. **The `-6.5` set is the one uploaded**: the iPhone tab of App Store Connect
takes only the 6.5" sizes (1242 × 2688 or 1284 × 2778) and refuses 1320 × 2868 with
"wrong screenshot dimensions". The copy is scaled evenly from the same frame and cut by a
few rows of background, not stretched. The script checks both resolutions and fails if
the shots were taken on the wrong device, and it saves them without an alpha channel: the
simulator's PNG has one, and App Store Connect refuses screenshots that do.

The data comes from [`scripts/seed-demo-db.mjs`](../scripts/seed-demo-db.mjs). It is
deterministic but tied to today's date: two runs on the same day produce identical files,
a run tomorrow shifts the history by a day. That is intended: the screenshot should show
today. For the same reason the expense period start day is picked so that today falls
about two weeks into a period: a set shot on the 1st would otherwise show a period that
has barely begun, with an empty spending bar. The schema in the seed is a transcription of
`db/migrations.ts` at `user_version 5`: when a new migration appears, the seed is updated
too, otherwise the app will open the database and show an empty screen.

The seed takes the language as its second argument. Three things depend on it: the
`language` row, the habit names (user data, not translated) and the currency: `₽` as a
suffix for `ru`, `$` as a prefix and amounts ten times smaller for `en`, so a month looks
like a plausible month rather than a fortune. Category names in the database are always
Russian: `lib/category-name.ts` maps the eight starter ones back by name and translates
them at render time.

A Debug build is not a compromise here: it draws the same screens, the dev menu does not
get into the frame, and the Fast Refresh route needs it (Release has nothing to attach
Fast Refresh to).

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
| The publisher's general policy, `dastanlo.github.io/become-smarter-daily-privacy/privacy-policy.html` (one English page for every app on the account) | no accounts, no personal data collected, no analytics, ads or tracking; what the user creates stays on the device; local notifications only |
| `ios/HabbitsLine/PrivacyInfo.xcprivacy` (generated by prebuild) | `NSPrivacyTracking false`, `NSPrivacyCollectedDataTypes` empty; required-reason APIs declared: file timestamps, user defaults, system boot time, and disk space from `ios.privacyManifests` in `app.json` (see [pitfalls.md](pitfalls.md)) |
| App Privacy questionnaire in App Store Connect | "Data Not Collected", no tracking |

Verified by the absence of any network call in `src` and of any third-party analytics or
advertising library in `package.json`:

```bash
grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|axios" src   # empty, except tests
```

When the first network call appears, all three are updated: policy, manifest and
questionnaire. The policy lives outside this repository, in the publisher's
`DastanLo/become-smarter-daily-privacy`. [`docs/privacy-policy.ru.md`](privacy-policy.ru.md)
and [`.en.md`](privacy-policy.en.md) describe this app in more detail, backups included,
but nothing serves them: GitHub Pages is not enabled for this repository.
