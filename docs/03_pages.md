# 03. Страницы и навигация

В Melo навигация организована через Next.js App Router. Оболочка `AppShell` монтирует общую панель навигации (`Navigation`), верхнюю панель (`Header`) и нижний аудиоплеер (`Player`).

## Список всех маршрутов приложения

| URL | Файл | Описание страницы | Источник данных |
|---|---|---|---|
| `/` | `src/app/page.tsx` | **Главная лента**: лента историй (`StoriesBar`), список активных друзей (`FriendCard`), рекомендованные треки и чарты. | Истории — Supabase БД и Storage; друзья и треки — `mockData.ts`. |
| `/explore` | `src/app/explore/page.tsx` | **Обзор**: каталог жанров, топ недели, новые релизы, строка поиска треков. | Демо-данные `mockData.ts`. |
| `/friends` | `src/app/friends/page.tsx` | **Друзья**: 4 вкладки («Все друзья», «Входящие заявки», «Исходящие заявки», «Поиск пользователей»). | База данных Supabase (`friend_requests`, `profiles`). |
| `/messages` | `src/app/messages/page.tsx` | **Личные сообщения**: двухпанельный мессенджер с Realtime, чтением, редактированием, удалением и превью историй. | База данных Supabase (`messages`, `profiles`, `stories`). |
| `/playlists` | `src/app/playlists/page.tsx` | **Плейлисты**: управление коллекциями («Мои», «Совместные», «Любимые треки»), модальное окно создания плейлиста. | Локальный стейт `useState` страницы и `mockData.ts`. |
| `/profile` | `src/app/profile/page.tsx` | **Личный профиль**: данные текущего пользователя, аватарка, любимые жанры, история прослушивания, кнопка редактирования. | `AuthContext` (данные Supabase Auth и `profiles`) + `mockData.ts`. |
| `/profile/[username]` | `src/app/profile/[username]/page.tsx` | **Публичный профиль**: просмотр профиля любого пользователя по никнейму, проверка статуса дружбы. | База данных Supabase (`profiles`, `friend_requests`). |
| `/room/[id]` | `src/app/room/[id]/page.tsx` | **Комната совместного прослушивания**: синхронизированный трек, участники (хост и гости), live-чат комнаты. | Локальный стейт чата `useState`, `mockData.ts`. |
| `/stories/[id]` | `src/app/stories/[id]/page.tsx` | **Плеер историй**: полноэкранный просмотр фото/видео, таймер прогресса, пауза по зажатию, реакции и удаление. | База данных Supabase (`stories`, `story_views`, `story_reactions`) и Storage. |
| `/settings` | `src/app/settings/page.tsx` | **Настройки**: изменение юзернейма, имени, bio, загрузка аватара в Storage `avatars`. | `AuthContext`, Supabase Storage и `profiles`. |
| `/login` | `src/app/login/page.tsx` | **Вход в аккаунт**: форма авторизации по email и паролю. | `AuthContext.signIn()`. |
| `/register` | `src/app/register/page.tsx` | **Регистрация**: создание аккаунта, валидация уникальности юзернейма. | `AuthContext.signUp()`. |

## Поведение навигации
- **Десктоп**: фиксированная левая колонка (`sidebar`) со ссылками, счетчиками бейджей и виджетом быстрой комнаты (`/room/1`).
- **Мобильные**: нижняя фиксированная панель (`mobileNav`). При открытии чата в `/messages` панель автоматически скрывается через флаг `mobileChatOpen` в `PlayerContext`.
