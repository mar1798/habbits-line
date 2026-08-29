# Habbits Line

Офлайн-трекер привычек для iOS. Без бэкенда, аккаунтов и сети: всё живёт в локальной
SQLite и в локальных уведомлениях. Личный проект.

## Стек

Expo SDK 57 + expo-router, TypeScript, expo-sqlite, zustand, expo-notifications
(только локальные), react-native-reanimated, date-fns.
Стилизация — `StyleSheet` поверх `src/constants/design-tokens.ts`.

Тема переключается в настройках (системная / светлая / тёмная), шрифт не масштабируется
системным Dynamic Type. UI на русском и английском: по умолчанию русский, английский
включается там же, в настройках. Android и веб намеренно не поддерживаются
(`"platforms": ["ios"]`).

## Запуск

```bash
npm install
npm run ios        # expo run:ios — собирает нативный проект и ставит его в симулятор
```

Папка `ios/` генерируется и лежит в `.gitignore`. Она не обновляется сама: всё, что
приходит из `app.json` (отображаемое имя, иконка, splash, bundle id), попадает в сборку
только после `npx expo prebuild --platform ios`. После правки `app.json` — запускать его,
иначе собирается старое.

Приложение целиком работает в Expo Go: из сетевого там нужны только локальные
уведомления, а они в Expo Go доступны. Поведение splash при запуске по тапу на
уведомление отличается от настоящего, поэтому напоминания проверяются на dev build.

## Проверки

```bash
npm run typecheck  # tsc --noEmit — должен проходить чисто
npm run lint
npm test           # jest: чистая логика дат, расписаний, стриков и плюрализации
```

## Структура

```
src/
  app/            экраны expo-router: (tabs)/index|stats|settings, habit/new|[id]
  components/     ui/* — базовые примитивы, habit/* и stats/* — доменные
  constants/      design-tokens.ts — единственный источник цветов, отступов, радиусов
  db/             миграции, провайдер и репозитории поверх expo-sqlite
  i18n/           ru.ts — источник ключей, en.ts типизирован по нему, plural.ts + тесты
  store/          zustand: habits-store (привычки + CRUD), entries-store, settings-store
  lib/            date, schedule, streaks, notifications, backup, haptics, id + тесты
  hooks/          use-theme, use-i18n, use-today-key
```

## Документы

- [PLAN.md](PLAN.md) — принятые решения, схема БД, дизайн-система, этапы и риски.
  Живой документ: после каждого этапа приводится в соответствие с кодом. Все 11 этапов
  выполнены.
- [AGENTS.md](AGENTS.md) — правила работы над проектом.
