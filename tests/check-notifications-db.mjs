// Isolated SQL integration check. No connection to the project's Supabase.
// npm install --prefix .next/notifications-db-check --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
// node tests/check-notifications-db.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const requireRunner = createRequire(new URL('../.next/notifications-db-check/package.json', import.meta.url));
const { PGlite } = requireRunner('@electric-sql/pglite');
const db = new PGlite();
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const STORY = '10000000-0000-4000-8000-000000000001';
const EXPIRED = '10000000-0000-4000-8000-000000000002';
const REQUEST = '20000000-0000-4000-8000-000000000001';
const migration = await readFile(new URL('../supabase/notifications.sql', import.meta.url), 'utf8');
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0].value;
const count = async (where = 'true') => Number(await scalar(`SELECT count(*) AS value FROM public.notifications WHERE ${where}`));
const forbidden = async (sql) => {
  await assert.rejects(db.query(sql), (error) => error.code === '42501');
};

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id),
      username text, display_name text, avatar_url text
    );
    CREATE TABLE public.stories (
      id uuid PRIMARY KEY, user_id uuid REFERENCES public.profiles(id), expires_at timestamptz
    );
    CREATE TABLE public.story_reactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      story_id uuid REFERENCES public.stories(id), user_id uuid REFERENCES public.profiles(id), reaction text
    );
    CREATE TABLE public.friend_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id uuid REFERENCES public.profiles(id), receiver_id uuid REFERENCES public.profiles(id), status text
    );
    CREATE PUBLICATION supabase_realtime;
    INSERT INTO auth.users VALUES ('${A}'), ('${B}'), ('${C}');
    INSERT INTO public.profiles (id, username) VALUES ('${A}', 'a'), ('${B}', 'b'), ('${C}', 'c');
    INSERT INTO public.stories VALUES
      ('${STORY}', '${A}', now() + interval '1 day'),
      ('${EXPIRED}', '${A}', now() - interval '1 day');
    INSERT INTO public.story_reactions (story_id, user_id, reaction) VALUES ('${STORY}', '${B}', '❤️');
  `);

  await db.exec(migration);
  await db.exec(migration);
  assert.equal(await count(), 0, 'migration is repeatable and does not backfill old events');
  assert.equal(Number(await scalar(`SELECT count(*) AS value FROM pg_publication_tables WHERE tablename='notifications'`)), 1);
  console.log('PASS: migration, repeatability, no backfill, Realtime publication');

  await db.exec(`DELETE FROM public.story_reactions;
    INSERT INTO public.story_reactions (story_id, user_id, reaction) VALUES ('${STORY}', '${B}', '❤️');`);
  assert.equal(await count(`recipient_id='${A}' AND actor_id='${B}' AND type='story_like' AND read_at IS NULL`), 1);
  await db.exec(`UPDATE public.story_reactions SET reaction='❤️';
    UPDATE public.story_reactions SET reaction='🔥';
    UPDATE public.story_reactions SET reaction='❤️';
    DELETE FROM public.story_reactions;
    INSERT INTO public.story_reactions (story_id, user_id, reaction) VALUES ('${STORY}', '${B}', '❤️');`);
  assert.equal(await count(), 1, 'repeated likes do not spam the owner');
  await db.exec(`INSERT INTO public.story_reactions (story_id, user_id, reaction) VALUES ('${STORY}', '${C}', '🔥');`);
  assert.equal(await count(), 1, 'non-heart reactions do not notify');
  await db.exec(`UPDATE public.story_reactions SET reaction='❤️' WHERE user_id='${C}';`);
  assert.equal(await count(), 2, 'changing a non-heart to a heart notifies');
  await db.exec(`INSERT INTO public.story_reactions (story_id, user_id, reaction) VALUES
    ('${STORY}', '${A}', '❤️'), ('${EXPIRED}', '${B}', '❤️');`);
  assert.equal(await count(), 2, 'no self notifications or expired-story notifications');
  console.log('PASS: likes, reaction changes, deduplication, self/expired exclusions');

  await db.exec(`INSERT INTO public.friend_requests VALUES ('${REQUEST}', '${A}', '${B}', 'pending');`);
  assert.equal(await count(`recipient_id='${B}' AND actor_id='${A}' AND type='friend_request_received'`), 1);
  await db.exec(`UPDATE public.friend_requests SET status='accepted' WHERE id='${REQUEST}';
    UPDATE public.friend_requests SET status='accepted' WHERE id='${REQUEST}';`);
  assert.equal(await count(`recipient_id='${A}' AND actor_id='${B}' AND type='friend_request_accepted'`), 1);
  await db.exec(`INSERT INTO public.friend_requests (sender_id, receiver_id, status) VALUES ('${A}', '${C}', 'pending');
    UPDATE public.friend_requests SET status='declined' WHERE receiver_id='${C}';`);
  assert.equal(await count(`type='friend_request_accepted'`), 1);
  console.log('PASS: request recipient, acceptance recipient, rejection, duplicate updates');

  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${A}';`);
  assert.equal(await count(), 3, 'only current recipient can read');
  assert.equal(await count(`recipient_id='${B}'`), 0, 'other recipient inbox is hidden');
  const ownRead = await db.query(`UPDATE public.notifications SET read_at=now() WHERE type='story_like' RETURNING id`);
  assert.equal(ownRead.rows.length, 2);
  const otherRead = await db.query(`UPDATE public.notifications SET read_at=now() WHERE recipient_id='${B}' RETURNING id`);
  assert.equal(otherRead.rows.length, 0, 'cannot mark another inbox read');
  await forbidden(`UPDATE public.notifications SET type='forged'`);
  await forbidden(`UPDATE public.notifications SET recipient_id='${B}'`);
  await forbidden(`INSERT INTO public.notifications (recipient_id, type, event_key) VALUES ('${A}', 'forged', '1')`);
  await forbidden(`DELETE FROM public.notifications`);
  await forbidden(`SELECT public.notify_story_like()`);
  await forbidden(`SELECT public.notify_friend_request()`);
  await db.exec('RESET ROLE; SET ROLE anon;');
  await forbidden(`SELECT * FROM public.notifications`);
  console.log('PASS: own-only RLS, read_at-only updates, no client forgery/deletion/function calls, no anon access');

  await db.exec(`RESET ROLE;
    INSERT INTO public.notifications (recipient_id, type, event_key, payload)
    VALUES ('${A}', 'future_event', 'future-1', '{"extra":"data"}');`);
  assert.equal(await count(`type='future_event'`), 1, 'new event types need no enum migration');
  await db.exec(`INSERT INTO public.stories VALUES
    ('10000000-0000-4000-8000-000000000003', '${C}', now() + interval '1 day');
    GRANT INSERT ON public.story_reactions, public.friend_requests TO authenticated;
    SET ROLE authenticated; SET request.jwt.claim.sub='${A}';
    INSERT INTO public.story_reactions (story_id, user_id, reaction)
    VALUES ('10000000-0000-4000-8000-000000000003', '${A}', '❤️');
    RESET ROLE;`);
  assert.equal(await count(`recipient_id='${C}' AND actor_id='${A}' AND type='story_like'`), 1,
    'a client action creates a notification through the trigger despite having no notifications INSERT grant');
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${C}';
    INSERT INTO public.friend_requests (sender_id, receiver_id, status) VALUES ('${C}', '${A}', 'pending');
    RESET ROLE;`);
  assert.equal(await count(`recipient_id='${A}' AND actor_id='${C}' AND type='friend_request_received'`), 1);
  console.log('PASS: database triggers work for authenticated client actions');
  await db.exec(`DELETE FROM public.story_reactions WHERE user_id='${B}';
    DELETE FROM public.friend_requests WHERE sender_id='${B}' OR receiver_id='${B}';
    DELETE FROM public.profiles WHERE id='${B}';`);
  assert.equal(await count(`recipient_id='${A}' AND actor_id IS NULL`), 3, 'history survives a removed actor profile');
  console.log('PASS: future event types and deleted actor profile');
  const D = '00000000-0000-4000-8000-000000000004';
  await db.exec(`INSERT INTO auth.users VALUES ('${D}');
    INSERT INTO public.notifications (recipient_id, type, event_key, created_at)
    SELECT '${D}', 'inbox_test', 'old-' || n, '2026-10-13T08:00:00Z'::timestamptz
    FROM generate_series(1, 25) AS n;
    INSERT INTO public.notifications (recipient_id, type, event_key, created_at)
    VALUES ('${D}', 'inbox_test', 'arrived-later', '2026-10-13T08:01:00Z');
    SET ROLE authenticated; SET request.jwt.claim.sub='${D}';`);
  const readAll = await db.query(`UPDATE public.notifications SET read_at=now()
    WHERE recipient_id='${D}' AND read_at IS NULL AND created_at <= '2026-10-13T08:00:00Z'
    RETURNING id`);
  assert.equal(readAll.rows.length, 25, 'opening the inbox marks items beyond the first page too');
  assert.equal(await count('read_at IS NULL'), 1, 'notifications arriving after the snapshot remain unread');
  assert.equal(await count(`event_key='arrived-later' AND read_at IS NULL`), 1);
  await db.exec('RESET ROLE;');
  assert.equal(await count(`recipient_id='${D}' AND read_at IS NOT NULL`), 25, 'read status is persisted');
  console.log('PASS: bulk read across pages, persisted state, later arrivals remain unread');
  console.log('All isolated database checks passed.');
} finally {
  await db.close();
}
