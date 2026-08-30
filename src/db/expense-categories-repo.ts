import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/lib/id';

import type { ExpenseCategoryRow } from './types';

export interface ExpenseCategoryInput {
  name: string;
  emoji: string;
  colorKey: string;
}

export async function listExpenseCategories(
  db: SQLiteDatabase,
  options: { includeArchived?: boolean } = {}
): Promise<ExpenseCategoryRow[]> {
  if (options.includeArchived) {
    return db.getAllAsync<ExpenseCategoryRow>(
      'SELECT * FROM expense_categories ORDER BY sort_order ASC'
    );
  }
  return db.getAllAsync<ExpenseCategoryRow>(
    'SELECT * FROM expense_categories WHERE archived_at IS NULL ORDER BY sort_order ASC'
  );
}

export async function createExpenseCategory(
  db: SQLiteDatabase,
  input: ExpenseCategoryInput
): Promise<ExpenseCategoryRow> {
  const id = generateId();
  const now = new Date().toISOString();
  const maxOrderRow = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM expense_categories'
  );
  const sortOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

  await db.runAsync(
    `INSERT INTO expense_categories
      (id, name, emoji, color_key, sort_order, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    id,
    input.name,
    input.emoji,
    input.colorKey,
    sortOrder,
    now,
    now
  );

  const created = await db.getFirstAsync<ExpenseCategoryRow>(
    'SELECT * FROM expense_categories WHERE id = ?',
    id
  );
  if (!created) {
    throw new Error(`Failed to read back created expense category ${id}`);
  }
  return created;
}

export async function updateExpenseCategory(
  db: SQLiteDatabase,
  id: string,
  input: ExpenseCategoryInput
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE expense_categories
     SET name = ?, emoji = ?, color_key = ?, updated_at = ?
     WHERE id = ?`,
    input.name,
    input.emoji,
    input.colorKey,
    now,
    id
  );
}

export async function archiveExpenseCategory(db: SQLiteDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE expense_categories SET archived_at = ?, updated_at = ? WHERE id = ?',
    now,
    now,
    id
  );
}

export async function unarchiveExpenseCategory(db: SQLiteDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  const maxOrderRow = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) as maxOrder FROM expense_categories'
  );
  const sortOrder = (maxOrderRow?.maxOrder ?? -1) + 1;
  await db.runAsync(
    'UPDATE expense_categories SET archived_at = NULL, sort_order = ?, updated_at = ? WHERE id = ?',
    sortOrder,
    now,
    id
  );
}

/**
 * Deletes a category outright. Only legal while it holds no expenses: the foreign key is
 * ON DELETE RESTRICT, so SQLite rejects the statement otherwise instead of taking the
 * expenses with it. Money already spent must not disappear from a past period's total
 * because its category was tidied away — that is what archiving is for.
 */
export async function deleteExpenseCategory(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM expense_categories WHERE id = ?', id);
}

/**
 * How many expenses each category holds, as `categoryId -> count`. The settings screen
 * needs this for every row at once to decide which categories may be deleted, so it is
 * one grouped query rather than a count per row.
 */
export async function countExpensesByCategory(
  db: SQLiteDatabase
): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ category_id: string; total: number }>(
    'SELECT category_id, COUNT(*) as total FROM expenses GROUP BY category_id'
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.category_id] = row.total;
  }
  return counts;
}
