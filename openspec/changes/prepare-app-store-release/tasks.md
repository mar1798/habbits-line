## 1. Prerequisites outside the repository

- [x] 1.1 Check that the Apple Developer Program account is active (check: the
      publisher's other app, Become Smarter Daily, is live on the App Store under it).
- [ ] 1.2 Get the app record in App Store Connect with bundle id
      `com.dastan.habbitsline`, primary language `ru`, iPhone-only: the first
      `eas submit` creates it from `eas.json`, or it is created by hand for the Xcode
      route (check: the record exists in App Store Connect).
- [ ] 1.3 Only for uploading a local `.ipa` without an Apple ID login: issue an App Store
      Connect API key with the App Manager role, put the `.p8` outside the repository and
      note the issuer id and key id (check: `git status` in a clean working copy does not
      show the `.p8`).
- [x] 1.4 Choose where the policy is published. GitHub Pages cannot be enabled on
      `mar1798/habbits-line` without admin rights there, so the app uses the publisher's
      general pages: `dastanlo.github.io/become-smarter-daily-privacy/privacy-policy.html`
      and, for support, `dastanlo.github.io/support-page/support.html` (check: both URLs
      open without authentication).

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

- [x] 4.1 Check the publisher's general policy (chosen in 1.4) against the app: no
      accounts, no personal data, no analytics, ads or tracking, content kept on the
      device, local notifications only, and the publisher's email as the contact. Its
      one inexact line, "this data never leaves your device", does not mention the
      backup file the user exports themselves. `docs/privacy-policy.ru.md` and
      `docs/privacy-policy.en.md` keep a more detailed app-specific text that is not
      published (check: every claim is confirmed by the code; compare with
      `src/lib/backup.ts` and `src/lib/notifications.ts`, no third-party SDKs in
      `package.json`).
- [x] 4.2 Publish using the method chosen in 1.4 and put the resulting URL into the
      constant the About section refers to (check: tapping the link in the simulator
      opens the published page).
- [x] 4.3 Compare the policy text with `PrivacyInfo.xcprivacy` and with the App Privacy
      questionnaire answers ("Data Not Collected", no tracking); there must be no
      discrepancies (check: the three sources are written out side by side and match).

## 5. Release pipeline

- [ ] 5.1 Run `npx eas-cli@latest init` to link the project (check: `app.json` gained
      `extra.eas.projectId`, `npm run typecheck` is green).
- [x] 5.2 Create `eas.json`: `cli.appVersionSource: "local"`,
      `cli.promptToConfigurePushNotifications: false`, a `production` build profile and
      `submit.production.ios` with the app name, primary language `ru` and SKU for the
      record the first `eas submit` creates; do not write `ascApiKeyPath` (check:
      eas-cli's own `@expo/eas-json` accepts the build and submit profiles,
      `grep -r "\-\-\-\-\-BEGIN" eas.json` is empty).
- [x] 5.3 Check that `.gitignore` covers `*.p8` and add `AuthKey_*.p8` if the pattern
      does not cover the key's name (check: `git check-ignore -v AuthKey_TEST.p8` prints
      the rule).
- [ ] 5.4 Build the release: `npx eas-cli@latest build -p ios --profile production`, or
      the archive in Xcode (`ios/HabbitsLine.xcworkspace`, Release scheme, Archive →
      Distribute → App Store Connect) (check: the build page on expo.dev shows a
      finished iOS build, or the `.ipa` lies outside the repository or in an ignored
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

- [ ] 8.1 Submit the build: `npx eas-cli@latest submit -p ios --latest`, or
      `EXPO_ASC_API_KEY_* … npx eas-cli@latest submit -p ios --path <ipa>` for a local
      archive (check: the build appeared in App Store Connect and was processed without
      "Missing Compliance").
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
