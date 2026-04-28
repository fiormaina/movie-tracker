# Movie Tracker Frontend

Клиентская часть `Movie Tracker` организована как статический frontend без привязки к React/Vue-сборке.

## Структура

```text
.
|-- index.html
|-- pages/
|   |-- watch-history.html
|   |-- folders.html
|   |-- folder-detail.html
|   |-- folder-create.html
|   |-- movie-detail.html
|   `-- profile.html
|-- src/
|   |-- scripts/
|   |   |-- core/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- stores/
|   |   `-- utils/
|   `-- styles/
|       |-- base/
|       |-- layouts/
|       |-- components/
|       `-- pages/
`-- assets/
    |-- branding/
    |-- backgrounds/
    `-- placeholders/
```

## Где что искать

- `pages/` — HTML entrypoints страниц.
- `src/scripts/pages/` — page-specific логика.
- `src/scripts/components/` — общие рендеры и UI-блоки.
- `src/scripts/core/` — конфиг, роуты, soft navigation.
- `src/scripts/stores/` — работа с состоянием и локальным mock-store.
- `src/scripts/utils/` — мелкие переиспользуемые helpers.
- `src/styles/base/` — токены, reset, utility classes.
- `src/styles/layouts/` — общая оболочка приложения.
- `src/styles/components/` — shared UI styles.
- `src/styles/pages/` — page-specific стили.
- `assets/` — брендовые изображения, фоны и плейсхолдеры.

## GitHub Pages и проверка бэка

Этот фронт можно публиковать на `GitHub Pages`, потому что он статический и не требует сборщика.

Базовый сценарий публикации:

1. Создать отдельный репозиторий на GitHub именно под содержимое этой папки.
2. Загрузить в него файлы из `movie-tracker-front`, включая `.github/workflows/deploy-pages.yml`.
3. В настройках репозитория открыть `Settings -> Pages` и убедиться, что источником деплоя выбран `GitHub Actions`.

Для проверки интеграции с бэком важно следующее:

- API должен быть доступен извне, а не только на `127.0.0.1`.
- Лучше использовать `https`, иначе браузер заблокирует mixed content с `https://<user>.github.io/...`.
- На бэке должен быть настроен `CORS` для домена `GitHub Pages`.

URL API можно задать без правок кода:

```text
https://<user>.github.io/<repo>/?apiBaseUrl=https://api.example.com
```

После первого открытия адрес сохранится в `localStorage` под ключом `movieTracker.apiBaseUrl` и будет использоваться на остальных страницах сайта.
