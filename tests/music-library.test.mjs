import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, imports = {}) {
  const source = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(id => imports[id] ?? require(id), module, module.exports);
  return module.exports;
}
const music = load('src/lib/musicPlayback.ts');
const { filterMusic, mapLibrary } = load('src/lib/musicLibrary.ts');
const { AudioPlayback } = load('src/lib/audioPlayback.ts', { './musicPlayback': music });
const track = (id, artist = 'Kevin MacLeod') => ({ id, title: 'Carefree ' + id, artist, album: 'Сингл', source: 'library', streamUrl: 'https://example.com/' + id + '.mp3', duration: 205, genre: 'Инструментальная' });

test('search includes all words and applies actual artist and genre filters', () => {
  const a = track('a'), b = { ...track('b', 'Chris Zabriskie'), title: 'Cylinder One', genre: 'Эмбиент', album: 'Cylinders' };
  assert.deepEqual(filterMusic([a,b], ' KEVIN  carefree '), [a]);
  assert.deepEqual(filterMusic([a,b], 'cylinders'), [b]);
  assert.deepEqual(filterMusic([a,b], 'Kevin', 'Эмбиент'), []);
});
test('queue excludes prototypes, keeps selected track, and does not wrap after last song', () => {
  const a = track('a'), b = track('b');
  const queue = music.playbackQueue(a, [b, b, { ...track('demo'), source: undefined }]);
  assert.deepEqual(queue.map(t => t.id), ['b','a']);
  assert.equal(music.adjacentTrack(queue, 'a', 1), null);
  assert.equal(music.adjacentTrack(queue, 'missing', 1), null);
  assert.deepEqual(music.enqueueTrack(queue, 'b', a, true).map(t => t.id), ['b','a']);
  assert.deepEqual(music.shuffledQueue(queue, 'a').map(t => t.id), ['a','b']);
});
test('mapping uses the linked performer, album and owned storage file', () => {
  const result = mapLibrary([{ id:'t',title:'Cylinder One',artist_id:'a',album_id:'b',duration_seconds:176,genre:'Эмбиент',track_number:1,audio_path:'audio.m4a',source_url:'https://chriszabriskie.com/cylinders/',attribution:'credit',license_url:'https://creativecommons.org/licenses/by/4.0/',license_code:'CC-BY-4.0',music_artists:{id:'a',name:'Chris Zabriskie',slug:'chris-zabriskie',source_url:'https://chriszabriskie.com/'},music_albums:{id:'b',title:'Cylinders',release_year:2014} }], 'https://storage.example/music-audio');
  assert.equal(result.tracks[0].artist, 'Chris Zabriskie');
  assert.equal(result.tracks[0].albumId, 'b');
  assert.equal(result.tracks[0].streamUrl, 'https://storage.example/music-audio/audio.m4a');
  assert.equal(result.artists.length, 1);
  assert.equal(result.tracks[0].licenseCode, 'CC-BY-4.0');
});
class FakeAudio extends EventTarget {
  paused = true; currentTime = 0; duration = 205; volume = 1; muted = false; loop = false; error = null; src = '';
  playResult = () => Promise.resolve();
  play() { this.paused = false; return this.playResult(); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  load() {}
  removeAttribute() { this.src = ''; }
}
test('native audio events control time, pause, seeking, repeat and ending', () => {
  const audio = new FakeAudio(); let state; let ended = 0;
  const engine = new AudioPlayback(audio, value => state = value, () => ended++);
  assert.equal(engine.select(track('a')), true);
  audio.dispatchEvent(new Event('playing'));
  audio.currentTime = 17; audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(state.currentTime, 17); assert.equal(state.isPlaying, true);
  engine.seek(500); assert.equal(audio.currentTime, 205);
  engine.setVolume(40); engine.setMuted(true); engine.setRepeat(true);
  assert.equal(audio.volume, .4); assert.equal(audio.muted, true); assert.equal(audio.loop, true);
  audio.dispatchEvent(new Event('ended')); assert.equal(ended, 1);
  engine.dispose(); assert.equal(audio.src, '');
});
test('old rejected play promises cannot interrupt a newer song', async () => {
  const audio = new FakeAudio(); let state; let reject;
  audio.playResult = () => new Promise((resolve, fail) => reject = fail);
  const engine = new AudioPlayback(audio, value => state = value);
  engine.select(track('old'));
  audio.playResult = () => Promise.resolve();
  engine.select(track('new'));
  audio.dispatchEvent(new Event('playing'));
  reject(new Error('old request failed')); await Promise.resolve();
  assert.equal(state.isPlaying, true); assert.equal(state.error, null);
  assert.equal(engine.select({ ...track('demo'), source: undefined }), false);
  assert.equal(audio.src, track('new').streamUrl);
  engine.dispose();
});
test('catalogue retains the initial collection and links Russian vocals to their own licence and performer', () => {
  const library = JSON.parse(readFileSync(new URL('../music/library.json', import.meta.url), 'utf8'));
  assert.equal(library.tracks.filter(t=>t.licenseCode==='CC-BY-4.0').length, 24);
  assert.equal(new Set(library.tracks.map(t => t.id)).size, library.tracks.length);
  const vocals = library.tracks.filter(t=>t.language==='ru' && t.hasVocals);
  assert.equal(vocals.length, 6);
  assert.equal(filterMusic(library.tracks, 'кто-то рядом')[0].artist, 'Sector 516');
  for (const t of library.tracks) {
    assert.equal(t.artist, library.artists.find(a => a.id === t.artistId)?.name);
    assert.ok(['CC-BY-4.0','CC-BY-SA-3.0'].includes(t.licenseCode)); assert.ok(t.attribution.includes(t.artist));
    assert.equal(t.licenseUrl,t.licenseCode==='CC-BY-4.0'?'https://creativecommons.org/licenses/by/4.0/':'https://creativecommons.org/licenses/by-sa/3.0/');
    assert.ok(t.downloadUrl.startsWith('https://')); assert.ok(t.duration > 0);
    if (t.albumId) assert.equal(library.albums.find(a => a.id === t.albumId)?.artistId, t.artistId);
  }
});
