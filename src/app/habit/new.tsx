import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { DEFAULT_HABIT_FORM_VALUES, HabitForm } from '@/components/habit/habit-form';
import { Screen } from '@/components/ui/screen';
import type { HabitInput } from '@/db/habits-repo';
import { useI18n } from '@/hooks/use-i18n';
import { useHabitsStore } from '@/store/habits-store';

export default function NewHabitScreen() {
  const db = useSQLiteContext();
  const { t } = useI18n();
  const createHabit = useHabitsStore((state) => state.create);

  const handleSubmit = async (input: HabitInput) => {
    await createHabit(db, input);
    router.back();
  };

  // edges: the native header already covers the top inset.
  return (
    <Screen edges={['bottom']}>
      <HabitForm
        initialValues={DEFAULT_HABIT_FORM_VALUES}
        submitLabel={t('habit_form_create')}
        onSubmit={handleSubmit}
      />
    </Screen>
  );
}
