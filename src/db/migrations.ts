import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

/**
 * PRAGMA foreign_keys is a connection-level setting, not a persisted file setting —
 * it must run on every open, before checking user_version. Hiding it inside the
 * v0 -> v1 block would make ON DELETE CASCADE silently stop working from the second
 * launch onward, since that block only runs once.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

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
    currentVersion = 1;
  }

  // v1 -> v2: add the next migration as a new block below this comment.
  // The block above is shipped — never edit it, only append.

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
