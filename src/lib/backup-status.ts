import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';

import { isValidDateKey, parseDateKey } from './date';

/**
 * `app_settings` row holding the date key of the last successful export.
 *
 * Lives here rather than in lib/backup.ts so the settings store can read it without
 * pulling the share sheet and the document picker into its module graph, and so the
 * rule that interprets the row sits next to the name of the row it interprets.
 */
export const LAST_EXPORT_AT_KEY = 'last_export_at';

/**
 * How long a backup is allowed to age before settings starts asking for a new one.
 *
 * A month, not a week: the export is a manual share-sheet trip, and a hint that turns
 * red faster than the user is willing to act on it is a hint they learn to look past.
 */
export const BACKUP_STALE_AFTER_DAYS = 30;

/**
 * `idle` — nothing has been exported and there is nothing to lose yet, so settings says
 * nothing at all. The other three all show a line; only `stale` and `never` warn.
 */
export type BackupStatus =
  | { kind: 'idle' }
  | { kind: 'never' }
  | { kind: 'fresh'; date: string; days: number }
  | { kind: 'stale'; date: string; days: number };

/**
 * What the settings screen should say about the last export.
 *
 * `lastExportAt` is a date key written by a successful export, and like every other row
 * of `app_settings` it is untrusted on the way in: an older build, a hand-edited backup
 * or a file from another device can put anything there. Anything that is not a real
 * calendar day is read as "never exported" rather than thrown — a broken row must not
 * take the settings screen down, and nagging for a backup is the safe direction to fail.
 *
 * A key in the future — a device whose clock was moved back, or a backup carried over
 * from a phone set a day ahead — counts as zero days old rather than a negative age.
 */
export function backupStatus(
  lastExportAt: string | null,
  todayDate: string,
  hasData: boolean
): BackupStatus {
  if (lastExportAt === null || !isValidDateKey(lastExportAt)) {
    return hasData ? { kind: 'never' } : { kind: 'idle' };
  }

  const days = Math.max(
    0,
    differenceInCalendarDays(parseDateKey(todayDate), parseDateKey(lastExportAt))
  );

  return {
    kind: days > BACKUP_STALE_AFTER_DAYS ? 'stale' : 'fresh',
    date: lastExportAt,
    days,
  };
}
