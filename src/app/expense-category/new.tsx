import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { CategoryForm, DEFAULT_CATEGORY_FORM_VALUES } from '@/components/expense/category-form';
import { Screen } from '@/components/ui/screen';
import type { ExpenseCategoryInput } from '@/db/expense-categories-repo';
import { useI18n } from '@/hooks/use-i18n';
import { useTakenCategoryNames } from '@/hooks/use-taken-names';
import { useExpenseCategoriesStore } from '@/store/expense-categories-store';

export default function NewCategoryScreen() {
  const db = useSQLiteContext();
  const { t } = useI18n();
  const createCategory = useExpenseCategoriesStore((state) => state.create);
  const takenNames = useTakenCategoryNames();

  // The store reloads before this resolves, so the expense form underneath already sees
  // the new category by the time the modal is gone — that is what it selects it by.
  const handleSubmit = async (input: ExpenseCategoryInput) => {
    await createCategory(db, input);
    router.back();
  };

  // edges: the native header already covers the top inset.
  return (
    <Screen edges={['bottom']}>
      <CategoryForm
        initialValues={DEFAULT_CATEGORY_FORM_VALUES}
        submitLabel={t('create')}
        takenNames={takenNames}
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}
