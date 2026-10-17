// Isolated PostgreSQL only. Uses the same optional PGlite installation as check-music-db.mjs.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../.music-import/db-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; create table public.music_tracks(id uuid primary key,is_published boolean); grant select on public.music_tracks to authenticated;`);
await db.exec(readFileSync(new URL('../supabase/personal_music.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/personal_music.sql',import.meta.url),'utf8'));
const u='00000000-0000-4000-8000-000000000001', v='00000000-0000-4000-8000-000000000002', p='00000000-0000-4000-8000-000000000003', a='00000000-0000-4000-8000-000000000004', b='00000000-0000-4000-8000-000000000005', hidden='00000000-0000-4000-8000-000000000006';
await db.exec(`insert into auth.users values ('${u}'),('${v}'); insert into music_tracks values ('${a}',true),('${b}',true),('${hidden}',false); set role authenticated; set request.jwt.claim.sub='${u}'; insert into music_playlists(id,title) values ('${p}','Evening'); insert into music_favorites(track_id) values ('${a}');`);
await db.exec(`select music_playlist_add_track('${p}','${a}'); select music_playlist_add_track('${p}','${b}'); select music_playlist_add_track('${p}','${a}');`);
assert.equal((await db.query('select * from music_playlist_tracks')).rows.length,2);
await db.exec(`select music_playlist_reorder('${p}',array['${b}','${a}']::uuid[]);`);
assert.deepEqual((await db.query('select track_id from music_playlist_tracks order by position')).rows.map(r=>r.track_id),[b,a]);
await assert.rejects(db.exec(`select music_playlist_reorder('${p}',array['${b}','${b}']::uuid[]);`));
await assert.rejects(db.exec(`insert into music_favorites(track_id) values ('${hidden}');`));
await assert.rejects(db.exec(`update music_playlists set user_id='${v}' where id='${p}';`));
await db.exec(`set request.jwt.claim.sub='${v}';`);
assert.equal((await db.query('select * from music_playlists')).rows.length,0);
assert.equal((await db.query('select * from music_favorites')).rows.length,0);
assert.equal((await db.query('select * from music_playlist_tracks')).rows.length,0);
await assert.rejects(db.exec(`select music_playlist_add_track('${p}','${a}');`));
await assert.rejects(db.exec(`insert into music_playlist_tracks values ('${p}','${hidden}',3);`));
await db.exec(`delete from music_playlists where id='${p}'; set role anon;`);
await assert.rejects(db.exec('select * from music_playlists'));
await assert.rejects(db.exec(`select music_playlist_add_track('${p}','${a}');`));
await db.exec(`set role authenticated; set request.jwt.claim.sub='${u}'; delete from music_playlists where id='${p}';`);
assert.equal((await db.query('select * from music_playlist_tracks')).rows.length,0);
await db.close();console.log('PASS: idempotent migration, favorites, duplicate add, atomic reorder, private RLS, cross-owner protections, anonymous denial, cascading delete');


