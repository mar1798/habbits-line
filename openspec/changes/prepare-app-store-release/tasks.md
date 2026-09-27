## 1. Prerequisites outside the repository

- [ ] 1.1 Check that the Apple Developer Program account is active and note the Team ID,
      which `eas.json` needs (check: the Team ID is written down).
- [ ] 1.2 Create the app record in App Store Connect with bundle id
      `com.mar1798.habbits-line`, default language `ru`, iPhone-only; note the
      `ascAppId` from App Information (check: the `ascAppId` is written down).
- [ ] 1.3 Issue an App Store Connect API key with the App Manager role, put the `.p8`
      outside the repository and note the issuer id and key id (check: `git status` in a
      clean working copy does not show the `.p8`).
- [ ] 1.4 Check the visibility of the `mar1798/habbits-line` repository and enable GitHub
      Pages for `docs/`, or, if the repository is private, choose a public gist
      (check: the chosen URL opens in a private browser window without authentication).

## 2. App configuration

- [x] 2.1 Return `expo-notifications` to `plugins` in `app.json` (check:
      `git diff app.json` no longer shows the plugin being removed).
- [x] 2.2 Add `ios.buildNumber: "1"`, `ios.config.usesNonExemptEncryption: false`,
      `ios.supportsTablet: false` and `description` to `app.json` (check:
      `npx expo config --type public` prints all four).
- [x] 2.3 Run `npx expo prebuild --platform ios --clean` and check
      `ios/HabbitsLine/Info.plist`: `CFBundleVersion 1`,
      `ITSAppUsesNonExemptEncryption false`, `UIDeviceFamily` only `1` (check:
      `plutil -p ios/HabbitsLine/Info.plist` shows these values).
- [x] 2.4 Make sure `ios/HabbitsLine/PrivacyInfo.xcprivacy` kept `NSPrivacyTracking false`
      and an empty `NSPrivacyCollectedDataTypes` after prebuild (check: the file's
      contents match the expected ones).
- [x] 2.5 Run `npm run typecheck`, `npm run lint`, `npm test` (check: all three are
      green).

## 3. About section in settings

- [x] 3.1 Add the keys `about_title`, `about_version`, `about_privacy_policy` to
      `src/i18n/ru.ts` and `src/i18n/en.ts` (check: `npm run typecheck` is green, since
      `en.ts` is typed against `ru.ts`).
- [x] 3.2 Add an About section at the end of `src/app/(tabs)/settings.tsx`: version and
      build number from `Constants.expoConfig`, a row with the policy link via
      `Linking.openURL` (check: `npm run typecheck` and `npm run lint` are green).
- [x] 3.3 Take a screenshot of the section in the simulator in both languages and
      compare the numbers shown with `CFBundleShortVersionString` and `CFBundleVersion`
      from `Info.plist` (check: screenshots attached, numbers match).

## 4. Privacy policy

- [ ] 4.1 Write `docs/privacy-policy.ru.md` and `docs/privacy-policy.en.md`: offline, no
      accounts and no network, no tracking and no analytics; data leaves the device only
      as a backup file the user exports themselves; a contact (check: every claim is
      confirmed by the code; compare with `src/lib/backup.ts` and
      `src/lib/notifications.ts`, no third-party SDKs in `package.json`).
- [ ] 4.2 Publish using the method chosen in 1.4 and put the resulting URL into the
      constant the About section refers to (check: tapping the link in the simulator
      opens the published page).
- [x] 4.3 Compare the policy text with `PrivacyInfo.xcprivacy` and with the App Privacy
      questionnaire answers ("Data Not Collected", no tracking); there must be no
      discrepancies (check: the three sources are written out side by side and match).

## 5. Release pipeline

- [ ] 5.1 Run `npx eas-cli@latest init` to link the project (check: `app.json` gained
      `extra.eas.projectId`, `npm run typecheck` is green).
- [ ] 5.2 Create `eas.json`: `cli.appVersionSource: "local"`, a `production` build
      profile and `submit.production.ios` with `ascAppId` and `appleTeamId` from step 1;
      the key is passed via the `EXPO_ASC_API_KEY_*` variables, do not write
      `ascApiKeyPath` (check: `npx eas-cli@latest config` reads the file without errors,
      `grep -r "\-\-\-\-\-BEGIN" eas.json` is empty).
- [x] 5.3 Check that `.gitignore` covers `*.p8` and add `AuthKey_*.p8` if the pattern
      does not cover the key's name (check: `git check-ignore -v AuthKey_TEST.p8` prints
      the rule).
- [ ] 5.4 Build the release archive in Xcode (`ios/HabbitsLine.xcworkspace`, Release
      scheme, Archive → Distribute → App Store Connect → Export) and get the `.ipa`
      (check: the `.ipa` exists and lies outside the repository or in an ignored
      directory).

## 6. Release build acceptance

- [ ] 6.1 Install the release build on a device over a clean state and go through a cold
      start (check: the app opens on the empty state, with no calls to Metro and no
      debug overlays).
- [ ] 6.2 Check a reminder: enable it on a habit, wait for it to fire, open the app by
      tapping the notification (check: the notification arrived, the tap opens the
      right habit).
- [ ] 6.3 Check backup export and import on the release build (check: the file is
      exported via the share sheet and imported back with nothing lost).
- [ ] 6.4 Go through every screen in both themes and both languages (check: screenshots
      attached, no truncated text and no untranslated strings).
- [ ] 6.5 Compare `CFBundleShortVersionString` and `CFBundleVersion` of the built archive
      with `app.json` and with what the About section shows (check: the three sources
      match).

## 7. Listing artifacts

- [x] 7.1 Write `scripts/seed-demo-db.ts` (or `.js`) that builds a demo database from a
      deterministic seed: habits with streaks, expense categories, a budget, several
      months of history (check: two runs produce byte-identical data in the tables).
- [x] 7.2 Write `scripts/screenshots.sh`: boot iPhone 17 Pro Max, terminate the app, put
      the demo database into the container, go through the tabs with deep links and
      take `xcrun simctl io booted screenshot` into `assets/store/screenshots/`
      (check: two runs in a row produce identical 1320 × 2868 images).
- [x] 7.3 Take the final set: habits, expenses, statistics, settings (check: the files
      are in `assets/store/screenshots/`, the resolution is right, no placeholders and no
      debug overlays).
- [x] 7.4 Write `store.config.json` with `ru` and `en-US` localizations: name, subtitle,
      description, keywords, release notes; categories `PRODUCTIVITY` /
      `HEALTH_AND_FITNESS`, an unrestricted age rating, review contacts, policy and
      support URLs (check: name and subtitle ≤ 30 characters, keywords field ≤ 100
      characters, counted for both languages).
- [x] 7.5 Check that the description promises nothing the app lacks and that the
      screenshots show exactly what the description talks about (check: go through the
      description point by point against the screenshot set).

## 8. Submission

- [ ] 8.1 Submit the build: `EXPO_ASC_API_KEY_* … npx eas-cli@latest submit -p ios
      --path <ipa>` (check: the build appeared in App Store Connect and was processed
      without "Missing Compliance").
- [ ] 8.2 Fill in the listing in App Store Connect by copying from `store.config.json`,
      upload the screenshots, set the policy URL, answer the App Privacy questionnaire
      "Data Not Collected" (check: App Store Connect shows no unfilled required fields).
- [ ] 8.3 Submit for review (check: the app status is "Waiting for Review").

## 9. Documentation

- [x] 9.1 Write `docs/release.md`: prerequisites and accounts, bumping `version` /
      `ios.buildNumber` together with `prebuild` as one step, building the archive,
      submission, what is filled in by hand in the first release and what moves to
      `eas metadata:push` from the second, the acceptance checklist (check: the whole
      path can be followed from the document without consulting this plan).
- [x] 9.2 Add the `buildNumber` and `prebuild` pitfall to `docs/pitfalls.md`, and a link
      to `docs/release.md` to `README.md` (check: the links open, the text describes
      what is in the code).
