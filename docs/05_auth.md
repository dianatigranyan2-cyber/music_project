# 05. Авторизация и профиль

## 1. Механизм аутентификации
Аутентификация построена на сервисе **Supabase Auth (GoTrue)** и централизована в `src/context/AuthContext.tsx`.

### Регистрация (`signUp`)
1. Клиент проверяет валидность имени пользователя (`username`):
   - Минимум 3 символа.
   - Разрешены только символы `a-z`, `A-Z`, `0-9` и знак `_`.
2. Перед вызовом регистрации проверяется уникальность `username`:
   ```ts
   const { data: existingUser } = await supabase
     .from('profiles')
     .select('id')
     .eq('username', cleanUsername)
     .maybeSingle();
   ```
   Если имя занято, выбрасывается понятная ошибка.
3. Вызывается `supabase.auth.signUp({ email, password, options: { data: { username, display_name } } })`.
4. В таблицу `profiles` вставляется запись с `id = user.id`. Для предотвращения коллизий с возможными триггерами в базе используется `.upsert()`.

### Вход и выход (`signIn`, `signOut`)
- `signIn`: вызывает `supabase.auth.signInWithPassword`, восстанавливает профиль из `profiles`.
- `signOut`: вызывает `supabase.auth.signOut`, сбрасывает локальное состояние React.
- Сессия сохраняется в LocalStorage браузера и синхронизируется через Cookies для серверной проверки сессий.

---

## 2. Загрузка аватара (`uploadAvatar`)
Функция реализована в `AuthContext.tsx` и вызывается со страницы настроек (`/settings`):
1. **Валидация типа файла**:
   ```ts
   const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
   ```
2. **Валидация размера**:
   ```ts
   const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
   ```
3. **Загрузка в бакет `avatars`**:
   - Путь в хранилище: `${user.id}/avatar-${Date.now()}.${ext}`
   - `supabase.storage.from('avatars').upload(filePath, file, { upsert: true })`
4. **Получение URL**:
   - `supabase.storage.from('avatars').getPublicUrl(filePath)`
5. **Обновление профиля**:
   - Запись нового URL в `profiles.avatar_url`.

---

## 3. Редактирование данных (`updateProfile`)
Пользователь может изменить:
- `display_name` (до 50 символов)
- `bio` (описание до 500 символов)
- `username` (с проверкой на уникальность перед сохранением)
Изменения валидируются на клиенте и отправляются через `supabase.from('profiles').update(...).eq('id', user.id)`.
