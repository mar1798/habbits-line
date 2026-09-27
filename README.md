# Habbits Line

An offline habit tracker for iOS. No backend, no accounts, no network: everything lives
in a local SQLite database and local notifications. A personal project.

## Stack

Expo SDK 57 + expo-router, TypeScript, expo-sqlite, zustand, expo-notifications
(local only), react-native-reanimated, date-fns.
Styling: `StyleSheet` on top of `src/constants/design-tokens.ts`.

Besides habits there are expenses: a budget per period with any start day (1..28),
categories with an emoji and a color, a spending bar by category, and period comparison
in the statistics.

The theme is switched in settings (system / light / dark); the font is not scaled by
system Dynamic Type. The UI is in Russian and English: Russian by default, English is
switched on in the same settings. Android and web are deliberately unsupported
(`"platforms": ["ios"]`).

## Running

```bash
npm install
npm run ios        # expo run:ios: builds the native project and installs it in the simulator
```

The `ios/` folder is generated and sits in `.gitignore`. It does not update itself:
everything that comes from `app.json` (display name, icon, splash, bundle id) reaches the
build only after `npx expo prebuild --platform ios`. After editing `app.json`, run it,
or the old build is what gets made.

The whole app runs in Expo Go: the only system service it needs is local notifications,
and those are available in Expo Go. The splash behavior on a launch from a
notification tap differs from the real one, so reminders are tested on a dev build.

Shipping to the App Store (build, upload, listing and acceptance) is described in
[docs/release.md](docs/release.md).

## Checks

```bash
npm run typecheck  # tsc --noEmit: must pass cleanly
npm run lint
npm test           # jest: pure logic for dates, schedules, streaks, periods, sums
                   # and pluralization
npm run test:tz    # date tests in ten timezones
```

## Structure

```
src/
  app/            expo-router screens: (tabs)/index|expenses|stats|settings,
                  habit/new|[id], expense/new|[id]|budget, expense-category/new|[id]
  components/     ui/*: base primitives; habit/*, expense/* and stats/*: domain components
  constants/      design-tokens.ts: the single source of colors, spacing, radii
  db/             migrations, provider and repositories on top of expo-sqlite
  i18n/           ru.ts: source of keys, en.ts is typed against it, plural.ts + tests
  store/          zustand: habits-store (habits + CRUD), entries-store, settings-store,
                  expense-categories-store, expenses-store
  lib/            date, schedule, streaks, period, money, expenses, notifications,
                  backup, haptics, id + tests
  hooks/          use-theme, use-i18n, use-today-key
```

## Documents

- [AGENTS.md](AGENTS.md): working rules for the project, commands, checks, measurements.
- [docs/architecture.md](docs/architecture.md): data flow, file tree, conventions.
- [docs/database.md](docs/database.md): DB schema, pragmas, migration rules.
- [docs/domain.md](docs/domain.md): how streaks, rates, periods and the budget are computed.
- [docs/pitfalls.md](docs/pitfalls.md): pitfalls: prebuild, timezones, the iOS
  notification limit, weekday numbering, the cost of computing streaks.
- [docs/release.md](docs/release.md): shipping a release to the App Store.

The documents are living: they describe what is in the code and are edited along with it.
All text in the repository is written in English; the only exceptions are user-facing
localized content (see [AGENTS.md](AGENTS.md#language)).
