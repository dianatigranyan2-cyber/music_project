import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as audius from '../src/lib/audius.ts';

const require = createRequire(import.meta.url);
async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true}}).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(name => name === 'server-only' ? {} : dependencies[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
const server = await load('../src/lib/audiusServer.ts', {'./audius': audius});
const raw = (changes = {}) => ({
  id: 'G0wyE', title: 'Song', duration: 123, genre: 'Electronic', permalink: '/account/song',
  user: {name: 'Uploader', handle: 'account', is_verified: false}, license: 'All rights reserved',
  is_streamable: true, is_available: true, is_stream_gated: false, access: {stream: true}, ...changes,
});
const normalized = changes => audius.normalizeAudiusTrack(raw(changes));

test('Audius input allows ordinary search and canonical song links, never arbitrary resolver destinations', () => {
  assert.deepEqual(audius.audiusInput('  Любимая песня  '), {kind: 'search', value: 'Любимая песня'});
  assert.deepEqual(audius.audiusInput('https://www.audius.co/artist/song?share=1#part'), {kind: 'url', value: 'https://audius.co/artist/song'});
  for (const value of ['', 'x', 'a'.repeat(201), 'https://localhost/song/x', 'https://audius.co.evil.test/a/b', 'https://evil.test/a/b', 'http://audius.co/a/b', 'https://user:pass@audius.co/a/b', 'https://audius.co:444/a/b', 'https://audius.co/profile']) assert.equal(audius.audiusInput(value), null);
  for (const id of ['../secret', 'song?token=secret', 'https://evil.test', 'a', 'a'.repeat(65)]) assert.equal(audius.audiusTrackId(id), null);
});

test('metadata preserves the uploader label and actual license instead of inventing artist ownership or CC permission', () => {
  const track = normalized();
  assert.equal(track.account.name, 'Uploader'); assert.equal(track.account.verified, false);
  assert.equal(track.license, 'All rights reserved'); assert.equal(track.sourceUrl, 'https://audius.co/account/song');
  assert.equal('artist' in track, false);
  for (const value of [null, {}, raw({permalink: 'https://evil.test/a/b'}), raw({duration: 0}), raw({duration: Infinity}), raw({id: '../bad'}), raw({user: {}})]) assert.equal(audius.normalizeAudiusTrack(value), null);
});

test('open streams are technically available; missing data remains a review instead of a legal guarantee', () => {
  assert.equal(audius.assessAudiusTrack(normalized()).status, 'available');
  assert.equal(audius.assessAudiusTrack(normalized()).canPreview, true);
  const unknownAccess = audius.assessAudiusTrack(normalized({access: null}));
  assert.equal(unknownAccess.status, 'review'); assert.equal(unknownAccess.canPreview, false);
  const unknownLicense = audius.assessAudiusTrack(normalized({license: null}));
  assert.equal(unknownLicense.status, 'review'); assert.equal(unknownLicense.canPreview, true);
});

test('gates, deleted/private tracks and app restrictions are never previewed, even if the current API user has access', () => {
  for (const changes of [
    {is_delete: true}, {is_available: false}, {is_streamable: false}, {access: {stream: false}},
    {is_unlisted: true}, {is_scheduled_release: true}, {is_stream_gated: true},
    {stream_conditions: {usdc_purchase: {price: 1}}}, {access_authorities: ['address']}, {allowed_api_keys: ['app-address']},
  ]) {
    const result = audius.assessAudiusTrack(normalized(changes));
    assert.equal(result.status, 'unavailable', JSON.stringify(changes));
    assert.equal(result.canPreview, false);
  }
});

test('server search is bounded, supports links through the official resolver and preserves pagination', async () => {
  const original = globalThis.fetch; const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({url: new URL(url), init});
    return Response.json({data: url.includes('/resolve?') ? raw() : Array.from({length: 12}, () => raw())});
  };
  try {
    const search = await server.searchAudius('Song', 12);
    assert.equal(search.tracks.length, 12); assert.equal(search.hasMore, true); assert.equal(search.nextOffset, 24);
    assert.equal(requests[0].url.origin, 'https://api.audius.co'); assert.equal(requests[0].url.searchParams.get('limit'), '12');
    const resolved = await server.searchAudius('https://audius.co/account/song?share=1', 0);
    assert.equal(resolved.tracks[0].id, 'G0wyE'); assert.equal(resolved.hasMore, false);
    assert.equal(requests[1].url.pathname, '/v1/resolve');
    assert.equal(requests[1].url.searchParams.get('url'), 'https://audius.co/account/song');
    await assert.rejects(server.searchAudius('https://evil.test/a/b', 0), {status: 400});
    await assert.rejects(server.searchAudius('Song', 1001), {status: 400});
    assert.equal(requests.length, 2);
  } finally {globalThis.fetch = original;}
});

test('fresh access-info can revoke a stale search result; checks do not trust client-supplied permissions', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => Response.json({data: url.endsWith('/access-info') ? {access: {stream: false}} : raw()});
  try {
    const check = await server.checkAudius('G0wyE');
    assert.equal(check.assessment.canPreview, false); assert.equal(check.assessment.status, 'unavailable');
    assert.ok(Number.isFinite(Date.parse(check.checkedAt)));
    globalThis.fetch = async url => Response.json({data: url.endsWith('/access-info') ? {} : raw()});
    const incomplete = await server.checkAudius('G0wyE');
    assert.equal(incomplete.assessment.canPreview, false); assert.equal(incomplete.assessment.status, 'review');
  } finally {globalThis.fetch = original;}
});

test('the optional bearer token is sent only in server headers and never appears in returned data or stream URLs', async () => {
  const original = globalThis.fetch; const previousToken = process.env.AUDIUS_BEARER_TOKEN; const requests = [];
  process.env.AUDIUS_BEARER_TOKEN = 'server-test-secret';
  globalThis.fetch = async (url, init) => {requests.push({url, init}); return Response.json({data: [raw()]});};
  try {
    const result = await server.searchAudius('Song', 0);
    assert.equal(requests[0].init.headers.Authorization, 'Bearer server-test-secret');
    assert.doesNotMatch(requests[0].url, /secret/); assert.doesNotMatch(JSON.stringify(result), /secret/);
    assert.equal(result.mode, 'token'); assert.equal(server.audiusPublicStream('G0wyE'), 'https://api.audius.co/v1/tracks/G0wyE/stream?app_name=Melo');
    delete process.env.AUDIUS_BEARER_TOKEN; await server.searchAudius('Song', 0);
    assert.equal(requests[1].init.headers.Authorization, undefined); assert.equal(server.audiusConnectionMode(), 'public');
  } finally {globalThis.fetch = original; if (previousToken === undefined) delete process.env.AUDIUS_BEARER_TOKEN; else process.env.AUDIUS_BEARER_TOKEN = previousToken;}
});

test('upstream failures have actionable, sanitized errors rather than leaking provider bodies or secrets', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, expected] of [[404, 404], [429, 429], [401, 503], [403, 503], [500, 502]]) {
      globalThis.fetch = async () => new Response('secret upstream diagnostics', {status});
      await assert.rejects(server.searchAudius('Song', 0), error => error.status === expected && !error.message.includes('secret'));
    }
    globalThis.fetch = async () => {throw new Error('private network diagnostics');};
    await assert.rejects(server.searchAudius('Song', 0), error => error.status === 503 && !error.message.includes('private'));
    globalThis.fetch = async () => Response.json({unexpected: raw()});
    await assert.rejects(server.searchAudius('Song', 0), {status: 502});
    globalThis.fetch = async () => Response.json({data: {id: 'playlist'}});
    await assert.rejects(server.searchAudius('https://audius.co/account/playlist', 0), {status: 400});
  } finally {globalThis.fetch = original;}
});

let admin = false; let calls = 0; let permitted = true;
const route = await load('../src/app/api/music/admin/audius/route.ts', {
  '../../../../../lib/audiusCatalog': {importAudiusTrack: async () => {calls++; return {id:'saved'};}, editAudiusTrack: async () => {calls++; return {id:'edited'};}},
  '../../../../../lib/musicAdminAuth': {musicAdminClient: async () => admin ? {} : null},
  '../../../../../lib/audiusServer': {...server,
    searchAudius: async () => {calls++; return {tracks: [normalized()]};},
    checkAudius: async id => {calls++; return {track: {...normalized(), id}, assessment: {canPreview: permitted}};},
  },
});
test('the Audius endpoint authorizes before making upstream search, check or preview requests', async () => {
  admin = false; calls = 0;
  for (const query of ['q=Song', 'track=G0wyE', 'track=G0wyE&preview=1']) {
    const response = await route.GET(new Request('http://localhost/api/music/admin/audius?' + query));
    assert.equal(response.status, 403); assert.match(response.headers.get('cache-control'), /no-store/);
  }
  assert.equal(calls, 0);
  for (const method of ['POST','PATCH']) {
    assert.equal((await route[method](new Request('http://localhost/api/music/admin/audius', {method, body:'{}'}))).status,403);
  }
  assert.equal(calls,0);
});
test('preview redirects only for a freshly allowed track and never includes app credentials', async () => {
  admin = true; permitted = false;
  const request = () => new Request('http://localhost/api/music/admin/audius?track=G0wyE&preview=1');
  assert.equal((await route.GET(request())).status, 403);
  permitted = true; const response = await route.GET(request());
  assert.equal(response.status, 307); assert.equal(response.headers.get('location'), server.audiusPublicStream('G0wyE'));
  assert.doesNotMatch(response.headers.get('location'), /token|secret|Authorization/);
  const badPage = await route.GET(new Request('http://localhost/api/music/admin/audius?q=Song&offset=-1'));
  assert.equal(badPage.status, 400);
});
