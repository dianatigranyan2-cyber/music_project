// Read-only verification of the published catalogue and uploaded audio.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
  const i = line.indexOf('='); return [line.slice(0,i), line.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];
}));
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const library = JSON.parse(await readFile('music/library.json','utf8'));
const report = JSON.parse(await readFile('.music-import/report.json','utf8'));
const response = await fetch(base + '/rest/v1/music_tracks?select=id,artist_id,album_id,title,audio_path,is_published,license_code&order=id', { headers: { apikey:key }, signal:AbortSignal.timeout(30000) });
assert.equal(response.status,200,'Public catalogue request');
const rows = await response.json();
assert.equal(rows.length,library.tracks.length,'Published track count');
for (const track of library.tracks) {
  const row = rows.find(item => item.id === track.id);
  assert.ok(row,track.title + ' published');
  assert.equal(row.artist_id,track.artistId); assert.equal(row.album_id,track.albumId);
  assert.equal(row.license_code,track.licenseCode); assert.equal(row.is_published,true);
}
const queue = [...library.tracks];
await Promise.all(Array.from({length:3},async () => {
  while (queue.length) {
    const track=queue.shift(), expected=report.find(row => row.id === track.id);
    const audio = await fetch(base + '/storage/v1/object/public/music-audio/' + track.audioPath, { headers:{Range:'bytes=0-4095'},signal:AbortSignal.timeout(30000) });
    assert.equal(audio.status,206,'Range playback: ' + track.title);
    assert.equal(audio.headers.get('content-range'),'bytes 0-4095/' + expected.bytes,'Complete file size: ' + track.title);
    const bytes=Buffer.from(await audio.arrayBuffer());
    assert.equal(bytes.length,4096);
    const local=await readFile('.music-import/audio/' + track.audioPath);
    assert.ok(bytes.equals(local.subarray(0,4096)),'Audio bytes: ' + track.title);
    console.log('Verified playback bytes: '+track.title);
  }
}));
console.log(`Remote library passed: ${rows.length} published tracks and ${library.tracks.length} public audio files with HTTP Range support.`);
