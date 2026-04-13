# Movie Tracker Skeleton

Каркас расширения для поэтапной реализации платформенных обработчиков.

## Папки
- `src/content/` — общий слой расширения
- `src/platforms/` — отдельные обработчики кинотеатров
- `src/shared/` — общие утилиты и вспомогательные модули

## Рекомендуемый порядок работы
1. `logger.js`
2. `platform-manager.js`
3. `video-tracker.js`
4. `payload-builder.js`
5. по одному модулю из `platforms/`
