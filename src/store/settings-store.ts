import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as settingsRepo from '@/db/settings-repo';
import { parseLanguage, type Language, DEFAULT_LANGUAGE } from '@/i18n';
import { LAST_EXPORT_AT_KEY } from '@/lib/backup-status';
import { todayKey } from '@/lib/date';
import {
  DEFAULT_CURRENCY_POSITION,
  DEFAULT_CURRENCY_SYMBOL,
  normalizeCurrencySymbol,
  parseCurrencyPosition,
  type Currency,
} from '@/lib/money';
import { clampPeriodStartDay, DEFAULT_PERIOD_START_DAY, parsePeriodStartDay } from '@/lib/period';

/** 'system' follows the OS appearance; the other two override it. */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const THEME_MODE_KEY = 'theme_mode';
const LANGUAGE_KEY = 'language';
const PERIOD_START_DAY_KEY = 'expense_period_start_day';
const CURRENCY_SYMBOL_KEY = 'currency_symbol';
const CURRENCY_POSITION_KEY = 'currency_position';

/** Anything else in the row (older build, hand-edited file) falls back to following the OS. */
function parseThemeMode(value: string | null): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : 'system';
}

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  /** Day of month an expense period opens on, 1..28. */
  periodStartDay: number;
  /**
   * The symbol printed beside every amount and the side it goes on. An empty symbol is a
   * real setting, not a missing one: it is the bare number the app showed before there
   * was a symbol at all.
   */
  currency: Currency;
  /**
   * Date key of the last successful export, or null if there has never been one. Read
   * as-is — `backupStatus` is what decides whether the value is a usable day.
   */
  lastExportAt: string | null;
  loaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  setThemeMode: (db: SQLiteDatabase, mode: ThemeMode) => Promise<void>;
  setLanguage: (db: SQLiteDatabase, language: Language) => Promise<void>;
  setPeriodStartDay: (db: SQLiteDatabase, day: number) => Promise<void>;
  setCurrency: (db: SQLiteDatabase, currency: Currency) => Promise<void>;
  markExported: (db: SQLiteDatabase) => Promise<void>;
}

/**
 * App-wide preferences kept in `app_settings`. Unlike the habits and entries stores this
 * one is read once at launch: nothing else writes the rows, so there is no reload to
 * write through to.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: 'system',
  language: DEFAULT_LANGUAGE,
  periodStartDay: DEFAULT_PERIOD_START_DAY,
  currency: { symbol: DEFAULT_CURRENCY_SYMBOL, position: DEFAULT_CURRENCY_POSITION },
  lastExportAt: null,
  loaded: false,

  load: async (db) => {
    const [
      storedTheme,
      storedLanguage,
      storedPeriodStartDay,
      storedCurrencySymbol,
      storedCurrencyPosition,
      storedLastExportAt,
    ] = await Promise.all([
      settingsRepo.getSetting(db, THEME_MODE_KEY),
      settingsRepo.getSetting(db, LANGUAGE_KEY),
      settingsRepo.getSetting(db, PERIOD_START_DAY_KEY),
      settingsRepo.getSetting(db, CURRENCY_SYMBOL_KEY),
      settingsRepo.getSetting(db, CURRENCY_POSITION_KEY),
      settingsRepo.getSetting(db, LAST_EXPORT_AT_KEY),
    ]);
    set({
      themeMode: parseThemeMode(storedTheme),
      language: parseLanguage(storedLanguage),
      periodStartDay: parsePeriodStartDay(storedPeriodStartDay),
      // A missing row is the default symbol; an empty stored one is the user's own
      // "no symbol" and must survive the next launch.
      currency: {
        symbol:
          storedCurrencySymbol === null
            ? DEFAULT_CURRENCY_SYMBOL
            : normalizeCurrencySymbol(storedCurrencySymbol),
        position: parseCurrencyPosition(storedCurrencyPosition),
      },
      lastExportAt: storedLastExportAt,
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
      // Imported here rather than at the top of the file: lib/notifications.ts reads the
      // language back out of this store, and a static import in both directions is a
      // require cycle Metro warns about on every launch. By the time a language is
      // switched both modules are long since evaluated, so the lazy edge costs nothing.
      const notifications = await import('@/lib/notifications');
      await notifications.scheduleAllReminders(db);
    } catch (error) {
      console.error('Failed to reschedule reminders after a language change', error);
    }
  },

  /**
   * The start day is not versioned, exactly like a habit's schedule and target: moving it
   * recomputes the boundaries of the whole history. Budget rows whose `period_start` no
   * longer opens a period are neither deleted nor shown; a later period still inherits
   * them, since inheritance looks for the last row *before* a period rather than an exact
   * match, and the current period gets its amount rewritten at its new start by the modal
   * that moved the day — see `resolveBudget` and `budget.tsx`.
   *
   * Clamped on the way in as well as on the way out: 1..28 is a rule of the period
   * arithmetic, not of the picker that happens to be the only caller today.
   *
   * Applied before the write like the two above, but rolled back if the write fails —
   * and unlike a theme, this one moves every period boundary in the app. Left applied
   * over a failed write it would show budgets and totals for periods the database knows
   * nothing about, until a restart quietly put them all back.
   */
  setPeriodStartDay: async (db, day) => {
    const clamped = clampPeriodStartDay(day);
    const previous = get().periodStartDay;
    set({ periodStartDay: clamped });

    try {
      await settingsRepo.setSetting(db, PERIOD_START_DAY_KEY, String(clamped));
    } catch (error) {
      set({ periodStartDay: previous });
      throw error;
    }
  },

  /**
   * The symbol and its side, written as two rows and applied before the write like the
   * theme above — every amount in the app repaints, and waiting on SQLite would leave the
   * field the user is typing in a frame behind.
   *
   * Rolled back on a failed write, for the reason the start day is: the number on the card
   * would otherwise carry a symbol the database knows nothing about until a restart
   * quietly took it away. Normalized on the way in as well as in the field, so the store
   * never holds a symbol `formatAmount` would print with a space in it.
   */
  setCurrency: async (db, currency) => {
    const next: Currency = {
      symbol: normalizeCurrencySymbol(currency.symbol),
      position: currency.position,
    };
    const previous = get().currency;
    set({ currency: next });

    try {
      await settingsRepo.setSetting(db, CURRENCY_SYMBOL_KEY, next.symbol);
      await settingsRepo.setSetting(db, CURRENCY_POSITION_KEY, next.position);
    } catch (error) {
      set({ currency: previous });
      throw error;
    }
  },

  /**
   * Stamps today onto the backup hint. Called after the share sheet is done with, not
   * before it opens: an export that never produced a file must not reset the reminder.
   *
   * The share sheet cannot tell us whether the file was actually saved somewhere — a
   * cancelled sheet resolves exactly like a saved one — so this is as close to "there is
   * a backup" as the app can get. Erring towards silence on a cancel would be worse: the
   * user did open the sheet, and a hint that keeps warning after a real export is the
   * one that gets ignored.
   *
   * `todayKey()`, not the file's `exportedAt`: that field is a UTC instant, and the hint
   * counts local days.
   */
  markExported: async (db) => {
    const key = todayKey();
    set({ lastExportAt: key });
    await settingsRepo.setSetting(db, LAST_EXPORT_AT_KEY, key);
  },
}));
