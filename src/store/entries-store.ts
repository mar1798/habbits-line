import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as entriesRepo from '@/db/entries-repo';

interface EntriesState {
  /** date -> habitId -> count, for the currently loaded week only. */
  counts: Record<string, Record<string, number>>;
  loaded: boolean;
  loadWeek: (db: SQLiteDatabase, from: string, to: string) => Promise<void>;
  setCount: (db: SQLiteDatabase, habitId: string, date: string, count: number) => Promise<void>;
  cycle: (db: SQLiteDatabase, habitId: string, date: string, target: number) => Promise<void>;
}

type Counts = EntriesState['counts'];

/** Replaces one (date, habit) cell; a count of 0 drops it, mirroring the empty row in SQL. */
function patch(counts: Counts, date: string, habitId: string, count: number): Counts {
  const dayCounts = { ...counts[date] };
  if (count > 0) {
    dayCounts[habitId] = count;
  } else {
    delete dayCounts[habitId];
  }
  return { ...counts, [date]: dayCounts };
}

/**
 * Caches one visible week of entries; the screen resets it by calling loadWeek with a
 * new range whenever the week changes. Each tap writes through the repo and then
 * patches just its (date, habit) slice, rather than reloading the whole range —
 * unlike the habits store, this runs on every tap and a full reload would be wasteful.
 */
export const useEntriesStore = create<EntriesState>((set, get) => ({
  counts: {},
  loaded: false,

  loadWeek: async (db, from, to) => {
    const rows = await entriesRepo.listEntriesInRange(db, from, to);
    const counts: Counts = {};
    for (const row of rows) {
      (counts[row.date] ??= {})[row.habit_id] = row.count;
    }
    set({ counts, loaded: true });
  },

  setCount: async (db, habitId, date, count) => {
    await entriesRepo.setEntryCount(db, habitId, date, count);
    set((state) => ({ counts: patch(state.counts, date, habitId, count) }));
  },

  /**
   * One tap of the check button: 0 -> 1 -> … -> target -> 0.
   *
   * The next value is read from the store and applied synchronously, before the write
   * is awaited. Deriving it in the component instead loses a tap whenever two presses
   * land inside one pending write: both read the same pre-tap count and the second
   * write repeats the first. On failure the cell rolls back to what it showed before.
   */
  cycle: async (db, habitId, date, target) => {
    const previous = get().counts[date]?.[habitId] ?? 0;
    const next = previous >= target ? 0 : previous + 1;
    set((state) => ({ counts: patch(state.counts, date, habitId, next) }));

    try {
      await entriesRepo.setEntryCount(db, habitId, date, next);
    } catch (error) {
      set((state) => ({ counts: patch(state.counts, date, habitId, previous) }));
      console.warn('Failed to save entry', error);
    }
  },
}));
