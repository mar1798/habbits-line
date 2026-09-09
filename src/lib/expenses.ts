/**
 * Pure expense arithmetic. Like lib/streaks.ts it takes structural shapes rather than the
 * row types from db/types.ts, so the calculations stay independent of the database and can
 * be tested without one.
 */

import { periodDaysElapsed, periodStartFor } from './period';

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
 * Moving the start day leaves rows behind whose `period_start` no longer opens any period.
 * They stay eligible, because a file imported without its `expense_period_start_day` — a
 * v2 backup written before settings joined the format — carries budgets keyed to a day
 * this device does not use, and dropping them outright would lose every budget in it.
 * But they lose to a row that does open a period, and that ordering is the whole point:
 * moving the start day *back* writes the replacement at an earlier date than the row it
 * replaces, so by date alone the abandoned row is the later one and would be inherited by
 * every period after it — quietly handing the next period an amount the user overwrote.
 */
/**
 * The amount this period wrote for itself, ignoring what it would inherit. Separate from
 * `resolveBudget` because the two answer different questions: the card shows the budget in
 * force, while "remove the budget" can only act on a row this period actually owns.
 */
export function resolveOwnBudget(budgets: BudgetItem[], periodStart: string): number | null {
  for (const budget of budgets) {
    if (budget.period_start === periodStart) return budget.amount;
  }
  return null;
}

export function resolveBudget(
  budgets: BudgetItem[],
  periodStart: string,
  startDay: number
): number | null {
  let live: BudgetItem | null = null;
  let abandoned: BudgetItem | null = null;

  for (const budget of budgets) {
    if (budget.period_start === periodStart) return budget.amount;
    if (budget.period_start > periodStart) continue;

    const opensAPeriod = periodStartFor(budget.period_start, startDay) === budget.period_start;
    const best = opensAPeriod ? live : abandoned;
    if (best !== null && best.period_start >= budget.period_start) continue;

    if (opensAPeriod) {
      live = budget;
    } else {
      abandoned = budget;
    }
  }

  return (live ?? abandoned)?.amount ?? null;
}

/**
 * Takes anything carrying an amount rather than an `ExpenseItem`, so the same function
 * adds up a period's incomes. It only ever reads `amount`; narrowing the parameter would
 * mean a second copy of a loop, and two places to be wrong about what a total is.
 */
export function sumAmounts(items: { amount: number }[]): number {
  let total = 0;
  for (const item of items) {
    total += item.amount;
  }
  return total;
}

/**
 * What the period actually has to spend: its budget plus everything received in it. The
 * single definition of what income means to the numbers on screen — the balance card and
 * the period bar both take this in place of the raw budget, so neither can disagree with
 * the other about the total.
 *
 * Income is added to the period it falls in and stops there. Nothing carries over into
 * the next one, exactly as an unspent budget does not: a period is a fresh start, and
 * `resolveBudget` hands the next one the budget that was set, not the money that was left.
 *
 * With no budget set, income becomes the budget rather than being added to nothing —
 * logging what came in is then enough to get a remainder, without setting a budget at
 * all. A period with neither is still `null`, and the card says "no budget set" there.
 */
export function availableBudget(budget: number | null, income: number): number | null {
  if (budget === null) return income > 0 ? income : null;
  return budget + income;
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

/**
 * What a day of this period has cost on average, rounded to whole units — derived from what
 * is already in the database, with no field, no history and no background job.
 *
 * The average is deliberately over *elapsed days*, not over days with expenses: the
 * question is what a day of living costs, and days that cost nothing are part of that.
 *
 * Null for a period that is not the current one — a closed period's days are all elapsed
 * and a future one has none — and null for an empty period, where "0 a day" says nothing.
 */
export function spendingPerDay(
  spent: number,
  periodStart: string,
  periodEnd: string,
  todayDate: string
): number | null {
  if (spent <= 0) return null;
  if (todayDate < periodStart || todayDate > periodEnd) return null;

  const elapsed = periodDaysElapsed(periodStart, periodEnd, todayDate);
  if (elapsed <= 0) return null;

  return Math.round(spent / elapsed);
}
