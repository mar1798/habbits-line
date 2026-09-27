# Domain rules

Why the statistics are computed the way they are. The formulas live in
[`src/lib/streaks.ts`](../src/lib/streaks.ts), [`period.ts`](../src/lib/period.ts) and
[`expenses.ts`](../src/lib/expenses.ts) and are covered by tests in `src/lib/__tests__/`;
this file holds the reasons the code does not show.

## Dates

- A date is always a `'YYYY-MM-DD'` string in the user's **local** timezone. All
  conversions go through `lib/date.ts` only.
- `toISOString()` is banned **for date keys**: it yields UTC, and in eastern timezones
  after midnight it returns yesterday. For `created_at` / `updated_at`, ISO is exactly
  what is needed.
- Flying to another timezone does not rewrite past entries: they are already strings.
- "Today" is recomputed on `AppState → active` and by a timer to the next midnight, in a
  single hook, [`use-today-key.ts`](../src/hooks/use-today-key.ts). Without it, an app
  left open overnight would show yesterday as today.
- There is deliberately no configurable "day ends at 4 AM": it would infect every
  calculation with a second notion of date.

## Habits

- **A day is closed only at 100% of the target.** The heatmap paints a cell by the
  completion share `min(count / target_per_day, 1)`, i.e. `dayCompletionRatio`.
- **A streak counts only scheduled days.** An off-schedule day neither breaks nor extends
  it. A day counts when **all** habits scheduled for it are closed, so for one habit this
  is its own streak, and for the list it is the "everything done" streak.
- **An unclosed today does not reset the streak**: it simply has not been counted yet.
- **A habit's history is bounded on both sides** (`toHabitSeries`): the start is
  `created_at` (otherwise every new habit would open with a zero streak and 0% over 30
  days), the end is `archived_at` (otherwise a habit dropped at a 40-day streak would show
  0, and the longer it sat in the archive, the worse its history would look). Both bounds
  widen to the earliest and latest entry: a day with progress belongs to the habit,
  whatever the timestamps say.
- **Rates are computed over scheduled days**, not calendar days. Otherwise a habit
  scheduled 3 days a week could never rise above 43%, which contradicts the streak rule.
- **An empty window gives `null`, not 0.** A Sunday habit opened on Saturday, or an
  archived one whose window lies entirely after its end, has not "failed everything", and
  the card must not blame the user for days that were never theirs.
- **The weekday breakdown** (`computeWeekdayStats`) is the same rates split across the
  seven days, over a rolling 90-day window. A window rather than the whole history: the
  question is how the user lives now, and a Friday abandoned two years ago must not drag
  its column down until the end of time. Indexing starts at Monday, like the
  `schedule_mask` bits.
- **A miss is the gap between two closed days** (`computeRecovery`). It is computed over
  the same days as the streak; a miss's length is the number of skipped **scheduled**
  days. Days before the first closed day do not count as a miss (there was nothing to
  drop), and neither does the unclosed tail up to today: that is not a recovery time yet
  but the current gap, and averaging it in would understate the result more the longer
  the user stays away.
- **Schedule and target are not versioned:** statistics always use the current settings.
  A retroactive edit changes past streaks and the heatmap; this is accepted deliberately
  to keep the schema simple. For an honest history, create a new habit; the edit form
  carries a note saying so.

## Interaction

- Past days are edited with the date switcher on the Today screen.
- The date strip pages by week: backward without limit (that is the access to history),
  forward up to the week that contains today. Paging keeps the weekday; a step forward
  past today is clamped to today.
- Future days are shown dimmed but cannot be marked.
- Tapping the check button cycles the counter `0 → 1 → … → N → 0`.
- A short left swipe on a card reveals the Edit / Archive actions
  (`components/ui/swipe-row.tsx`). Only one card in the whole app can be open: the next
  one closes the previous. The same actions are duplicated as `accessibilityActions`,
  since a swipe is unavailable to a screen reader.
- **Habit templates on the empty screen.** While there are no active habits, six ready
  ones sit under the empty state (`constants/habit-templates.ts`): a tap creates the habit
  immediately, without the form. Emoji, color and target are already in the template, and
  everything can be edited later via the card's swipe. The name is written in the UI
  language at the moment of the tap and from then on is ordinary user data: unlike the
  starter expense categories, it has no reverse translation table. A template whose name
  is already taken, including by an archived habit, is not shown. All six are scheduled
  on all seven days: a template not scheduled for today would, after the tap, swap one
  empty state for another and look like a button that did nothing.

## Expenses

- A period is not a calendar month: it starts on a configurable day `1..28`
  (`expense_period_start_day`). Days 29–31 are excluded so a period does not vanish in
  February.
- A budget is set for a specific period. A period without its own row inherits **the
  latest budget set before its start** (`resolveBudget`); otherwise every new month would
  start from zero.
- **Income** is a row in `expense_incomes` with an amount and a date, added to the budget
  of the period the date falls into. The whole rule lives in `availableBudget`: the
  balance card and the period bar take one number from it, so they cannot diverge.
  - Income does not carry over to the next period, just as unspent budget does not: the
    period starts afresh, and `resolveBudget` passes on the set amount, not the money left.
  - Without a set budget, income **becomes** the budget (`availableBudget(null, 10000)`
    → `10000`); otherwise recorded income would mean nothing until a budget is set. A
    period with neither is still `null`, "no budget set".
  - A date, not `period_start`: income is an event of a day, and when the period start
    day changes, it lands in whichever period covers that date on its own. A budget is
    the opposite, a setting of the period, so its key is `period_start`.
  - Its own table, not a flag in `expenses`: `sumAmounts` over `expenses` means "spent",
    and a shared discriminator column would force **every** existing query to filter,
    and a forgotten filter does not crash: it silently adds income into the spent total,
    the category breakdown and the daily average.
  - Income does not affect statistics: they show what was spent, not what is left.
- Amounts are whole currency units in INTEGER: no floating point in money.
- **The currency symbol is a setting, not a locale.** `app_settings.currency_symbol` (a
  free string of up to three characters, default `₽`) and `currency_position` (`prefix`
  / `suffix`, default `suffix`). An empty string is a full value: it is the bare number
  the app used to show; a missing row is still the default. No ICU, no exchange rates, no
  network: `formatAmount` prints the symbol next to the number, and the minus stays in
  front of the whole amount (`-$5`). Inside components, the `use-money` hook does the
  formatting, so a symbol change redraws every screen without a restart. The symbol does
  not affect stored amounts.
- **The daily average** (`spendingPerDay`) is the current period's total divided by its
  **elapsed days**, not by days with expenses: the question is what a day of life costs,
  and empty days are part of the answer. It is computed only for the **current** period
  and only if something was spent in it; it lives on the statistics screen under the
  period total. There is no end-of-period forecast: early in a period it multiplied one
  expense by nearly the whole length and lied.
- A category with expenses is deleted together with moving its expenses to "Прочее"
  (Other) (`deleteExpenseCategoryReassigning`): the money stays in its period's total,
  and only the breakdown by that category disappears. "Прочее" is restored from the
  archive in the process, or recreated if it was deleted earlier. "Прочее" itself cannot
  be deleted while it has expenses, since there is nowhere to move them; archiving
  remains for it.

## Backups

- Backup is manual only: export opens the share sheet, import replaces all data.
- The date of the last successful export is in `app_settings.last_export_at`, a
  `YYYY-MM-DD` date key for the local day. It is written **after** the share sheet
  closes: an export that never reached a file must not reset the reminder. The system
  does not let us tell a save from a cancel, so a closed sheet counts as an export.
- A backup file carries the date of *its own* export: the `last_export_at` row is
  substituted at serialization time; otherwise a copy restored on a new device would
  claim the last backup happened before the copy itself.
- The hint in settings (`backupStatus`, `lib/backup-status.ts`) has four states: `idle`,
  an empty app without an export, says nothing; `never`, there is data and no copy;
  `fresh`, the copy is no older than `BACKUP_STALE_AFTER_DAYS` (30); `stale`, older, and
  then the line is painted `warning`. An unreadable value in the settings row is treated
  as "no copy was made": the safe side of the error.

## Notifications

- Local only. Any mutation (editing a habit, archiving, deleting, importing, changing the
  language) triggers a **full recomputation** under a mutex:
  `cancelAllScheduledNotificationsAsync()` and scheduling again. Incremental edits are a
  source of drift, and all notifications in the system are ours, so "cancel all" is safe.
- The text reaches the system at scheduling time, not at display time, which is why a
  language change also needs a recomputation.
- The banner has a **Mark** button (category `habitreminder`, action `mark`,
  `opensAppToForeground: false`): pressing it writes **+1 toward the target** for the
  day **when the notification was delivered**, and never resets the counter to 0, since
  the banner cannot show that the day was just cleared. A reached target is not changed
  by the press; a deleted or archived habit is ignored. The button title, like the text,
  is read by the system from what was registered, so a language change re-registers the
  category via the same recomputation.
- **Habits with the same time are merged into one notification** (`buildReminderPlans`,
  `lib/reminder-plan.ts`). The plan is built per time, and within a time, per weekday:
  if the set of habits is the same on all seven days, it is one `DAILY` trigger,
  otherwise one `CALENDAR` trigger per non-empty day. For a single habit the rule
  degenerates into the old "all 7 days, one trigger". The title of a merged notification
  is "3 habits today", the body is emojis and names joined with `·`, in `sort_order`.
- A merged notification has **no** category and therefore no Mark button: the button
  marks one habit, and a banner with three does not say which. Its `data` has no
  `habitId`, which is enough for `applyReminderMark` to skip the response.
- The iOS limit is 64 scheduled notifications, with each repeating one counted. The
  merging above is what makes the ceiling reachable: the cost of the schedule depends on
  the number of **distinct times** (at most 7 requests per time), not on the number of
  habits. At `NOTIFICATION_WARNING_THRESHOLD` (55), settings show a warning instead of
  silently losing reminders.

The pitfalls of these rules are in [pitfalls.md](pitfalls.md), the schema is in
[database.md](database.md).
