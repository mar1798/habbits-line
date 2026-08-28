import type { SQLiteDatabase } from 'expo-sqlite';

import type { EntryRow } from './types';

export async function getEntry(
  db: SQLiteDatabase,
  habitId: string,
  date: string
): Promise<EntryRow | null> {
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entries WHERE habit_id = ? AND date = ?',
    habitId,
    date
  );
  return row ?? null;
}

/** Entries for one habit, optionally restricted to a date range — used by stats/heatmap. */
export async function listEntriesForHabit(
  db: SQLiteDatabase,
  habitId: string,
  range?: { from: string; to: string }
): Promise<EntryRow[]> {
  if (range) {
    return db.getAllAsync<EntryRow>(
      'SELECT * FROM entries WHERE habit_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC',
      habitId,
      range.from,
      range.to
    );
  }
  return db.getAllAsync<EntryRow>(
    'SELECT * FROM entries WHERE habit_id = ? ORDER BY date ASC',
    habitId
  );
}

/** All habits' entries for one calendar date — used by the "Today" screen. */
export async function listEntriesForDate(db: SQLiteDatabase, date: string): Promise<EntryRow[]> {
  return db.getAllAsync<EntryRow>('SELECT * FROM entries WHERE date = ?', date);
}

/** All habits' entries across a date range — used to prime a week of the "Today" screen. */
export async function listEntriesInRange(
  db: SQLiteDatabase,
  from: string,
  to: string
): Promise<EntryRow[]> {
  return db.getAllAsync<EntryRow>(
    'SELECT * FROM entries WHERE date BETWEEN ? AND ? ORDER BY date ASC',
    from,
    to
  );
}

/**
 * Upserts the row for (habitId, date); a count of 0 or less deletes it instead,
 * per the schema rule that a day with no progress has no row.
 */
export async function setEntryCount(
  db: SQLiteDatabase,
  habitId: string,
  date: string,
  count: number
): Promise<void> {
  if (count <= 0) {
    await db.runAsync('DELETE FROM entries WHERE habit_id = ? AND date = ?', habitId, date);
    return;
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO entries (habit_id, date, count, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (habit_id, date) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
    habitId,
    date,
    count,
    now
  );
}
