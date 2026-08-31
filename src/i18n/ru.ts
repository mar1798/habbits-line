/**
 * The source of truth for every UI string: `en.ts` is typed against these keys, so a
 * forgotten translation fails `tsc --noEmit` instead of rendering as an empty string.
 *
 * `{name}`-style placeholders are filled in by `translate()`. Plural words come from
 * `ruPlurals` through `pluralize()`, never from the sentence itself.
 */
export const ru = {
  // Shared across screens.
  cancel: 'Отмена',
  delete: 'Удалить',
  close: 'Закрыть',
  done: 'Готово',
  clear: 'Очистить',
  try_again: 'Попробуйте ещё раз.',
  save: 'Сохранить',
  create: 'Создать',
  empty_no_habits: 'Привычек пока нет',

  // Tabs.
  tab_habits: 'Привычки',
  tab_expenses: 'Расходы',
  tab_stats: 'Статистика',
  tab_settings: 'Настройки',

  // Modal routes.
  habit_new_title: 'Новая привычка',
  habit_edit_title: 'Изменить привычку',
  expense_new_title: 'Новый расход',
  expense_edit_title: 'Изменить расход',
  expense_budget_title: 'Бюджет',
  category_new_title: 'Новая категория',
  category_edit_title: 'Изменить категорию',

  // +not-found.
  not_found_title: 'Не найдено',
  not_found_heading: 'Экран не найден',
  not_found_subtitle: 'Возможно, ссылка устарела',
  not_found_action: 'На главную',

  // Today.
  today_title: 'Привычки',
  today_add_habit: 'Добавить привычку',
  today_day_progress: 'Прогресс дня',
  today_empty_subtitle: 'Нажмите «+», чтобы добавить первую привычку',
  today_nothing_title: 'На этот день ничего не запланировано',
  today_nothing_subtitle: 'Выберите другой день или измените расписание привычки',
  today_mark_failed: 'Не удалось сохранить отметку',

  // Day strip.
  day_strip_prev_week: 'Предыдущая неделя',
  day_strip_next_week: 'Следующая неделя',

  // Check button.
  check_progress: '{count} из {target}',
  check_mark_done: 'Отметить выполненным',
  check_mark_undone: 'Отметить невыполненным',

  // Habit card and its context menu.
  habit_card_target: 'Цель: {count} {times} в день',
  menu_edit: 'Изменить',
  menu_archive: 'Архивировать',
  menu_unarchive: 'Разархивировать',

  // Habit form.
  habit_form_create: 'Создать',
  habit_form_save: 'Сохранить',
  habit_form_save_failed: 'Не удалось сохранить',
  habit_form_name: 'Название',
  habit_form_name_placeholder: 'Например, Пить воду',
  habit_form_name_required: 'Введите название — без него привычку не сохранить',
  habit_form_name_taken: 'Привычка с таким названием уже есть',
  habit_form_emoji: 'Эмодзи',
  habit_form_color: 'Цвет',
  habit_form_weekdays: 'Дни недели',
  habit_form_weekdays_required: 'Выберите хотя бы один день — иначе привычка нигде не появится',
  habit_form_editing_note: 'Изменение дней или цели задним числом меняет прошлую статистику',
  habit_form_target: 'Цель в день',
  habit_form_target_decrease: 'Уменьшить цель',
  habit_form_target_increase: 'Увеличить цель',
  habit_not_found: 'Привычка не найдена',

  // Reminders.
  reminder: 'Напоминание',
  reminder_hint: 'Придёт в выбранные дни недели',
  reminder_denied:
    'Уведомления запрещены в настройках iOS — время сохранится, но напоминание не придёт',
  notification_body: 'Не забудьте отметить привычку сегодня',

  // Expenses screen.
  expenses_title: 'Расходы',
  expenses_add: 'Добавить расход',
  expenses_add_action: '+ Добавить расход',
  expenses_remaining: 'Осталось из {budget}',
  expenses_spent: 'Потрачено {amount}',
  expenses_overspent: 'Перерасход',
  expenses_no_budget: 'Бюджет не задан',
  expenses_set_budget: 'Задать',
  expenses_open_budget: 'Изменить бюджет периода',
  expenses_bar_label: 'Потрачено {spent} из {total}',
  expenses_bar_label_no_budget: 'Потрачено {spent}',
  expenses_empty_day: 'В этот день расходов не было',
  expense_delete_title: 'Удалить расход?',
  expense_delete_message: 'Расход будет удалён без возможности восстановления.',

  // Expense form.
  expense_form_amount: 'Сумма',
  expense_form_amount_placeholder: '0',
  expense_form_category: 'Категория',
  expense_form_category_required: 'Выберите категорию — без неё расход не сохранить',
  expense_form_note: 'Описание',
  expense_form_note_optional: 'необязательно',
  expense_form_note_placeholder: 'Например, обед с коллегами',
  expense_form_save_failed: 'Не удалось сохранить расход',
  expense_not_found: 'Расход не найден',

  // Budget modal.
  expense_budget_amount: 'Бюджет на период',
  expense_budget_period: 'Период: {period}',
  expense_budget_start_day: 'День начала периода',
  expense_budget_start_day_hint:
    'Период сдвигается целиком. Бюджеты прошлых периодов при этом не теряются.',
  expense_budget_day: '{day} число',
  expense_budget_save_failed: 'Не удалось сохранить бюджет',

  // Starter category names. The rows are seeded in Russian by the v1 -> v2 migration and
  // matched back to these keys by name — see lib/category-name.ts.
  category_seed_health: 'Здоровье',
  category_seed_leisure: 'Досуг',
  category_seed_home: 'Дом',
  category_seed_food: 'Еда',
  category_seed_entertainment: 'Развлечение',
  category_seed_shopping: 'Покупки',
  category_seed_transport: 'Транспорт',
  category_seed_other: 'Прочее',

  // Category form.
  category_form_name: 'Название',
  category_form_name_placeholder: 'Например, Кофе',
  category_form_name_required: 'Введите название — без него категорию не сохранить',
  category_form_name_taken: 'Категория с таким названием уже есть',
  category_form_emoji: 'Эмодзи',
  category_form_color: 'Цвет',
  category_form_save_failed: 'Не удалось сохранить категорию',
  category_not_found: 'Категория не найдена',
  category_add: 'Новая категория',

  // Statistics.
  stats_title: 'Статистика',
  stats_show_archived: 'Показывать архивные привычки',
  stats_archived: 'Архивные',
  stats_empty_title: 'Пока нет данных',
  stats_empty_subtitle: 'Статистика появится, когда вы начнёте отмечать привычки',
  stats_all: 'Все',
  stats_habits: 'Привычки',
  stats_last_3_months: 'Последние 3 месяца',
  // Read out instead of the month's grid of squares: the cells carry their meaning in
  // colour alone, which VoiceOver has no way to convey.
  stats_heatmap_month: '{month}: закрыто {closed} из {scheduled} запланированных дней',
  stats_heatmap_month_empty: '{month}: запланированных дней нет',
  rate_no_scheduled: 'Не запланировано',
  streak_current: 'Текущий стрик',
  streak_best: 'Лучший',
  rate_7_days: 'За 7 дней',
  rate_30_days: 'За 30 дней',
  stats_expenses: 'Расходы',
  stats_expenses_current: 'Текущий период',
  stats_expenses_history: 'Прошлые периоды',
  stats_expenses_by_category: 'По категориям',
  stats_expenses_empty: 'В этом периоде расходов не было',
  stats_expenses_range: 'Расходы за период',
  stats_expenses_range_hint: 'Выберите в календаре первую и последнюю дату, чтобы увидеть расходы за эти дни',
  stats_expenses_range_pending: 'Теперь выберите последнюю дату',
  stats_expenses_range_clear: 'Сбросить',
  stats_expenses_range_days: '{count} {days}',
  stats_expenses_range_empty: 'За выбранные даты расходов не было',
  stats_habits_range: 'Привычки за период',
  stats_habits_range_hint: 'Выберите в календаре первую и последнюю дату, чтобы увидеть, сколько привычек закрыто за эти дни',
  stats_habits_range_pending: 'Теперь выберите последнюю дату',
  stats_habits_range_clear: 'Сбросить',
  stats_habits_range_days: '{count} {days}',
  stats_habits_range_closed: 'Закрыто {closed} из {scheduled} {days}',
  stats_habits_range_empty: 'В эти дни ничего не было запланировано',
  calendar_prev_month: 'Предыдущий месяц',
  calendar_next_month: 'Следующий месяц',

  // Settings.
  settings_title: 'Настройки',
  settings_appearance: 'Оформление',
  theme_system: 'Системная',
  theme_light: 'Светлая',
  theme_dark: 'Тёмная',
  settings_language: 'Язык',
  // Endonyms: a language is named in itself, so someone who cannot read the current UI
  // still recognises the one they want.
  language_ru: 'Русский',
  language_en: 'English',
  settings_data: 'Данные',
  settings_export: 'Экспорт',
  settings_import: 'Импорт',
  settings_data_hint:
    'Экспорт сохраняет привычки, отметки, категории, расходы и настройки в файл резервной копии. Импорт восстанавливает их из такого файла, заменяя текущие данные.',
  settings_habits: 'Привычки',
  settings_habits_add: 'Добавить привычку',
  settings_archive: 'Архив',
  settings_archived_badge: 'Архивная',
  settings_move_up: 'Переместить вверх',
  settings_move_down: 'Переместить вниз',
  settings_edit_habit: 'Изменить «{name}»',
  settings_delete_title: 'Удалить «{name}»?',
  settings_delete_message: 'Привычка и вся её история будут удалены без возможности восстановления.',
  settings_empty_subtitle: 'Добавьте первую привычку на вкладке «Привычки»',
  settings_categories: 'Категории расходов',
  settings_categories_add: 'Добавить категорию',
  settings_categories_archive: 'Архив категорий',
  settings_edit_category: 'Изменить «{name}»',
  settings_category_expenses: 'В категории {count} {expenses}',
  settings_category_delete_title: 'Удалить «{name}»?',
  settings_category_delete_message: 'Категория будет удалена без возможности восстановления.',
  settings_category_delete_failed: 'Не удалось удалить категорию',
  settings_notifications_denied:
    'Уведомления запрещены в настройках iOS — напоминания не будут приходить.',
  settings_open_ios_settings: 'Открыть настройки',
  settings_notification_limit:
    'Запланировано {count} {reminders} — iOS ограничивает их число, часть новых может не встать в расписание',
  settings_export_failed: 'Не удалось экспортировать',
  settings_import_failed: 'Не удалось импортировать',
  settings_import_done_title: 'Импорт завершён',
  settings_import_done_message: 'Данные восстановлены из файла.',
  settings_import_confirm_title: 'Импорт данных',
  settings_import_confirm_message:
    'Текущие привычки, отметки и расходы будут удалены и заменены содержимым файла. Это необратимо.',
  settings_import_confirm_action: 'Импортировать',
  settings_picker_failed: 'Не удалось открыть файл',

  // Backup failures, keyed by the codes lib/backup.ts throws.
  backup_error_sharing_unavailable: 'Отправка файлов недоступна на этом устройстве',
  backup_error_malformed_file: 'Файл повреждён и не может быть прочитан',
  backup_error_unrecognized_format: 'Формат файла не распознан',
  backup_error_unsupported_version:
    'Файл сохранён в формате версии {version}, это приложение читает до {supported}',
  backup_error_orphan_entries: 'Файл повреждён: есть записи для несуществующей привычки',
  backup_error_orphan_expenses: 'Файл повреждён: есть расходы для несуществующей категории',

  // Database provider — the screens behind a database that cannot be opened.
  db_render_error_title: 'Что-то пошло не так',
  db_render_error_subtitle: 'Перезапустите приложение — сохранённые данные останутся на месте.',
  db_open_failed_title: 'Не удалось открыть базу данных',
  db_open_failed_subtitle:
    'Попробуйте перезапустить приложение. Если это повторится, данные могли повредиться — базу можно сбросить и восстановить из резервной копии.',
  db_reset_action: 'Сбросить базу данных',
  db_reset_confirm_title: 'Сбросить базу данных?',
  db_reset_confirm_message:
    'Все привычки и отметки на этом устройстве будут удалены без возможности восстановления. Если у вас есть файл резервной копии, после сброса его можно импортировать в настройках.',
  db_reset_confirm_action: 'Сбросить',
  db_reset_done_title: 'База данных сброшена',
  db_reset_done_subtitle:
    'Запустите приложение заново. Если у вас есть файл резервной копии, его можно импортировать в настройках.',
  db_reset_failed_title: 'Не удалось сбросить базу',
  db_reset_failed_message: 'Переустановите приложение, чтобы очистить данные.',
} as const;

/** Russian has three plural forms; `plural.ts` picks between them. */
export const ruPlurals = {
  days: { one: 'день', few: 'дня', many: 'дней' },
  times: { one: 'раз', few: 'раза', many: 'раз' },
  expenses: { one: 'расход', few: 'расхода', many: 'расходов' },
  reminders: { one: 'напоминание', few: 'напоминания', many: 'напоминаний' },
} as const;

type Seven<T> = readonly [T, T, T, T, T, T, T];

/**
 * Weekday labels come from the dictionary rather than from date-fns: both sets are
 * ordered Monday-first to match `schedule_mask` bit 0, and the picker needs
 * fixed-width abbreviations that a locale's own list does not guarantee.
 */
export type WeekdayLabels = {
  /** Two-letter labels for the day strip and the weekday picker. */
  short: Seven<string>;
  /** Single letters for the heatmap's column headers. */
  initial: Seven<string>;
};

export const ruWeekdays: WeekdayLabels = {
  short: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  initial: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'],
};
