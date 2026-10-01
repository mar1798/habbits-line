#!/usr/bin/env node
/**
 * Builds the demo database the App Store screenshots are taken on.
 *
 * Why a generated file and not a fixture checked into the repository: a screenshot has to
 * show today, so the dates have to move with the calendar — a binary `.db` would freeze
 * the heatmap on the day it was committed. Everything else is deterministic: fixed ids,
 * fixed names, and a seeded PRNG for amounts and gaps. Two runs on the same day produce
 * byte-identical tables.
 *
 * The schema is a transcription of db/migrations.ts at user_version 5, and the file is
 * stamped with that version, so the app opens it and `migrate()` returns immediately.
 * A new migration means updating this script too — a mismatch shows up as an empty
 * screen, not as an error.
 *
 * The App Store wants a set per localization, so the database is built per language:
 * the second argument picks it. Habit names are user data and are written in that
 * language; category names are not — the eight starters are matched back by their
 * Russian name in lib/category-name.ts and translated at render time, so they stay
 * Russian in the file whatever the UI language is.
 *
 * Usage: node scripts/seed-demo-db.mjs [output.db] [ru|en]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const OUT = resolve(process.argv[2] ?? 'build/demo/habits.db');

const LANGUAGE = process.argv[3] ?? 'ru';
if (LANGUAGE !== 'ru' && LANGUAGE !== 'en') {
  throw new Error(`unknown language '${LANGUAGE}' — expected 'ru' or 'en'`);
}

/**
 * The money the screenshots are taken in. The symbol is a setting rather than a locale,
 * so it is written explicitly instead of left to the default.
 *
 * `scale` divides the generated amounts: the same spending that reads as an ordinary
 * month in rubles would read as a fortune in dollars, and a store screenshot has to look
 * like a plausible month to the person looking at it.
 */
const MONEY = {
  ru: { symbol: '\u20bd', position: 'suffix', scale: 1, budget: 15000 },
  en: { symbol: '$', position: 'prefix', scale: 0.1, budget: 1500 },
}[LANGUAGE];

/** Deterministic PRNG — the same seed gives the same sequence on every run. */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `YYYY-MM-DD` in the local zone, the way lib/date.ts builds it — never toISOString(). */
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(n) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - n);
  return date;
}

/** Monday is bit 0 here, as in lib/schedule.ts — not date-fns' Sunday-first getDay(). */
function scheduledOn(date, mask) {
  const bit = (date.getDay() + 6) % 7;
  return (mask & (1 << bit)) !== 0;
}

const q = (value) => (value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);

// A fixed timestamp: created_at/updated_at are never shown, and a real clock would make
// two runs differ for no visible gain.
const TS = '2026-01-01T00:00:00.000Z';
const EVERY_DAY = 127;
const WEEKDAYS = 0b0011111; // Mon-Fri
// A full year of history: the heatmap draws twelve months and the statistics screen lists
// twelve periods, so anything shorter shows up as a blank half of both.
const HISTORY_DAYS = 365;

/**
 * The day expense periods start on, picked so that today falls about two weeks into one
 * (1..28, the range lib/period.ts allows). A fixed 1 would make every set shot early in a
 * month show a period that has barely begun: a near-empty spending bar and a budget
 * nobody has touched.
 */
const PERIOD_START_DAY = ((new Date().getDate() + 13) % 28) + 1;

/**
 * `rate` is how often the habit gets done on a day it is scheduled; `recentStreak` is how
 * many of the most recent scheduled days are forced to done, so the streak cards show a
 * number instead of a zero.
 */
const HABITS = [
  { id: 'demo-habit-1', name: { ru: 'Зарядка', en: 'Workout' }, emoji: '💪', colorKey: 'violet', mask: EVERY_DAY, reminder: '07:30', rate: 0.9, recentStreak: 12 },
  { id: 'demo-habit-2', name: { ru: 'Чтение', en: 'Reading' }, emoji: '📚', colorKey: 'indigo', mask: EVERY_DAY, reminder: '21:00', rate: 0.82, recentStreak: 7 },
  { id: 'demo-habit-3', name: { ru: 'Вода', en: 'Water' }, emoji: '💧', colorKey: 'sky', mask: EVERY_DAY, reminder: null, rate: 0.95, recentStreak: 24 },
  { id: 'demo-habit-4', name: { ru: 'Английский', en: 'Spanish' }, emoji: '🗣️', colorKey: 'teal', mask: WEEKDAYS, reminder: '19:00', rate: 0.76, recentStreak: 4 },
  { id: 'demo-habit-5', name: { ru: 'Прогулка', en: 'Walk' }, emoji: '🚶', colorKey: 'green', mask: EVERY_DAY, reminder: null, rate: 0.68, recentStreak: 2 },
];

// The same eight the v1 -> v2 migration seeds, with the same names: category-name.ts
// matches them back by name to show a translated label, and a different name would
// quietly turn one into "the user's own" and stop translating it.
const CATEGORIES = [
  { id: 'demo-cat-1', name: 'Здоровье', emoji: '💊', colorKey: 'mint', share: 0.08 },
  { id: 'demo-cat-2', name: 'Досуг', emoji: '🎨', colorKey: 'sky', share: 0.07 },
  { id: 'demo-cat-3', name: 'Дом', emoji: '🏠', colorKey: 'indigo', share: 0.18 },
  { id: 'demo-cat-4', name: 'Еда', emoji: '🍎', colorKey: 'green', share: 0.34 },
  { id: 'demo-cat-5', name: 'Развлечение', emoji: '🎬', colorKey: 'plum', share: 0.09 },
  { id: 'demo-cat-6', name: 'Покупки', emoji: '🛍️', colorKey: 'rose', share: 0.12 },
  { id: 'demo-cat-7', name: 'Транспорт', emoji: '🚌', colorKey: 'amber', share: 0.1 },
  { id: 'demo-cat-8', name: 'Прочее', emoji: '📦', colorKey: 'slate', share: 0.02 },
];

const SCHEMA = `
CREATE TABLE habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color_key TEXT NOT NULL,
  target_per_day INTEGER NOT NULL DEFAULT 1 CHECK (target_per_day >= 1),
  schedule_mask INTEGER NOT NULL DEFAULT 127 CHECK (schedule_mask > 0 AND schedule_mask <= 127),
  reminder_time TEXT,
  sort_order INTEGER NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_habits_active ON habits(archived_at, sort_order);

CREATE TABLE entries (
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (habit_id, date)
);
CREATE INDEX idx_entries_date ON entries(date);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE expense_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  color_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_expense_categories_active ON expense_categories(archived_at, sort_order);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  note TEXT,
  time TEXT
);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category_id);

CREATE TABLE expense_budgets (
  period_start TEXT PRIMARY KEY NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE expense_incomes (
  id TEXT PRIMARY KEY NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_expense_incomes_date ON expense_incomes(date);
`;

/**
 * Today's expenses get fixed times, all before 09:41 — the clock the status bar is pinned
 * to in every frame. A row stamped later than the time above it would read as a mistake.
 */
const TODAY_TIMES = ['07:38', '08:05', '08:24', '08:52', '09:17'];

/**
 * Times for an earlier day, 08:00 to 21:59, ascending. A PRNG of their own, so adding
 * them left the amounts and categories drawn from the main one exactly as they were.
 */
const clock = mulberry32(11);
function dayTimes(count) {
  return Array.from({ length: count }, () => 8 * 60 + Math.floor(clock() * 14 * 60))
    .sort((a, b) => a - b)
    .map((minutes) => {
      const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
      const mm = String(minutes % 60).padStart(2, '0');
      return `${hh}:${mm}`;
    });
}

/**
 * `created_at` for an expense entered at `time` on `day`. The list orders a day by
 * `created_at DESC`, and with one shared timestamp the rows would come out in whatever
 * order SQLite keeps them, not latest first. A timestamp, not a date key, so
 * toISOString() is the right tool here.
 */
function enteredAt(day, time) {
  const at = new Date(day);
  const [hh, mm] = time.split(':').map(Number);
  at.setHours(hh, mm, 0, 0);
  return at.toISOString();
}

function build() {
  const lines = ['PRAGMA foreign_keys = OFF;', 'BEGIN;', SCHEMA];

  HABITS.forEach((habit, index) => {
    lines.push(
      `INSERT INTO habits VALUES (${q(habit.id)}, ${q(habit.name[LANGUAGE])}, ${q(habit.emoji)}, ` +
        `${q(habit.colorKey)}, 1, ${habit.mask}, ${q(habit.reminder)}, ${index}, NULL, ` +
        `${q(TS)}, ${q(TS)});`
    );

    const random = mulberry32(1000 + index);
    let scheduledSeen = 0;
    for (let back = 0; back <= HISTORY_DAYS; back += 1) {
      const date = daysAgo(back);
      if (!scheduledOn(date, habit.mask)) continue;
      scheduledSeen += 1;
      const done = scheduledSeen <= habit.recentStreak || random() < habit.rate;
      if (!done) continue;
      lines.push(
        `INSERT INTO entries VALUES (${q(habit.id)}, ${q(dateKey(date))}, 1, ${q(TS)});`
      );
    }
  });

  CATEGORIES.forEach((category, index) => {
    lines.push(
      `INSERT INTO expense_categories VALUES (${q(category.id)}, ${q(category.name)}, ` +
        `${q(category.emoji)}, ${q(category.colorKey)}, ${index}, NULL, ${q(TS)}, ${q(TS)});`
    );
  });

  // A year of spending, the span the statistics screen lists periods over.
  const random = mulberry32(7);
  let expenseIndex = 0;
  for (let back = HISTORY_DAYS; back >= 0; back -= 1) {
    const day = daysAgo(back);
    const date = dateKey(day);
    // Today gets a fuller day than the rest: the expenses tab lists the selected day,
    // and a single row under the budget card reads as an empty app in a screenshot.
    const perDay = back === 0 ? 5 : 1 + Math.floor(random() * 3);
    const times = back === 0 ? TODAY_TIMES : dayTimes(perDay);
    for (let n = 0; n < perDay; n += 1) {
      // Pick a category by its share, so "Еда" dominates the breakdown the way it would
      // in a real month rather than every slice coming out the same size.
      let roll = random();
      const category = CATEGORIES.find((c) => (roll -= c.share) <= 0) ?? CATEGORIES[3];
      // Whole units, the way lib/money.ts shows them — the app has no fractional part.
      const amount = Math.max(1, Math.round((50 + Math.floor(random() * 250)) * MONEY.scale));
      expenseIndex += 1;
      lines.push(
        `INSERT INTO expenses VALUES ('demo-exp-${expenseIndex}', ${q(category.id)}, ` +
          `${amount}, ${q(date)}, ${q(enteredAt(day, times[n]))}, ${q(TS)}, NULL, ` +
          `${q(times[n])});`
      );
    }
  }

  // One budget, set on the day a period opens thirteen months back: the rule in
  // lib/expenses.ts carries the last budget forward, so every later period inherits it —
  // including the twelve the statistics screen lists. Thirteen rather than twelve, because
  // when today is earlier in the month than PERIOD_START_DAY the current period opened
  // last month, and twelve months back would miss the oldest listed one.
  const firstOfPeriod = new Date();
  firstOfPeriod.setHours(12, 0, 0, 0);
  firstOfPeriod.setDate(PERIOD_START_DAY);
  firstOfPeriod.setMonth(firstOfPeriod.getMonth() - 13);
  // A budget about a third above what a month actually costs: the bar has to read as
  // "on track", not as an empty or an overspent one.
  lines.push(
    `INSERT INTO expense_budgets VALUES (${q(dateKey(firstOfPeriod))}, ${MONEY.budget}, ${q(TS)});`
  );

  lines.push(`INSERT INTO app_settings VALUES ('theme_mode', 'system');`);
  lines.push(`INSERT INTO app_settings VALUES ('language', ${q(LANGUAGE)});`);
  lines.push(
    `INSERT INTO app_settings VALUES ('expense_period_start_day', '${PERIOD_START_DAY}');`
  );
  // The currency the amounts are printed with. A missing row would fall back to the
  // ruble sign, but the screenshots must not move the day that default changes.
  lines.push(`INSERT INTO app_settings VALUES ('currency_symbol', ${q(MONEY.symbol)});`);
  lines.push(`INSERT INTO app_settings VALUES ('currency_position', ${q(MONEY.position)});`);
  // A recent export, so settings shows the calm "backed up N days ago" line instead of
  // the warning a database that has never been exported gets.
  lines.push(
    `INSERT INTO app_settings VALUES ('last_export_at', ${q(dateKey(daysAgo(3)))});`
  );

  // No income: it only raises the budget the card counts down from, and the budget above
  // is already sized for the bar to read as "on track".

  lines.push('PRAGMA user_version = 5;', 'COMMIT;');
  return lines.join('\n');
}

mkdirSync(dirname(OUT), { recursive: true });
for (const suffix of ['', '-wal', '-shm']) rmSync(`${OUT}${suffix}`, { force: true });
execFileSync('sqlite3', [OUT], { input: build() });
console.log(`Seeded ${OUT} (${LANGUAGE})`);
