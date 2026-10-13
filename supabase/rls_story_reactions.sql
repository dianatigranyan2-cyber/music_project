-- ==============================================================================
-- Диагностика и миграция: RLS и Realtime для таблицы story_reactions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- ШАГ 0 (ДИАГНОСТИКА): Запрос для проверки ВСЕХ текущих политик таблицы story_reactions.
-- Выполните этот запрос в SQL Editor Supabase, чтобы увидеть, какие политики уже действуют:
-- ------------------------------------------------------------------------------
/*
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'story_reactions';
*/

-- ------------------------------------------------------------------------------
-- ОСНОВНАЯ МИГРАЦИЯ
-- Идемпотентна (безопасна для повторного запуска).
-- НЕ затрагивает существующие INSERT, UPDATE и DELETE политики.
-- ------------------------------------------------------------------------------

-- 1. Включаем RLS на таблице story_reactions (если ещё не включен)
ALTER TABLE IF EXISTS public.story_reactions ENABLE ROW LEVEL SECURITY;

-- 2. Динамически удаляем ВСЕ старые SELECT-политики на story_reactions,
-- независимо от их названий (чтобы не оставалось политик с широким доступом)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'story_reactions'
          AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.story_reactions', pol.policyname);
    END LOOP;
END $$;

-- 3. Создаем единую строгую политику SELECT:
-- Реакцию могут читать ТОЛЬКО:
--   а) Пользователь, поставивший её (auth.uid() = user_id)
--   б) Владелец истории, к которой оставлена реакция (stories.user_id = auth.uid())
-- Посторонние пользователи доступа к реакциям не имеют.
CREATE POLICY "story_reactions_select_owner_and_author"
ON public.story_reactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM public.stories
    WHERE public.stories.id = public.story_reactions.story_id
      AND public.stories.user_id = auth.uid()
  )
);

-- 4. КРИТИЧЕСКИ ВАЖНО ДЛЯ REALTIME DELETE:
-- По умолчанию PostgreSQL использует REPLICA IDENTITY DEFAULT, при котором
-- при операции DELETE в WAL-лог пишется только PRIMARY KEY (id), а поля story_id
-- и user_id в старой записи (OLD) равны NULL.
-- Из-за этого:
--   а) Серверный фильтр Realtime `filter: story_id=eq.X` не срабатывает и отбрасывает событие.
--   б) RLS-проверка на чтение удаляемой записи для владельца истории не может проверить story_id.
-- Установка REPLICA IDENTITY FULL заставляет PostgreSQL включать все столбцы в запись DELETE,
-- обеспечивая доставку события Realtime клиенту.
ALTER TABLE public.story_reactions REPLICA IDENTITY FULL;

-- 5. Добавляем story_reactions в публикацию Supabase Realtime (безопасно для повторного вызова)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'story_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_reactions;
  END IF;
END $$;
