import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendMessageToast, incomingMessageFor, isOpenConversation, messageToastPreview,
} from '../src/lib/messageNotifications.ts';

const message = {
  id: 'message-1', sender_id: 'friend', receiver_id: 'me', content: 'Привет!', read_at: null,
};

test('only new incoming messages addressed to this account qualify', () => {
  assert.deepEqual(incomingMessageFor(message, 'me'), message);
  for (const value of [
    null, {}, { ...message, receiver_id: 'another-account' },
    { ...message, sender_id: 'me' }, { ...message, read_at: '2026-10-13T10:00:00Z' },
    { ...message, content: null }, { ...message, id: '' },
  ]) assert.equal(incomingMessageFor(value, 'me'), null);
});

test('the selected dialog suppresses toasts without requiring window focus or visibility', () => {
  assert.equal(isOpenConversation('friend', 'friend', '/messages'), true);
  assert.equal(isOpenConversation('friend', 'friend', '/'), false);
  assert.equal(isOpenConversation('friend', 'other-friend', '/messages'), false);
  assert.equal(isOpenConversation('friend', null, '/messages'), false);
});

test('preview handles story replies, whitespace, and emoji without broken characters', () => {
  assert.equal(messageToastPreview({ ...message, content: '  Привет!\n Как\tдела?  ' }), 'Привет! Как дела?');
  assert.equal(messageToastPreview({ ...message, is_story_reply: true }), 'Ответ на историю: Привет!');
  assert.equal(messageToastPreview({ ...message, story_id: 'story', content: ' ' }), 'Ответ на вашу историю');
  assert.equal(messageToastPreview({ ...message, content: '' }), 'Новое сообщение');
  assert.equal(messageToastPreview({ ...message, content: '🎵'.repeat(130) }), '🎵'.repeat(120) + '…');
});

const toast = (id, arrivalOrder) => ({
  id, arrivalOrder, senderId: 'friend', senderName: 'Друг', avatarUrl: null, preview: 'Привет!',
});

test('duplicate delivery cannot create a second toast or restart its lifetime', () => {
  const current = [toast('a', 1)];
  assert.equal(appendMessageToast(current, toast('a', 10)), current);
});

test('bursts retain the latest three even when profile lookups finish out of order', () => {
  let current = [toast('a', 1), toast('c', 3), toast('d', 4)];
  current = appendMessageToast(current, toast('b', 2));
  assert.deepEqual(current.map(({ id }) => id), ['b', 'c', 'd']);
  current = appendMessageToast(current, toast('e', 5));
  assert.deepEqual(current.map(({ id }) => id), ['c', 'd', 'e']);
});
