import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { ExpenseForm } from '@/components/expense/expense-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import * as expensesRepo from '@/db/expenses-repo';
import type { ExpenseRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useExpensesStore } from '@/store/expenses-store';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { t } = useI18n();
  const stored = useExpensesStore((state) => state.expenses.find((item) => item.id === id));
  const updateExpense = useExpensesStore((state) => state.update);

  const [fetched, setFetched] = useState<ExpenseRow | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  /**
   * The store holds one period, and the row being edited was tapped inside it, so the
   * lookup above normally succeeds. The fallback covers the period having moved on under
   * an open modal, and reads the row straight from the repository rather than loading a
   * whole other period into the store the screen behind it is still showing.
   */
  useEffect(() => {
    if (stored) return;
    let cancelled = false;
    expensesRepo
      .getExpense(db, id)
      .then((row) => {
        if (!cancelled) setFetched(row);
      })
      .catch((error) => console.warn('Failed to load expense', error))
      .finally(() => {
        if (!cancelled) setLookupDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, id, stored]);

  const expense = stored ?? fetched;

  const handleSubmit = async (input: expensesRepo.ExpenseInput) => {
    await updateExpense(db, id, input);
    router.back();
  };

  // edges: the native header already covers the top inset.
  return (
    <Screen edges={['bottom']}>
      {expense ? (
        <ExpenseForm
          initialValues={{
            amount: expense.amount,
            categoryId: expense.category_id,
            note: expense.note,
            // Editing keeps the row's day: moving an expense to another date means
            // deleting it and writing it again.
            date: expense.date,
          }}
          submitLabel={t('save')}
          onSubmit={handleSubmit}
        />
      ) : lookupDone ? (
        <EmptyState icon="questionmark.circle" title={t('expense_not_found')} />
      ) : null}
    </Screen>
  );
}
