# 06. База данных Supabase

## 1. Схема базы данных

База данных Melo развернута в облачной среде Supabase (PostgreSQL).

### Структура таблиц
- **`profiles`**:
  - `id` (`UUID`, PK, ссылка на `auth.users.id`)
  - `username` (`TEXT`, UNIQUE, NOT NULL)
  - `display_name` (`TEXT`)
  - `bio` (`TEXT`)
  - `avatar_url` (`TEXT`)
  - `created_at`, `updated_at` (`TIMESTAMPTZ`)
- **`friend_requests`**:
  - `id` (`UUID`, PK)
  - `sender_id` (`UUID`, FK к `profiles.id`)
  - `receiver_id` (`UUID`, FK к `profiles.id`)
  - `status` (`TEXT`: `'pending'`, `'accepted'`, `'rejected'`)
  - `created_at`, `updated_at` (`TIMESTAMPTZ`)
- **`messages`**:
  - `id` (`UUID`, PK)
  - `sender_id` (`UUID`, FK к `profiles.id`)
  - `receiver_id` (`UUID`, FK к `profiles.id`)
  - `content` (`TEXT`, NOT NULL)
  - `created_at` (`TIMESTAMPTZ`)
  - `read_at` (`TIMESTAMPTZ`, NULL если не прочитано)
  - `edited_at` (`TIMESTAMPTZ`, NULL если не редактировалось)
  - `story_id` (`UUID`, FK к `stories.id`, NULLable)
  - `is_story_reply` (`BOOLEAN`, default false)
- **`stories`**:
  - `id` (`UUID`, PK)
  - `user_id` (`UUID`, FK к `profiles.id`)
  - `media_url` (`TEXT`)
  - `media_path` (`TEXT`, NOT NULL — путь в Storage 'stories')
  - `media_type` (`TEXT`: `'image'` или `'video'`)
  - `created_at` (`TIMESTAMPTZ`)
  - `expires_at` (`TIMESTAMPTZ`, срок жизни истории)
- **`story_views`**:
  - `id` (`UUID`, PK), `story_id` (`UUID`), `viewer_id` (`UUID`), `created_at`
- **`story_reactions`**:
  - `id` (`UUID`, PK), `story_id` (`UUID`), `user_id` (`UUID`), `emoji` (`TEXT`), `created_at`

---

## 2. Хранимые процедуры (RPC)

### `edit_own_message`
Функция безопасности для изменения текста сообщений:
```sql
CREATE OR REPLACE FUNCTION edit_own_message(p_message_id UUID, p_new_content TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET content = p_new_content,
      edited_at = NOW()
  WHERE id = p_message_id AND sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or unauthorized';
  END IF;
END;
$$;
```

---

## 3. Realtime конфигурация
Для работы мгновенных уведомлений о сообщениях в панели Supabase включена публикация:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

---

## 4. Разделение: Что подтверждено в коде vs Что в облаке
1. **Подтверждено кодом проекта**: имена всех таблиц, список полей, типы запросов (`select`, `insert`, `update`, `delete`, `rpc`), бакеты `avatars` и `stories`.
2. **Находится в облаке Supabase**: DDL скрипты (файлов миграций нет в git), RLS политики, триггеры `auth.users -> profiles`.
