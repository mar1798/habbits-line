import type { SQLiteDatabase } from 'expo-sqlite';

import { resolveBudget } from '@/lib/expenses';

import type { ExpenseBudgetRow } from './types';

/** Every budget ever written, oldest first. One row per period the user set a budget for. */
export async function listBudgets(db: SQLiteDatabase): Promise<ExpenseBudgetRow[]> {
  return db.getAllAsync<ExpenseBudgetRow>(
    'SELECT * FROM expense_budgets ORDER BY period_start ASC'
  );
}

/**
 * The budget in force for a period — its own, or the last one set before it, or none.
 *
 * The rule itself lives in `resolveBudget` rather than in two SQL statements here, so
 * that it has exactly one definition and can be tested without a database. The table
 * holds one row per period the user actually set a budget for, so reading all of it is
 * cheaper than the round trips saved would be.
 */
export async function getBudgetFor(
  db: SQLiteDatabase,
  periodStart: string
): Promise<number | null> {
  return resolveBudget(await listBudgets(db), periodStart);
}

/**
 * Drops this period's own row, if it has one. It does not mean the period ends up without
 * a budget: `resolveBudget` then hands it the last amount set before it, exactly as a
 * period that never had a row of its own. Removing the last row in the table is what
 * leaves the app with no budget at all.
 */
export async function deleteBudget(db: SQLiteDatabase, periodStart: string): Promise<void> {
  await db.runAsync('DELETE FROM expense_budgets WHERE period_start = ?', periodStart);
}

/** Writing a budget always writes a row for exactly this period, never for the one it inherited from. */
export async function setBudget(
  db: SQLiteDatabase,
  periodStart: string,
  amount: number
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO expense_budgets (period_start, amount, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (period_start) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
    periodStart,
    amount,
    now
  );
}
