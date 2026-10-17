import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const css = await readFile(new URL('../src/app/profile/page.module.css', import.meta.url), 'utf8');
const styles = Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => [match[1], match[1]]));
const track = (id, title, genre) => ({ id, title, genre, artist: 'Исполнитель', coverUrl: '/music-placeholder.svg', source: 'library' });
const favorite = track('favorite', 'Моя любимая песня', 'Джаз');
const recent = track('recent', 'Моя последняя песня', 'Электроника');
const user = { id: 'me', user_metadata: { username: 'мой_ник' } };
let auth, personal, catalog, friends, following;
const plays = [];
const reset = () => {
  auth = { user, loading: false, profile: { id: user.id, username: 'мой_ник', display_name: 'Моё имя', bio: 'Моё описание', avatar_url: '/my-avatar.png' } };
  personal = { loading: false, error: '', data: { userId: user.id, favoriteIds: ['favorite'], playlists: [{ id: 'playlist', title: 'Мой плейлист', description: '', trackIds: ['favorite'], shared: false }], history: [{ trackId: 'recent', playedAt: '2026-10-16T09:20:00Z' }] } };
  catalog = { library: { tracks: [favorite, recent] }, error: '' };
  friends = { result: { userId: user.id, count: 2 } };
  following = null;
  plays.length = 0;
};
let ProfileContent;
function TestLink({ children, ...props }) { return React.createElement('a', props, children); }
const dependencies = name => {
  if (name === 'next/link') return TestLink;
  if (name.endsWith('.css')) return styles;
  if (name.endsWith('BlockUser')) return { BlockUser: () => null };
  if (name.endsWith('ProfileContent')) return { ProfileContent };
  if (name.endsWith('MusicLists')) return { MusicTracks: ({ tracks }) => React.createElement('div', { 'data-track-ids': tracks.map(t => t.id).join(',') }, tracks.map(t => t.title).join(', ')) };
  if (name.endsWith('PlaylistCover')) return { PlaylistCover: ({ title }) => React.createElement('span', null, title) };
  if (name.endsWith('AuthContext')) return { useAuth: () => auth };
  if (name.endsWith('PersonalMusicContext')) return { usePersonalMusic: () => personal };
  if (name.endsWith('useMusicLibrary')) return { useMusicLibrary: () => catalog };
  if (name.endsWith('useProfileFriendCount')) return { useProfileFriendCount: () => friends };
  if (name.endsWith('PlayerContext')) return { usePlayer: () => ({ playTrack: (...args) => plays.push(args), listeningControl: following }) };
  return require(name);
};
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(dependencies, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
({ ProfileContent } = await load('../src/components/Profile/ProfileContent.tsx'));
const ProfilePage = (await load('../src/app/profile/page.tsx')).default;
const { AccountPrivacy } = await load('../src/components/Profile/AccountPrivacy.tsx');
const render = () => renderToStaticMarkup(React.createElement(ProfilePage));

test('owner profile shows real playlists and favorite songs instead of history', () => {
  reset(); const html = render();
  assert.match(html, /Моё имя/); assert.match(html, /Моё описание/);
  assert.match(html, /2<\/span><span class="statLbl">Друзей/);
  assert.match(html, /1<\/span><span class="statLbl">Плейлистов/);
  assert.match(html, /1<\/span><span class="statLbl">Любимых треков/);
  assert.match(html, /class="genreTag">Джаз/);
  assert.match(html, /Мой плейлист/); assert.match(html, /Показывать в профиле: Мой плейлист/);
  assert.match(html, /Моя любимая песня/);
  assert.doesNotMatch(html, /Недавно прослушано|Моя последняя песня|128 ч|Starboy|dateTime=/);
});

test('empty account, loading and failed data remain distinct', () => {
  reset(); personal.data.favoriteIds = []; personal.data.playlists = []; friends.result.count = 0; auth.profile.bio = null;
  const empty = render();
  assert.match(empty, /0<\/span><span class="statLbl">Друзей/);
  assert.match(empty, /0<\/span><span class="statLbl">Плейлистов/);
  assert.match(empty, /Описание профиля пока не добавлено/);
  assert.match(empty, /Любимых песен пока нет/);
  personal = { data: null, loading: true, error: '' }; friends.result = null;
  const loading = render(); assert.match(loading, /Загружаем плейлисты/); assert.doesNotMatch(loading, /Любимых песен пока нет/);
  personal.loading = false; personal.error = 'Ошибка музыки'; friends.result = { error: 'Ошибка друзей' };
  const failed = render();
  assert.match(failed, /—<\/span><span class="statLbl">Плейлистов/);
  assert.match(failed, /Плейлисты сейчас недоступны/);
});

test('guest and account changes do not display the previous account private collections', () => {
  reset(); auth.user = { id: 'other', user_metadata: { username: 'новый_ник' } };
  const switched = render(); assert.match(switched, /новый_ник/);
  assert.doesNotMatch(switched, /Моё имя|Моё описание|my-avatar|Мой плейлист|Моя любимая песня/);
  auth.user = null; const guest = render();
  assert.match(guest, /Войдите, чтобы увидеть свой профиль/); assert.doesNotMatch(guest, /Мой плейлист|Моя любимая песня/);
});

test('visitors see the viewed profile music and no owner editing controls', () => {
  reset();
  const html = renderToStaticMarkup(React.createElement(ProfileContent, { profile: { id: 'other', username: 'artist', display_name: 'Друг' }, music: { favoriteIds: ['recent'], playlists: [{ id: 'public', title: 'Открытая подборка', description: '', trackIds: ['recent'], shared: true }] }, friendCount: 4, loading: false, error: '', retry: () => {}, isOwner: false }));
  assert.match(html, /Друг/); assert.match(html, /Открытая подборка/); assert.match(html, /Моя последняя песня/);
  assert.doesNotMatch(html, /Редактировать профиль|Управлять плейлистами|Показывать в профиле|Мой плейлист|Моя любимая песня|Недавно прослушано/);
});

test('unavailable favorites do not become demo songs or made-up genres', () => {
  reset(); personal.data.favoriteIds = ['removed']; const html = render();
  assert.match(html, /Любимые песни сейчас недоступны в каталоге/);
  assert.doesNotMatch(html, /class="genreTag">|Starboy|Моя любимая песня/);
});

test('locked visitor profile shows identity without details, counts, music or edit controls', () => {
  reset();
  const html=renderToStaticMarkup(React.createElement(ProfileContent,{profile:{id:'other',username:'private_user',display_name:'Закрытый пользователь',bio:'Секретное описание',is_private:true},music:personal.data,friendCount:99,detailsVisible:false,loading:false,error:'',retry:()=>{},isOwner:false}));
  assert.match(html,/Закрытый пользователь|private_user/);assert.match(html,/Это закрытый аккаунт/);
  assert.doesNotMatch(html,/Секретное описание|Мой плейлист|Моя любимая песня|99<|Жанры любимых треков|Редактировать профиль|Показывать в профиле/);
});

test('privacy controls use the confirmed account setting and stay disabled until it loads', () => {
  reset();auth.profile.is_private=true;
  let html=renderToStaticMarkup(React.createElement(AccountPrivacy));
  assert.match(html.match(/<input[^>]+aria-label="Закрытый аккаунт"[^>]*>/)[0],/checked/);
  assert.doesNotMatch(html.match(/<input[^>]+aria-label="Публичный аккаунт"[^>]*>/)[0],/checked/);
  delete auth.profile.is_private;
  html=renderToStaticMarkup(React.createElement(AccountPrivacy));
  assert.match(html,/<fieldset[^>]*disabled/);assert.match(html,/Загружаем настройки приватности/);
});
