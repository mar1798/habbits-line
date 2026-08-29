import { useIsFocused } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { Heatmap } from '@/components/stats/heatmap';
import { RateCard } from '@/components/stats/rate-card';
import { StreakCard } from '@/components/stats/streak-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, resolveHabitColor, spacing } from '@/constants/design-tokens';
import * as entriesRepo from '@/db/entries-repo';
import * as habitsRepo from '@/db/habits-repo';
import type { EntryRow, HabitRow } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { useTodayKey } from '@/hooks/use-today-key';
import { computeCompletionRate, computeStreaks } from '@/lib/streaks';

function toEntryCounts(rows: EntryRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.date] = row.count;
  }
  return counts;
}

/** Stable identity so a habit with no history yet doesn't rebuild derived values each render. */
const NO_ENTRIES: Record<string, number> = {};

type LoadedEntries = {
  /** Which habit these counts belong to — see `entryCounts` below. */
  habitId: string;
  counts: Record<string, number>;
};

/**
 * Loads its own habit list straight from the repo rather than through the shared
 * habits store: the store's `includeArchived` scope is global, and flipping it here
 * to show archived habits would silently make the "Today" screen's next reload
 * include them too.
 *
 * Both loads re-run on every focus. The tab stays mounted while the user is on
 * "Today", so a screen that loaded once at mount would keep showing the streak and
 * heatmap from before the marks, habits and archivings made since.
 */
export default function StatsScreen() {
  const db = useSQLiteContext();
  const { colors, scheme } = useTheme();
  const isFocused = useIsFocused();
  const today = useTodayKey();

  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [habitsLoaded, setHabitsLoaded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LoadedEntries | null>(null);

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;

    habitsRepo.listHabits(db, { includeArchived: showArchived }).then((rows) => {
      if (cancelled) return;
      setHabits(rows);
      setHabitsLoaded(true);
      setSelectedId((current) =>
        current && rows.some((habit) => habit.id === current) ? current : (rows[0]?.id ?? null)
      );
    });

    return () => {
      cancelled = true;
    };
  }, [db, showArchived, isFocused]);

  // Keyed on the id, not on the habit row: the row is a fresh object after every
  // reload, and depending on it would refetch the whole history on each focus even
  // when the selection never moved.
  useEffect(() => {
    if (!isFocused || !selectedId) return;
    let cancelled = false;

    entriesRepo.listEntriesForHabit(db, selectedId).then((rows) => {
      if (cancelled) return;
      setEntries({ habitId: selectedId, counts: toEntryCounts(rows) });
    });

    return () => {
      cancelled = true;
    };
  }, [db, selectedId, isFocused]);

  const selectedHabit = habits.find((habit) => habit.id === selectedId) ?? null;

  // Switching habits leaves the previous history in state until the new query lands.
  // Without this guard those days would be shown for a moment as the new habit's
  // streak and heatmap — and a slow query overtaken by a faster one would leave them
  // there for good.
  const entryCounts = entries && entries.habitId === selectedId ? entries.counts : NO_ENTRIES;

  const streaks = selectedHabit
    ? computeStreaks(entryCounts, selectedHabit.schedule_mask, selectedHabit.target_per_day, today)
    : { current: 0, best: 0 };
  const rate7 = selectedHabit
    ? computeCompletionRate(entryCounts, selectedHabit.schedule_mask, selectedHabit.target_per_day, today, 7)
    : 0;
  const rate30 = selectedHabit
    ? computeCompletionRate(entryCounts, selectedHabit.schedule_mask, selectedHabit.target_per_day, today, 30)
    : 0;

  const accentColor = selectedHabit
    ? resolveHabitColor(selectedHabit.color_key, scheme)
    : colors.accent;

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title1">Статистика</Text>
        <PressableScale
          onPress={() => setShowArchived((value) => !value)}
          // iOS has no checkbox/radio trait — with those roles VoiceOver announces the
          // control as plain text and never reads its state. See color-picker.tsx.
          accessibilityRole="button"
          accessibilityLabel="Показывать архивные привычки"
          accessibilityState={{ selected: showArchived }}
          style={[
            styles.archiveToggle,
            { backgroundColor: showArchived ? colors.accentSoft : colors.surfaceAlt },
          ]}>
          <SymbolView
            name="archivebox"
            size={14}
            tintColor={showArchived ? colors.accent : colors.textSecondary}
          />
          <Text variant="caption" color={showArchived ? colors.accent : colors.textSecondary}>
            Архивные
          </Text>
        </PressableScale>
      </View>

      {habitsLoaded && habits.length === 0 ? (
        <EmptyState
          icon="chart.bar"
          title="Пока нет данных"
          subtitle="Статистика появится, когда вы начнёте отмечать привычки"
        />
      ) : (
        <>
          <FlatList
            horizontal
            data={habits}
            extraData={selectedId}
            keyExtractor={(habit) => habit.id}
            showsHorizontalScrollIndicator={false}
            // A horizontal list inherits ScrollView's `flexGrow: 1`, so in this column it
            // would split the screen's height with the content below and stretch every
            // chip to fill it. It must be exactly as tall as one row of chips.
            style={styles.chipsList}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
                <PressableScale
                  onPress={() => setSelectedId(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.chip,
                    { backgroundColor: isSelected ? colors.accent : colors.surfaceAlt },
                  ]}>
                  {item.archived_at ? (
                    <SymbolView
                      name="archivebox"
                      size={12}
                      tintColor={isSelected ? colors.onAccent : colors.textTertiary}
                    />
                  ) : null}
                  <Text variant="callout" color={isSelected ? colors.onAccent : colors.textPrimary}>
                    {item.emoji} {item.name}
                  </Text>
                </PressableScale>
              );
            }}
          />

          {selectedHabit ? (
            <ScrollView contentContainerStyle={styles.content}>
              <StreakCard current={streaks.current} best={streaks.best} />
              <RateCard rate7={rate7} rate30={rate30} color={accentColor} />
              <View style={styles.heatmapSection}>
                <Text variant="title2">Последние 3 месяца</Text>
                <Heatmap
                  entryCounts={entryCounts}
                  scheduleMask={selectedHabit.schedule_mask}
                  targetPerDay={selectedHabit.target_per_day}
                  color={accentColor}
                  todayDate={today}
                />
              </View>
            </ScrollView>
          ) : null}
        </>
      )}
    </Screen>
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
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  chipsList: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // Without this the container's default `stretch` pulls each chip to the list's full
    // height; the chip's own minHeight already carries the 44pt target.
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heatmapSection: {
    gap: spacing.md,
  },
});
