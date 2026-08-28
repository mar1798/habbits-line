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
