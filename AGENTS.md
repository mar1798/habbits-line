# Habbits Line

Офлайн-трекер привычек и трат для iOS. Без бэкенда, аккаунтов и сети: всё живёт в
локальной SQLite и локальных уведомлениях. Личный проект, один разработчик.

## Стек

Expo SDK 57 ([docs](https://docs.expo.dev/)), TypeScript, iOS-only (`"platforms": ["ios"]`).

| Пакет | Зачем | Docs |
|---|---|---|
| `expo-router` | файловая навигация, `typedRoutes` | https://docs.expo.dev/router/introduction/ |
| `expo-sqlite` | база, миграции через `user_version` | https://docs.expo.dev/versions/latest/sdk/sqlite/ |
| `zustand` | сторы с атомарными селекторами | https://zustand.docs.pmnd.rs/ |
| `expo-notifications` | **только локальные** напоминания | https://docs.expo.dev/versions/latest/sdk/notifications/ |
| `react-native-reanimated` | анимации на UI-потоке | https://docs.swmansion.com/react-native-reanimated/ |
| `date-fns` | арифметика дат, **только глубокие импорты** | https://date-fns.org/docs/Getting-Started |
| `@expo/ui` | нативные контролы (DatePicker и т.д.) | https://docs.expo.dev/versions/latest/sdk/ui/ |
| `expo-symbols` | SF Symbols | https://docs.expo.dev/versions/latest/sdk/symbols/ |

Стилизация — `StyleSheet` поверх [`src/constants/design-tokens.ts`](src/constants/design-tokens.ts).

## Язык

Весь UI — на русском и английском через `src/i18n` (по умолчанию русский).
Код, комментарии, коммиты и PR — на английском. Общение и документы — на русском.

## Правила

- Не добавляй зависимости без моего разрешения. Сначала спроси.
- Не меняй схему БД без миграции и без моего согласия. Выпущенную миграцию не
  редактируют — только новый блок, см. [docs/database.md](docs/database.md).
- Не трогай файлы вне текущей задачи.
- Цвета, отступы, радиусы, шрифты — только из `design-tokens.ts`.
- Стрики и статистика считаются из `entries`, не хранятся отдельно.
- Даты — строка `YYYY-MM-DD` в локальной таймзоне, только через `lib/date.ts`.
  `toISOString()` для ключей дат запрещён.
- Длинные списки — `FlatList`, не `.map`.
- Новая строка UI — ключ в `i18n/ru.ts` **и** `i18n/en.ts`.
- Не полагайся на память по Expo API — сверяйся с Expo Skills и docs выше.

## Проверки

```bash
npm run typecheck   # tsc --noEmit — должен проходить чисто
npm run lint
npm test            # jest: чистая логика в src/lib и i18n
npm run test:tz     # тесты дат в 10 таймзонах — после правок в lib/date.ts
npm run ios         # expo run:ios — нативная сборка в симулятор
```

Перед словом «готово»: typecheck и тесты зелёные, приложение поднимается без warning в
Metro. Изменения в UI — подтверждены скриншотом из симулятора, а не рассуждением.
CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) гоняет lint, typecheck, тесты
и экспорт бандла на каждый push в `master`.

## Проверка изменений в симуляторе

Приложение стоит на запущенном симуляторе, Metro на 8081 — правки JS доезжают через Fast
Refresh, пересборка не нужна.

```bash
xcrun simctl openurl booted "habbitsline://"           # сброс на корень
xcrun simctl openurl booted "habbitsline://habit/new"  # любой путь expo-router
xcrun simctl io booted screenshot out.png
sips -c H W --cropOffset Y X out.png                   # обрезать до нужного места
```

Синтетические тапы **не работают** (ни AppleScript, ни CGEvent). Состояние, до которого
не дотянуться диплинком, ставится кодом: временно изменённый дефолт или инлайновый
`ref`, скриншот, потом `git checkout` файла. Настройки, меняемые только тапом (тема,
язык, день начала периода), лежат в таблице `app_settings` базы симулятора:

```bash
xcrun simctl get_app_container booted com.mar1798.habbits-line data
# → <container>/Documents/SQLite/habits.db  — терминировать приложение, править sqlite3,
#   запустить снова, снять скриншот, вернуть значение обратно
```

Числа на экране (стрики, проценты, остаток бюджета) сверяются с той же базой: правило
переписывается в одноразовом скрипте и сравнивается. Импортировать `lib/streaks.ts` для
такой сверки бессмысленно — общий баг сойдётся сам с собой.

## Измерения

Размер бандла — только замером, не рассуждением:

```bash
EXPO_UNSTABLE_ATLAS=true npx expo export --platform ios --output-dir /tmp/atlas --clear
```

Экспорт печатает размер Hermes `.hbc` — это и есть число для сравнения между изменениями.
`.expo/atlas.jsonl` из двух строк: строка 0 — метаданные, строка 1 — JSON-массив, где
**индекс 6** это список модулей (`relativePath`, `package`, `output[].data.code`). Сумма
длины `code` по `package` даёт разбивку. Поле `size` — размер исходника, не результата,
ему не верить.

## Скиллы

- Плагин `expo` включён в [`.claude/settings.json`](.claude/settings.json): `expo-overview`
  — вход в любую задачу по Expo, дальше он маршрутизирует в `expo-router`, `expo-native-ui`,
  `expo-ui`, `expo-animation`, `expo-upgrade` и остальные.
- [`.agents/skills/react-native-best-practices`](.agents/skills/react-native-best-practices/SKILL.md)
  — производительность RN: списки, ре-рендеры, размер бандла, TTI, память. Зафиксирован в
  `skills-lock.json`.
- Актуальные API библиотек — через Context7 или официальные docs из таблицы выше, а не по
  памяти.

## Документы

- [README.md](README.md) — что это, как запустить.
- [docs/architecture.md](docs/architecture.md) — поток данных, дерево файлов, соглашения.
- [docs/database.md](docs/database.md) — схема, прагмы, правила миграций.
- [docs/domain.md](docs/domain.md) — правила стриков, процентов, периодов, уведомлений.
- [docs/pitfalls.md](docs/pitfalls.md) — грабли: prebuild, таймзоны, лимит уведомлений,
  нумерация дней недели, стоимость расчётов.

## Как работаем

Одна задача за сессию. Ход: понять, что уже в коде → сделать → прогнать проверки →
короткий отчёт: что сделано, что осталось, что сломалось.

Документы живые: если изменение меняет схему, правило расчёта или добавляет граблю —
правится соответствующий файл в `docs/` в том же коммите. Docs описывают то, что лежит в
коде, а не планы.
