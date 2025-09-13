psql 'postgresql://neondb_owner:npg_4yYRW5tpwgPN@ep-floral-rain-a2efqgrr-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

Структура проекта:

envibe/
├── Основные файлы
│ ├── package.json - Конфигурация проекта (Next.js + React)
│ ├── generate.js - CLI утилита для генерации предложений
│ └── README.md - Инструкции по запуску
│
├── pages/ - Next.js страницы
│ ├── index.js - Главная страница приложения (556 строк)
│ └── api/
│ └── generate.js - API для генерации предложений с AI
│
├── lib/ - Утилиты
│ └── generateSentence.js - Модуль для работы с Gemini AI
│
├── stack/ - Stack Auth конфигурация
│ ├── client.js - Клиентская конфигурация
│ └── server.js - Серверная конфигурация
│
└── neon-auth-nextjs-template/ - Шаблон Neon Auth
└── src/ - TypeScript приложение с аутентификацией

Основной функционал

Приложение для изучения английского словаря с AI-генерацией предложений:

1. Управление словарем

- Загрузка данных с Neon DB: https://app-orange-meadow-73857621.dpl.myneon.app/vocabulary
- Формат данных: [{id, key, translate}]
- Кэширование в localStorage

2. Режимы навигации

- Последовательный: слова по порядку
- Случайный: случайный выбор слов
- Навигация стрелками, кликом, клавиатурой

3. AI-генерация предложений

- Интеграция с Google Gemini AI
- Генерация предложений по уровню (A1-C2)
- API endpoint: /api/generate

4. История просмотров

- Отслеживание просмотренных слов
- Дедупликация записей
- Модальное окно истории

5. Настройки

- Выбор уровня английского (A1-C2)
- Переключение случайного режима
- Сброс кэша и истории

Технологический стек

- Frontend: Next.js 15.4.5, React 19.1.1
- AI: Google Gemini AI (@google/genai)
- База данных: Neon PostgreSQL
- Аутентификация: Stack Auth (@stackframe/js)
- Стилизация: Inline CSS

Ключевые компоненты

1. pages/index.js (556 строк) - Основное приложение

- Управление состоянием словаря
- Навигация между словами
- AI-генерация предложений
- Модальные окна настроек и истории

2. lib/generateSentence.js - AI модуль

- Интеграция с Gemini API
- Генерация предложений по уровню

3. pages/api/generate.js - API endpoint

- Обработка POST запросов
- Вызов AI генерации

Запуск проекта

npm install # Установка зависимостей
npm run dev # Запуск dev сервера

# Открыть http://localhost:3000
