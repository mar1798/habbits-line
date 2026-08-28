import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { HabitForm } from '@/components/habit/habit-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import type { HabitInput } from '@/db/habits-repo';
import { useHabitsStore } from '@/store/habits-store';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const habit = useHabitsStore((state) => state.habits.find((item) => item.id === id));
  const loaded = useHabitsStore((state) => state.loaded);
  const loadHabits = useHabitsStore((state) => state.load);
  const updateHabit = useHabitsStore((state) => state.update);

  // The screen can be reached before any list has loaded — a deep link, or a
  // notification tap in stage 7 — and then the store is simply empty.
  useEffect(() => {
    if (!loaded) {
      loadHabits(db);
    }
  }, [db, loadHabits, loaded]);

  const handleSubmit = async (input: HabitInput) => {
    await updateHabit(db, id, input);
    router.back();
  };

  // edges: the native header already covers the top inset.
  return (
    <Screen edges={['bottom']}>
      {habit ? (
        <HabitForm
          initialValues={{
            name: habit.name,
            emoji: habit.emoji,
            colorKey: habit.color_key,
            targetPerDay: habit.target_per_day,
            scheduleMask: habit.schedule_mask,
            reminderTime: habit.reminder_time,
          }}
          submitLabel="Сохранить"
          isEditing
          onSubmit={handleSubmit}
        />
      ) : loaded ? (
        // Only once the list is actually loaded — otherwise every open would flash
        // "not found" before the habits arrive.
        <EmptyState icon="questionmark.circle" title="Привычка не найдена" />
      ) : null}
    </Screen>
  );
}
