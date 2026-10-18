import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as audius from '../src/lib/audius.ts';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/components/Music/AudiusAdminPanel.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
const mod = {exports: {}};
new Function('require', 'module', 'exports', code)(name => {
  if (name.endsWith('/audius')) return audius;
  if (name.endsWith('/PlayerContext')) return {usePlayer: () => ({acquireStoryAudioFocus: () => () => {}})};
  if (name.endsWith('.css')) return {__esModule: true, default: new Proxy({}, {get: (_, key) => key})};
  return require(name);
}, mod, mod.exports);
const {AudiusAdminPanel, AudiusCheckDetails, AudiusImportForm} = mod.exports;
const track = audius.normalizeAudiusTrack({id: 'G0wyE', title: 'Song', duration: 120, user: {name: 'Uploader', handle: 'uploader'}, permalink: '/uploader/song', license: 'All rights reserved', is_streamable: true, is_available: true, access: {stream: true}});
function details(changes = {}, previewState = 'idle', catalogId = null) {
  const selected = {...track, ...changes};
  return renderToStaticMarkup(React.createElement(AudiusCheckDetails, {
    check: {track: selected, assessment: audius.assessAudiusTrack(selected), checkedAt: '2026-10-18T12:00:00Z'},
    previewState, catalogId, audioRef: {current: null}, onPlay() {}, onPlaying() {}, onWaiting() {}, onPause() {}, onError() {},
  }));
}
test('Audius search accepts a title or link without requiring a file', () => {
  const html = renderToStaticMarkup(React.createElement(AudiusAdminPanel));
  assert.match(html, /Название песни, имя аккаунта или ссылка Audius/); assert.match(html, />Найти<\/button>/);
  assert.doesNotMatch(html, /type="file"|Сохранить|Добавить в каталог/);
});
test('the review screen distinguishes uploader, license and technical availability and does not claim legal verification', () => {
  const html = details();
  assert.match(html, /Аккаунт Audius/); assert.match(html, /Uploader · @uploader/);
  assert.match(html, /All rights reserved/); assert.match(html, /не подтверждает владение авторскими правами/);
  assert.match(html, /условия Audius/);
  assert.match(html, /<audio[^>]*controls=""[^>]*preload="none"/);
  assert.match(html, /\/api\/music\/admin\/audius\?track=G0wyE&amp;preview=1/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /CC-BY|Авторские права подтверждены/);
});

test('import asks for the real performer and automatically handles source credits, restricted songs cannot be imported', () => {
  const form = changes => {const selected={...track,...changes}; return renderToStaticMarkup(React.createElement(AudiusImportForm,{check:{track:selected,assessment:audius.assessAudiusTrack(selected),checkedAt:'now'}}));};
  const html=form();
  assert.match(html,/>Добавить в Melo<\/button>/); assert.match(html,/Исполнитель<input[^>]*value=""/);
  assert.match(html,/сохранятся автоматически/); assert.doesNotMatch(html,/type="file"|<textarea/);
  assert.doesNotMatch(form({gated:true}),/>Добавить в Melo<\/button>/);
  assert.doesNotMatch(form({license:null}),/>Добавить в Melo<\/button>/);
});
test('restricted tracks have no audio element and failed previews offer a clear error', () => {
  assert.doesNotMatch(details({gated: true}), /<audio/);
  assert.match(details({gated: true}), /Прослушивание недоступно/);
  assert.match(details({}, 'error'), /Не удалось воспроизвести поток Audius/);
  assert.match(details({license: null}), /Нужна дополнительная проверка/);
  assert.match(details({}, 'loading'), /Загружаем поток Audius/);
  assert.doesNotMatch(details({}, 'loading'), /Аудио воспроизводится/);
});

test('after import the preview plays the saved Melo ID through the same route as the main player',()=>{
  const id='00000000-0000-4000-8000-000000000001';const html=details({},'idle',id);
  assert.match(html,new RegExp('/api/music/audius/'+id+'/stream'));
  assert.match(html,/Прослушивание сохранённого трека Melo/);
  assert.doesNotMatch(html,/preview=1/);
});
