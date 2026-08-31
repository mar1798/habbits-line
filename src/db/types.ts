export interface HabitRow {
  id: string;
  name: string;
  emoji: string;
  color_key: string;
  target_per_day: number;
  schedule_mask: number;
  reminder_time: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntryRow {
  habit_id: string;
  date: string;
  count: number;
  updated_at: string;
}

export interface AppSettingRow {
  key: string;
  value: string;
}

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  emoji: string;
  color_key: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRow {
  id: string;
  category_id: string;
  amount: number;
  date: string;
  /** The user's own one-line description. Null when they left the field empty. */
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseBudgetRow {
  period_start: string;
  amount: number;
  updated_at: string;
}
