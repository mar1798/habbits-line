import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import * as categoriesRepo from '@/db/expense-categories-repo';
import type { ExpenseCategoryRow } from '@/db/types';

interface ExpenseCategoriesState {
  categories: ExpenseCategoryRow[];
  loaded: boolean;
  /** Scope of the last load(), reused by every write-through reload. */
  includeArchived: boolean;
  load: (db: SQLiteDatabase, options?: { includeArchived?: boolean }) => Promise<void>;
  reload: (db: SQLiteDatabase) => Promise<void>;
  create: (
    db: SQLiteDatabase,
    input: categoriesRepo.ExpenseCategoryInput
  ) => Promise<ExpenseCategoryRow>;
  update: (
    db: SQLiteDatabase,
    id: string,
    input: categoriesRepo.ExpenseCategoryInput
  ) => Promise<void>;
  archive: (db: SQLiteDatabase, id: string) => Promise<void>;
  unarchive: (db: SQLiteDatabase, id: string) => Promise<void>;
  remove: (db: SQLiteDatabase, id: string) => Promise<void>;
}

/**
 * Categories follow the habits store, not the expenses store: they change rarely and
 * `sort_order` is computed in SQL, so every mutation writes through the repo and re-reads
 * the list rather than patching it locally. Optimism would buy nothing here — nobody adds
 * a category in a tight loop the way the check button cycles a counter.
 *
 * The reload keeps the scope the screen asked for, so reloading after an archive does not
 * silently drop archived rows out of a list that had loaded them.
 */
export const useExpenseCategoriesStore = create<ExpenseCategoriesState>((set, get) => ({
  categories: [],
  loaded: false,
  includeArchived: false,

  load: async (db, options) => {
    const includeArchived = options?.includeArchived ?? false;
    const categories = await categoriesRepo.listExpenseCategories(db, { includeArchived });
    set({ categories, loaded: true, includeArchived });
  },

  reload: async (db) => {
    const categories = await categoriesRepo.listExpenseCategories(db, {
      includeArchived: get().includeArchived,
    });
    set({ categories, loaded: true });
  },

  // Returns the created row: the expense form opens the category modal when the grid is
  // missing a category, and selects what comes back the moment it is saved.
  create: async (db, input) => {
    const created = await categoriesRepo.createExpenseCategory(db, input);
    await get().reload(db);
    return created;
  },

  update: async (db, id, input) => {
    await categoriesRepo.updateExpenseCategory(db, id, input);
    await get().reload(db);
  },

  archive: async (db, id) => {
    await categoriesRepo.archiveExpenseCategory(db, id);
    await get().reload(db);
  },

  unarchive: async (db, id) => {
    await categoriesRepo.unarchiveExpenseCategory(db, id);
    await get().reload(db);
  },

  /**
   * Only succeeds for a category holding no expenses — the foreign key is ON DELETE
   * RESTRICT, so SQLite rejects the statement otherwise and the rejection reaches the
   * caller unchanged. The settings screen offers deletion only for empty categories;
   * this is the guarantee underneath that check, not a duplicate of it.
   */
  remove: async (db, id) => {
    await categoriesRepo.deleteExpenseCategory(db, id);
    await get().reload(db);
  },
}));
