// Isolated PostgreSQL check; no connection to the project's Supabase.
// Use the temporary PGlite installation described in check-social-presence-db.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const requireRunner = createRequire(new URL('../.next/notifications-db-check/package.json', import.meta.url));
const { PGlite } = requireRunner('@electric-sql/pglite');
const db = new PGlite();
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const migration = await readFile(new URL('../supabase/last_seen.sql', import.meta.url), 'utf8');
const asUser = async (id) => { await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]); };
const visible = async () => (await db.query('SELECT user_id FROM public.user_activity ORDER BY user_id')).rows.map((row) => row.user_id);
const denied = (sql) => assert.rejects(db.query(sql), (error) => error.code === '42501');

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${A}'), ('${B}'), ('${C}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE public.friend_requests (sender_id uuid, receiver_id uuid, status text);
    INSERT INTO public.friend_requests VALUES ('${A}', '${B}', 'accepted'), ('${A}', '${C}', 'pending');
    ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
    CREATE POLICY participants ON public.friend_requests FOR SELECT TO authenticated
      USING (sender_id = auth.uid() OR receiver_id = auth.uid());
    GRANT SELECT ON public.friend_requests TO authenticated;
  `);
  await db.exec(migration);
  await db.exec(migration);
  await db.exec('SET ROLE authenticated;');
  for (const id of [A, B, C]) {
    await asUser(id);
    const { rows } = await db.query('SELECT public.touch_user_activity() AS seen, statement_timestamp() AS server_now');
    assert.ok(Math.abs(new Date(rows[0].seen) - new Date(rows[0].server_now)) < 1_000);
  }
  await asUser(A);
  assert.deepEqual(await visible(), [A, B]);
  const first = (await db.query('SELECT public.touch_user_activity() AS seen')).rows[0].seen;
  const second = (await db.query('SELECT public.touch_user_activity() AS seen')).rows[0].seen;
  assert.ok(new Date(second) >= new Date(first));
  await denied(`UPDATE public.user_activity SET last_seen_at = '2099-01-01' WHERE user_id = '${B}'`);
  await denied(`INSERT INTO public.user_activity VALUES ('${A}', '2099-01-01')`);
  await denied(`DELETE FROM public.user_activity WHERE user_id = '${A}'`);
  console.log('PASS: repeatable migration, server timestamps, own-only writes through RPC, friend-only reads');

  await db.exec(`RESET ROLE; DELETE FROM public.friend_requests WHERE status = 'accepted'; SET ROLE authenticated;`);
  assert.deepEqual(await visible(), [A]);
  await asUser('');
  await assert.rejects(db.query('SELECT public.touch_user_activity()'), (error) => error.code === '28000');
  await db.exec('RESET ROLE; SET ROLE anon;');
  await denied('SELECT public.touch_user_activity()');
  await denied('SELECT * FROM public.user_activity');
  console.log('PASS: friendship removal revokes reads, anonymous and unauthenticated writes denied');
} finally {
  await db.close();
}
