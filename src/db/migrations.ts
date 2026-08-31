import type { SQLiteDatabase } from 'expo-sqlite';

import type { ExpenseColorKey } from '@/constants/design-tokens';
import { generateId } from '@/lib/id';

const DATABASE_VERSION = 2;

/**
 * Starter expense categories, written by the v1 -> v2 block. Every emoji here has to be
 * present in constants/emoji.ts, otherwise the category form could not show the value it
 * loaded as selected.
 */
const SEED_CATEGORIES: { name: string; emoji: string; colorKey: ExpenseColorKey }[] = [
  { name: 'Здоровье', emoji: '💊', colorKey: 'mint' },
  { name: 'Досуг', emoji: '🎨', colorKey: 'sky' },
  { name: 'Дом', emoji: '🏠', colorKey: 'indigo' },
  { name: 'Еда', emoji: '🍎', colorKey: 'green' },
  { name: 'Развлечение', emoji: '🎬', colorKey: 'plum' },
  { name: 'Покупки', emoji: '🛍️', colorKey: 'rose' },
  { name: 'Транспорт', emoji: '🚌', colorKey: 'amber' },
  { name: 'Прочее', emoji: '📦', colorKey: 'slate' },
];

/**
 * PRAGMA foreign_keys is a connection-level setting, not a persisted file setting —
 * it must run on every open, before checking user_version. Hiding it inside the
 * v0 -> v1 block would make ON DELETE CASCADE silently stop working from the second
 * launch onward, since that block only runs once.
 *
 * journal_mode sits here for a different reason: it is persisted, so it would only
 * ever need to run once, but it cannot run inside a transaction — and every migration
 * block below is one. Running it on every open is a no-op once WAL is already set.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    // One transaction with the version stamp inside it, for the same reason as v1 -> v2
    // below: applied piecemeal this block bricks the app. A first launch interrupted
    // between two CREATE TABLEs would leave `habits` in place and `user_version` at 0,
    // so the next launch re-runs the block, fails on "table habits already exists", and
    // stops at the database provider's error screen — whose only way out is reinstalling.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
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
      `);

      await db.execAsync('PRAGMA user_version = 1');
    });
    currentVersion = 1;
  }

  if (currentVersion < 2) {
    // The eight starter categories are seeded here rather than on first render: doing it
    // at launch would need a "seeded" flag in app_settings and a branch on every start,
    // while a migration runs exactly once by definition. The consequence is deliberate —
    // archiving all eight does not bring them back.
    //
    // Names are written in Russian and stay that way in the database: like habit names,
    // they are user data. The UI shows a translation for exactly these eight, matched
    // back by name in lib/category-name.ts — renaming one makes it the user's own and
    // ends the translation.
    //
    // Every statement of the block, `user_version` included, goes in one transaction.
    // Applied piecemeal it would brick the app: a failure between the CREATE TABLEs and
    // the version bump leaves the tables in place and the version at 1, so the next
    // launch re-runs CREATE TABLE against tables that already exist and fails at the
    // database provider's error screen, whose only way out is deleting the file.
    // SQLite is transactional over DDL and over the header `user_version` lives in.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
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
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_expenses_date ON expenses(date);
        CREATE INDEX idx_expenses_category ON expenses(category_id);

        CREATE TABLE expense_budgets (
          period_start TEXT PRIMARY KEY NOT NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          updated_at TEXT NOT NULL
        );
      `);

      const now = new Date().toISOString();
      for (const [index, category] of SEED_CATEGORIES.entries()) {
        await db.runAsync(
          `INSERT INTO expense_categories
            (id, name, emoji, color_key, sort_order, archived_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
          generateId(),
          category.name,
          category.emoji,
          category.colorKey,
          index,
          now,
          now
        );
      }

      await db.execAsync('PRAGMA user_version = 2');
    });
    currentVersion = 2;
  }

  // v2 -> v3: add the next migration as a new block below this comment, wrapped in
  // `withTransactionAsync` and bumping `user_version` inside it, the way both blocks
  // above do.
  // The blocks above are shipped — never edit them, only append.

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
