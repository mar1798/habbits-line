import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import * as entriesRepo from '@/db/entries-repo';
import { useTheme } from '@/hooks/use-theme';
import { todayKey } from '@/lib/date';
import { useHabitsStore } from '@/store/habits-store';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const habits = useHabitsStore((state) => state.habits);
  const load = useHabitsStore((state) => state.load);
  const create = useHabitsStore((state) => state.create);
  const remove = useHabitsStore((state) => state.remove);

  useEffect(() => {
    load(db, { includeArchived: true });
  }, [db, load]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title1">Сегодня</Text>
        <IconButton
          name="plus"
          accessibilityLabel="Добавить привычку"
          onPress={() => router.push('/habit/new')}
        />
      </View>
      <EmptyState
        icon="checkmark.circle"
        title="Привычек пока нет"
        subtitle="Нажмите «+», чтобы добавить первую привычку"
      />
      {__DEV__ ? (
        <DevPanel
          habitCount={habits.length}
          onCreateThree={async () => {
            for (let i = 0; i < 3; i++) {
              const habit = await create(db, {
                name: `Тестовая привычка ${i + 1}`,
                emoji: '✅',
                colorKey: 'violet',
                targetPerDay: 1,
                scheduleMask: 127,
                reminderTime: null,
              });
              await entriesRepo.setEntryCount(db, habit.id, todayKey(), 1);
            }
          }}
          onDeleteFirst={async () => {
            const first = habits[0];
            if (first) {
              await remove(db, first.id);
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Stage 2 only — verifies persistence and cascade delete via the expo-sqlite
 * inspector. Removed once stage 3 replaces this screen with the real habit list.
 */
function DevPanel({
  habitCount,
  onCreateThree,
  onDeleteFirst,
}: {
  habitCount: number;
  onCreateThree: () => void;
  onDeleteFirst: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.devPanel}>
      <Text variant="caption" color={colors.textTertiary}>
        Dev: привычек в базе — {habitCount}
      </Text>
      <Button title="Создать 3 тестовые привычки" onPress={onCreateThree} />
      <Button title="Удалить первую привычку" variant="secondary" onPress={onDeleteFirst} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  devPanel: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});
