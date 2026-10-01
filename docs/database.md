# Database

SQLite via `expo-sqlite`. It is opened by
`<SQLiteProvider databaseName="habits.db" onInit={initDatabase} useSuspense>` inside
`<Suspense>` in the root `src/app/_layout.tsx`; `initDatabase` runs `migrate` and then
reads the settings, and nothing renders until both are done. All SQL lives in
`src/db/*-repo.ts`; screens and stores never touch the database directly.

The current schema version is `DATABASE_VERSION` in [`src/db/migrations.ts`](../src/db/migrations.ts).

## Pragmas

`PRAGMA foreign_keys = ON` is a **connection**-level setting, not a file-level one. It
runs at the start of `migrate(db)`, **before** the `user_version` check, i.e. on every
database open. Tucked inside a migration block, it would silently switch off
`ON DELETE CASCADE` from the app's second launch on.

`PRAGMA journal_mode = WAL`, on the other hand, is persistent: once at creation is enough.

## Tables

### `habits`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | uuid v4 from `expo-crypto` (stable across export/import) |
| `name` | TEXT NOT NULL | name |
| `emoji` | TEXT NOT NULL | a single emoji from `constants/emoji.ts` |
| `color_key` | TEXT NOT NULL | palette **key** (`violet`, `teal`, …), not hex |
| `target_per_day` | INTEGER NOT NULL DEFAULT 1 | `CHECK (target_per_day >= 1)` |
| `schedule_mask` | INTEGER NOT NULL DEFAULT 127 | day bits, bit 0 = Monday … bit 6 = Sunday; `CHECK (> 0 AND <= 127)` |
| `reminder_time` | TEXT NULL | local `'HH:mm'`, NULL = no reminder |
| `sort_order` | INTEGER NOT NULL | order in the list; `max + 1` on creation |
| `archived_at` | TEXT NULL | ISO timestamp of archiving; NULL = active |
| `created_at` / `updated_at` | TEXT NOT NULL | ISO timestamps |

Index `idx_habits_active(archived_at, sort_order)`.

- **`color_key`, not hex:** the color has to change with the theme. A hex value would
  pin the light variant forever and break the "colors only from tokens" rule.
- **A mask, not a days table:** 7 bits instead of 7 rows; "scheduled today" is one
  bitwise operation with no JOIN on the hot path of the Today screen.
- **`CHECK (schedule_mask > 0)`:** a habit with an empty schedule would show up on no
  screen at all. The form does not let the last day be unchecked.

### `entries`

| Column | Type | Description |
|---|---|---|
| `habit_id` | TEXT NOT NULL | `REFERENCES habits(id) ON DELETE CASCADE` |
| `date` | TEXT NOT NULL | `'YYYY-MM-DD'` in the local timezone |
| `count` | INTEGER NOT NULL | `CHECK (count > 0)`; the row is deleted when it drops to zero |
| `updated_at` | TEXT NOT NULL | ISO |

`PRIMARY KEY (habit_id, date)` doubles as the covering index for "all days of one habit".
Plus `idx_entries_date(date)` for "the day's progress across all habits".

- **One row per day, not per tap:** every query is an aggregate, and `count` removes a
  `GROUP BY` from every render. The price is that the tap time is not stored; that is
  out of scope.
- **`count` against a lowered target:** after `target_per_day` goes from 3 to 1, an old
  entry gives 300%. The share is clamped everywhere: `min(count / target_per_day, 1)`.
  The entry itself is left alone.
- **Entries on off-schedule days:** they stay after a weekday is unchecked. The heatmap
  paints the cell as usual (the data is there, so it is shown); streaks and rates ignore it.

### `expense_categories`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | uuid v4 |
| `name` | TEXT NOT NULL | name |
| `emoji` | TEXT NOT NULL | a single emoji from `constants/emoji.ts` |
| `color_key` | TEXT NOT NULL | key of the **expense palette** (16 colors), not hex |
| `sort_order` | INTEGER NOT NULL | order in the grid; `max + 1` on creation |
| `archived_at` | TEXT NULL | ISO timestamp of archiving; NULL = active |
| `created_at` / `updated_at` | TEXT NOT NULL | ISO |

Index `idx_expense_categories_active(archived_at, sort_order)`.

Eight categories are seeded **by the migration itself**, not by the first render:
otherwise it would need a "seeding done" flag and a branch on every start. The migration
runs exactly once, so someone who archived all eight does not get them back, by design.
The names are seeded in Russian and are **not translated** when the language changes:
they are user data, just like habit names.

### `expenses`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | uuid v4 |
| `category_id` | TEXT NOT NULL | `REFERENCES expense_categories(id) ON DELETE RESTRICT` |
| `amount` | INTEGER NOT NULL | whole units, `CHECK (amount > 0)` |
| `date` | TEXT NOT NULL | `'YYYY-MM-DD'` in the local timezone |
| `note` | TEXT NULL | one-line description; NULL ≠ `''`, and the list branches on exactly that |
| `time` | TEXT NULL | local `'HH:mm'`; NULL on rows from before v5 |
| `created_at` / `updated_at` | TEXT NOT NULL | ISO |

Indexes `idx_expenses_date(date)` and `idx_expenses_category(category_id)`.

- **`time` is set by the repository on insert; the form does not offer it:** it is the
  moment the expense was recorded, not an input field. Editing the amount or description
  later does not move it. It comes from `nowTimeOfDay()` in `lib/date.ts`, not from
  `created_at`: that one is ISO in UTC, and the list needs wall-clock time. Rows from
  before v5 are not backfilled: a time derived from `created_at` would invent a minute
  that never happened, and an evening entry of a morning expense would stay evening
  forever. The list shows nothing for NULL.
- **Not part of `date`:** everything that groups, filters and sums works on the day key,
  and `lib/date.ts` lets nothing but `'YYYY-MM-DD'` in there.
- **Its own `id`, not a composite key like `entries`:** there can be any number of
  expenses in one category on one day, and each is edited on its own; a composite key
  would turn the second "Food" of the day into an overwrite of the first.
- **`ON DELETE RESTRICT`, not `CASCADE`:** deleting a habit reasonably takes its check-ins
  with it, but expenses are money already spent, and deleting a category must not change
  last month's total. A category with expenses is deleted only after its expenses are
  reassigned to "Прочее" (Other), and both operations run in one transaction; the schema
  guarantees the reassignment cannot be forgotten, because SQLite simply refuses the
  `DELETE`.

### `expense_budgets`

| Column | Type | Description |
|---|---|---|
| `period_start` | TEXT PK | `'YYYY-MM-DD'`, the first day of the period |
| `amount` | INTEGER NOT NULL | `CHECK (amount > 0)` |
| `updated_at` | TEXT NOT NULL | ISO |

A row exists only for a period whose budget was set explicitly. A period without a row
inherits the latest row **before** its start; the rule is in `lib/expenses.ts`
(`resolveBudget`).

### `expense_incomes`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | uuid v4 |
| `amount` | INTEGER NOT NULL | whole units, `CHECK (amount > 0)` |
| `date` | TEXT NOT NULL | `'YYYY-MM-DD'` in the local timezone |
| `created_at` / `updated_at` | TEXT NOT NULL | ISO |

Index `idx_expense_incomes_date(date)`.

- **Its own table, not a `kind` column in `expenses`:** every existing query and every
  function in `lib/expenses.ts` sums `expenses` as "spent". A discriminator would push
  the duty to filter onto all of them, and a forgotten filter does not crash: it quietly
  adds income into the spent total, the category breakdown and the daily average. Here
  nothing that reads `expenses` changed at all.
- **No category and no note:** income has no place in the expense category palette, and
  the amount is all it says. Either one can be added with a single `ALTER`, the way
  `note` was added to `expenses` in v3.
- **A date, not `period_start`:** income belongs to a period by falling inside it. A
  period key would move the income to another period (or leave it tied to a period that
  is never opened again) on the first change of the start day.

### `app_settings`

`key TEXT PRIMARY KEY, value TEXT NOT NULL`: flat settings. `theme_mode`, `language`,
`expense_period_start_day` (`'1'`..`'28'`, default `'1'`), `currency_symbol` (up to three
characters, default `'₽'`; an empty string is a deliberate "no symbol", not a missing
row), `currency_position` (`'prefix'` / `'suffix'`, default `'suffix'`), `last_export_at`
(the `YYYY-MM-DD` date key of the last export; no row until the first export). They are
read by a single `load()` in the provider's `onInit`, before the first render: otherwise
the chosen theme would flash as the system one on the first frame, and the native tab
bar would keep blank labels (see [pitfalls.md](pitfalls.md)).

A new key here is not a migration: it is a key-value table, and a missing row reads as
the default. Only a change in the meaning of an already shipped key would need a
migration.

### What is NOT stored

Streaks, best streak, 7/30-day rates, daily totals: all computed on the fly from
`entries` and `expenses`. Any retroactive edit would instantly invalidate a cache, and
the volume is tiny (a habit over 3 years ≈ 1000 rows). Notification ids are not stored
either; they are recovered by a full recomputation.

## Migrations

`PRAGMA user_version` plus sequential blocks in `migrate(db)`. Each block is **one
transaction together with the version stamp**: applied halfway, it bricks the app (the
next launch runs `CREATE TABLE` against an existing table and crashes).

**Project-wide rule: a shipped migration is never edited, only a new block with an
incremented `DATABASE_VERSION` is added.** An installed copy already has its
`user_version` set, and an edit to an old block would simply never apply. Before a
migration on a live device, export JSON from the settings.

The schema does not change without the project owner's consent (see [AGENTS.md](../AGENTS.md)).
