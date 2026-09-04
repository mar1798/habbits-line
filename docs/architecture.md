# Архитектура

Один поток данных на всё приложение:

```
expo-sqlite ──► src/db/*-repo.ts ──► src/store/*-store.ts ──► экраны и компоненты
                (весь SQL)          (zustand, атомарные       (только рендер)
                                     селекторы)
```

Экраны в базу напрямую не ходят. Чистая логика (даты, стрики, периоды, суммы) живёт в
`src/lib/` без импортов React и покрыта тестами — из рендера она вынесена не ради
красоты, а потому что правила «день закрыт» и «день вне расписания» должны быть в одном
месте с тестами.

## Дерево

```
src/
  app/            маршруты expo-router
                  (tabs)/index    — «Сегодня»: полоса дат, карточки привычек
                  (tabs)/expenses — траты периода, баланс, полоса по категориям
                  (tabs)/stats    — стрики, проценты, хитмап, блок трат
                  (tabs)/settings — тема, язык, категории, экспорт/импорт, уведомления
                  habit/new|[id], expense/new|[id]|budget,
                  expense-category/new|[id] — модалки
  components/     ui/*    — примитивы (text, button, card, screen, day-strip…)
                  habit/*, expense/*, stats/* — доменные
  constants/      design-tokens.ts — единственный источник цветов, отступов, радиусов,
                                     типографики, теней и таймингов
                  emoji.ts
  db/             migrations.ts, provider.tsx, *-repo.ts, types.ts
  i18n/           ru.ts — источник ключей, en.ts типизирован по нему, plural.ts
  store/          habits, entries, settings, expense-categories, expenses
  lib/            date, date-range, schedule, streaks, period, money, expenses,
                  notifications, backup, name-match, category-name, haptics,
                  action-sheet, id  (+ __tests__)
  hooks/          use-theme, use-i18n, use-today-key, use-taken-names
```

## Соглашения

- **Стилизация** — `StyleSheet` поверх токенов. Никаких литеральных цветов, отступов,
  радиусов и размеров шрифта в компонентах.
- **Тема** — `use-theme`; цвет привычки и категории хранится ключом палитры, чтобы
  меняться вместе с темой.
- **Текст** — только `components/ui/text.tsx`: там `allowFontScaling: false`, шрифт
  намеренно не масштабируется системным Dynamic Type.
- **Иконки** — SF Symbols через `expo-symbols`.
- **Списки** — `FlatList`, не `ScrollView` + `.map`.
- **Анимации** — Reanimated на UI-потоке, только `transform` / `opacity`.
- **Строки UI** — все через `i18n`; новый ключ добавляется в `ru.ts` (источник) и `en.ts`.
  Пользовательские данные (названия привычек и категорий) не переводятся.
- **Нативный UI** — `@expo/ui` уже в проекте (например, `DatePicker`); новая зависимость
  на такое не нужна.
