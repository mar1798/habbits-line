import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ExpenseForm } from '@/components/expense/expense-form';
import { Screen } from '@/components/ui/screen';
import type { ExpenseInput } from '@/db/expenses-repo';
import { useI18n } from '@/hooks/use-i18n';
import { isValidDateKey, todayKey } from '@/lib/date';
import { useExpensesStore } from '@/store/expenses-store';

export default function NewExpenseScreen() {
  const db = useSQLiteContext();
  const { t } = useI18n();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const createExpense = useExpensesStore((state) => state.create);

  // The day comes from the strip on the expenses screen; a route opened without it (a
  // deep link) writes to today rather than refusing to open.
  const day = date && isValidDateKey(date) ? date : todayKey();

  const handleSubmit = async (input: ExpenseInput) => {
    await createExpense(db, input);
    router.back();
  };

  // edges: the native header already covers the top inset.
  return (
    <Screen edges={['bottom']}>
      <ExpenseForm
        initialValues={{ amount: null, categoryId: null, note: null, date: day }}
        submitLabel={t('create')}
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}
