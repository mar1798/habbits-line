import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as settingsRepo from '@/db/settings-repo';
import { parseLanguage, type Language, DEFAULT_LANGUAGE } from '@/i18n';
import * as notifications from '@/lib/notifications';
import { clampPeriodStartDay, DEFAULT_PERIOD_START_DAY, parsePeriodStartDay } from '@/lib/period';

/** 'system' follows the OS appearance; the other two override it. */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const THEME_MODE_KEY = 'theme_mode';
const LANGUAGE_KEY = 'language';
const PERIOD_START_DAY_KEY = 'expense_period_start_day';

/** Anything else in the row (older build, hand-edited file) falls back to following the OS. */
function parseThemeMode(value: string | null): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : 'system';
}

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  /** Day of month an expense period opens on, 1..28. */
  periodStartDay: number;
  loaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  setThemeMode: (db: SQLiteDatabase, mode: ThemeMode) => Promise<void>;
  setLanguage: (db: SQLiteDatabase, language: Language) => Promise<void>;
  setPeriodStartDay: (db: SQLiteDatabase, day: number) => Promise<void>;
}

/**
 * App-wide preferences kept in `app_settings`. Unlike the habits and entries stores this
 * one is read once at launch: nothing else writes the rows, so there is no reload to
 * write through to.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  language: DEFAULT_LANGUAGE,
  periodStartDay: DEFAULT_PERIOD_START_DAY,
  loaded: false,

  load: async (db) => {
    const [storedTheme, storedLanguage, storedPeriodStartDay] = await Promise.all([
      settingsRepo.getSetting(db, THEME_MODE_KEY),
      settingsRepo.getSetting(db, LANGUAGE_KEY),
      settingsRepo.getSetting(db, PERIOD_START_DAY_KEY),
    ]);
    set({
      themeMode: parseThemeMode(storedTheme),
      language: parseLanguage(storedLanguage),
      periodStartDay: parsePeriodStartDay(storedPeriodStartDay),
      loaded: true,
    });
  },

  // Applied before the write, not after: repainting the whole app is what the tap is
  // for, and waiting on SQLite would leave the segmented control lagging a frame or two
  // behind the finger.
  setThemeMode: async (db, mode) => {
    set({ themeMode: mode });
    await settingsRepo.setSetting(db, THEME_MODE_KEY, mode);
  },

  /**
   * Same immediate repaint as the theme, plus a full reminder recompute: a notification's
   * body is baked into the trigger when it is scheduled, so already-scheduled reminders
   * would keep arriving in the old language until the habit was next edited. The
   * recompute is the same one every habit mutation runs, under the same mutex.
   *
   * Its failure is logged rather than propagated — the language did change, and the
   * caller must not see the switch itself as failed.
   */
  setLanguage: async (db, language) => {
    set({ language });
    await settingsRepo.setSetting(db, LANGUAGE_KEY, language);
    try {
      await notifications.scheduleAllReminders(db);
    } catch (error) {
      console.error('Failed to reschedule reminders after a language change', error);
    }
  },

  /**
   * The start day is not versioned, exactly like a habit's schedule and target: moving it
   * recomputes the boundaries of the whole history. Budget rows whose `period_start` no
   * longer opens a period are neither deleted nor shown, but they are not lost either —
   * inheritance finds them, because it looks for the last row *before* a period rather
   * than an exact match.
   *
   * Clamped on the way in as well as on the way out: 1..28 is a rule of the period
   * arithmetic, not of the picker that happens to be the only caller today.
   */
  setPeriodStartDay: async (db, day) => {
    const clamped = clampPeriodStartDay(day);
    set({ periodStartDay: clamped });
    await settingsRepo.setSetting(db, PERIOD_START_DAY_KEY, String(clamped));
  },
}));
