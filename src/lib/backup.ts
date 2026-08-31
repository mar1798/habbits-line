import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { resolveColorKey, resolveExpenseColorKey } from '@/constants/design-tokens';
import type {
  AppSettingRow,
  EntryRow,
  ExpenseBudgetRow,
  ExpenseCategoryRow,
  ExpenseRow,
  HabitRow,
} from '@/db/types';
import type { MessageParams } from '@/i18n';
import { isValidDateKey, isValidTimeOfDay } from '@/lib/date';

/**
 * v2 added the three expense tables. It is a superset of v1, not a replacement: a v1
 * file is still readable and still restores what it holds — see `importBackupAsync`
 * for what that means for the tables it says nothing about.
 */
export const BACKUP_VERSION = 2;

/** The first version whose files carry the expense tables. */
const EXPENSES_SINCE_VERSION = 2;

/**
 * Why a code and not a message: this module has no language of its own. It runs outside
 * the component tree and its failures are shown by whatever screen called it, so putting
 * a finished sentence in `Error.message` would leave exactly one place the language
 * never reaches — and one that is only noticed on someone else's device.
 */
export type BackupErrorCode =
  | 'sharing_unavailable'
  | 'malformed_file'
  | 'unrecognized_format'
  | 'unsupported_version'
  | 'orphan_entries'
  | 'orphan_expenses';

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  /** Values for the message's placeholders — `unsupported_version` carries the versions. */
  readonly params?: MessageParams;

  constructor(code: BackupErrorCode, params?: MessageParams) {
    // The message is for the console only; the UI translates `code`.
    super(`Backup failed: ${code}`);
    this.name = 'BackupError';
    this.code = code;
    this.params = params;
  }
}

interface BackupFile {
  version: number;
  exportedAt: string;
  habits: HabitRow[];
  entries: EntryRow[];
  /** The three below are absent in a v1 file and always present from v2 on. */
  expense_categories?: ExpenseCategoryRow[];
  expenses?: ExpenseRow[];
  expense_budgets?: ExpenseBudgetRow[];
  /**
   * `app_settings`, optional at every version rather than tied to one: it was added to
   * the format after v2 files were already being written, and a file without it is not
   * broken — it simply says nothing about preferences, which the import then leaves alone.
   *
   * Worth carrying at all because one of these rows is not a preference: the period start
   * day moves every expense period boundary, and budgets are keyed by the period start it
   * produces. Restored without it, a backup's budgets land on periods that no longer open
   * on those days.
   */
  settings?: AppSettingRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isRowArray<T>(value: unknown, isRow: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(isRow);
}

/**
 * Values, not just types. Everything below the top level of this file is untrusted: a
 * hand-edited or foreign backup can carry a string of the right shape that no other
 * part of the app can survive — `2026-02-31` parses to an Invalid Date and makes the
 * streak walk throw, `reminder_time: "evening"` becomes a NaN hour at scheduling time.
 * The database has no CHECK for either, so this is the only place that can refuse them.
 */
function isNullableTimeOfDay(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && isValidTimeOfDay(value));
}

function isHabitRow(value: unknown): value is HabitRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.emoji === 'string' &&
    typeof value.color_key === 'string' &&
    Number.isInteger(value.target_per_day) &&
    (value.target_per_day as number) >= 1 &&
    Number.isInteger(value.schedule_mask) &&
    (value.schedule_mask as number) > 0 &&
    (value.schedule_mask as number) <= 127 &&
    isNullableTimeOfDay(value.reminder_time) &&
    Number.isInteger(value.sort_order) &&
    isNullableString(value.archived_at) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

function isEntryRow(value: unknown): value is EntryRow {
  return (
    isRecord(value) &&
    typeof value.habit_id === 'string' &&
    typeof value.date === 'string' &&
    isValidDateKey(value.date) &&
    Number.isInteger(value.count) &&
    (value.count as number) > 0 &&
    typeof value.updated_at === 'string'
  );
}

function isExpenseCategoryRow(value: unknown): value is ExpenseCategoryRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.emoji === 'string' &&
    typeof value.color_key === 'string' &&
    Number.isInteger(value.sort_order) &&
    isNullableString(value.archived_at) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

/** `amount` mirrors the table's CHECK: a positive integer of minor units. */
function isExpenseRow(value: unknown): value is ExpenseRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.category_id === 'string' &&
    Number.isInteger(value.amount) &&
    (value.amount as number) > 0 &&
    typeof value.date === 'string' &&
    isValidDateKey(value.date) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

function isExpenseBudgetRow(value: unknown): value is ExpenseBudgetRow {
  return (
    isRecord(value) &&
    typeof value.period_start === 'string' &&
    isValidDateKey(value.period_start) &&
    Number.isInteger(value.amount) &&
    (value.amount as number) > 0 &&
    typeof value.updated_at === 'string'
  );
}

function isAppSettingRow(value: unknown): value is AppSettingRow {
  return isRecord(value) && typeof value.key === 'string' && typeof value.value === 'string';
}

/**
 * The expense arrays are checked only from v2 on: a v1 file predates them and is a
 * valid file without them. From v2 they are part of the format and must be there —
 * empty arrays included, since "no expenses" and "nothing said about expenses" mean
 * different things to the import.
 */
function isBackupFile(value: unknown): value is BackupFile {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    typeof value.exportedAt !== 'string' ||
    !isRowArray(value.habits, isHabitRow) ||
    !isRowArray(value.entries, isEntryRow)
  ) {
    return false;
  }

  // Optional at every version, so it is checked when present and skipped when not.
  if (value.settings !== undefined && !isRowArray(value.settings, isAppSettingRow)) {
    return false;
  }

  if (value.version < EXPENSES_SINCE_VERSION) {
    return true;
  }

  return (
    isRowArray(value.expense_categories, isExpenseCategoryRow) &&
    isRowArray(value.expenses, isExpenseRow) &&
    isRowArray(value.expense_budgets, isExpenseBudgetRow)
  );
}

/**
 * The `version` field is the whole point of carrying one: a file written by a later
 * build may hold columns and rules this build knows nothing about, and importing it
 * as if it were v1 would silently drop them. Read what we understand, refuse the rest.
 */
function isReadableVersion(version: number): boolean {
  return Number.isInteger(version) && version >= 1 && version <= BACKUP_VERSION;
}

/** Writes the full database to a JSON file in cache and opens the share sheet for it. */
export async function exportBackupAsync(db: SQLiteDatabase): Promise<void> {
  const habits = await db.getAllAsync<HabitRow>('SELECT * FROM habits ORDER BY sort_order ASC');
  const entries = await db.getAllAsync<EntryRow>('SELECT * FROM entries');
  const expenseCategories = await db.getAllAsync<ExpenseCategoryRow>(
    'SELECT * FROM expense_categories ORDER BY sort_order ASC'
  );
  const expenses = await db.getAllAsync<ExpenseRow>('SELECT * FROM expenses');
  const expenseBudgets = await db.getAllAsync<ExpenseBudgetRow>('SELECT * FROM expense_budgets');
  const settings = await db.getAllAsync<AppSettingRow>('SELECT * FROM app_settings');

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    entries,
    expense_categories: expenseCategories,
    expenses,
    expense_budgets: expenseBudgets,
    settings,
  };

  // Checked before writing: there is no point leaving a file in the cache that nothing
  // can be done with.
  if (!(await Sharing.isAvailableAsync())) {
    throw new BackupError('sharing_unavailable');
  }

  // Dated, not timestamped: the name is what the user sees in the share sheet, and
  // overwriting today's file keeps a tap-happy afternoon from filling the cache with
  // near-identical copies.
  const file = new File(Paths.cache, `habits-backup-${backup.exportedAt.slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(JSON.stringify(backup, null, 2));

  await Sharing.shareAsync(file.uri, {
    UTI: 'public.json',
    mimeType: 'application/json',
  });
}

/** Opens the system document picker. Returns the picked file's URI, or null if cancelled. */
export async function pickBackupFileAsync(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled) {
    return null;
  }
  return result.assets[0].uri;
}

/**
 * Restores the database from a backup file — a full replace, not a merge. Runs inside
 * one exclusive transaction so a bad or truncated file rolls back cleanly instead of
 * leaving habits and entries out of sync.
 *
 * A v1 file replaces habits and entries and leaves the three expense tables untouched.
 * It was written by a build that did not know money existed, so wiping the expenses it
 * cannot restore would destroy data on the strength of a file that never claimed to
 * hold it. A v2 file replaces all six tables, empty arrays included. `settings` follows
 * the same rule on its own: present, it replaces `app_settings`; absent, the preferences
 * on this device are left as they are.
 *
 * `withExclusiveTransactionAsync` opens its own connection (`useNewConnection: true`),
 * and `PRAGMA foreign_keys` is per-connection — it runs in `migrate()` on the main one
 * only. So neither the cascade nor the foreign key is in force inside this callback:
 * children are deleted explicitly and before their parents, and every entry's `habit_id`
 * and every expense's `category_id` is checked against the imported parents before the
 * first write rather than left to a constraint that is not being enforced here.
 */
export async function importBackupAsync(db: SQLiteDatabase, fileUri: string): Promise<void> {
  const file = new File(fileUri);
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('malformed_file');
  }

  // Version first, structure second. A file from a later build is expected to fail the
  // row checks — it may carry columns and rules this build knows nothing about — so
  // validating shape first would report "unrecognized format" for the one case the
  // version field exists to explain.
  if (!isRecord(parsed) || typeof parsed.version !== 'number') {
    throw new BackupError('unrecognized_format');
  }

  if (!isReadableVersion(parsed.version)) {
    throw new BackupError('unsupported_version', {
      version: parsed.version,
      supported: BACKUP_VERSION,
    });
  }

  if (!isBackupFile(parsed)) {
    throw new BackupError('unrecognized_format');
  }

  const habitIds = new Set(parsed.habits.map((habit) => habit.id));
  if (parsed.entries.some((entry) => !habitIds.has(entry.habit_id))) {
    throw new BackupError('orphan_entries');
  }

  const restoresExpenses = parsed.version >= EXPENSES_SINCE_VERSION;
  const categories = parsed.expense_categories ?? [];
  const expenses = parsed.expenses ?? [];
  const budgets = parsed.expense_budgets ?? [];

  if (restoresExpenses) {
    const categoryIds = new Set(categories.map((category) => category.id));
    if (expenses.some((expense) => !categoryIds.has(expense.category_id))) {
      throw new BackupError('orphan_expenses');
    }
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    if (parsed.settings !== undefined) {
      await txn.execAsync('DELETE FROM app_settings;');
      for (const setting of parsed.settings) {
        await txn.runAsync(
          'INSERT INTO app_settings (key, value) VALUES (?, ?)',
          setting.key,
          setting.value
        );
      }
    }

    if (restoresExpenses) {
      await txn.execAsync(
        'DELETE FROM expenses; DELETE FROM expense_budgets; DELETE FROM expense_categories;'
      );
    }
    await txn.execAsync('DELETE FROM entries; DELETE FROM habits;');

    for (const habit of parsed.habits) {
      await txn.runAsync(
        `INSERT INTO habits
          (id, name, emoji, color_key, target_per_day, schedule_mask, reminder_time, sort_order, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        habit.id,
        habit.name,
        habit.emoji,
        resolveColorKey(habit.color_key),
        habit.target_per_day,
        habit.schedule_mask,
        habit.reminder_time,
        habit.sort_order,
        habit.archived_at,
        habit.created_at,
        habit.updated_at
      );
    }

    for (const entry of parsed.entries) {
      await txn.runAsync(
        'INSERT INTO entries (habit_id, date, count, updated_at) VALUES (?, ?, ?, ?)',
        entry.habit_id,
        entry.date,
        entry.count,
        entry.updated_at
      );
    }

    if (!restoresExpenses) {
      return;
    }

    for (const category of categories) {
      await txn.runAsync(
        `INSERT INTO expense_categories
          (id, name, emoji, color_key, sort_order, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        category.id,
        category.name,
        category.emoji,
        resolveExpenseColorKey(category.color_key),
        category.sort_order,
        category.archived_at,
        category.created_at,
        category.updated_at
      );
    }

    for (const expense of expenses) {
      await txn.runAsync(
        `INSERT INTO expenses (id, category_id, amount, date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        expense.id,
        expense.category_id,
        expense.amount,
        expense.date,
        expense.created_at,
        expense.updated_at
      );
    }

    for (const budget of budgets) {
      await txn.runAsync(
        'INSERT INTO expense_budgets (period_start, amount, updated_at) VALUES (?, ?, ?)',
        budget.period_start,
        budget.amount,
        budget.updated_at
      );
    }
  });
}
