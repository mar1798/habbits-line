import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/lib/id';

import type { HabitRow } from './types';

export interface HabitInput {
  name: string;
  emoji: string;
  colorKey: string;
  targetPerDay: number;
  scheduleMask: number;
  reminderTime: string | null;
}

export async function listHabits(
  db: SQLiteDatabase,
  options: { includeArchived?: boolean } = {}
): Promise<HabitRow[]> {
  if (options.includeArchived) {
    return db.getAllAsync<HabitRow>('SELECT * FROM habits ORDER BY sort_order ASC');
  }
  return db.getAllAsync<HabitRow>(
    'SELECT * FROM habits WHERE archived_at IS NULL ORDER BY sort_order ASC'
  );
}

export async function createHabit(db: SQLiteDatabase, input: HabitInput): Promise<HabitRow> {
  const id = generateId();
  const now = new Date().toISOString();
  const maxOrderRow = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM habits'
  );
  const sortOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

  await db.runAsync(
    `INSERT INTO habits
      (id, name, emoji, color_key, target_per_day, schedule_mask, reminder_time, sort_order, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    id,
    input.name,
    input.emoji,
    input.colorKey,
    input.targetPerDay,
    input.scheduleMask,
    input.reminderTime,
    sortOrder,
    now,
    now
  );

  const created = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', id);
  if (!created) {
    throw new Error(`Failed to read back created habit ${id}`);
  }
  return created;
}

export async function updateHabit(
  db: SQLiteDatabase,
  id: string,
  input: HabitInput
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE habits
     SET name = ?, emoji = ?, color_key = ?, target_per_day = ?, schedule_mask = ?, reminder_time = ?, updated_at = ?
     WHERE id = ?`,
    input.name,
    input.emoji,
    input.colorKey,
    input.targetPerDay,
    input.scheduleMask,
    input.reminderTime,
    now,
    id
  );
}

export async function archiveHabit(db: SQLiteDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync('UPDATE habits SET archived_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}

export async function unarchiveHabit(db: SQLiteDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  const maxOrderRow = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM habits'
  );
  const sortOrder = (maxOrderRow?.maxOrder ?? -1) + 1;
  await db.runAsync(
    'UPDATE habits SET archived_at = NULL, sort_order = ?, updated_at = ? WHERE id = ?',
    sortOrder,
    now,
    id
  );
}

export async function deleteHabit(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM habits WHERE id = ?', id);
}

/**
 * Rewrites `sort_order` for exactly the given ids, in one transaction, to their
 * position in `orderedIds`. Ids not included (e.g. archived habits sitting between
 * active ones) keep their old value — callers only ever reorder within one group.
 *
 * Exclusive, like the import: `withTransactionAsync` does not keep other awaited queries
 * on the same connection from interleaving with these updates, and a create or an archive
 * landing between two of them renumbers rows this loop is about to renumber again.
 */
export async function reorderHabits(db: SQLiteDatabase, orderedIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let index = 0; index < orderedIds.length; index++) {
      await txn.runAsync(
        'UPDATE habits SET sort_order = ?, updated_at = ? WHERE id = ?',
        index,
        now,
        orderedIds[index]
      );
    }
  });
}

/**
 * Every habit's name, archived ones included: a name is taken as long as the habit
 * exists at all, since an archived habit can be brought back at any time and would then
 * sit in the list next to its twin.
 */
export async function listHabitNames(db: SQLiteDatabase): Promise<{ id: string; name: string }[]> {
  return db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM habits');
}
