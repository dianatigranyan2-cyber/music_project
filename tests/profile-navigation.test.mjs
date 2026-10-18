import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {AppIcon} from './helpers/app-icon.mjs';

const require = createRequire(import.meta.url);
const links = [];
const effects = [];
let openInbox = false;
let refValue = null;
const inbox = {notifications: [], unreadCount: 0, markAsRead() {}, markAllAsRead() {}};
function TestLink(props) {
  links.push(props);
  return React.createElement('a', props, props.children);
}
let Avatar;
async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'react') return {...React,
      useState: value => [value === false && openInbox ? true : value, () => {}],
      useRef: () => ({current: refValue}), useId: () => 'test-panel',
      useEffect: fn => effects.push(fn),
    };
    if (name === 'next/link') return TestLink;
    if (name.endsWith('.css')) return {__esModule: true, default: new Proxy({}, {get: (_, key) => key})};
    if (name.endsWith('/Avatar')) return {Avatar};
    if (name.endsWith('/AppIcon')) return {AppIcon};
    if (name.endsWith('/AuthContext')) return {useAuth: () => ({user: {id: 'me'}})};
    if (name.endsWith('/PlayerContext')) return {usePlayer: () => ({setSearchQuery() {}})};
    if (name.endsWith('/useNotifications')) return {useNotifications: () => inbox};
    if (name.endsWith('/notifications')) return require('../src/lib/notifications.ts');
    if (name.endsWith('/StoryEditor')) return {StoryEditor: () => null};
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
({Avatar} = await load('../src/components/Profile/Avatar.tsx'));
const {StoriesBar} = await load('../src/components/Stories/StoriesBar.tsx');
const {MessageToastStack} = await load('../src/components/Notifications/MessageToastStack.tsx');
const {NotificationsBell} = await load('../src/components/Notifications/NotificationsBell.tsx');

test('avatars use the real encoded username, including when the photo is missing', () => {
  for (const src of ['/photo.jpg', null]) {
    const html = renderToStaticMarkup(React.createElement(Avatar, {src, username: 'Другая/страница', alt: 'Имя'}));
    assert.match(html, /href="\/profile\/%D0%94%D1%80%D1%83%D0%B3%D0%B0%D1%8F%2F%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0"/);
    assert.match(html, /aria-label="Открыть профиль: Имя"/);
    if (!src) assert.match(html, /src="\/icons\/profile.png"/);
  }
  const own = renderToStaticMarkup(React.createElement(Avatar, {ownProfile: true, username: 'me', alt: 'Я'}));
  assert.match(own, /href="\/profile"/);
  const unknown = renderToStaticMarkup(React.createElement(Avatar, {alt: 'Удалённый пользователь'}));
  assert.doesNotMatch(unknown, /<a\b/);
});

test('avatar navigation stops the surrounding chat action without cancelling the link', () => {
  let stopped = 0, opened = 0;
  const avatar = Avatar({username: 'friend', alt: 'Друг', onProfileOpen: () => opened++});
  avatar.props.onClick({stopPropagation: () => stopped++});
  assert.equal(stopped, 1);
  assert.equal(opened, 1);
  assert.equal(avatar.props.href, '/profile/friend');
});

test('story photos open stories, and own photo without a story opens upload instead of profile', () => {
  let uploads = 0;
  const opened = [];
  refValue = {click: () => uploads++};
  const stories = [
    {id: 'story', userId: 'friend-id', userName: 'Имя друга', userAvatar: null, hasUnseen: true},
    {id: 'my-story', userId: 'me', userName: 'Я', userAvatar: null, isCurrentUser: true},
    {id: 'current-user-add', userId: 'me', userName: 'Я', userAvatar: null, isCurrentUser: true},
  ];
  const view = StoriesBar({stories, onSelectStory: story => opened.push(story.id)});
  const buttons = [];
  function walk(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === 'button') buttons.push(node);
    React.Children.forEach(node.props.children, walk);
  }
  walk(view);
  const photoButtons = buttons.filter(button => button.props.className === 'storyAvatarButton');
  assert.equal(photoButtons.length, 3);
  photoButtons.forEach(button => button.props.onClick());
  assert.deepEqual(opened, ['story', 'my-story']);
  assert.equal(uploads, 1);
  buttons.find(button => button.props['aria-label'] === 'Добавить историю').props.onClick({stopPropagation() {}});
  assert.equal(uploads, 2);
  const html = renderToStaticMarkup(React.createElement(StoriesBar, {stories: [
    ...stories,
  ]}));
  assert.doesNotMatch(html, /<a\b/);
  assert.match(html, /aria-label="Открыть истории: Имя друга"/);
  assert.match(html, /aria-label="Добавить историю"/);
  assert.doesNotMatch(html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<a\b/);
  assert.doesNotMatch(html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/);
  refValue = null;
});

test('message toast avatar opens its sender profile while the text still opens the conversation', () => {
  links.length = 0;
  const dismissed = [];
  const html = renderToStaticMarkup(React.createElement(MessageToastStack, {
    toasts: [{id: 'message', senderId: 'id', senderUsername: 'sender_handle', senderName: 'Имя отправителя', preview: 'Привет'}],
    chatOpen: false, onDismiss: id => dismissed.push(id), onOpen() {},
  }));
  assert.match(html, /href="\/profile\/sender_handle"/);
  assert.match(html, /aria-label="Открыть диалог с Имя отправителя: Привет"/);
  assert.doesNotMatch(html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<a\b/);
  links.find(link => link.href === '/profile/sender_handle').onClick({stopPropagation() {}});
  assert.deepEqual(dismissed, ['message']);
});

test('bell notifications keep the actor profile separate from the notification destination', () => {
  openInbox = true;
  inbox.notifications = [{id: 'notification', type: 'story_like', actor_id: 'friend',
    actor: {username: 'liker', display_name: 'Друг'}, payload: {story_id: '00000000-0000-4000-8000-000000000001'}, created_at: '2026-10-18T10:00:00Z'}];
  const html = renderToStaticMarkup(React.createElement(NotificationsBell));
  assert.match(html, /href="\/profile\/liker"/);
  assert.match(html, /href="\/stories\/00000000-0000-4000-8000-000000000001"/);
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/);
  assert.doesNotMatch(html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<a\b/);
  openInbox = false;
});
