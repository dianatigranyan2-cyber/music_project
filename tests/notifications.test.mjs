import assert from 'node:assert/strict';
import test from 'node:test';
import {
  notificationActorName, presentNotification, formatNotificationTime,
} from '../src/lib/notifications.ts';

const notification = {
  id: '1', recipient_id: 'owner', actor_id: 'actor',
  type: 'story_like', payload: {}, created_at: '2026-10-13T08:00:00Z', read_at: null,
  actor: { username: 'diana', display_name: 'Диана', avatar_url: null },
};

test('story likes open the referenced story; malformed data cannot become a URL', () => {
  const id = '0a10bcde-1234-4567-89ab-123456789abc';
  assert.equal(presentNotification({ ...notification, payload: { story_id: id } }).href, `/stories/${id}`);
  for (const story_id of [undefined, null, 42, {}, '../settings', 'javascript:alert(1)']) {
    assert.equal(presentNotification({ ...notification, payload: { story_id } }).href, null);
  }
});

test('friend events open their appropriate destination', () => {
  assert.equal(presentNotification({ ...notification, type: 'friend_request_received' }).href,
    '/friends?tab=requests');
  assert.equal(presentNotification({ ...notification, type: 'friend_request_accepted' }).href,
    '/friends');
});

test('a new or unexpected event type remains readable without a broken link', () => {
  for (const type of ['new_event_type', 'constructor', '__proto__']) {
    assert.deepEqual(presentNotification({ ...notification, type }), {
      icon: '🔔', text: 'Новое уведомление', href: null,
    });
  }
});

test('deleted profiles and empty display names have safe readable fallbacks', () => {
  assert.equal(notificationActorName(notification), 'Диана');
  assert.equal(notificationActorName({ ...notification,
    actor: { ...notification.actor, display_name: '  ' } }), 'diana');
  assert.equal(notificationActorName({ ...notification, actor: null }), 'Пользователь');
});

test('invalid dates do not show Invalid Date in the inbox', () => {
  assert.equal(formatNotificationTime('invalid'), '');
  assert.notEqual(formatNotificationTime(notification.created_at), '');
});
