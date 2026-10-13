# 12. Запуск и настройка

## 1. Системные требования
- **Node.js**: версия 18.18.0 или выше (рекомендуется LTS 20+)
- **Менеджер пакетов**: npm, yarn, pnpm или bun
- **Учетная запись Supabase**: созданный проект на [supabase.com](https://supabase.com)

---

## 2. Пошаговая инструкция по запуску

### Шаг 1. Клонирование репозитория
```bash
git clone <url-репозитория>
cd music_project
```

### Шаг 2. Установка зависимостей
```bash
npm install
```

### Шаг 3. Настройка переменных окружения
Создайте файл `.env.local` в корневой папке проекта со следующим содержимым:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Шаг 4. Настройка проекта Supabase
1. Выполните SQL-скрипты создания таблиц (`profiles`, `friend_requests`, `messages`, `stories`, `story_views`, `story_reactions`) и RPC-функции `edit_own_message` (см. [06_database.md](./06_database.md)).
2. В разделе **Storage** создайте два бакета:
   - `avatars` (установите чекбокс **Public bucket**)
   - `stories` (оставьте **Private bucket**)
3. В разделе **Database -> Replication** добавьте таблицу `messages` в публикацию `supabase_realtime`.

### Шаг 5. Запуск сервера разработки
```bash
npm run dev
```
Откройте браузер по адресу: [http://localhost:3000](http://localhost:3000).
