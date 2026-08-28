import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';

import { HabitForm } from '@/components/habit/habit-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import type { HabitInput } from '@/db/habits-repo';
import { useHabitsStore } from '@/store/habits-store';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const habit = useHabitsStore((state) => state.habits.find((item) => item.id === id));
  const loadHabits = useHabitsStore((state) => state.load);
  const updateHabit = useHabitsStore((state) => state.update);
  const [lookupDone, setLookupDone] = useState(false);
  const lookupStarted = useRef(false);

  /**
   * The screen can be reached before any list has loaded — a deep link, or a
   * notification tap — and then the store is simply empty. It can also be reached for
   * an archived habit while the store holds the active-only scope, so the fallback load
   * widens the scope instead of repeating the query that already missed. Widening is
   * safe: "Today" filters archived habits out itself, and stats reads its own list
   * straight from the repository.
   *
   * Runs at most once, so a habit that genuinely does not exist settles on the empty
   * state instead of re-querying on every render.
   */
  useEffect(() => {
    if (habit || lookupStarted.current) return;
    lookupStarted.current = true;
    loadHabits(db, { includeArchived: true }).finally(() => setLookupDone(true));
  }, [db, habit, loadHabits]);

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
      ) : lookupDone ? (
        // Only once the fallback load has come back — otherwise every open would flash
        // "not found" before the habits arrive.
        <EmptyState icon="questionmark.circle" title="Привычка не найдена" />
      ) : null}
    </Screen>
  );
}
