import { MenuView } from '@expo/ui/community/menu';
import type { NativeActionEvent } from '@expo/ui/community/menu';
import { router, useIsFocused } from 'expo-router';
import { SFSymbol, SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, resolveHabitColor, spacing } from '@/constants/design-tokens';
import type { HabitRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import type { Language, MessageKey } from '@/i18n';
import {
  BackupError,
  exportBackupAsync,
  importBackupAsync,
  pickBackupFileAsync,
} from '@/lib/backup';
import {
  getScheduledCountAsync,
  NOTIFICATION_WARNING_THRESHOLD,
  scheduleAllReminders,
  useNotificationPermissionStatus,
} from '@/lib/notifications';
import { useEntriesStore } from '@/store/entries-store';
import { useHabitsStore } from '@/store/habits-store';
import { type ThemeMode, useSettingsStore } from '@/store/settings-store';

const THEME_OPTIONS: { mode: ThemeMode; labelKey: MessageKey; icon: SFSymbol }[] = [
  { mode: 'system', labelKey: 'theme_system', icon: 'iphone' },
  { mode: 'light', labelKey: 'theme_light', icon: 'sun.max' },
  { mode: 'dark', labelKey: 'theme_dark', icon: 'moon' },
];

/**
 * Each language is named in itself, so the labels do not change with the setting — which
 * is the point: someone who cannot read the current UI still finds their own language.
 * No icons here, unlike the theme row: a language has no glyph that says it.
 */
const LANGUAGE_OPTIONS: { language: Language; labelKey: MessageKey }[] = [
  { language: 'ru', labelKey: 'language_ru' },
  { language: 'en', labelKey: 'language_en' },
];

/** Message key for a failed import or export — a BackupError carries its own code. */
function backupErrorKey(error: unknown): MessageKey {
  if (!(error instanceof BackupError)) return 'try_again';
  switch (error.code) {
    case 'sharing_unavailable':
      return 'backup_error_sharing_unavailable';
    case 'malformed_file':
      return 'backup_error_malformed_file';
    case 'unrecognized_format':
      return 'backup_error_unrecognized_format';
    case 'unsupported_version':
      return 'backup_error_unsupported_version';
    case 'orphan_entries':
      return 'backup_error_orphan_entries';
  }
}

function backupErrorParams(error: unknown) {
  return error instanceof BackupError ? error.params : undefined;
}

type Row =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'habit'; key: string; habit: HabitRow; isFirst: boolean; isLast: boolean };

export default function SettingsScreen() {
  const { colors, scheme } = useTheme();
  const { t, plural } = useI18n();
  const isFocused = useIsFocused();
  const permission = useNotificationPermissionStatus();
  const [scheduledCount, setScheduledCount] = useState(0);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const db = useSQLiteContext();
  const habits = useHabitsStore((state) => state.habits);
  const loaded = useHabitsStore((state) => state.loaded);
  const loadHabits = useHabitsStore((state) => state.load);
  const archiveHabit = useHabitsStore((state) => state.archive);
  const unarchiveHabit = useHabitsStore((state) => state.unarchive);
  const removeHabit = useHabitsStore((state) => state.remove);
  const reorderHabits = useHabitsStore((state) => state.reorder);
  const reloadEntries = useEntriesStore((state) => state.reload);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  // Includes archived habits — the only screen that needs the full list, so the
  // scope lives on the shared store rather than a local query. That also fixes
  // habit/[id]'s lookup for an archived habit opened from here, since the store's
  // scope is preserved by every write-through reload.
  useEffect(() => {
    if (!isFocused) return;
    loadHabits(db, { includeArchived: true });
  }, [db, isFocused, loadHabits]);

  // Re-read on every focus: a reminder saved on another screen recomputes the
  // schedule after this tab has already mounted.
  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    getScheduledCountAsync().then((count) => {
      if (!cancelled) setScheduledCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  /**
   * Runs a habit mutation from this screen. Archiving, unarchiving and deleting all
   * recompute the whole schedule, so the count behind the iOS-limit banner is re-read
   * afterwards — the focus effect alone would leave it stale until the tab was left and
   * re-entered. The rejection is swallowed here rather than left to `void`: an
   * unhandled rejection surfaces as a Metro warning for a failure the user can only
   * retry anyway.
   */
  const runMutation = (mutation: Promise<unknown>) => {
    mutation
      .catch((error) => console.warn('Habit mutation failed', error))
      .then(() => getScheduledCountAsync())
      .then(setScheduledCount)
      .catch(() => undefined);
  };

  const activeHabits = habits.filter((habit) => !habit.archived_at);
  const archivedHabits = habits.filter((habit) => habit.archived_at);

  const rows: Row[] = [
    ...(activeHabits.length > 0
      ? [{ kind: 'header' as const, key: 'header-active', title: t('settings_active') }]
      : []),
    ...activeHabits.map((habit, index) => ({
      kind: 'habit' as const,
      key: habit.id,
      habit,
      isFirst: index === 0,
      isLast: index === activeHabits.length - 1,
    })),
    ...(archivedHabits.length > 0
      ? [{ kind: 'header' as const, key: 'header-archived', title: t('settings_archive') }]
      : []),
    ...archivedHabits.map((habit) => ({
      kind: 'habit' as const,
      key: habit.id,
      habit,
      isFirst: true,
      isLast: true,
    })),
  ];

  const moveHabit = (habitId: string, direction: -1 | 1) => {
    const ids = activeHabits.map((habit) => habit.id);
    const from = ids.indexOf(habitId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    // `reorder` reorders the store synchronously and handles its own failure, so a
    // second tap before the write lands still moves the habit one more place.
    void reorderHabits(db, ids);
  };

  const confirmDelete = (habit: HabitRow) => {
    Alert.alert(
      t('settings_delete_title', { name: habit.name }),
      t('settings_delete_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => runMutation(removeHabit(db, habit.id)),
        },
      ]
    );
  };

  const handleExport = async () => {
    setBusy('export');
    try {
      await exportBackupAsync(db);
    } catch (error) {
      console.warn('Export failed', error);
      Alert.alert(
        t('settings_export_failed'),
        t(backupErrorKey(error), backupErrorParams(error))
      );
    } finally {
      setBusy(null);
    }
  };

  /**
   * Both stores are reloaded by hand, and so is the schedule: an import writes straight
   * to SQL, bypassing the repo mutations that the store actions wrap, so none of the
   * write-through reloads or the reminder recompute that normally follow a mutation
   * happen on their own. The entries store matters as much as the habits one — the
   * "Today" tab stays mounted and would keep displaying the marks of the replaced data
   * until its week changed.
   */
  const performImport = async (uri: string) => {
    setBusy('import');
    try {
      await importBackupAsync(db, uri);
      await loadHabits(db, { includeArchived: true });
      await reloadEntries(db);
      await scheduleAllReminders(db, { requestPermission: true }).catch((error) => {
        console.error('Failed to reschedule reminders after import', error);
      });
      setScheduledCount(await getScheduledCountAsync());
      Alert.alert(t('settings_import_done_title'), t('settings_import_done_message'));
    } catch (error) {
      console.warn('Import failed', error);
      Alert.alert(
        t('settings_import_failed'),
        t(backupErrorKey(error), backupErrorParams(error))
      );
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    let uri: string | null;
    try {
      uri = await pickBackupFileAsync();
    } catch (error) {
      // The picker rejects on its own (a second sheet already open, a file the system
      // could not copy). Without this it would surface as an unhandled rejection.
      console.warn('Document picker failed', error);
      Alert.alert(t('settings_picker_failed'), t('try_again'));
      return;
    }
    if (!uri) return;
    Alert.alert(
      t('settings_import_confirm_title'),
      t('settings_import_confirm_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('settings_import_confirm_action'),
          style: 'destructive',
          onPress: () => void performImport(uri),
        },
      ]
    );
  };

  const handleMenuAction = (habit: HabitRow) => ({ nativeEvent }: NativeActionEvent) => {
    switch (nativeEvent.event) {
      case 'edit':
        router.push({ pathname: '/habit/[id]', params: { id: habit.id } });
        break;
      case 'archive':
        runMutation(archiveHabit(db, habit.id));
        break;
      case 'unarchive':
        runMutation(unarchiveHabit(db, habit.id));
        break;
      case 'delete':
        confirmDelete(habit);
        break;
    }
  };

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        // The empty state fills its remaining height, and `flex: 1` inside a scroll
        // view's content container collapses to nothing without flexGrow to grow into.
        contentContainerStyle={[styles.list, rows.length === 0 && styles.listEmpty]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="title1">{t('settings_title')}</Text>

            {permission === 'denied' ? (
              <Card style={styles.banner}>
                <Text variant="body">{t('settings_notifications_denied')}</Text>
                <Button
                  title={t('settings_open_ios_settings')}
                  variant="secondary"
                  onPress={() => Linking.openSettings()}
                />
              </Card>
            ) : null}

            {scheduledCount >= NOTIFICATION_WARNING_THRESHOLD ? (
              <Card style={styles.banner}>
                <Text variant="body" color={colors.warning}>
                  {t('settings_notification_limit', {
                    count: scheduledCount,
                    reminders: plural('reminders', scheduledCount),
                  })}
                </Text>
              </Card>
            ) : null}

            <View style={styles.group}>
              <Text variant="title2">{t('settings_appearance')}</Text>
              <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
                {THEME_OPTIONS.map((option) => (
                  <Segment
                    key={option.mode}
                    label={t(option.labelKey)}
                    icon={option.icon}
                    isSelected={option.mode === themeMode}
                    onPress={() => {
                      // The theme flips synchronously inside the store; only the write
                      // is awaited, and a failed one must not crash the screen.
                      setThemeMode(db, option.mode).catch((error) =>
                        console.warn('Failed to save theme mode', error)
                      );
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={styles.group}>
              <Text variant="title2">{t('settings_language')}</Text>
              <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <Segment
                    key={option.language}
                    label={t(option.labelKey)}
                    isSelected={option.language === language}
                    onPress={() => {
                      // Same as the theme: the UI switches synchronously inside the store.
                      // The awaited part is the write plus the reminder recompute, and
                      // neither failing may take the screen down with it.
                      setLanguage(db, option.language).catch((error) =>
                        console.warn('Failed to save language', error)
                      );
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={styles.group}>
              <Text variant="title2">{t('settings_data')}</Text>
              <View style={styles.dataButtons}>
                <Button
                  title={t('settings_export')}
                  variant="secondary"
                  disabled={busy !== null}
                  onPress={() => void handleExport()}
                  style={styles.dataButton}
                />
                <Button
                  title={t('settings_import')}
                  variant="secondary"
                  disabled={busy !== null}
                  onPress={() => void handleImport()}
                  style={styles.dataButton}
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              icon="list.bullet"
              title={t('empty_no_habits')}
              subtitle={t('settings_empty_subtitle')}
            />
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <Text variant="caption" color={colors.textSecondary} style={styles.sectionTitle}>
                {item.title.toUpperCase()}
              </Text>
            );
          }

          const { habit, isFirst, isLast } = item;
          const isArchived = habit.archived_at !== null;
          const accentColor = resolveHabitColor(habit.color_key, scheme);

          return (
            // The row itself is a plain View: the arrows and the menu are pressables of
            // their own, and nesting them inside a row-wide one made a disabled arrow
            // fall through to the row and open the edit modal, while the menu's native
            // trigger competed with the row for the same tap. Only the name area opens
            // the form.
            <View
              style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <PressableScale
                onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
                accessibilityRole="button"
                accessibilityLabel={t('settings_edit_habit', { name: habit.name })}
                style={styles.main}>
                <View style={[styles.emoji, { backgroundColor: `${accentColor}33` }]}>
                  <Text variant="headline">{habit.emoji}</Text>
                </View>
                <View style={styles.info}>
                  <Text
                    variant="body"
                    numberOfLines={1}
                    color={isArchived ? colors.textSecondary : undefined}>
                    {habit.name}
                  </Text>
                  {isArchived ? (
                    <Text variant="caption" color={colors.textTertiary}>
                      {t('settings_archived_badge')}
                    </Text>
                  ) : null}
                </View>
              </PressableScale>

              {!isArchived ? (
                <View style={styles.arrows}>
                  <IconButton
                    name="chevron.up"
                    accessibilityLabel={t('settings_move_up')}
                    size={16}
                    disabled={isFirst}
                    onPress={() => moveHabit(habit.id, -1)}
                  />
                  <IconButton
                    name="chevron.down"
                    accessibilityLabel={t('settings_move_down')}
                    size={16}
                    disabled={isLast}
                    onPress={() => moveHabit(habit.id, 1)}
                  />
                </View>
              ) : null}

              <MenuView
                actions={
                  isArchived
                    ? [
                        { id: 'edit', title: t('menu_edit'), image: 'pencil' },
                        {
                          id: 'unarchive',
                          title: t('menu_unarchive'),
                          image: 'tray.and.arrow.up',
                        },
                        {
                          id: 'delete',
                          title: t('delete'),
                          image: 'trash',
                          attributes: { destructive: true },
                        },
                      ]
                    : [
                        { id: 'edit', title: t('menu_edit'), image: 'pencil' },
                        { id: 'archive', title: t('menu_archive'), image: 'archivebox' },
                        {
                          id: 'delete',
                          title: t('delete'),
                          image: 'trash',
                          attributes: { destructive: true },
                        },
                      ]
                }
                onPressAction={handleMenuAction(habit)}>
                <View style={[styles.moreButton, { backgroundColor: colors.surfaceAlt }]}>
                  <SymbolView name="ellipsis" size={18} tintColor={colors.textPrimary} />
                </View>
              </MenuView>
            </View>
          );
        }}
      />
    </Screen>
  );
}

/**
 * One option of a segmented control — the theme row and the language row are the same
 * exclusive choice, and the selected pill is what says which one is on. The icon is
 * optional: the languages are named, not pictured.
 */
function Segment({
  label,
  icon,
  isSelected,
  onPress,
}: {
  label: string;
  icon?: SFSymbol;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      // Same reason as the archive toggle on the stats screen: iOS has no radio trait,
      // and a non-button role leaves VoiceOver silent on state.
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      style={[styles.segment, isSelected && { backgroundColor: colors.surface }]}>
      {icon ? (
        <SymbolView
          name={icon}
          size={15}
          tintColor={isSelected ? colors.accent : colors.textSecondary}
        />
      ) : null}
      <Text variant="caption" color={isSelected ? colors.accent : colors.textSecondary}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  banner: {
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minHitSlop,
    borderRadius: radius.pill,
  },
  dataButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dataButton: {
    flex: 1,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  listEmpty: {
    flexGrow: 1,
  },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minHitSlop,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  arrows: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  moreButton: {
    width: minHitSlop,
    height: minHitSlop,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
