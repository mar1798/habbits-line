import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as budgetsRepo from '@/db/budgets-repo';
import * as expensesRepo from '@/db/expenses-repo';
import type { ExpenseRow } from '@/db/types';
import { haptics } from '@/lib/haptics';

interface ExpensesState {
  /** Every expense of the loaded period, ordered as the repo returns them. */
  expenses: ExpenseRow[];
  /** Bounds of the loaded period, inclusive; null until the first load. */
  period: { start: string; end: string } | null;
  /** Budget in force for the loaded period — its own or inherited. Null when none applies. */
  budget: number | null;
  loaded: boolean;
  loadPeriod: (db: SQLiteDatabase, start: string, end: string) => Promise<void>;
  ensurePeriod: (db: SQLiteDatabase, start: string, end: string) => Promise<void>;
  reload: (db: SQLiteDatabase) => Promise<void>;
  create: (db: SQLiteDatabase, input: expensesRepo.ExpenseInput) => Promise<void>;
  update: (db: SQLiteDatabase, id: string, input: expensesRepo.ExpenseInput) => Promise<void>;
  remove: (db: SQLiteDatabase, id: string) => Promise<void>;
  setBudget: (db: SQLiteDatabase, amount: number) => Promise<void>;
  clearBudget: (db: SQLiteDatabase) => Promise<void>;
}

/** Same order the repo reads in: newest day first, and within a day the latest entry first. */
function sortExpenses(expenses: ExpenseRow[]): ExpenseRow[] {
  return [...expenses].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return 0;
  });
}

/**
 * Holds one period at a time: its expenses, its bounds and its budget. The day list under
 * the strip is derived from this by a filter rather than being its own query — the bar and
 * the remainder need the whole period anyway, so switching days after the load is free and
 * cannot flash the previous day's rows. A reload happens only when the selected date moves
 * into a different period. Same reasoning as `listAllEntries` on the statistics screen,
 * applied to one period instead of the whole table.
 *
 * Mutations are optimistic, like `cycle` in the entries store: the array is patched
 * synchronously, the repository is awaited, and a failure rolls the patch back.
 */
export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expenses: [],
  period: null,
  budget: null,
  loaded: false,

  loadPeriod: async (db, start, end) => {
    const [expenses, budget] = await Promise.all([
      expensesRepo.listExpensesBetween(db, start, end),
      budgetsRepo.getBudgetFor(db, start),
    ]);
    set({ expenses, budget, period: { start, end }, loaded: true });
  },

  /** Loads only when the requested period is not the one already in the store. */
  ensurePeriod: async (db, start, end) => {
    const period = get().period;
    if (period && period.start === start && period.end === end) return;
    await get().loadPeriod(db, start, end);
  },

  /**
   * Re-reads the loaded period. Needed after a write that bypassed this store — deleting a
   * category cannot orphan expenses, but an import replaces the whole table while the
   * expenses tab stays mounted, so its effect on the period would not re-fire.
   */
  reload: async (db) => {
    const period = get().period;
    if (!period) return;
    await get().loadPeriod(db, period.start, period.end);
  },

  /**
   * The optimistic row is a placeholder: its id and timestamps are the ones the repository
   * hands back, which arrive only after the insert. So the row is swapped for the real one
   * on success and dropped on failure, rather than being kept and patched.
   *
   * An expense dated outside the loaded period is written but not shown — the form only
   * ever writes the day selected on the strip, which is inside it by construction.
   */
  create: async (db, input) => {
    const period = get().period;
    const visible = period !== null && input.date >= period.start && input.date <= period.end;
    const placeholder: ExpenseRow = {
      id: `pending-${input.date}-${Date.now()}`,
      category_id: input.categoryId,
      amount: input.amount,
      date: input.date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (visible) {
      set((state) => ({ expenses: sortExpenses([placeholder, ...state.expenses]) }));
    }

    try {
      const created = await expensesRepo.createExpense(db, input);
      if (visible) {
        set((state) => ({
          expenses: sortExpenses(
            state.expenses.map((expense) => (expense.id === placeholder.id ? created : expense))
          ),
        }));
      }
      haptics.success();
    } catch (error) {
      if (visible) {
        set((state) => ({
          expenses: state.expenses.filter((expense) => expense.id !== placeholder.id),
        }));
      }
      throw error;
    }
  },

  update: async (db, id, input) => {
    const previous = get().expenses;
    set((state) => ({
      expenses: sortExpenses(
        state.expenses.map((expense) =>
          expense.id === id
            ? { ...expense, category_id: input.categoryId, amount: input.amount, date: input.date }
            : expense
        )
      ),
    }));

    try {
      await expensesRepo.updateExpense(db, id, input);
      haptics.success();
    } catch (error) {
      set({ expenses: previous });
      throw error;
    }
  },

  remove: async (db, id) => {
    const previous = get().expenses;
    set((state) => ({ expenses: state.expenses.filter((expense) => expense.id !== id) }));

    try {
      await expensesRepo.deleteExpense(db, id);
      haptics.warning();
    } catch (error) {
      set({ expenses: previous });
      throw error;
    }
  },

  /**
   * Writes a budget for exactly the loaded period, never for the one it may have inherited
   * from. Not optimistic: the amount comes from a modal that closes on save, so there is no
   * finger waiting on the number, and a rollback would repaint a screen already gone.
   *
   * With no period loaded there is nothing to write it for, and that throws rather than
   * returning quietly. A silent return is indistinguishable from a save at the call site:
   * the modal would close on its own success path and the budget would simply not exist.
   * Callers that can reach this state — the budget modal opened by a deep link, without
   * the expenses tab ever loading — must call `ensurePeriod` first.
   */
  setBudget: async (db, amount) => {
    const period = get().period;
    if (!period) {
      throw new Error('Cannot set a budget: no expense period is loaded');
    }
    await budgetsRepo.setBudget(db, period.start, amount);
    set({ budget: amount });
  },

  /**
   * Removes the loaded period's own budget row — what an emptied amount field means.
   *
   * The new amount is re-read rather than assumed to be null: the period may still
   * inherit the last budget set before it, and pretending otherwise would show a card the
   * next load contradicts. Same "no period loaded" rule as `setBudget`.
   */
  clearBudget: async (db) => {
    const period = get().period;
    if (!period) {
      throw new Error('Cannot clear a budget: no expense period is loaded');
    }
    await budgetsRepo.deleteBudget(db, period.start);
    set({ budget: await budgetsRepo.getBudgetFor(db, period.start) });
  },
}));
