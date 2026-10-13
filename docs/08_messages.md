# 08. Личные сообщения

## 1. Мессенджер Melo
Модуль личных сообщений расположен в `src/app/messages/page.tsx`.

### Возможности:
- Двухпанельный адаптивный интерфейс (список чатов + активное окно).
- Обмен текстовыми сообщениями 1-на-1 в реальном времени.
- Статусы прочтения (две галочки, поле `read_at`).
- Редактирование сообщений (вызов RPC `edit_own_message`, отметка *(ред.)*).
- Удаление сообщений (удаление из базы данных `messages`).
- Ответы на истории с отображением карточки превью.

---

## 2. Realtime синхронизация
Компонент подписывается на каналы Supabase:
```ts
// Новые сообщения
supabase.channel(`messages-insert-${userId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, onInsert)
  .subscribe();

// Обновления (редактирование и прочтение)
supabase.channel(`messages-update-${userId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, onUpdate)
  .subscribe();

// Удаление сообщений
supabase.channel(`messages-delete-${userId}`)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, onDelete)
  .subscribe();
```

---

## 3. Ответы на истории в чате
Если сообщение отправлено как реакция на историю (`is_story_reply = true`):
1. В базе фиксируется `story_id`.
2. Функция `fetchStorySnippets` запрашивает запись истории и генерирует временную ссылку:
   ```ts
   supabase.storage.from('stories').createSignedUrl(story.media_path, 300);
   ```
3. Ссылка действует 300 секунд (5 минут).
4. **Если история удалена автором или истекла по времени**:
   - Интерфейс чата отображает бейдж: `📷 История недоступна`.
   - Это гарантирует, что чат не упадет с ошибкой и пользователь поймет, что медиа больше не существует.
