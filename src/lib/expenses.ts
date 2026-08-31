/**
 * Pure expense arithmetic. Like lib/streaks.ts it takes structural shapes rather than the
 * row types from db/types.ts, so the calculations stay independent of the database and can
 * be tested without one.
 */

/** The fields of an expense every calculation here reads. */
export interface ExpenseItem {
  category_id: string;
  amount: number;
  date: string;
}

/** The fields of a budget row `resolveBudget` reads. */
export interface BudgetItem {
  period_start: string;
  amount: number;
}

/**
 * The budget in force for a period: its own row if there is one, otherwise the last row
 * written for an earlier period, otherwise none.
 *
 * Inheriting backwards is what lets "each period has its own budget" and "a new period
 * carries the last one over" coexist without a background job writing a row at every
 * period boundary — the app is offline and can sit unopened for months, so such a job
 * would have nowhere to run. It only looks backwards: a period *before* the first budget
 * was ever set has none, and that is correct — back then it really was not set.
 *
 * Looking only backwards is also why moving the period start day is not handled here.
 * Moved forward, the period's new start is after the old row and inherits it; moved back,
 * the new start is *before* it and would inherit an older amount or none — so the budget
 * modal rewrites the amount for the new period start as part of the same save. Doing it
 * here instead would mean guessing which of the rows around a period was written for
 * "this" one, and would hand a period that genuinely predates every budget a budget it
 * never had.
 */
export function resolveBudget(budgets: BudgetItem[], periodStart: string): number | null {
  let inherited: BudgetItem | null = null;

  for (const budget of budgets) {
    if (budget.period_start === periodStart) return budget.amount;
    if (budget.period_start < periodStart) {
      if (inherited === null || budget.period_start > inherited.period_start) {
        inherited = budget;
      }
    }
  }

  return inherited?.amount ?? null;
}

export function sumAmounts(expenses: ExpenseItem[]): number {
  let total = 0;
  for (const expense of expenses) {
    total += expense.amount;
  }
  return total;
}

/**
 * The expenses of one day out of a loaded period. The store keeps the whole period and
 * the day list is derived from it, so switching days after the load costs a filter and
 * cannot flash the previous day's rows.
 */
export function expensesOnDate<T extends { date: string }>(expenses: T[], date: string): T[] {
  return expenses.filter((expense) => expense.date === date);
}

/**
 * What the period bar divides its full width by: the budget normally, the amount spent
 * once that is larger.
 *
 * Clamping at overspend keeps the bar inside its track — a bar running past the end breaks
 * the card's layout, and the overspend itself is already said by the remainder going
 * negative and red. With no budget set the bar still means something: it shows the split
 * between categories across its whole width.
 */
export function barTotal(budget: number | null, spent: number): number {
  return budget === null ? spent : Math.max(budget, spent);
}

export interface CategoryTotal {
  categoryId: string;
  amount: number;
  /** Fraction of `total`, 0..1. Zero for every category when `total` is 0. */
  share: number;
}

/**
 * Per-category sums out of a flat list, largest first, each with its share of `total`.
 *
 * The denominator is the caller's: the period bar passes `barTotal` so segments read
 * against the budget, the statistics block passes the period's own sum so the shares read
 * as "of what I spent". A total of 0 — an empty period — yields shares of 0 rather than a
 * division by zero, and an empty list yields an empty breakdown.
 */
export function categoryTotals(expenses: ExpenseItem[], total: number): CategoryTotal[] {
  const sums = new Map<string, number>();
  for (const expense of expenses) {
    sums.set(expense.category_id, (sums.get(expense.category_id) ?? 0) + expense.amount);
  }

  return Array.from(sums, ([categoryId, amount]) => ({
    categoryId,
    amount,
    share: total > 0 ? amount / total : 0,
  })).sort((a, b) => b.amount - a.amount);
}

/**
 * What is left of the budget, negative once it is overspent. Null when no budget applies
 * to the period — the screen shows "no budget set" there instead of a number.
 */
export function budgetRemainder(budget: number | null, spent: number): number | null {
  return budget === null ? null : budget - spent;
}
