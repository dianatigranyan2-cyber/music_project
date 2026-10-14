// Isolated PostgreSQL; never connects to the real Supabase project.
// npm install --prefix .music-import/db-check --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../.music-import/db-check/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
const migration = await readFile(new URL('../supabase/music_library.sql', import.meta.url), 'utf8');
const licenses = await readFile(new URL('../supabase/music_library_licenses.sql', import.meta.url), 'utf8');
const seed = await readFile(new URL('../.music-import/seed.sql', import.meta.url), 'utf8');
const library = JSON.parse(await readFile(new URL('../music/library.json', import.meta.url), 'utf8'));
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant all on storage.objects to anon,authenticated;
    create policy legacy_all on storage.objects for all to anon,authenticated using(true) with check(true);`);
  await db.exec(migration); await db.exec(migration);
  await db.exec(licenses); await db.exec(licenses);
  await assert.rejects(db.exec(seed), /Upload all \d+ prepared/);
  await db.exec('rollback;');
  for (const t of library.tracks) await db.query('insert into storage.objects values ($1,$2)', ['music-audio',t.audioPath]);
  await db.exec(seed); await db.exec(seed);
  assert.equal((await db.query('select count(*)::int as n from music_tracks')).rows[0].n, library.tracks.length);
  const t = library.tracks[0], album = library.albums[0];
  await assert.rejects(db.query('update music_tracks set album_id=$1 where id=$2',[album.id,t.id]), error => error.code === '23503');
  await assert.rejects(db.query("update music_tracks set license_url='https://creativecommons.org/licenses/by-sa/3.0/' where id=$1",[t.id]), error => error.code === '23514');
  await db.query('update music_tracks set is_published=false where id=$1',[t.id]);
  for (const role of ['anon','authenticated']) {
    await db.exec('set role ' + role);
    assert.equal((await db.query('select count(*)::int as n from music_tracks')).rows[0].n,library.tracks.length-1);
    assert.equal((await db.query('select count(*)::int as n from music_artists')).rows[0].n,library.artists.length);
    await assert.rejects(db.exec('delete from music_tracks'), error => error.code === '42501');
    await assert.rejects(db.exec('update music_artists set name=\'Spoofed artist\''), error => error.code === '42501');
    await assert.rejects(db.exec("insert into storage.objects values ('music-audio','overwrite.mp3')"), error => error.code === '42501');
    assert.equal((await db.query("delete from storage.objects where bucket_id='music-audio' returning name")).rows.length,0);
    assert.equal((await db.query("update storage.objects set name='overwrite.mp3' where bucket_id='music-audio' returning name")).rows.length,0);
    await db.exec("insert into storage.objects values ('stories','unaffected-social-file')");
    await db.exec('reset role;');
  }
  await db.query('update music_tracks set is_published=false where artist_id=$1',[album.artistId]);
  await db.exec('set role anon;');
  assert.equal((await db.query('select count(*)::int as n from music_artists')).rows[0].n,library.artists.length-1);
  assert.equal((await db.query('select id from music_albums where id=$1',[album.id])).rows.length,0);
  console.log(`Music SQL passed: repeatable migration/seed, upload prerequisite, ${library.tracks.length} tracks, licence pairing, RLS, write denial and album ownership.`);
} finally { await db.close(); }
