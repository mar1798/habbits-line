import {
  barTotal,
  budgetRemainder,
  categoryTotals,
  expensesOnDate,
  resolveBudget,
  sumAmounts,
  type ExpenseItem,
} from '../expenses';

function expense(category: string, amount: number, date = '2026-08-10'): ExpenseItem {
  return { category_id: category, amount, date };
}

describe('resolveBudget', () => {
  const budgets = [
    { period_start: '2026-06-01', amount: 50000 },
    { period_start: '2026-08-01', amount: 70000 },
  ];

  it('prefers the period’s own row', () => {
    expect(resolveBudget(budgets, '2026-08-01')).toBe(70000);
  });

  it('inherits the last row set before the period when it has none of its own', () => {
    expect(resolveBudget(budgets, '2026-09-01')).toBe(70000);
    expect(resolveBudget(budgets, '2026-07-01')).toBe(50000);
  });

  // Inheritance only ever looks backwards: before the first budget was set there really
  // was no budget, and showing a later one there would be a lie about the past.
  it('has no budget for a period earlier than every row', () => {
    expect(resolveBudget(budgets, '2026-05-01')).toBeNull();
    expect(resolveBudget([], '2026-08-01')).toBeNull();
  });

  // The rows a changed start day left behind no longer open any period, but they are still
  // found, because the search is for the last row *before* the period, not an exact match.
  it('still picks up rows whose start no longer opens a period', () => {
    const stale = [{ period_start: '2026-07-06', amount: 40000 }];
    expect(resolveBudget(stale, '2026-08-01')).toBe(40000);
  });
});

describe('sumAmounts / expensesOnDate', () => {
  const period = [
    expense('food', 300, '2026-08-10'),
    expense('home', 1200, '2026-08-10'),
    expense('food', 500, '2026-08-11'),
  ];

  it('sums a period', () => {
    expect(sumAmounts(period)).toBe(2000);
    expect(sumAmounts([])).toBe(0);
  });

  it('derives one day out of the loaded period', () => {
    expect(expensesOnDate(period, '2026-08-10')).toHaveLength(2);
    expect(expensesOnDate(period, '2026-08-12')).toEqual([]);
  });
});

describe('categoryTotals', () => {
  const period = [expense('food', 300), expense('home', 1200), expense('food', 500)];

  it('sums per category and orders by amount, largest first', () => {
    const totals = categoryTotals(period, sumAmounts(period));
    expect(totals.map((total) => total.categoryId)).toEqual(['home', 'food']);
    expect(totals.map((total) => total.amount)).toEqual([1200, 800]);
  });

  it('shares add up to less than the whole bar while the budget holds', () => {
    const totals = categoryTotals(period, barTotal(5000, sumAmounts(period)));
    const shares = totals.reduce((sum, total) => sum + total.share, 0);
    expect(shares).toBeCloseTo(0.4);
  });

  it('shares add up to the whole bar once the budget is overspent', () => {
    const totals = categoryTotals(period, barTotal(1000, sumAmounts(period)));
    const shares = totals.reduce((sum, total) => sum + total.share, 0);
    expect(shares).toBeCloseTo(1);
  });

  it('shares add up to the whole bar when no budget is set', () => {
    const totals = categoryTotals(period, barTotal(null, sumAmounts(period)));
    const shares = totals.reduce((sum, total) => sum + total.share, 0);
    expect(shares).toBeCloseTo(1);
  });

  // An empty period is the state of a fresh install, and the bar renders on it before
  // anything has been entered — it must not divide by zero.
  it('an empty period gives an empty breakdown, not a division by zero', () => {
    expect(categoryTotals([], barTotal(null, 0))).toEqual([]);
    expect(categoryTotals([], barTotal(5000, 0))).toEqual([]);
  });

  it('gives every category a zero share when the denominator is zero', () => {
    const totals = categoryTotals([expense('food', 0)], 0);
    expect(totals).toEqual([{ categoryId: 'food', amount: 0, share: 0 }]);
  });
});

describe('barTotal / budgetRemainder', () => {
  it('divides by the budget while it holds and by the spend once it does not', () => {
    expect(barTotal(5000, 2000)).toBe(5000);
    expect(barTotal(1000, 2000)).toBe(2000);
    expect(barTotal(null, 2000)).toBe(2000);
  });

  it('goes negative on overspend', () => {
    expect(budgetRemainder(5000, 2000)).toBe(3000);
    expect(budgetRemainder(1000, 2000)).toBe(-1000);
    expect(budgetRemainder(2000, 2000)).toBe(0);
  });

  it('has no remainder to show when no budget applies', () => {
    expect(budgetRemainder(null, 2000)).toBeNull();
  });
});
