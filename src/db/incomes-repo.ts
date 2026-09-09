import type { SQLiteDatabase } from 'expo-sqlite';

import { generateId } from '@/lib/id';

import type { ExpenseIncomeRow } from './types';

export interface IncomeInput {
  amount: number;
  date: string;
}

/**
 * Every income between two date keys, inclusive — read alongside the period's expenses
 * by the same store. Ordered the way the expenses are: newest day first, and the last
 * thing entered first within a day.
 */
export async function listIncomesBetween(
  db: SQLiteDatabase,
  from: string,
  to: string
): Promise<ExpenseIncomeRow[]> {
  return db.getAllAsync<ExpenseIncomeRow>(
    'SELECT * FROM expense_incomes WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC',
    from,
    to
  );
}

/**
 * Income carries a date rather than a period start, so it belongs to a period by falling
 * inside it. A budget row is keyed by `period_start` because it *is* the period's own
 * setting; an income is an event on a day, and keying it by period would move it to
 * another one — or leave it keyed to a period that no longer opens — the moment the
 * start day is changed.
 */
export async function createIncome(
  db: SQLiteDatabase,
  input: IncomeInput
): Promise<ExpenseIncomeRow> {
  const id = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO expense_incomes (id, amount, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id,
    input.amount,
    input.date,
    now,
    now
  );

  const created = await db.getFirstAsync<ExpenseIncomeRow>(
    'SELECT * FROM expense_incomes WHERE id = ?',
    id
  );
  if (!created) {
    throw new Error(`Failed to read back created income ${id}`);
  }
  return created;
}

export async function deleteIncome(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM expense_incomes WHERE id = ?', id);
}
