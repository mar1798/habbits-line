import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/lib/id';

import type { ExpenseRow } from './types';

export interface ExpenseInput {
  categoryId: string;
  amount: number;
  date: string;
  /** The optional one-line description. Null when the field was left empty. */
  note: string | null;
}

/**
 * Every expense between two date keys, inclusive — the query the expenses screen runs
 * once per period. Ordered newest first within a day so the day list shows the last
 * thing entered at the top; `created_at` breaks ties between expenses on the same date.
 */
export async function listExpensesBetween(
  db: SQLiteDatabase,
  from: string,
  to: string
): Promise<ExpenseRow[]> {
  return db.getAllAsync<ExpenseRow>(
    'SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC',
    from,
    to
  );
}

export async function getExpense(db: SQLiteDatabase, id: string): Promise<ExpenseRow | null> {
  const row = await db.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', id);
  return row ?? null;
}

/**
 * An expense carries its own id rather than being keyed by (category, date) the way an
 * entry is keyed by (habit, date). An entry is a per-day counter, one row by construction;
 * there can be any number of expenses in one category on one day, and each is edited and
 * deleted on its own — a composite key would turn the second "Food" of the day into an
 * overwrite of the first.
 */
export async function createExpense(
  db: SQLiteDatabase,
  input: ExpenseInput
): Promise<ExpenseRow> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO expenses (id, category_id, amount, date, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.categoryId,
    input.amount,
    input.date,
    input.note,
    now,
    now
  );

  const created = await db.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', id);
  if (!created) {
    throw new Error(`Failed to read back created expense ${id}`);
  }
  return created;
}

/** The date is part of the input but the form never offers it: editing keeps the row's day. */
export async function updateExpense(
  db: SQLiteDatabase,
  id: string,
  input: ExpenseInput
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE expenses SET category_id = ?, amount = ?, date = ?, note = ?, updated_at = ? WHERE id = ?',
    input.categoryId,
    input.amount,
    input.date,
    input.note,
    now,
    id
  );
}

export async function deleteExpense(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}
