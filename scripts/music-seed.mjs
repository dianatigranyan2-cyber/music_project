import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = JSON.parse(await readFile(path.join(root, 'music/library.json'), 'utf8'));
const report = JSON.parse(await readFile(path.join(root, '.music-import/report.json'), 'utf8'));
const q = value => value == null ? 'null' : typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const lines = ['-- Upload all .music-import/audio files to music-audio BEFORE running this seed.', 'begin;'];
lines.push(`do $$ begin if (select count(*) from storage.objects where bucket_id = 'music-audio' and name in (${library.tracks.map(t => q(t.audioPath)).join(',')})) <> ${library.tracks.length} then raise exception 'Upload all ${library.tracks.length} prepared audio files to music-audio before publishing'; end if; end $$;`);
for (const a of library.artists) lines.push(`insert into public.music_artists (id,slug,name,source_url) values (${[a.id,a.slug,a.name,a.sourceUrl].map(q)}) on conflict (id) do nothing;`);
for (const a of library.albums) lines.push(`insert into public.music_albums (id,artist_id,slug,title,release_year,source_url) values (${[a.id,a.artistId,a.slug,a.title,a.year,a.sourceUrl].map(q)}) on conflict (id) do nothing;`);
for (const t of library.tracks) {
  const r = report.find(row => row.id === t.id);
  if (!r) throw new Error('Missing prepared audio: ' + t.title);
  const bytes = await readFile(path.join(root, '.music-import/audio', t.audioPath));
  if (createHash('sha256').update(bytes).digest('hex') !== r.sha256) throw new Error('Changed audio: ' + t.title);
  const values=[t.id,t.artistId,t.albumId,t.title,t.trackNumber,t.duration,t.genre,t.audioPath,r.sha256,r.bytes,t.sourceId,t.sourceUrl,t.licenseCode,t.licenseUrl,t.attribution];
  lines.push(`insert into public.music_tracks (id,artist_id,album_id,title,track_number,duration_seconds,genre,audio_path,audio_sha256,audio_bytes,source_id,source_url,license_code,license_url,attribution,is_published) values (${values.map(q)},true) on conflict (id) do nothing;`);
}
lines.push('commit;', '');
await writeFile(path.join(root, '.music-import/seed.sql'), lines.join('\n'));
console.log('Verified audio and generated .music-import/seed.sql: ' + library.tracks.length + ' tracks.');
