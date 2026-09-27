# Architecture

One data flow for the whole app:

```
expo-sqlite ──► src/db/*-repo.ts ──► src/store/*-store.ts ──► screens and components
                (all SQL)           (zustand, atomic           (render only)
                                     selectors)
```

Screens never touch the database directly. Pure logic (dates, streaks, periods, sums)
lives in `src/lib/` with no React imports and is covered by tests. It is kept out of
render not for looks but because rules like "the day is closed" and "the day is off
schedule" must live in one place, next to their tests.

## Tree

```
src/
  app/            expo-router routes
                  (tabs)/index    — "Today": date strip, habit cards
                  (tabs)/expenses — period expenses, balance, category bar
                  (tabs)/stats    — streaks, misses, rates, weekdays, heatmap, expenses block
                  (tabs)/settings — theme, language, categories, export/import, notifications
                  habit/new|[id], expense/new|[id]|budget,
                  expense-category/new|[id] — modals
  components/     ui/*    — primitives (text, button, card, screen, day-strip,
                            swipe-row…)
                  habit/*, expense/*, stats/* — domain components
  constants/      design-tokens.ts — the single source of colors, spacing, radii,
                                     typography, shadows and timings
                  emoji.ts, habit-templates.ts
  db/             migrations.ts, provider.tsx, *-repo.ts, types.ts
  i18n/           ru.ts — source of keys, en.ts is typed against it, plural.ts
  store/          habits, entries, settings, expense-categories, expenses
  lib/            date, date-range, schedule, streaks, period, money, expenses,
                  notifications, reminder-plan, backup, name-match, category-name,
                  haptics, id  (+ __tests__)
  hooks/          use-theme, use-i18n, use-money, use-font-scale, use-today-key,
                  use-taken-names
```

## Conventions

- **Styling**: `StyleSheet` on top of the tokens. No literal colors, spacing, radii or
  font sizes in components.
- **Theme**: `use-theme`. Habit and category colors are stored as a palette key so they
  change along with the theme.
- **Text**: only through `components/ui/text.tsx`. System Dynamic Type is honored but
  clamped to 1.0–1.3 (`clampFontScale` in the tokens): a variant's size and `lineHeight`
  are multiplied by hand, and `allowFontScaling` stays off, because RN only offers a
  ceiling (`maxFontSizeMultiplier`) and leaves `lineHeight` alone. Non-text sizes that
  must grow with the text (a box around a number, a column width, a caret) take the
  multiplier from `use-font-scale`.
- **Icons**: SF Symbols via `expo-symbols`.
- **Lists**: `FlatList`, not `ScrollView` + `.map`. The exception is a short fixed-length
  list inside a screen that already scrolls (the period's incomes in the budget modal): a
  `VirtualizedList` inside a `ScrollView` of the same orientation triggers an RN warning,
  and virtualizing a handful of rows buys nothing.
- **Animations**: Reanimated on the UI thread, `transform` / `opacity` only.
- **UI strings**: all through `i18n`. A new key goes into `ru.ts` (the source) and
  `en.ts`. User data (habit and category names) is not translated.
- **Native UI**: `@expo/ui` is already in the project (e.g. `DatePicker`), so this kind
  of control needs no new dependency.
