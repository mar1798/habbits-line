import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as settingsRepo from '@/db/settings-repo';

/** 'system' follows the OS appearance; the other two override it. */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const THEME_MODE_KEY = 'theme_mode';

/** Anything else in the row (older build, hand-edited file) falls back to following the OS. */
function parseThemeMode(value: string | null): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : 'system';
}

interface SettingsState {
  themeMode: ThemeMode;
  loaded: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  setThemeMode: (db: SQLiteDatabase, mode: ThemeMode) => Promise<void>;
}

/**
 * App-wide preferences kept in `app_settings`. Unlike the habits and entries stores this
 * one is read once at launch: nothing else writes the row, so there is no reload to
 * write through to.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  loaded: false,

  load: async (db) => {
    const stored = await settingsRepo.getSetting(db, THEME_MODE_KEY);
    set({ themeMode: parseThemeMode(stored), loaded: true });
  },

  // Applied before the write, not after: repainting the whole app is what the tap is
  // for, and waiting on SQLite would leave the segmented control lagging a frame or two
  // behind the finger.
  setThemeMode: async (db, mode) => {
    set({ themeMode: mode });
    await settingsRepo.setSetting(db, THEME_MODE_KEY, mode);
  },
}));
