# Выпуск релиза

Единственный документ о том, как приложение попадает в App Store. Описывает то, что
лежит в репозитории; меняется порядок — правится этот файл в том же коммите.

Сборка локальная, в облако уходит только загрузка: EAS здесь работает загрузчиком, а не
сборщиком. Build-минуты не тратятся.

## Что нужно один раз

| Что | Где | Куда попадает |
|---|---|---|
| Apple Developer Program | developer.apple.com | Team ID → `eas.json` |
| Запись приложения | App Store Connect, bundle id `com.mar1798.habbits-line`, язык по умолчанию `ru`, iPhone-only | `ascAppId` → `eas.json` |
| App Store Connect API key, роль App Manager | App Store Connect → Users and Access → Keys | `.p8` **вне репозитория** |
| Аккаунт Expo | expo.dev | `extra.eas.projectId` в `app.json`, через `npx eas-cli@latest init` |
| GitHub Pages из `docs/` | Settings → Pages → Deploy from a branch → `/docs` | URL политики |

Ключ `.p8` в репозиторий не кладётся: `.gitignore` закрывает `*.p8`, а `eas.json`
намеренно **не** содержит `ascApiKeyPath` — путь к ключу передаётся окружением.

## Порядок выпуска

### 1. Поднять номера — вместе с prebuild

`ios/` сгенерирована и лежит в `.gitignore`. Правка `app.json` сама в сборку не попадает,
поэтому бамп и prebuild — один шаг, а не два:

```bash
# version — только когда меняется то, что видит пользователь;
# ios.buildNumber — перед каждой загрузкой, включая повторную загрузку той же version
$EDITOR app.json
npx expo prebuild --platform ios --clean
plutil -p ios/HabbitsLine/Info.plist | grep -E 'CFBundleShortVersionString|CFBundleVersion'
```

Обе строки в выводе должны совпасть с `app.json`. Не совпали — собирается старое.

### 2. Проверки

```bash
npm run typecheck
npm run lint
npm test
npm run test:tz     # если трогали lib/date.ts
```

### 3. Собрать архив

```bash
open ios/HabbitsLine.xcworkspace
```

Схема `HabbitsLine`, конфигурация Release, destination «Any iOS Device» →
Product → Archive → Distribute App → App Store Connect → Export → `.ipa`.
`*.ipa` закрыт в `.gitignore`.

### 4. Приёмка на устройстве

Отправляется только то, что прошло весь список — на **физическом устройстве**, не на
симуляторе:

- [ ] чистая установка, холодный старт: пустое состояние, без обращений к Metro и без
      отладочных наложений;
- [ ] напоминание приходит в назначенное время, тап открывает нужную привычку;
- [ ] экспорт бэкапа через share sheet и импорт обратно — без потерь;
- [ ] все экраны в светлой и тёмной теме, на русском и английском: без обрезанного
      текста и непереведённых строк;
- [ ] раздел «О приложении» в настройках показывает те же номера, что и
      `Info.plist` архива.

Что-то упало — правится, `ios.buildNumber` поднимается, всё с шага 1.

### 5. Загрузить

```bash
export EXPO_ASC_API_KEY_PATH=~/keys/AuthKey_XXXXXXXXXX.p8
export EXPO_ASC_API_KEY_ISSUER_ID=…
export EXPO_ASC_API_KEY_ID=XXXXXXXXXX
npx eas-cli@latest submit -p ios --path /path/to/HabbitsLine.ipa
```

Сборка должна обработаться в App Store Connect **без** статуса «Missing Compliance»:
за это отвечает `ios.config.usesNonExemptEncryption: false` в `app.json`, который
prebuild кладёт в `Info.plist` как `ITSAppUsesNonExemptEncryption`.

### 6. Листинг

Источник истины — [`store.config.json`](../store.config.json): названия, подзаголовки,
описания, ключевые слова, заметки к версии на `ru` и `en-US`, категории, возрастной
рейтинг, контакты для ревью.

- **Первый релиз** — поля заполняются в App Store Connect руками, копированием из этого
  файла. `eas metadata:push` для нового приложения не работает: он требует, чтобы
  бинарник уже был отправлен.
- **Со второго релиза** — `npx eas-cli@latest metadata:push` после шага 5. Функция в
  превью; сломается — файл всё равно остаётся тем, из чего заполняют руками.

Скриншоты `eas metadata` не загружает никогда — только вручную, из
`assets/store/screenshots/`.

### 7. Скриншоты

```bash
npx expo run:ios --device "iPhone 17 Pro Max"   # Debug — нужен Metro для Fast Refresh
./scripts/screenshots.sh prepare
```

Дальше по одному кадру на вкладку. Диплинками вкладку не переключить: iOS 26 вешает
поверх кадра системный диалог «Открыть в приложении?» на любой custom scheme, включая
`simctl openurl` — URL при этом доставляется и приложение переходит, но диалог с кадра не
убрать (синтетические тапы не работают, Escape он игнорирует). Поэтому вкладка ставится
кодом, через Fast Refresh — приём из [AGENTS.md](../AGENTS.md) для состояния, до которого
не достаёт диплинк.

В `src/app/(tabs)/_layout.tsx` временно, внутри `TabsLayout`:

```tsx
useEffect(() => {
  router.replace('/stats');
}, []);
```

Сохранить, дождаться Fast Refresh, снять — и так четыре раза:

| route | имя кадра |
|---|---|
| `/` | `01-habits` |
| `/expenses` | `02-expenses` |
| `/stats` | `03-stats` |
| `/settings` | `04-settings` |

```bash
./scripts/screenshots.sh shoot 03-stats
```

В конце:

```bash
./scripts/screenshots.sh finish
git checkout "src/app/(tabs)/_layout.tsx"     # обязательно — временная правка
```

Кадры ложатся в `assets/store/screenshots/` в 1320 × 2868 — единственный размер, который
App Store требует для iPhone. Скрипт проверяет разрешение и падает, если снимали не с
того устройства.

Данные берутся из [`scripts/seed-demo-db.mjs`](../scripts/seed-demo-db.mjs). Они
детерминированы, но привязаны к сегодняшней дате: два прогона в один день дают одинаковые
файлы, прогон завтра сдвинет историю на день. Так и задумано — на скриншоте должно быть
сегодня. Схема в сиде — транскрипция `db/migrations.ts` на `user_version 3`: появится
новая миграция — правится и сид, иначе приложение откроет базу и покажет пустой экран.

Debug-сборка здесь не компромисс, а условие: Release не к чему подключать Fast Refresh.
Экраны она рисует те же, а дев-меню в кадр не попадает.

Обязательно после пересъёмки: пройтись по описанию из `store.config.json` пункт за
пунктом и убедиться, что каждый обещанный экран в наборе есть, а того, чего в приложении
нет, в описании не появилось.

### 8. Отправить на ревью

App Store Connect → выбрать сборку → заполнить «What's New» → Submit for Review.

`release.automaticRelease` в `store.config.json` — `false`: релиз публикуется вручную
после одобрения.

## Приватность

Три источника должны говорить одно и то же, расхождение между ними — повод для отказа:

| Источник | Что говорит |
|---|---|
| [`docs/privacy-policy.ru.md`](privacy-policy.ru.md) / [`.en.md`](privacy-policy.en.md) | данных не собирает, трекинга нет, наружу данные уходят только файлом бэкапа по действию пользователя |
| `ios/HabbitsLine/PrivacyInfo.xcprivacy` (генерируется prebuild) | `NSPrivacyTracking false`, `NSPrivacyCollectedDataTypes` пуст |
| Анкета App Privacy в App Store Connect | «Data Not Collected», трекинга нет |

Проверяется тем, что в `src` нет ни одного сетевого вызова и ни одной сторонней
аналитической или рекламной библиотеки в `package.json`:

```bash
grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|axios" src   # пусто, кроме тестов
```

Появится первый сетевой вызов — политика, манифест и анкета правятся все три.
