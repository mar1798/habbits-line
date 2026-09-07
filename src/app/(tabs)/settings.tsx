import { format } from 'date-fns/format';
import Constants from 'expo-constants';
import { router, useIsFocused } from 'expo-router';
import { SFSymbol, SymbolView } from 'expo-symbols';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  fontFamily,
  minHitSlop,
  radius,
  resolveExpenseColor,
  resolveHabitColor,
  spacing,
  typography,
} from '@/constants/design-tokens';
import { countExpensesByCategory } from '@/db/expense-categories-repo';
import type { ExpenseCategoryRow, HabitRow } from '@/db/types';
import { useScaledFontSize } from '@/hooks/use-font-scale';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { useTodayKey } from '@/hooks/use-today-key';
import type { Language, MessageKey } from '@/i18n';
import { showActionSheet } from '@/lib/action-sheet';
import type { ActionSheetAction } from '@/lib/action-sheet';
import {
  BackupError,
  exportBackupAsync,
  importBackupAsync,
  pickBackupFileAsync,
} from '@/lib/backup';
import { backupStatus } from '@/lib/backup-status';
import { categoryName, FALLBACK_CATEGORY } from '@/lib/category-name';
import { parseDateKey } from '@/lib/date';
import {
  formatAmount,
  MAX_CURRENCY_SYMBOL_LENGTH,
  type CurrencyPosition,
} from '@/lib/money';
import {
  getScheduledCountAsync,
  NOTIFICATION_WARNING_THRESHOLD,
  scheduleAllReminders,
  useNotificationPermissionStatus,
} from '@/lib/notifications';
import { useEntriesStore } from '@/store/entries-store';
import { useExpenseCategoriesStore } from '@/store/expense-categories-store';
import { useExpensesStore } from '@/store/expenses-store';
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

const CURRENCY_POSITION_OPTIONS: { position: CurrencyPosition; labelKey: MessageKey }[] = [
  { position: 'prefix', labelKey: 'settings_currency_prefix' },
  { position: 'suffix', labelKey: 'settings_currency_suffix' },
];

/** The amount the hint under the currency field is written with. */
const CURRENCY_EXAMPLE_AMOUNT = 1250;

/**
 * Read from the manifest embedded in the build, not from `expo-application`: that would
 * be a new dependency for two strings. Both come from the same `app.json` that prebuild
 * writes `Info.plist` from — so they match the binary only if prebuild was actually run,
 * which is why release acceptance compares this row against the archive's plist.
 */
const APP_VERSION = Constants.expoConfig?.version ?? '—';
const APP_BUILD = Constants.expoConfig?.ios?.buildNumber ?? '—';

/**
 * Published from `docs/` via GitHub Pages, one page per UI language: the App Store
 * listing points at the same pair, and a reader who switched the app to English should
 * not land on the Russian text.
 */
const PRIVACY_POLICY_URL: Record<Language, string> = {
  ru: 'https://mar1798.github.io/habbits-line/privacy-policy.ru.html',
  en: 'https://mar1798.github.io/habbits-line/privacy-policy.en.html',
};

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
    case 'orphan_expenses':
      return 'backup_error_orphan_expenses';
  }
}

function backupErrorParams(error: unknown) {
  return error instanceof BackupError ? error.params : undefined;
}

type Row =
  | { kind: 'add-habit'; key: string }
  | { kind: 'archive-toggle'; key: string }
  | { kind: 'habit'; key: string; habit: HabitRow; isFirst: boolean; isLast: boolean };

export default function SettingsScreen() {
  const { colors, scheme } = useTheme();
  const { t, plural, locale } = useI18n();
  const inputFontSize = useScaledFontSize('body');
  const isFocused = useIsFocused();
  const todayDate = useTodayKey();
  const permission = useNotificationPermissionStatus();
  const [scheduledCount, setScheduledCount] = useState(0);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [expenseCounts, setExpenseCounts] = useState<Record<string, number>>({});
  const [showArchivedCategories, setShowArchivedCategories] = useState(false);
  const [showArchivedHabits, setShowArchivedHabits] = useState(false);
  // Both lists start closed: the preferences above them are what the screen is opened
  // for most often, and either list unfolded pushes them off the top on a long one.
  const [habitsExpanded, setHabitsExpanded] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const db = useSQLiteContext();
  const habits = useHabitsStore((state) => state.habits);
  const loaded = useHabitsStore((state) => state.loaded);
  const loadHabits = useHabitsStore((state) => state.load);
  const archiveHabit = useHabitsStore((state) => state.archive);
  const unarchiveHabit = useHabitsStore((state) => state.unarchive);
  const removeHabit = useHabitsStore((state) => state.remove);
  const reorderHabits = useHabitsStore((state) => state.reorder);
  const reloadEntries = useEntriesStore((state) => state.reload);
  const reloadExpenses = useExpensesStore((state) => state.reload);
  const categories = useExpenseCategoriesStore((state) => state.categories);
  const loadCategories = useExpenseCategoriesStore((state) => state.load);
  const archiveCategory = useExpenseCategoriesStore((state) => state.archive);
  const unarchiveCategory = useExpenseCategoriesStore((state) => state.unarchive);
  const removeCategory = useExpenseCategoriesStore((state) => state.remove);
  const removeCategoryReassigning = useExpenseCategoriesStore((state) => state.removeReassigning);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const loadSettings = useSettingsStore((state) => state.load);
  const currency = useSettingsStore((state) => state.currency);
  const setCurrency = useSettingsStore((state) => state.setCurrency);
  const lastExportAt = useSettingsStore((state) => state.lastExportAt);
  const markExported = useSettingsStore((state) => state.markExported);

  // Includes archived habits — the only screen that needs the full list, so the
  // scope lives on the shared store rather than a local query. That also fixes
  // habit/[id]'s lookup for an archived habit opened from here, since the store's
  // scope is preserved by every write-through reload.
  useEffect(() => {
    if (!isFocused) return;
    loadHabits(db, { includeArchived: true }).catch((error) =>
      console.warn('Failed to load habits', error)
    );
  }, [db, isFocused, loadHabits]);

  /**
   * Categories and their expense counts, re-read on every focus for the same reason as
   * the habits above: the tab stays mounted, and a category added from the expense modal
   * or an expense written since would otherwise not show up here. Archived ones are
   * included — this screen is where they are brought back from.
   *
   * The counts decide which categories may be deleted at all, and come as one grouped
   * query rather than a count per row.
   */
  useEffect(() => {
    if (!isFocused) return;
    loadCategories(db, { includeArchived: true }).catch((error) =>
      console.warn('Failed to load expense categories', error)
    );
  }, [db, isFocused, loadCategories]);

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    countExpensesByCategory(db)
      .then((counts) => {
        if (!cancelled) setExpenseCounts(counts);
      })
      .catch((error) => console.warn('Failed to count expenses by category', error));
    return () => {
      cancelled = true;
    };
  }, [db, isFocused]);

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

  // Collapsing the accordion empties the list rather than hiding a rendered one: the
  // habit rows are the FlatList's `data`, and keeping them mounted behind a closed
  // section would leave the section headers and the empty state to render around them.
  const rows: Row[] = !habitsExpanded ? [] : [
    ...activeHabits.map((habit, index) => ({
      kind: 'habit' as const,
      key: habit.id,
      habit,
      isFirst: index === 0,
      isLast: index === activeHabits.length - 1,
    })),
    // Same place as the categories' add button: under the active rows, above the
    // archive toggle. With no habits at all it moves under the empty state instead —
    // a row here would make `data` non-empty and keep that state from rendering.
    ...(habits.length > 0 ? [{ kind: 'add-habit' as const, key: 'add-habit' }] : []),
    ...(archivedHabits.length > 0
      ? [{ kind: 'archive-toggle' as const, key: 'archive-toggle-habits' }]
      : []),
    ...(showArchivedHabits
      ? archivedHabits.map((habit) => ({
          kind: 'habit' as const,
          key: habit.id,
          habit,
          isFirst: true,
          isLast: true,
        }))
      : []),
  ];

  /**
   * The categories accordion ends in an add button, and this is the habits' one. It is
   * rendered from two places — a list row when there are habits, and under the empty
   * state when there are none, since a FlatList shows either its data or its empty
   * component, never both.
   */
  const renderAddHabitButton = (style?: StyleProp<ViewStyle>) => (
    <Button
      title={t('settings_habits_add')}
      variant="secondary"
      onPress={() => router.push('/habit/new')}
      style={style}
    />
  );

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

  const activeCategories = categories.filter((category) => !category.archived_at);
  const archivedCategories = categories.filter((category) => category.archived_at);

  /**
   * Deletes a category, and says in the confirmation what will happen to the money in it.
   * An empty one goes straight out; one holding expenses hands them to "Прочее" first, so
   * nothing disappears from a past period's total — the count in the message comes from a
   * map read on focus, but the reassignment itself works off what is in SQL at the moment
   * of the delete, so a stale count only mislabels the prompt.
   *
   * Both paths reload the expenses store and re-read the counts: the expenses tab stays
   * mounted, and its rows carry the category id that just changed underneath them.
   */
  const confirmDeleteCategory = (category: ExpenseCategoryRow, count: number) => {
    const fallbackName = categoryName(FALLBACK_CATEGORY.name, t);
    const runDelete = async () => {
      try {
        if (count > 0) {
          await removeCategoryReassigning(db, category.id);
        } else {
          await removeCategory(db, category.id);
        }
        await reloadExpenses(db);
        setExpenseCounts(await countExpensesByCategory(db));
      } catch (error) {
        console.warn('Failed to delete expense category', error);
        Alert.alert(t('settings_category_delete_failed'), t('try_again'));
      }
    };

    Alert.alert(
      t('settings_category_delete_title', { name: categoryName(category.name, t) }),
      count > 0
        ? t('settings_category_delete_reassign_message', { fallback: fallbackName })
        : t('settings_category_delete_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => void runDelete() },
      ]
    );
  };

  const handleCategoryMenuAction = (category: ExpenseCategoryRow, count: number) => (id: string) => {
    switch (id) {
      case 'edit':
        router.push({ pathname: '/expense-category/[id]', params: { id: category.id } });
        break;
      case 'archive':
        archiveCategory(db, category.id).catch((error) =>
          console.warn('Failed to archive expense category', error)
        );
        break;
      case 'unarchive':
        unarchiveCategory(db, category.id).catch((error) =>
          console.warn('Failed to unarchive expense category', error)
        );
        break;
      case 'delete':
        confirmDeleteCategory(category, count);
        break;
    }
  };

  /**
   * The backup hint under the two data buttons. `hasData` keeps a fresh install quiet:
   * there is nothing to lose yet, and a warning on the first launch warns about an
   * emptiness the user can see. Expenses count as data as much as habits do, and their
   * counts are already on this screen for the delete rules, so this costs no query.
   */
  const hasData = habits.length > 0 || Object.values(expenseCounts).some((count) => count > 0);
  const backup = useMemo(
    () => backupStatus(lastExportAt, todayDate, hasData),
    [hasData, lastExportAt, todayDate]
  );

  const backupHint = useMemo(() => {
    switch (backup.kind) {
      case 'idle':
        return null;
      case 'never':
        return { text: t('settings_backup_never'), warn: true };
      default: {
        // With the year, unlike every other date in the app: this line is read precisely
        // when the last export is old enough to have happened in a different one.
        const date = format(parseDateKey(backup.date), 'd MMM yyyy', { locale });
        return backup.kind === 'stale'
          ? {
              text: t('settings_backup_stale', {
                date,
                count: backup.days,
                days: plural('days', backup.days),
              }),
              warn: true,
            }
          : { text: t('settings_backup_last', { date }), warn: false };
      }
    }
  }, [backup, locale, plural, t]);

  const handleExport = async () => {
    setBusy('export');
    try {
      await exportBackupAsync(db);
      // After the share sheet, and with its own catch: the export did happen, and a row
      // that failed to write must not be reported as a failed export.
      await markExported(db).catch((error) =>
        console.warn('Failed to record the export date', error)
      );
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
   * Every store is reloaded by hand, and so is the schedule: an import writes straight
   * to SQL, bypassing the repo mutations that the store actions wrap, so none of the
   * write-through reloads or the reminder recompute that normally follow a mutation
   * happen on their own. The entries store matters as much as the habits one — the
   * "Today" tab stays mounted and would keep displaying the marks of the replaced data
   * until its week changed — and from backup v2 on the same is true of the expense
   * tables, which a v2 file replaces as well.
   *
   * Preferences are re-read first: a file that carries them may switch the language, and
   * the reminder recompute at the end bakes the current one into every notification body.
   */
  const performImport = async (uri: string) => {
    setBusy('import');
    try {
      await importBackupAsync(db, uri);
      await loadSettings(db);
      await loadHabits(db, { includeArchived: true });
      await reloadEntries(db);
      await loadCategories(db, { includeArchived: true });
      await reloadExpenses(db);
      await scheduleAllReminders(db, { requestPermission: true }).catch((error) => {
        console.error('Failed to reschedule reminders after import', error);
      });
      setScheduledCount(await getScheduledCountAsync());
      // By hand, like the reminder count above it: the focus effect that owns this map
      // cannot re-fire during an import, and a stale count both mislabels every category
      // row and offers Delete on categories that now hold expenses. Its own catch, so a
      // failed count cannot report a successful import as failed.
      setExpenseCounts(
        await countExpensesByCategory(db).catch((error) => {
          console.warn('Failed to count expenses by category after import', error);
          return {};
        })
      );
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

  const handleMenuAction = (habit: HabitRow) => (id: string) => {
    switch (id) {
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
        contentContainerStyle={[
          styles.list,
          habitsExpanded && habits.length === 0 && styles.listEmpty,
        ]}
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

            {/* Under the language, above the data block: it is a preference like the two
                above it, and it changes nothing but how a number is written. The amounts
                themselves stay whole units of one unspoken currency — see money.ts. */}
            <View style={styles.group}>
              <Text variant="title2">{t('settings_currency')}</Text>
              <View style={styles.currencyRow}>
                <TextInput
                  value={currency.symbol}
                  // Written on every keystroke rather than on blur: the store applies the
                  // symbol synchronously, so the example below and every amount on the
                  // other tabs follow the field as it is typed — and a field that is at
                  // most three characters long cannot make this a chatty write. Leaving
                  // the screen is not an event a text field can be relied on to get.
                  onChangeText={(symbol) => {
                    setCurrency(db, { ...currency, symbol }).catch((error) =>
                      console.warn('Failed to save the currency symbol', error)
                    );
                  }}
                  placeholder={t('settings_currency_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  accessibilityLabel={t('settings_currency_symbol')}
                  // Scaled by hand like every other field in the app — RN would otherwise
                  // apply the system multiplier a second time on top of it.
                  allowFontScaling={false}
                  // The store normalizes anyway; this stops the field from showing a
                  // fourth character for the frame before it is taken back out.
                  maxLength={MAX_CURRENCY_SYMBOL_LENGTH}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.currencyInput,
                    { fontSize: inputFontSize },
                    {
                      backgroundColor: colors.surfaceAlt,
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.segmented,
                    styles.currencyPosition,
                    { backgroundColor: colors.surfaceAlt },
                  ]}>
                  {CURRENCY_POSITION_OPTIONS.map((option) => (
                    <Segment
                      key={option.position}
                      label={t(option.labelKey)}
                      isSelected={option.position === currency.position}
                      onPress={() => {
                        setCurrency(db, { ...currency, position: option.position }).catch(
                          (error) => console.warn('Failed to save the currency position', error)
                        );
                      }}
                    />
                  ))}
                </View>
              </View>
              <Text variant="caption" color={colors.textSecondary}>
                {t('settings_currency_hint', {
                  example: formatAmount(CURRENCY_EXAMPLE_AMOUNT, currency),
                })}
              </Text>
            </View>

            <View style={styles.group}>
              <Text variant="title2">{t('settings_data')}</Text>
              {/* Side by side, under one hint that names both: they are the two halves of
                  the same operation, and a paragraph each stacked them into a block taller
                  than every other group on the screen. */}
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
              <Text variant="caption" color={colors.textSecondary}>
                {t('settings_data_hint')}
              </Text>
              {backupHint ? (
                <Text
                  variant="caption"
                  color={backupHint.warn ? colors.warning : colors.textSecondary}
                >
                  {backupHint.text}
                </Text>
              ) : null}
            </View>

            {/* The habit rows are the FlatList's `data`, so nothing but this margin sits
                between the open header and the first one — the categories get the same
                step from the footer's own gap. */}
            <AccordionHeader
              title={t('settings_habits')}
              count={habits.length}
              expanded={habitsExpanded}
              onPress={() => setHabitsExpanded((value) => !value)}
              style={habitsExpanded ? styles.accordionOpen : undefined}
            />
          </View>
        }
        /**
         * The categories live in the footer rather than in `data`: the habit list has its
         * own empty state, and category rows in the same array would fill it and keep
         * "no habits yet" from ever showing. The list is short and bounded by hand —
         * the FlatList rule is about lists that grow with the data.
         */
        ListFooterComponent={
          <View style={styles.footer}>
            <AccordionHeader
              title={t('settings_categories')}
              count={categories.length}
              expanded={categoriesExpanded}
              onPress={() => setCategoriesExpanded((value) => !value)}
            />

            {categoriesExpanded ? (
              <>
                {activeCategories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    count={expenseCounts[category.id] ?? 0}
                    onPressAction={handleCategoryMenuAction(
                      category,
                      expenseCounts[category.id] ?? 0
                    )}
                  />
                ))}

                <Button
                  title={t('settings_categories_add')}
                  variant="secondary"
                  onPress={() => router.push('/expense-category/new')}
                />

                {archivedCategories.length > 0 ? (
                  <>
                    <ArchiveToggle
                      label={t('settings_categories_archive')}
                      count={archivedCategories.length}
                      expanded={showArchivedCategories}
                      onPress={() => setShowArchivedCategories((value) => !value)}
                    />

                    {showArchivedCategories
                      ? archivedCategories.map((category) => (
                          <CategoryRow
                            key={category.id}
                            category={category}
                            count={expenseCounts[category.id] ?? 0}
                            onPressAction={handleCategoryMenuAction(
                              category,
                              expenseCounts[category.id] ?? 0
                            )}
                          />
                        ))
                      : null}
                  </>
                ) : null}
              </>
            ) : null}

            {/* Last on the screen and deliberately so: a version number and a policy link
                are reference, not a setting. The link leaves the app, so it is a plain
                row rather than a button — nothing here changes state. */}
            <View style={styles.about}>
              <Text variant="title2">{t('settings_about')}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {t('settings_about_version', { version: APP_VERSION, build: APP_BUILD })}
              </Text>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={t('settings_about_privacy')}
                hitSlop={minHitSlop}
                onPress={() => {
                  // Opening an external browser can be refused (no handler, restricted
                  // device). Nothing on this screen depends on it, so it stays a warning.
                  Linking.openURL(PRIVACY_POLICY_URL[language]).catch((error) =>
                    console.warn('Failed to open the privacy policy', error)
                  );
                }}>
                <Text variant="body" color={colors.accent}>
                  {t('settings_about_privacy')}
                </Text>
              </PressableScale>
            </View>
          </View>
        }
        ListEmptyComponent={
          // Only inside the open accordion: a closed one has no rows either, and the
          // count on its header already says the list is empty.
          habitsExpanded && loaded && habits.length === 0 ? (
            <View style={styles.empty}>
              <EmptyState
                icon="list.bullet"
                title={t('empty_no_habits')}
                subtitle={t('settings_empty_subtitle')}
              />
              {renderAddHabitButton()}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === 'add-habit') {
            return renderAddHabitButton(styles.addHabitInList);
          }

          if (item.kind === 'archive-toggle') {
            return (
              <ArchiveToggle
                label={t('settings_archive')}
                count={archivedHabits.length}
                expanded={showArchivedHabits}
                onPress={() => setShowArchivedHabits((value) => !value)}
                style={styles.archiveToggleInList}
              />
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

              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('settings_habit_menu', { name: habit.name })}
                onPress={() =>
                  showActionSheet(
                    {
                      scheme,
                      cancelLabel: t('cancel'),
                      actions: isArchived
                        ? [
                            { id: 'edit', title: t('menu_edit') },
                            { id: 'unarchive', title: t('menu_unarchive') },
                            { id: 'delete', title: t('delete'), destructive: true },
                          ]
                        : [
                            { id: 'edit', title: t('menu_edit') },
                            { id: 'archive', title: t('menu_archive') },
                            { id: 'delete', title: t('delete'), destructive: true },
                          ],
                    },
                    handleMenuAction(habit)
                  )
                }
                style={[styles.moreButton, { backgroundColor: colors.surfaceAlt }]}>
                <SymbolView name="ellipsis" size={18} tintColor={colors.textPrimary} />
              </PressableScale>
            </View>
          );
        }}
      />
    </Screen>
  );
}

/**
 * The tappable title of a collapsible settings section. The count sits on the header so a
 * closed section still says how much is behind it — without it, "Привычки" folded shut
 * reads the same whether the user has ten habits or none.
 */
function AccordionHeader({
  title,
  count,
  expanded,
  onPress,
  style,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
      style={[
        styles.accordion,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}>
      {/* One step below the group titles above it: an accordion is a row that opens, not
          a heading, and at title2 the two shut sections shouted over the whole screen. */}
      <Text variant="callout" style={styles.accordionTitle}>
        {title}
      </Text>
      <Text variant="caption" color={colors.textSecondary}>
        {count}
      </Text>
      <SymbolView
        name={expanded ? 'chevron.up' : 'chevron.down'}
        size={14}
        tintColor={colors.textSecondary}
      />
    </PressableScale>
  );
}

/**
 * The tappable "Archive (N)" row shared by the habits list and the categories list: both
 * archives are collapsed by default and expand the same way, so one component keeps them
 * from drifting apart again. `style` carries the horizontal spacing, since the habits list
 * needs it on the row itself while the categories footer already supplies it as a
 * container padding.
 */
function ArchiveToggle({
  label,
  count,
  expanded,
  onPress,
  style,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      style={[styles.archiveHeader, style]}>
      <Text variant="caption" color={colors.textSecondary}>
        {`${label} (${count})`}
      </Text>
      <SymbolView
        name={expanded ? 'chevron.up' : 'chevron.down'}
        size={14}
        tintColor={colors.textSecondary}
      />
    </PressableScale>
  );
}

/**
 * One category in the settings list, laid out like a habit row minus the reorder arrows:
 * the order is fixed by `sort_order` at creation, and a category is not something the eye
 * scans down a screen the way it scans habits.
 *
 * Deletion is offered whatever the category holds: the expenses in it move to "Прочее"
 * rather than going with it, so money already spent stays in its period's total. The one
 * category that cannot be deleted while it holds expenses is "Прочее" itself — it is
 * where they would have to move to.
 */
function CategoryRow({
  category,
  count,
  onPressAction,
}: {
  category: ExpenseCategoryRow;
  count: number;
  onPressAction: (id: string) => void;
}) {
  const { colors, scheme } = useTheme();
  const { t, plural } = useI18n();
  const isArchived = category.archived_at !== null;
  const accentColor = resolveExpenseColor(category.color_key, scheme);

  const canDelete = count === 0 || category.name !== FALLBACK_CATEGORY.name;

  const actions: ActionSheetAction[] = [
    { id: 'edit', title: t('menu_edit') },
    isArchived
      ? { id: 'unarchive', title: t('menu_unarchive') }
      : { id: 'archive', title: t('menu_archive') },
    ...(canDelete ? [{ id: 'delete', title: t('delete'), destructive: true }] : []),
  ];

  return (
    <View style={[styles.categoryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <PressableScale
        onPress={() =>
          router.push({ pathname: '/expense-category/[id]', params: { id: category.id } })
        }
        accessibilityRole="button"
        accessibilityLabel={t('settings_edit_category', { name: categoryName(category.name, t) })}
        style={styles.main}>
        <View style={[styles.emoji, { backgroundColor: `${accentColor}33` }]}>
          <Text variant="headline">{category.emoji}</Text>
        </View>
        <View style={styles.info}>
          <Text variant="body" numberOfLines={1} color={isArchived ? colors.textSecondary : undefined}>
            {categoryName(category.name, t)}
          </Text>
          {isArchived ? (
            <Text variant="caption" color={colors.textTertiary}>
              {t('settings_archived_badge')}
            </Text>
          ) : null}
          {/* Unconditional, zero included: hiding the line on an empty category made
              every row in the list a different height, and the count is what says how
              much would move to "Прочее" if the row were deleted. */}
          <Text variant="caption" color={colors.textTertiary}>
            {t('settings_category_expenses', { count, expenses: plural('expenses', count) })}
          </Text>
        </View>
      </PressableScale>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('settings_category_menu', { name: categoryName(category.name, t) })}
        onPress={() =>
          showActionSheet({ scheme, cancelLabel: t('cancel'), actions }, onPressAction)
        }
        style={[styles.moreButton, { backgroundColor: colors.surfaceAlt }]}>
        <SymbolView name="ellipsis" size={18} tintColor={colors.textPrimary} />
      </PressableScale>
    </View>
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
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  currencyInput: {
    // Wide enough for three characters and the padding around them, and no wider: the
    // field is not where the eye should land in this row.
    width: 88,
    textAlign: 'center',
    minHeight: minHitSlop,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    // Body type from the tokens, minus its size and lineHeight — same reason as the
    // category form's name field.
    fontFamily,
    fontWeight: typography.body.fontWeight,
  },
  currencyPosition: {
    flex: 1,
  },
  dataButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dataButton: {
    // Equal halves of the row, whichever label is the longer of the two.
    flex: 1,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  listEmpty: {
    flexGrow: 1,
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
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    // Matches the gap between the groups in the header: with both accordions shut the
    // two headers sit one under the other and have to read as a pair, not as a section
    // and an afterthought.
    paddingTop: spacing.md,
  },
  about: {
    gap: spacing.sm,
    // The categories accordion sits directly above; without this the heading reads as
    // part of it rather than as a section of its own.
    paddingTop: spacing.lg,
  },
  accordion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accordionOpen: {
    marginBottom: spacing.sm,
  },
  accordionTitle: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  archiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: minHitSlop,
  },
  // Only needed in the habits FlatList: the categories footer already gives its rows
  // horizontal padding, but a FlatList row has none of its own.
  archiveToggleInList: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  addHabitInList: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  // The empty state keeps filling the list's height; the add button sits under it with
  // the same horizontal padding as every other row.
  empty: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  moreButton: {
    width: minHitSlop,
    height: minHitSlop,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
