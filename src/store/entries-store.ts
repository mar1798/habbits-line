import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as entriesRepo from '@/db/entries-repo';

interface EntriesState {
  /** date -> habitId -> count, for the currently loaded week only. */
  counts: Record<string, Record<string, number>>;
  /**
   * The same week exactly as it came out of the database, never patched by a tap. The
   * "Today" screen lists a habit on a day it predates when that day has progress on it —
   * read from `counts`, that test flips the moment the count is cycled back to 0, and the
   * habit vanishes from the day with no way to put the mark back. Read from here it holds
   * for as long as the week stays loaded.
   */
  loadedCounts: Record<string, Record<string, number>>;
  loaded: boolean;
  /** Range of the last loadWeek(), replayed by reload(). */
  range: { from: string; to: string } | null;
  loadWeek: (db: SQLiteDatabase, from: string, to: string) => Promise<void>;
  reload: (db: SQLiteDatabase) => Promise<void>;
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
  loadedCounts: {},
  loaded: false,
  range: null,

  /**
   * A failed read is reset to the pre-load state rather than left as it lies: the cells
   * of a week that could not be read would otherwise draw as unmarked, and the next tap
   * on one would write a 1 over a count that is really there. `loaded` back at false is
   * what the "Today" screen reads to keep the day non-editable until a read lands.
   */
  loadWeek: async (db, from, to) => {
    try {
      const rows = await entriesRepo.listEntriesInRange(db, from, to);
      const counts: Counts = {};
      for (const row of rows) {
        (counts[row.date] ??= {})[row.habit_id] = row.count;
      }
      // Both hold the same object: `patch` never mutates, so every later tap replaces
      // `counts` and leaves this reference on the week as it was read.
      set({ counts, loadedCounts: counts, loaded: true, range: { from, to } });
    } catch (error) {
      set({ counts: {}, loadedCounts: {}, loaded: false, range: null });
      throw error;
    }
  },

  /**
   * Re-reads the currently visible range from the database. Needed after a write that
   * bypassed this store — an import replaces every row in `entries`, and the "Today"
   * tab stays mounted, so its effect on `week` would not re-fire: without this the
   * screen would keep showing the marks of the data that was just thrown away.
   */
  reload: async (db) => {
    const range = get().range;
    if (!range) return;
    await get().loadWeek(db, range.from, range.to);
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
   *
   * The rollback is conditional and the error is rethrown. Conditional, because a tap
   * that landed while this write was failing owns the cell now — restoring `previous`
   * over it would throw away a mark that did save. Rethrown, because a mark that was
   * shown and then quietly sprang back is the one failure the user has to be told
   * about; the caller turns it into an alert.
   */
  cycle: async (db, habitId, date, target) => {
    const previous = get().counts[date]?.[habitId] ?? 0;
    const next = previous >= target ? 0 : previous + 1;
    set((state) => ({ counts: patch(state.counts, date, habitId, next) }));

    try {
      await entriesRepo.setEntryCount(db, habitId, date, next);
    } catch (error) {
      if ((get().counts[date]?.[habitId] ?? 0) === next) {
        set((state) => ({ counts: patch(state.counts, date, habitId, previous) }));
      }
      throw error;
    }
  },
}));
