import { useIsFocused } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ExpenseSummary } from '@/components/stats/expense-summary';
import { Heatmap } from '@/components/stats/heatmap';
import { RateCard } from '@/components/stats/rate-card';
import { StreakCard } from '@/components/stats/streak-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { minHitSlop, motion, radius, resolveHabitColor, spacing } from '@/constants/design-tokens';
import * as entriesRepo from '@/db/entries-repo';
import * as habitsRepo from '@/db/habits-repo';
import type { EntryRow, HabitRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { useTodayKey } from '@/hooks/use-today-key';
import { computeCompletionRate, computeStreaks, toHabitSeries } from '@/lib/streaks';

/**
 * The selection standing for "all habits at once". Habit ids are uuids, so this can
 * never collide with one.
 */
const ALL = 'all';

function groupByHabit(rows: EntryRow[]): Record<string, Record<string, number>> {
  const grouped: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    (grouped[row.habit_id] ??= {})[row.date] = row.count;
  }
  return grouped;
}

/** Stable identity so a habit with no history yet doesn't rebuild derived values each render. */
const NO_ENTRIES: Record<string, number> = {};

type Chip = {
  id: string;
  label: string;
  /** SF Symbol shown before the label — the overview's mark, or the archive box. */
  symbol: SymbolViewProps['name'] | null;
};

/**
 * Loads its own habit list straight from the repo rather than through the shared
 * habits store: the store's `includeArchived` scope is global, and flipping it here
 * to show archived habits would silently make the "Today" screen's next reload
 * include them too.
 *
 * Habits and the whole entry history load together on every focus. The tab stays
 * mounted while the user is on "Today", so a screen that loaded once at mount would
 * keep showing the streak and heatmap from before the marks, habits and archivings made
 * since — and loading both in one pass means switching between habits afterwards is
 * pure derivation, with no query to wait on and nothing to flash.
 */
export default function StatsScreen() {
  const db = useSQLiteContext();
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const isFocused = useIsFocused();
  const today = useTodayKey();

  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(ALL);
  const [entriesByHabit, setEntriesByHabit] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;

    Promise.all([
      habitsRepo.listHabits(db, { includeArchived: showArchived }),
      entriesRepo.listAllEntries(db),
    ]).then(([habitRows, entryRows]) => {
      if (cancelled) return;
      setHabits(habitRows);
      setEntriesByHabit(groupByHabit(entryRows));
      setLoaded(true);
      // A habit that just went out of scope (archived, or deleted from its edit screen)
      // must not leave the screen pointing at nothing.
      setSelectedId((current) =>
        current === ALL || habitRows.some((habit) => habit.id === current) ? current : ALL
      );
    });

    return () => {
      cancelled = true;
    };
  }, [db, showArchived, isFocused]);

  const seriesByHabit = useMemo(
    () =>
      new Map(
        habits.map((habit) => [habit.id, toHabitSeries(habit, entriesByHabit[habit.id] ?? NO_ENTRIES)])
      ),
    [habits, entriesByHabit]
  );

  const selectedHabit = selectedId === ALL ? null : habits.find((habit) => habit.id === selectedId);

  // The one place the two modes differ: the overview aggregates over every listed habit, a chip
  // over the single one. Everything below reads a list either way.
  const series = useMemo(() => {
    if (selectedId === ALL) return [...seriesByHabit.values()];
    const selected = seriesByHabit.get(selectedId);
    return selected ? [selected] : [];
  }, [selectedId, seriesByHabit]);

  const streaks = computeStreaks(series, today);
  const rate7 = computeCompletionRate(series, today, 7);
  const rate30 = computeCompletionRate(series, today, 30);

  const accentColor = selectedHabit
    ? resolveHabitColor(selectedHabit.color_key, scheme)
    : colors.accent;

  const chips = useMemo<Chip[]>(
    () => [
      { id: ALL, label: t('stats_all'), symbol: 'square.grid.2x2' },
      ...habits.map((habit): Chip => ({
        id: habit.id,
        label: `${habit.emoji} ${habit.name}`,
        symbol: habit.archived_at ? 'archivebox' : null,
      })),
    ],
    [habits, t]
  );

  // Crossfade on every switch, including the first paint: without it the cards and the
  // heatmap snap from one habit's numbers to another's, which reads as the whole screen
  // twitching. Starts at 0 so the mount fades in rather than flashing full-strength
  // first.
  const contentOpacity = useSharedValue(0);
  useEffect(() => {
    contentOpacity.value = 0;
    contentOpacity.value = withTiming(1, { duration: motion.timing.base });
  }, [selectedId, contentOpacity]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title1">{t('stats_title')}</Text>
        <PressableScale
          onPress={() => setShowArchived((value) => !value)}
          // iOS has no checkbox/radio trait — with those roles VoiceOver announces the
          // control as plain text and never reads its state. See color-picker.tsx.
          accessibilityRole="button"
          accessibilityLabel={t('stats_show_archived')}
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
            {t('stats_archived')}
          </Text>
        </PressableScale>
      </View>

      {/* Nothing until the first load lands: an ungated screen shows a lone overview chip
          over empty cards for a frame on every cold start. */}
      {!loaded ? null : habits.length === 0 ? (
        <EmptyState
          icon="chart.bar"
          title={t('stats_empty_title')}
          subtitle={t('stats_empty_subtitle')}
        />
      ) : (
        <>
          <FlatList
            horizontal
            data={chips}
            extraData={selectedId}
            keyExtractor={(chip) => chip.id}
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
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.chip,
                    { backgroundColor: isSelected ? colors.accent : colors.surfaceAlt },
                  ]}>
                  {item.symbol ? (
                    <SymbolView
                      name={item.symbol}
                      size={12}
                      tintColor={isSelected ? colors.onAccent : colors.textTertiary}
                    />
                  ) : null}
                  <Text variant="callout" color={isSelected ? colors.onAccent : colors.textPrimary}>
                    {item.label}
                  </Text>
                </PressableScale>
              );
            }}
          />

          {series.length > 0 ? (
            <Animated.ScrollView style={contentStyle} contentContainerStyle={styles.content}>
              <StreakCard current={streaks.current} best={streaks.best} />
              <RateCard rate7={rate7} rate30={rate30} color={accentColor} />
              <View style={styles.heatmapSection}>
                <Text variant="title2">{t('stats_last_3_months')}</Text>
                <Heatmap series={series} color={accentColor} todayDate={today} />
              </View>
              {/* Below the habit blocks, and outside the crossfade's reason to exist: the
                  chips above switch habits, and the expense block is the same either way. */}
              <ExpenseSummary todayDate={today} />
            </Animated.ScrollView>
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
