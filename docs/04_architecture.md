# 04. Архитектура приложения

## Архитектурные принципы

Приложение построено по гибридной архитектуре:
- **Next.js App Router (версия 16.3.6)** обеспечивает модульную маршрутизацию.
- **Client-Side Rendering (CSR)** активно используется на страницах (`'use client'`), так как платформа представляет собой интерактивное SPA с постоянным аудиоплеером, веб-сокетами и динамическими анимациями.
- **Supabase Cloud** выступает единым бэкендом (BaaS), предоставляя аутентификацию, реляционную базу данных PostgreSQL, хранилище медиафайлов и механизм подписки на события данных (Realtime).

---

## Архитектурная схема работы

```mermaid
flowchart TB
    subgraph Browser["Клиент (Браузер)"]
        UI["React 19 Компоненты"]
        AuthCtx["AuthContext (сессия, профиль)"]
        PlayerCtx["PlayerContext (плейбек, очередь)"]
        SBC["Supabase Browser Client"]
    end

    subgraph Server["Next.js Server"]
        RootLayout["RootLayout (app/layout.tsx)"]
        AppShell["AppShell (компоновка, провайдеры)"]
        Proxy["src/proxy.ts (Cookie session refresh)"]
    end

    subgraph Supabase["Supabase Cloud"]
        AuthService["Supabase Auth (JWT)"]
        PostgresDB["PostgreSQL (profiles, messages, stories...)"]
        StorageEngine["Supabase Storage ('avatars', 'stories')"]
        RealtimeEngine["Realtime WebSocket Gateway"]
    end

    RootLayout --> AppShell
    AppShell --> AuthCtx
    AppShell --> PlayerCtx
    UI --> AuthCtx
    UI --> PlayerCtx

    AuthCtx --> SBC
    UI --> SBC

    SBC -->|REST PostgREST| PostgresDB
    SBC -->|Auth API| AuthService
    SBC -->|Signed URLs / Upload| StorageEngine
    SBC -->|WebSocket postgres_changes| RealtimeEngine
    RealtimeEngine -->|Push Events| SBC

    Browser <-->|HTTP Cookies| Proxy
```

---

## Контексты приложения
1. **`AuthContext`** (`src/context/AuthContext.tsx`):
   - Хранит текущего пользователя (`user`) и данные профиля (`profile`).
   - Инициализируется через `supabase.auth.getSession()` и реагирует на события `onAuthStateChange`.
   - Инкапсулирует методы `signIn`, `signUp`, `signOut`, `updateProfile`, `uploadAvatar`.
2. **`PlayerContext`** (`src/context/PlayerContext.tsx`):
   - Управляет активным треком (`currentTrack`), статусом воспроизведения (`isPlaying`), переходами вперед/назад.
   - Хранит состояние поискового запроса (`searchQuery`) для синхронизации поиска между шапкой и контентом.
   - Управляет флагом `mobileChatOpen`, оптимизирующим экранное пространство на смартфонах.

---

## Серверный файл `src/proxy.ts`
Функция `updateSession` из `src/proxy.ts` реализует механизм рефреша токенов через `@supabase/ssr`:
- Считывает куки из входящего `NextRequest`.
- Инициализирует `createServerClient`.
- Вызывает `supabase.auth.getUser()`, что обновляет просроченные токены и устанавливает свежие заголовки `Set-Cookie` в `NextResponse`.
