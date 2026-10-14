-- Apply after social_presence.sql. Saves server-confirmed activity timestamps.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_activity TO authenticated;

DROP POLICY IF EXISTS user_activity_read ON public.user_activity;
CREATE POLICY user_activity_read ON public.user_activity FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.friend_requests f WHERE f.status = 'accepted' AND (
      (f.sender_id = (SELECT auth.uid()) AND f.receiver_id = user_activity.user_id)
      OR (f.receiver_id = (SELECT auth.uid()) AND f.sender_id = user_activity.user_id)
    )
  )
);

-- No user id or timestamp arguments: clients can only update their own activity,
-- using the database clock. Direct client writes are not permitted.
CREATE OR REPLACE FUNCTION public.touch_user_activity()
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  seen timestamptz;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  INSERT INTO public.user_activity AS activity (user_id, last_seen_at)
  VALUES (caller, statement_timestamp())
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = greatest(activity.last_seen_at, EXCLUDED.last_seen_at)
  RETURNING last_seen_at INTO seen;
  RETURN seen;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_user_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_user_activity() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
