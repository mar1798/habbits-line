import {
  availableBudget,
  barTotal,
  budgetRemainder,
  categoryTotals,
  expensesOnDate,
  resolveBudget,
  spendingPerDay,
  sumAmounts,
  type ExpenseItem,
} from '../expenses';

function expense(category: string, amount: number, date = '2026-08-10'): ExpenseItem {
  return { category_id: category, amount, date };
}

describe('resolveBudget', () => {
  // Every row here opens a period on the 1st, so the start day below is 1 throughout.
  const budgets = [
    { period_start: '2026-06-01', amount: 50000 },
    { period_start: '2026-08-01', amount: 70000 },
  ];

  it('prefers the period\u2019s own row', () => {
    expect(resolveBudget(budgets, '2026-08-01', 1)).toBe(70000);
  });

  it('inherits the last row set before the period when it has none of its own', () => {
    expect(resolveBudget(budgets, '2026-09-01', 1)).toBe(70000);
    expect(resolveBudget(budgets, '2026-07-01', 1)).toBe(50000);
  });

  // Inheritance only ever looks backwards: before the first budget was set there really
  // was no budget, and showing a later one there would be a lie about the past.
  it('has no budget for a period earlier than every row', () => {
    expect(resolveBudget(budgets, '2026-05-01', 1)).toBeNull();
    expect(resolveBudget([], '2026-08-01', 1)).toBeNull();
  });

  // The rows a changed start day left behind no longer open any period, but they are still
  // found, because the search is for the last row *before* the period, not an exact match.
  // A backup written without `expense_period_start_day` lands every one of its budgets in
  // this state, and dropping them would leave that file with no budgets at all.
  it('still picks up rows whose start no longer opens a period', () => {
    const stale = [{ period_start: '2026-07-06', amount: 40000 }];
    expect(resolveBudget(stale, '2026-08-01', 1)).toBe(40000);
  });

  // Moving the start day *back* writes the replacement at an earlier date than the row it
  // replaces, so by date alone the abandoned row is the later one. Inherited by date, it
  // would hand every following period the amount the user had just overwritten.
  it('lets a row that opens a period beat a later abandoned one', () => {
    const moved = [
      { period_start: '2026-08-10', amount: 50000 }, // written while the day was the 10th
      { period_start: '2026-08-06', amount: 80000 }, // the replacement, day now the 6th
    ];
    expect(resolveBudget(moved, '2026-09-06', 6)).toBe(80000);
    expect(resolveBudget(moved, '2026-10-06', 6)).toBe(80000);
    // The period that owns the replacement still reads its own row.
    expect(resolveBudget(moved, '2026-08-06', 6)).toBe(80000);
  });

  // The mirror case, which was never broken: moved forward, the replacement is already the
  // later row and wins on date alone. It must keep winning now that liveness is what ranks.
  it('is unchanged when the start day moved forward', () => {
    const moved = [
      { period_start: '2026-08-06', amount: 50000 },
      { period_start: '2026-08-10', amount: 80000 },
    ];
    expect(resolveBudget(moved, '2026-09-10', 10)).toBe(80000);
  });

  // Falling back to an abandoned row is a last resort, not a preference: once any row
  // opening a period precedes the target, the abandoned ones stop being consulted at all.
  it('prefers the newest opening row over a newer abandoned one', () => {
    const mixed = [
      { period_start: '2026-05-06', amount: 10000 }, // abandoned, oldest
      { period_start: '2026-06-01', amount: 20000 }, // opens a period
      { period_start: '2026-07-06', amount: 30000 }, // abandoned, newest
    ];
    expect(resolveBudget(mixed, '2026-08-01', 1)).toBe(20000);
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

  // Incomes carry no category, and the same function has to add them up.
  it('sums anything carrying an amount', () => {
    expect(sumAmounts([{ amount: 5000 }, { amount: 1000 }])).toBe(6000);
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

describe('availableBudget', () => {
  it('adds the period’s income to its budget', () => {
    expect(availableBudget(50000, 10000)).toBe(60000);
    expect(availableBudget(50000, 0)).toBe(50000);
  });

  // Without this, logging what came in would be worth nothing until a budget was set.
  it('lets income stand in for a budget that was never set', () => {
    expect(availableBudget(null, 10000)).toBe(10000);
  });

  it('has nothing to show for a period with neither', () => {
    expect(availableBudget(null, 0)).toBeNull();
  });

  // The whole point of routing both through this: the card's remainder and the bar's
  // denominator are computed from the same number.
  it('feeds the remainder and the bar', () => {
    const available = availableBudget(50000, 10000);
    expect(budgetRemainder(available, 20000)).toBe(40000);
    expect(barTotal(available, 20000)).toBe(60000);
    expect(budgetRemainder(availableBudget(null, 10000), 12000)).toBe(-2000);
  });
});

describe('spendingPerDay', () => {
  const start = '2026-08-06';
  const end = '2026-09-05'; // 31 days.

  it('averages over the days that have elapsed, empty ones included', () => {
    // Five days in, 1000 spent — 200 a day, whether it went in one day or five.
    expect(spendingPerDay(1000, start, end, '2026-08-10')).toBe(200);
  });

  it('counts the first day of a period as a whole day', () => {
    expect(spendingPerDay(300, start, end, start)).toBe(300);
  });

  it('divides by the whole period on its last day', () => {
    expect(spendingPerDay(3100, start, end, end)).toBe(100);
  });

  it('says nothing about a period that is not the current one', () => {
    expect(spendingPerDay(1000, start, end, '2026-09-06')).toBeNull();
    expect(spendingPerDay(1000, start, end, '2026-08-05')).toBeNull();
  });

  it('says nothing about a period nothing was spent in', () => {
    expect(spendingPerDay(0, start, end, '2026-08-10')).toBeNull();
  });
});
