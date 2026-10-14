import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = JSON.parse(await readFile(path.join(root, 'music/library.json'), 'utf8'));
const output = path.join(root, '.music-import');
await mkdir(path.join(output, 'audio'), { recursive: true });
await mkdir(path.join(output, 'licenses'), { recursive: true });
const hosts = new Set(['incompetech.com', 'audio.chriszabriskie.com', 'chriszabriskie.com', 'archive.org']);
const MAX_BYTES = 50 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = [];
const previous = await readFile(path.join(output, 'report.json'), 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
let save = Promise.resolve();

async function download(url, max = MAX_BYTES) {
  let response;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const allowed = hosts.has(url.hostname) || url.hostname.endsWith('.archive.org');
    if (url.protocol !== 'https:' || !allowed) throw new Error('Unapproved source: ' + url);
    response = await fetch(url, { signal: AbortSignal.timeout(90000), redirect: 'manual' });
    if (![301,302,303,307,308].includes(response.status)) break;
    if (redirects === 5) throw new Error('Too many redirects');
    const location = response.headers.get('location');
    if (!location) throw new Error('Missing redirect destination');
    await response.body?.cancel();
    url = new URL(location, url);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  if (Number(response.headers.get('content-length')) > max) throw new Error('File exceeds size limit');
  const parts = []; let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > max) throw new Error('File exceeds size limit');
    parts.push(part);
  }
  return Buffer.concat(parts);
}
async function retry(operation) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await operation(); } catch (caught) { error = caught; }
  }
  throw error;
}
const queue = [...library.tracks];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const track = queue.shift();
    const destination = path.join(output, 'audio', track.audioPath);
    let bytes;
    try { bytes = await readFile(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const known = previous.find(row => row.id === track.id);
    if (bytes && (!known || known.sha256 !== hash(bytes))) throw new Error('Unverified existing file: ' + destination);
    if (!bytes) {
      bytes = await retry(() => download(new URL(track.downloadUrl)));
      const mp3 = bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
      const m4a = bytes.subarray(4, 8).toString() === 'ftyp';
      if (bytes.length < 10000 || (track.audioPath.endsWith('.mp3') ? !mp3 : !m4a)) throw new Error('Not an audio file: ' + track.title);
      await writeFile(destination + '.part', bytes);
      await rename(destination + '.part', destination);
    }
    report.push({ id: track.id, path: track.audioPath, bytes: bytes.length, sha256: hash(bytes) });
    // Persist completed files so interrupted runs can safely resume.
    save = save.then(async () => {
      const merged = new Map([...previous, ...report].map(row => [row.id, row]));
      await writeFile(path.join(output, 'report.json.part'), JSON.stringify([...merged.values()], null, 2) + '\n');
      await rename(path.join(output, 'report.json.part'), path.join(output, 'report.json'));
    });
    await save;
    console.log('Prepared: ' + track.artist + ' — ' + track.title);
  }
}));
for (const [name, url] of Object.entries(library.licenseEvidence)) {
  const bytes = await retry(() => download(new URL(url), 2 * 1024 * 1024));
  await writeFile(path.join(output, 'licenses', name + '.html'), bytes);
}
console.log(`Ready: ${report.length} tracks, ${(report.reduce((sum, row) => sum + row.bytes, 0) / 1024 / 1024).toFixed(1)} MiB. Files: .music-import/audio`);
