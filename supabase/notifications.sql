-- Run this entire file in the Supabase SQL Editor before using the inbox.
-- Existing likes and friendships are not backfilled: only new events notify.
BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (length(type) > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT notifications_no_self CHECK (actor_id IS NULL OR recipient_id <> actor_id),
  CONSTRAINT notifications_event_unique UNIQUE (recipient_id, type, event_key)
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (recipient_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Clients can read their inbox and change ONLY read_at. Notification content
-- and recipients are written by database triggers, never by browser requests.
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = recipient_id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = recipient_id)
  WITH CHECK ((SELECT auth.uid()) = recipient_id);

CREATE OR REPLACE FUNCTION public.notify_story_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  story_owner uuid;
BEGIN
  IF NEW.reaction IS DISTINCT FROM '❤️' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.reaction = '❤️' AND OLD.story_id = NEW.story_id AND OLD.user_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT user_id INTO story_owner FROM public.stories
  WHERE id = NEW.story_id AND expires_at > now();

  IF story_owner IS NULL OR story_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, actor_id, type, payload, event_key)
  VALUES (
    story_owner, NEW.user_id, 'story_like',
    jsonb_build_object('story_id', NEW.story_id),
    NEW.story_id::text || ':' || NEW.user_id::text
  )
  -- Unliking and liking the same story again must not spam its owner.
  ON CONFLICT (recipient_id, type, event_key) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_story_like() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_on_story_like ON public.story_reactions;
CREATE TRIGGER notifications_on_story_like
  AFTER INSERT OR UPDATE OF reaction, story_id, user_id ON public.story_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_story_like();

CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending' THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status = 'pending' THEN
        RETURN NEW;
      END IF;
    END IF;

    INSERT INTO public.notifications (recipient_id, actor_id, type, payload, event_key)
    VALUES (
      NEW.receiver_id, NEW.sender_id, 'friend_request_received',
      jsonb_build_object('request_id', NEW.id), NEW.id::text
    )
    ON CONFLICT (recipient_id, type, event_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type, payload, event_key)
      VALUES (
        NEW.sender_id, NEW.receiver_id, 'friend_request_accepted',
        jsonb_build_object('request_id', NEW.id), NEW.id::text
      )
      ON CONFLICT (recipient_id, type, event_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_friend_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_on_friend_request ON public.friend_requests;
CREATE TRIGGER notifications_on_friend_request
  AFTER INSERT OR UPDATE OF status ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
