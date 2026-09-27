# Habbits Line

An offline habit and expense tracker for iOS. No backend, no accounts, no network:
everything lives in a local SQLite database and local notifications. A personal project,
one developer.

## Stack

Expo SDK 57 ([docs](https://docs.expo.dev/)), TypeScript, iOS-only (`"platforms": ["ios"]`).

| Package | Why | Docs |
|---|---|---|
| `expo-router` | file-based navigation, `typedRoutes` | https://docs.expo.dev/router/introduction/ |
| `expo-sqlite` | database, migrations via `user_version` | https://docs.expo.dev/versions/latest/sdk/sqlite/ |
| `zustand` | stores with atomic selectors | https://zustand.docs.pmnd.rs/ |
| `expo-notifications` | **local-only** reminders | https://docs.expo.dev/versions/latest/sdk/notifications/ |
| `react-native-reanimated` | animations on the UI thread | https://docs.swmansion.com/react-native-reanimated/ |
| `date-fns` | date arithmetic, **deep imports only** | https://date-fns.org/docs/Getting-Started |
| `@expo/ui` | native controls (DatePicker etc.) | https://docs.expo.dev/versions/latest/sdk/ui/ |
| `expo-symbols` | SF Symbols | https://docs.expo.dev/versions/latest/sdk/symbols/ |

Styling: `StyleSheet` on top of [`src/constants/design-tokens.ts`](src/constants/design-tokens.ts).

## Language

**All text in the repository is written in English**: code, comments, commit messages,
PRs, README, AGENTS.md, `docs/`, OpenSpec changes, Claude commands and skills, config
descriptions. New files and edits to existing ones follow the same rule.

The exceptions are content that is Russian by design:

- UI localization: `src/i18n/ru.ts` and the Russian parts of user-facing material
  (the `ru` locale in `store.config.json`, `docs/privacy-policy.ru.md`, `assets/store/`).
  The UI itself is in Russian and English via `src/i18n` (Russian by default).
- Data: the seeded category names in `db/migrations.ts` and `lib/category-name.ts`, the
  demo seed in `scripts/`, Russian strings in tests.
- Quoting a real Russian UI string or stored value in a comment (`"Прочее"`, `«из»`),
  when the comment is about that exact string.

Conversation with the owner is in Russian.

## Rules

- Do not add dependencies without my permission. Ask first.
- Do not change the DB schema without a migration and my consent. A shipped migration is
  never edited, only a new block is added; see [docs/database.md](docs/database.md).
- Do not touch files outside the current task.
- Colors, spacing, radii, fonts: only from `design-tokens.ts`.
- Streaks and statistics are computed from `entries`, never stored separately.
- Dates are a `YYYY-MM-DD` string in the local timezone, only through `lib/date.ts`.
  `toISOString()` for date keys is forbidden.
- Long lists: `FlatList`, not `.map`.
- A new UI string is a key in `i18n/ru.ts` **and** `i18n/en.ts`.
- Do not rely on memory for Expo APIs: check Expo Skills and the docs above.

## Checks

```bash
npm run typecheck   # tsc --noEmit: must pass cleanly
npm run lint
npm test            # jest: pure logic in src/lib and i18n
npm run test:tz     # date tests in 10 timezones, after edits to lib/date.ts
npm run ios         # expo run:ios: native build into the simulator
```

Before saying "done": typecheck and tests are green, and the app starts without warnings
in Metro. UI changes are confirmed by a screenshot from the simulator, not by reasoning.
CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck, tests
and a bundle export on every push to `master`.

## Verifying changes in the simulator

The app is installed on a running simulator with Metro on 8081; JS edits arrive via Fast
Refresh, no rebuild needed.

```bash
xcrun simctl openurl booted "habbitsline://"           # reset to the root
xcrun simctl openurl booted "habbitsline://habit/new"  # any expo-router path
xcrun simctl io booted screenshot out.png
sips -c H W --cropOffset Y X out.png                   # crop to the area you need
```

Synthetic taps **do not work** (neither AppleScript nor CGEvent). State that a deep link
cannot reach is set in code: a temporarily changed default or an inline `ref`, take the
screenshot, then `git checkout` the file. Settings that change only by a tap (theme,
language, period start day) live in the `app_settings` table of the simulator's database:

```bash
xcrun simctl get_app_container booted com.mar1798.habbits-line data
# → <container>/Documents/SQLite/habits.db: terminate the app, edit with sqlite3,
#   launch again, take the screenshot, restore the value
```

Numbers on screen (streaks, rates, remaining budget) are checked against the same
database: the rule is rewritten in a throwaway script and compared. Importing
`lib/streaks.ts` for such a check is pointless: a shared bug will agree with itself.

## Measurements

Bundle size is only ever measured, never reasoned about:

```bash
EXPO_UNSTABLE_ATLAS=true npx expo export --platform ios --output-dir /tmp/atlas --clear
```

The export prints the size of the Hermes `.hbc`: that is the number to compare between
changes. `.expo/atlas.jsonl` has two lines: line 0 is metadata, line 1 is a JSON array
where **index 6** is the module list (`relativePath`, `package`, `output[].data.code`).
Summing the length of `code` per `package` gives the breakdown. The `size` field is the
source size, not the output; do not trust it.

## Skills

- The `expo` plugin is enabled in [`.claude/settings.json`](.claude/settings.json):
  `expo-overview` is the entry point for any Expo task, and it routes on to `expo-router`,
  `expo-native-ui`, `expo-ui`, `expo-animation`, `expo-upgrade` and the rest.
- [`.agents/skills/react-native-best-practices`](.agents/skills/react-native-best-practices/SKILL.md):
  RN performance: lists, re-renders, bundle size, TTI, memory. Pinned in
  `skills-lock.json`.
- Current library APIs: via Context7 or the official docs from the table above, not from
  memory.

## Documents

- [README.md](README.md): what this is, how to run it.
- [docs/architecture.md](docs/architecture.md): data flow, file tree, conventions.
- [docs/database.md](docs/database.md): schema, pragmas, migration rules.
- [docs/domain.md](docs/domain.md): rules for streaks, rates, periods, notifications.
- [docs/pitfalls.md](docs/pitfalls.md): pitfalls: prebuild, timezones, the notification
  limit, weekday numbering, the cost of calculations.
- [docs/release.md](docs/release.md): shipping a release to the App Store.

## How we work

One task per session. The flow: understand what is already in the code → do it → run
the checks → a short report: what was done, what is left, what broke.

The documents are living: if a change alters the schema or a calculation rule, or adds a
pitfall, the corresponding file in `docs/` is edited in the same commit. Docs describe
what is in the code, not plans.
