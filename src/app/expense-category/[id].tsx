import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

import { CategoryForm } from '@/components/expense/category-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import type { ExpenseCategoryInput } from '@/db/expense-categories-repo';
import { useI18n } from '@/hooks/use-i18n';
import { categoryName } from '@/lib/category-name';
import { useExpenseCategoriesStore } from '@/store/expense-categories-store';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { t } = useI18n();
  const category = useExpenseCategoriesStore((state) =>
    state.categories.find((item) => item.id === id)
  );
  const loadCategories = useExpenseCategoriesStore((state) => state.load);
  const updateCategory = useExpenseCategoriesStore((state) => state.update);
  const [lookupDone, setLookupDone] = useState(false);
  const lookupStarted = useRef(false);

  /**
   * Same fallback as the habit form: the route can be opened before any list has loaded,
   * and the load widens the scope to archived categories rather than repeating the query
   * that already missed. It runs at most once, so a category that genuinely does not
   * exist settles on the empty state instead of re-querying on every render, and the
   * rejection is caught before `finally` so a failed query is not announced as "no such
   * category" — same reasoning as the habit and expense screens.
   */
  useEffect(() => {
    if (category || lookupStarted.current) return;
    lookupStarted.current = true;
    loadCategories(db, { includeArchived: true })
      .catch((error) => console.warn('Failed to load the category', error))
      .finally(() => setLookupDone(true));
  }, [category, db, loadCategories]);

  const handleSubmit = async (input: ExpenseCategoryInput) => {
    await updateCategory(db, id, input);
    router.back();
  };

  // edges: the native header already covers the top inset.
  return (
    <Screen edges={['bottom']}>
      {category ? (
        <CategoryForm
          /* The name is the one shown everywhere else, not the stored one: for a starter
             category in an English UI those differ, and a form that opened on "Еда" over
             a grid tile reading "Food" would look like it had loaded the wrong row.
             Saving it writes the visible name, which is exactly right — the category
             stops being a starter one and becomes the user's own. */
          initialValues={{
            name: categoryName(category.name, t),
            emoji: category.emoji,
            colorKey: category.color_key,
          }}
          submitLabel={t('save')}
          onSubmit={handleSubmit}
        />
      ) : lookupDone ? (
        <EmptyState icon="questionmark.circle" title={t('category_not_found')} />
      ) : null}
    </Screen>
  );
}
