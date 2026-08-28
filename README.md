# Habbits Line

Офлайн-трекер привычек для iOS. Без бэкенда, аккаунтов и сети: всё живёт в локальной
SQLite и в локальных уведомлениях. Личный проект.

## Стек

Expo SDK 57 + expo-router, TypeScript, expo-sqlite, zustand, expo-notifications
(только локальные), react-native-reanimated, react-native-svg, date-fns.
Стилизация — `StyleSheet` поверх `src/constants/design-tokens.ts`.

Тема только системная, шрифт не масштабируется системным Dynamic Type, весь UI на
русском. Android и веб намеренно не поддерживаются (`"platforms": ["ios"]`).

## Запуск

```bash
npm install
npm run ios        # expo start --ios
```

Приложение целиком работает в Expo Go: из сетевого там нужны только локальные
уведомления, а они в Expo Go доступны. Поведение splash при запуске по тапу на
уведомление отличается от настоящего, поэтому напоминания проверяются на dev build.

## Проверки

```bash
npm run typecheck  # tsc --noEmit — должен проходить чисто
npm run lint
npm test           # jest: чистая логика дат, расписаний и стриков
```

## Структура

```
src/
  app/            экраны expo-router: (tabs)/index|stats|settings, habit/new|[id]
  components/     ui/* — базовые примитивы, habit/* и stats/* — доменные
  constants/      design-tokens.ts — единственный источник цветов, отступов, радиусов
  db/             миграции, провайдер и репозитории поверх expo-sqlite
  store/          zustand: habits-store (привычки + CRUD), entries-store (отметки)
  lib/            date, schedule, streaks, notifications, backup, haptics, id + тесты
  hooks/          use-theme, use-today-key
```

## Документы

- [PLAN.md](PLAN.md) — принятые решения, схема БД, дизайн-система, этапы и риски.
  Живой документ: после каждого этапа приводится в соответствие с кодом. Все 10 этапов
  v1 выполнены.
- [AGENTS.md](AGENTS.md) — правила работы над проектом.
