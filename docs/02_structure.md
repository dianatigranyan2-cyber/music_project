# 02. Структура проекта

## Дерево файлов и каталогов

```
c:/projects/music_project/
├── .env.local                   # Переменные окружения Supabase
├── package.json                 # Зависимости и скрипты проекта
├── next.config.ts               # Настройки Next.js (Unsplash домены)
├── tsconfig.json                # Конфигурация TypeScript
├── docs/                        # Полная проектная документация
├── public/                      # Статические SVG ресурсы
└── src/
    ├── app/                     # Страницы и маршруты (App Router)
    │   ├── explore/             # Страница «Обзор»
    │   ├── friends/             # Страница «Друзья»
    │   ├── login/               # Страница входа
    │   ├── messages/            # Страница личных сообщений
    │   ├── playlists/           # Страница плейлистов
    │   ├── profile/             # Профиль пользователя
    │   │   └── [username]/      # Публичный просмотр профиля
    │   ├── register/            # Страница регистрации
    │   ├── room/[id]/           # Комната прослушивания
    │   ├── settings/            # Настройки профиля
    │   ├── stories/[id]/        # Плеер историй
    │   ├── globals.css          # Стили и дизайн-токены
    │   ├── layout.tsx           # Корневой шаблон
    │   └── page.tsx             # Главная страница
    ├── components/              # React-компоненты
    │   ├── AppShell/            # Глобальная оболочка приложения
    │   ├── FriendCard/          # Карточка друга
    │   ├── Header/              # Верхняя панель и поиск
    │   ├── Navigation/          # Навигация (Sidebar и Mobile Nav)
    │   ├── Player/              # Глобальный музыкальный плеер
    │   └── Stories/             # Полоса историй (StoriesBar)
    ├── context/                 # Контексты React
    │   ├── AuthContext.tsx      # Сессия и профиль пользователя
    │   └── PlayerContext.tsx    # Состояние воспроизведения плеера
    ├── data/
    │   └── mockData.ts          # Демонстрационные треки и друзья
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts        # Клиент для браузера (createBrowserClient)
    │   │   └── server.ts        # Клиент для сервера (createServerClient)
    │   └── supabase.ts          # Резервный клиент
    ├── proxy.ts                 # Обновление сессий (SSR Cookie Proxy)
    └── types/
        └── index.ts             # Интерфейсы TypeScript
```

## Назначение ключевых директорий
- `src/app/` — файловый роутинг Next.js App Router. Каждый каталог с `page.tsx` является отдельным URL-маршрутом.
- `src/components/` — изолированные UI-компоненты со своими стилями `.module.css`.
- `src/context/` — глобальное управление состоянием (State Management).
- `src/lib/supabase/` — фабрики клиентов для безопасного взаимодействия с Supabase в браузере и на сервере.
- `src/data/mockData.ts` — демо-данные для треков, комнат и друзей.
