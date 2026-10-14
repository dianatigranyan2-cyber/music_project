-- Apply in Supabase SQL Editor to enable private online status and typing.
-- Does not change existing application tables or their policies.
BEGIN;

CREATE OR REPLACE FUNCTION public.melo_social_access(channel_topic text, channel_extension text, writing boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT CASE
    WHEN channel_extension = 'presence' THEN
      channel_topic = 'melo:presence:' || (SELECT auth.uid())::text
      OR (NOT writing AND EXISTS (
        SELECT 1 FROM public.friend_requests f
        WHERE f.status = 'accepted' AND (
          (f.sender_id = (SELECT auth.uid()) AND channel_topic = 'melo:presence:' || f.receiver_id::text)
          OR (f.receiver_id = (SELECT auth.uid()) AND channel_topic = 'melo:presence:' || f.sender_id::text)
        )
      ))
    WHEN channel_extension = 'broadcast' THEN EXISTS (
      SELECT 1 FROM public.friend_requests f
      WHERE f.status = 'accepted'
        AND (f.sender_id = (SELECT auth.uid()) OR f.receiver_id = (SELECT auth.uid()))
        AND channel_topic = 'melo:typing:'
          || least(f.sender_id::text, f.receiver_id::text) || ':'
          || greatest(f.sender_id::text, f.receiver_id::text)
    )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.melo_social_access(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.melo_social_access(text, text, boolean) TO authenticated;

DROP POLICY IF EXISTS melo_social_receive ON realtime.messages;
CREATE POLICY melo_social_receive ON realtime.messages FOR SELECT TO authenticated
USING (public.melo_social_access((SELECT realtime.topic()), extension, false));

DROP POLICY IF EXISTS melo_social_publish ON realtime.messages;
CREATE POLICY melo_social_publish ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (public.melo_social_access((SELECT realtime.topic()), extension, true));

-- Restrictive guards keep older broad policies from opening these specific
-- topic prefixes. Unrelated Realtime channels retain their existing rules.
DROP POLICY IF EXISTS melo_social_receive_guard ON realtime.messages;
CREATE POLICY melo_social_receive_guard ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  (coalesce((SELECT realtime.topic()), '') NOT LIKE 'melo:presence:%'
    AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'melo:typing:%')
  OR public.melo_social_access((SELECT realtime.topic()), extension, false)
);

DROP POLICY IF EXISTS melo_social_publish_guard ON realtime.messages;
CREATE POLICY melo_social_publish_guard ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  (coalesce((SELECT realtime.topic()), '') NOT LIKE 'melo:presence:%'
    AND coalesce((SELECT realtime.topic()), '') NOT LIKE 'melo:typing:%')
  OR public.melo_social_access((SELECT realtime.topic()), extension, true)
);

NOTIFY pgrst, 'reload schema';
COMMIT;
