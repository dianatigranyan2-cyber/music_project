// Isolated PostgreSQL policy check, without connecting to Supabase.
// npm install --prefix .next/notifications-db-check --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
// node tests/check-social-presence-db.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const requireRunner = createRequire(new URL('../.next/notifications-db-check/package.json', import.meta.url));
const { PGlite } = requireRunner('@electric-sql/pglite');
const db = new PGlite();
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const D = '00000000-0000-4000-8000-000000000004';
const migration = await readFile(new URL('../supabase/social_presence.sql', import.meta.url), 'utf8');
const setTopic = async (topic) => { await db.query("SELECT set_config('realtime.topic', $1, false)", [topic]); };
const canRead = async (extension) => (await db.query(
  'SELECT EXISTS (SELECT 1 FROM realtime.messages WHERE extension = $1) AS allowed', [extension],
)).rows[0].allowed;
const publish = (extension) => db.query('INSERT INTO realtime.messages (extension) VALUES ($1)', [extension]);
const denied = (extension) => assert.rejects(publish(extension), (error) => error.code === '42501');

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE SCHEMA realtime;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS
      $$ SELECT current_setting('realtime.topic', true) $$;
    CREATE TABLE public.friend_requests (sender_id uuid, receiver_id uuid, status text);
    INSERT INTO public.friend_requests VALUES
      ('${A}', '${B}', 'accepted'), ('${A}', '${C}', 'pending'), ('${C}', '${D}', 'accepted');
    ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
    CREATE POLICY participants ON public.friend_requests FOR SELECT TO authenticated USING
      (sender_id = auth.uid() OR receiver_id = auth.uid());
    CREATE TABLE realtime.messages (extension text);
    INSERT INTO realtime.messages VALUES ('presence'), ('broadcast');
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth, realtime TO authenticated, anon;
    GRANT SELECT ON public.friend_requests TO authenticated;
    GRANT SELECT, INSERT ON realtime.messages TO authenticated;
    -- Existing permissive policies must not bypass the new topic guards.
    CREATE POLICY old_read ON realtime.messages FOR SELECT TO authenticated USING (true);
    CREATE POLICY old_write ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true);
  `);
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${A}', false);`);

  await setTopic(`melo:presence:${A}`);
  assert.equal(await canRead('presence'), true);
  await publish('presence');
  assert.equal(await canRead('broadcast'), false);
  await denied('broadcast');

  await setTopic(`melo:presence:${B}`);
  assert.equal(await canRead('presence'), true);
  await denied('presence');
  for (const id of [C, D]) {
    await setTopic(`melo:presence:${id}`);
    assert.equal(await canRead('presence'), false);
    await denied('presence');
  }
  console.log('PASS: own presence publishing, friend read access, pending/stranger and wrong-extension denial');

  await setTopic(`melo:typing:${A}:${B}`);
  assert.equal(await canRead('broadcast'), true);
  await publish('broadcast');
  assert.equal(await canRead('presence'), false);
  await denied('presence');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [B]);
  assert.equal(await canRead('broadcast'), true);
  await publish('broadcast');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [C]);
  assert.equal(await canRead('broadcast'), false);
  await denied('broadcast');
  await setTopic(`melo:typing:${A}:${C}`);
  assert.equal(await canRead('broadcast'), false);
  await denied('broadcast');
  console.log('PASS: pair-only typing and pending friendship denial, despite older broad policies');

  await setTopic('unrelated:existing-channel');
  assert.equal(await canRead('broadcast'), true);
  await publish('broadcast');
  await db.exec('RESET ROLE; SET ROLE anon;');
  await assert.rejects(db.query("SELECT public.melo_social_access('anything', 'presence', false)"),
    (error) => error.code === '42501');
  console.log('PASS: repeatable migration, unrelated policies preserved, anonymous helper access denied');
} finally {
  await db.close();
}
