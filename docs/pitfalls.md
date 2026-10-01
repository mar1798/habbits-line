# Pitfalls

Places where things have already broken or where the right choice is not obvious. Read
before touching the corresponding area.

## `ios/` does not regenerate itself

The folder is generated and sits in `.gitignore`, but the build is made from it.
Everything that comes from `app.json` (display name, icon, splash, bundle id) reaches the
build only through `npx expo prebuild --platform ios`. This has already cost one release
the wrong name under the icon. **Touched `app.json`? Run prebuild and check
`ios/HabbitsLine/Info.plist`, not just `expo config`.**

## `pod install` needs a UTF-8 locale

In a shell where `LANG` is not set (Terminal sets it, some non-interactive shells do
not), prebuild generates `ios/` and then CocoaPods dies in
`Pod::Config#installation_root` with "Unicode Normalization not appropriate for
ASCII-8BIT". The project is left without `Pods/`, and Xcode cannot build it.
`export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` before `npx expo prebuild` or
`npx expo run:ios`.

## `buildNumber` lives in `app.json` but is checked in `Info.plist`

A special case of the pitfall above, listed separately because the cost is different:
App Store Connect rejects an upload with a number that has been used before ("The bundle
version must be higher"). Bumping `ios.buildNumber` in `app.json` without running
prebuild means building an archive with the old `CFBundleVersion` and finding out only
at upload, after archiving. That is why in [release.md](release.md) the bump and the
prebuild are one step, with `plutil -p` over `Info.plist` right after it.

The same goes for `ios.config.usesNonExemptEncryption`: it does not appear in the public
config (`expo config --type public`) at all; it exists only as
`ITSAppUsesNonExemptEncryption` in the built `Info.plist`. Checking it via `expo config`
is useless; only the plist tells.

## Deep links in the simulator are no longer silent

iOS 26 shows a system "Open in app?" dialog for any custom scheme, and
`xcrun simctl openurl` is no exception. The URL **is delivered** (the app navigates where
it is told), but the dialog stays as an overlay on top of the screen. There is no way to
dismiss it: it cannot be tapped, it ignores Escape from the simulator keyboard, and the
second declared scheme (`com.dastan.habbitsline://`) behaves the same.

It does not get in the way of checking behavior, since the deep link works. It does get
in the way of screenshots: the frame is spoiled. There, the tab is switched with a tap in
the Simulator, or set in code via Fast Refresh where nothing can tap; see
[release.md](release.md), step 7.

## A notification button response arrives late and is dated by delivery

The `mark` action is declared with `opensAppToForeground: false`, and there is no
background task: `registerTaskAsync` pulls in `expo-task-manager`, a new dependency.
While the app is alive, the press arrives in `addNotificationResponseReceivedListener`.
If the app has been unloaded, the response **accumulates in the system** and is visible
only to the next launch via `getLastNotificationResponse()`, possibly days later.

Hence two rules in `applyReminderMark`:

- The day comes from `notification.date`, the moment of **delivery**, not from
  `todayKey()`; otherwise a delayed press would mark the wrong day.
- On iOS, `notification.date` is in **seconds** (`timeIntervalSince1970` in the native
  record, no `* 1000`), even though the type is the same `number` that Android fills with
  milliseconds. Hence the `* 1000` when parsing; the app is iOS-only, so there is no
  Android branch.

And a third one in `_layout.tsx`: the stored response is cleared with
`clearLastNotificationResponse()` **in both branches**, not only on a cold start. The
system hands it over on every subsequent launch, so an uncleared response would not
just navigate to Today again but apply the same mark a second time.

## `PRAGMA foreign_keys` is a connection setting

It lives at the start of `migrate()`, before the `user_version` check. Tucked into a
migration block, it silently disables cascading deletes from the second launch on. See
[database.md](database.md).

## An exclusive transaction opens a new connection

Import runs through `withExclusiveTransactionAsync` (a regular transaction captures
unrelated concurrent queries), and that is a **new connection** where `foreign_keys` is
not enabled. So import does not rely on the cascade and checks references itself.

## Weekday numbering: three different systems

Ours: bit 0 = Monday; `date-fns` `getDay()`: 0 = Sunday; `CalendarTriggerInput` /
`WeeklyTriggerInput`: `weekday: 1` = Sunday. Both conversions live in exactly one place,
[`src/lib/schedule.ts`](../src/lib/schedule.ts), and are covered by tests. Do not
convert at the call site.

## Untrusted data from import

The backup file is the only entry point through which the database receives things the
UI cannot create. The schema checks types but not values, so the checks live in
[`src/lib/backup.ts`](../src/lib/backup.ts), and the calculations keep a safety margin:
`forEachDateKey` on an invalid key returns an empty streak instead of a `RangeError`
from render, and `scheduleForHabit` skips a habit with a broken `reminder_time` instead
of failing the recomputation for all the others.

## The cost of computing streaks

`computeStreaks` walks the days linearly over the whole history, on every recomputation
of Stats. With date-fns `parse`/`format` on each iteration, that is 35 ms over three
years and 59 ms over ten (desktop Node; 3–5× more on a device). So the walk moved into
`forEachDateKey`, which keeps one mutable `Date` and builds the key by hand: the same
data takes 2 and 7 ms. The next step, if the history grows to decades, is to compute
`best` incrementally.

## `listAllEntries` reads the whole table on every tab focus

`SELECT * FROM entries ORDER BY date ASC` with no bounds, on every `isFocused` in
`(tabs)/stats.tsx`. This is intentional: after the load, switching between habits
becomes pure derivation with no trip to the database. But the cost grows linearly and
forever: the table has no upper bound. Measured: 1,286 rows take 3 ms for all cards,
7,670 take 12 ms, 38,406 take 49 ms (desktop Node, several times more on a device). At
today's volumes this is cheap; if it gets expensive, narrow the query where the logic
already implies a window (heatmap: one year, weekdays: 90 days).

## There is no such thing as a date-fns barrel

Metro does not tree-shake: `import { format } from 'date-fns'` drags all 310 modules of
the library into the bundle. Import only deep: `date-fns/format`. This is verified by
measurement, not reasoning: see "Measurements" in [AGENTS.md](../AGENTS.md).

## Expo Go vs dev build

Local notifications work in Expo Go (only push is unavailable there). But the splash
behavior on a launch from a notification tap differs from the real one: **reminders are
tested on a dev build only.**

## Notification permissions

On iOS, look at `ios.status`, not the root `status`. Without permission the
recomputation is skipped; that is not an error. A cold start from a tap needs
`getLastNotificationResponse()` followed by a mandatory
`clearLastNotificationResponse()`; otherwise the response lives on and fires on every
launch.

## `reactCompiler: true`

Enabled in `app.json`. Do not add manual `useMemo` / `useCallback` without a measured
problem: the compiler already does this.

But the compiler silently gives up on a whole file, and there is no way to know without
checking. A conditional expression inside `try` ("Support value blocks within a
try/catch statement") turns off memoization for the whole module, not one function. Keep
ternaries and `?.` outside `try`, and leave only the call itself inside. Verify in the
exported bundle: if a module has no `$[n]` cache slots, the file dropped out.

## A fixed height around text breaks under Dynamic Type

Text scales up to 1.3 (see `clampFontScale`), but `height: 40` does not. A box that
holds a `Text` either gets its size from `useScaledSize` (the streak and recovery cards,
the width for "100%" on Today) or lives on `minHeight` and grows by itself. Check with
`xcrun simctl ui booted content_size extra-extra-extra-large` (multiplier 1.353, exactly
the upper bound) and `content_size large` to go back.

`TextInput`, meanwhile, gets only `fontSize`: with an explicit `lineHeight`, iOS clips
the field's own text.

## `aps-environment` comes back with every prebuild

The `expo-notifications` config plugin adds `aps-environment` to the entitlements, i.e.
the Push Notifications capability, which reminders do not need: they are local only. A
provisioning profile without Push fails the on-device build:

```
Provisioning Profile "…" does not support the Push Notifications capability.
Entitlements file defines the value "aps-environment" which is not registered for profile
```

Keeping the plugin out of `plugins` in `app.json` does not stop it: `expo-notifications`
is one of the packages prebuild configures on its own once it is installed
(`versionedExpoSDKPackages` in `@expo/prebuild-config`), so the key is back in
`ios/HabbitsLine/HabbitsLine.entitlements` after every `npx expo prebuild --clean`.

With a paid developer account this does no harm: automatic signing in Xcode, like EAS
Build when it syncs capabilities, turns Push Notifications on for the App ID, and the
release build carries a capability it never uses. A free personal team cannot have Push at all; there the key is deleted from the
entitlements by hand before an on-device build, and again after each prebuild.

## A prebuilt Expo module drops its privacy manifest

SDK 57 installs some Expo modules as prebuilt XCFrameworks (`ios/Pods/ExpoFileSystem/`),
and the `PrivacyInfo.xcprivacy` from the package source never reaches the app:
`ExpoFileSystem_privacy.bundle` is built empty, and the pod-install step that merges pod
manifests into the app's own finds nothing to merge. Yet `ExpoFileSystem` calls
disk-space APIs (`NSFileSystemFreeSize`, `volumeAvailableCapacityForImportantUsage`), and
so does the SQLite inside the app (`fstatfs`). With no declared reason for that category,
App Store Connect answers the upload with ITMS-91053 "Missing API declaration" and does
not accept the build.

So the category is declared in `app.json` under `ios.privacyManifests`, with the reasons
expo-file-system gives in its own manifest (`E174.1`, `85F4.1`), and prebuild merges it
into `ios/HabbitsLine/PrivacyInfo.xcprivacy`. After an SDK upgrade or a new native
dependency, check the built app, not the sources: which manifests actually shipped, and
which required-reason APIs the binaries import.

```bash
find <HabbitsLine.app> -name PrivacyInfo.xcprivacy
nm -u <HabbitsLine.app>/Frameworks/<Name>.framework/<Name> | grep -E 'statfs|FileSystemFreeSize|VolumeAvailableCapacity'
```

## Native tab labels are taken once, on the first render

The tab bar is native (`NativeTabs`), and a label that changes right after it mounts
reaches only the selected tab: the other three stay blank until each one is opened. That
is what every cold start in English looked like while the stored language arrived after
the first render, in an effect. A switch later on, from Settings, updates all four. So
the stored settings are read in the database provider's `onInit`, right after
`migrate`, and nothing renders before them (`initDatabase` in
[`src/db/provider.tsx`](../src/db/provider.tsx)). Anything else the first frame depends
on belongs there too, not in an effect.
