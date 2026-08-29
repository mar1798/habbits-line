import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { resolveColorKey } from '@/constants/design-tokens';
import type { EntryRow, HabitRow } from '@/db/types';
import { isValidDateKey, isValidTimeOfDay } from '@/lib/date';

const BACKUP_VERSION = 1;

interface BackupFile {
  version: number;
  exportedAt: string;
  habits: HabitRow[];
  entries: EntryRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Values, not just types. Everything below the top level of this file is untrusted: a
 * hand-edited or foreign backup can carry a string of the right shape that no other
 * part of the app can survive — `2026-02-31` parses to an Invalid Date and makes the
 * streak walk throw, `reminder_time: "вечером"` becomes a NaN hour at scheduling time.
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

function isBackupFile(value: unknown): value is BackupFile {
  return (
    isRecord(value) &&
    typeof value.version === 'number' &&
    typeof value.exportedAt === 'string' &&
    Array.isArray(value.habits) &&
    value.habits.every(isHabitRow) &&
    Array.isArray(value.entries) &&
    value.entries.every(isEntryRow)
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

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    habits,
    entries,
  };

  // Checked before writing: there is no point leaving a file in the cache that nothing
  // can be done with.
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Отправка файлов недоступна на этом устройстве');
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
 * `withExclusiveTransactionAsync` opens its own connection (`useNewConnection: true`),
 * and `PRAGMA foreign_keys` is per-connection — it runs in `migrate()` on the main one
 * only. So neither the cascade nor the foreign key is in force inside this callback:
 * entries are deleted explicitly and before habits, and every entry's `habit_id` is
 * checked against the imported habits before the first write rather than left to a
 * constraint that is not being enforced here.
 */
export async function importBackupAsync(db: SQLiteDatabase, fileUri: string): Promise<void> {
  const file = new File(fileUri);
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Файл повреждён и не может быть прочитан');
  }

  // Version first, structure second. A file from a later build is expected to fail the
  // v1 row checks — it may carry columns and rules this build knows nothing about — so
  // validating shape first would report "формат не распознан" for the one case the
  // version field exists to explain.
  if (!isRecord(parsed) || typeof parsed.version !== 'number') {
    throw new Error('Формат файла не распознан');
  }

  if (!isReadableVersion(parsed.version)) {
    throw new Error(
      `Файл сохранён в формате версии ${parsed.version}, это приложение читает до ${BACKUP_VERSION}`
    );
  }

  if (!isBackupFile(parsed)) {
    throw new Error('Формат файла не распознан');
  }

  const habitIds = new Set(parsed.habits.map((habit) => habit.id));
  if (parsed.entries.some((entry) => !habitIds.has(entry.habit_id))) {
    throw new Error('Файл повреждён: есть записи для несуществующей привычки');
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
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
  });
}
