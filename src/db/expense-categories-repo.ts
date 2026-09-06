import type { SQLiteDatabase } from 'expo-sqlite';

import { FALLBACK_CATEGORY } from '@/lib/category-name';
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
 * because its category was tidied away — that is what `deleteExpenseCategoryReassigning`
 * and archiving are for.
 */
export async function deleteExpenseCategory(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM expense_categories WHERE id = ?', id);
}

/**
 * The category expenses are moved to when their own is deleted: the seeded "Прочее",
 * found by its stored name the same way `lib/category-name.ts` recognizes the starter
 * eight. Archived, it is brought back — it is about to hold expenses again, and a
 * destination missing from the grid is one the user cannot pick for the next expense.
 * Gone entirely (deleted earlier, or a database that never ran the seed), it is written
 * fresh with the emoji and color the migration gives it.
 */
async function ensureFallbackCategory(db: SQLiteDatabase): Promise<ExpenseCategoryRow> {
  const existing = await db.getFirstAsync<ExpenseCategoryRow>(
    'SELECT * FROM expense_categories WHERE name = ? ORDER BY archived_at IS NOT NULL LIMIT 1',
    FALLBACK_CATEGORY.name
  );
  if (existing) {
    if (existing.archived_at) {
      await unarchiveExpenseCategory(db, existing.id);
    }
    return existing;
  }
  return createExpenseCategory(db, FALLBACK_CATEGORY);
}

/**
 * Deletes a category that still holds expenses, moving them to "Прочее" first. The two
 * statements are one transaction: interrupted between them the expenses would be left
 * pointing at a row that is about to go, and ON DELETE RESTRICT would then block the
 * category from ever being deleted again.
 *
 * Returns the category the expenses landed in, so the caller can name it in what it
 * tells the user. Deleting "Прочее" itself is refused — there is nowhere to move its
 * expenses to, and the caller does not offer the action for it.
 */
export async function deleteExpenseCategoryReassigning(
  db: SQLiteDatabase,
  id: string
): Promise<ExpenseCategoryRow> {
  const fallback = await ensureFallbackCategory(db);
  if (fallback.id === id) {
    throw new Error('The fallback expense category cannot be reassigned to itself');
  }
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE expenses SET category_id = ?, updated_at = ? WHERE category_id = ?',
      fallback.id,
      now,
      id
    );
    await db.runAsync('DELETE FROM expense_categories WHERE id = ?', id);
  });
  return fallback;
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

/**
 * Every category's name, archived ones included — same reasoning as `listHabitNames`:
 * an archived category can be unarchived, and two categories reading the same in the
 * grid are indistinguishable to the person picking one.
 */
export async function listExpenseCategoryNames(
  db: SQLiteDatabase
): Promise<{ id: string; name: string }[]> {
  return db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM expense_categories');
}
