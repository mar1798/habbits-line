import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as habitsRepo from '@/db/habits-repo';
import type { HabitRow } from '@/db/types';

interface HabitsState {
  habits: HabitRow[];
  loaded: boolean;
  /** Scope of the last load(), reused by every write-through reload. */
  includeArchived: boolean;
  load: (db: SQLiteDatabase, options?: { includeArchived?: boolean }) => Promise<void>;
  reload: (db: SQLiteDatabase) => Promise<void>;
  create: (db: SQLiteDatabase, input: habitsRepo.HabitInput) => Promise<HabitRow>;
  update: (db: SQLiteDatabase, id: string, input: habitsRepo.HabitInput) => Promise<void>;
  archive: (db: SQLiteDatabase, id: string) => Promise<void>;
  unarchive: (db: SQLiteDatabase, id: string) => Promise<void>;
  remove: (db: SQLiteDatabase, id: string) => Promise<void>;
}

/**
 * Store is the UI's source of truth, the database is for persistence: every mutation
 * writes through the repo and then reloads the list from it, rather than mutating
 * local state — sort_order and defaults (e.g. new habit's position) are computed in
 * SQL, so re-reading is the only way to stay correct.
 *
 * The reload keeps the scope the screen asked for: reloading with the default scope
 * instead would silently drop archived habits out of a list that had loaded them.
 */
export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  loaded: false,
  includeArchived: false,

  load: async (db, options) => {
    const includeArchived = options?.includeArchived ?? false;
    const habits = await habitsRepo.listHabits(db, { includeArchived });
    set({ habits, loaded: true, includeArchived });
  },

  reload: async (db) => {
    const habits = await habitsRepo.listHabits(db, { includeArchived: get().includeArchived });
    set({ habits, loaded: true });
  },

  create: async (db, input) => {
    const created = await habitsRepo.createHabit(db, input);
    await get().reload(db);
    return created;
  },

  update: async (db, id, input) => {
    await habitsRepo.updateHabit(db, id, input);
    await get().reload(db);
  },

  archive: async (db, id) => {
    await habitsRepo.archiveHabit(db, id);
    await get().reload(db);
  },

  unarchive: async (db, id) => {
    await habitsRepo.unarchiveHabit(db, id);
    await get().reload(db);
  },

  remove: async (db, id) => {
    await habitsRepo.deleteHabit(db, id);
    await get().reload(db);
  },
}));
