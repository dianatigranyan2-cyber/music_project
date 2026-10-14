import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { hasOnlineSession, onlineStatusLabel, typingSignal, typingTopic } from '../src/lib/socialPresence.ts';

const me = '11111111-1111-4111-8111-111111111111';
const peer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('both participants join the same canonical channel; invalid and self dialogs are excluded', () => {
  assert.equal(typingTopic(me, peer), typingTopic(peer.toUpperCase(), me));
  assert.equal(typingTopic(me, peer), `melo:typing:${me}:${peer}`);
  for (const pair of [[null, peer], [me, null], [me, 'bad-id'], [me, me]]) {
    assert.equal(typingTopic(...pair), null);
  }
});

test('presence stays online while any session remains; unknown status is distinct from offline', () => {
  assert.equal(hasOnlineSession({}), false);
  assert.equal(hasOnlineSession({ user: [] }), false);
  assert.equal(hasOnlineSession({ first: [], second: [{ presence_ref: 'tab-2' }] }), true);
  assert.equal(onlineStatusLabel('unknown'), 'Время посещения пока неизвестно');
  assert.equal(onlineStatusLabel('offline'), 'Время посещения пока неизвестно');
  assert.equal(onlineStatusLabel('online'), 'В сети');
});

test('last visit uses local time and distinguishes today, yesterday and older dates', () => {
  const now = new Date(2026, 9, 13, 15, 0);
  const seen = new Date(2026, 9, 13, 14, 32).toISOString();
  assert.equal(onlineStatusLabel('offline', seen, now), 'Был(а) в сети сегодня в 14:32');
  assert.equal(onlineStatusLabel('online', seen, now), 'В сети');
  assert.equal(onlineStatusLabel('offline', new Date(2026, 9, 12, 22, 5).toISOString(), now),
    'Был(а) в сети вчера в 22:05');
  assert.equal(onlineStatusLabel('offline', new Date(2026, 8, 12, 8, 5).toISOString(), now),
    'Был(а) в сети 12.09.2026 в 08:05');
  assert.equal(onlineStatusLabel('offline', 'invalid', now), 'Время посещения пока неизвестно');
});

test('only a boolean signal from the current peer is accepted', () => {
  assert.equal(typingSignal({ userId: peer, typing: true }, peer), true);
  assert.equal(typingSignal({ userId: peer, typing: false }, peer), false);
  for (const payload of [null, {}, { userId: me, typing: true }, { userId: peer, typing: 'true' }]) {
    assert.equal(typingSignal(payload, peer), null);
  }
});

const source = await readFile(new URL('../src/hooks/useTypingIndicator.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

async function typingHarness() {
  let now = 10_000;
  let index = 0;
  const slots = [];
  const timers = new Map();
  const effects = [];
  const listeners = new Map();
  const sent = [];
  let received;
  let status;
  let removed = false;
  let channelOptions;
  const channel = {
    on(_type, _filter, callback) { received = callback; return this; },
    subscribe(callback) { status = callback; return this; },
    send(message) { sent.push(message); return Promise.resolve('ok'); },
  };
  const supabase = {
    realtime: { setAuth: async () => {} },
    channel(topic, options) { channelOptions = { topic, ...options }; return channel; },
    removeChannel: async () => { removed = true; },
  };
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], (value) => { slots[slot] = value; }];
    },
    useRef(initial) {
      const slot = index++;
      return slots[slot] ??= { current: initial };
    },
    useCallback: (callback) => callback,
    useEffect: (effect) => { if (!effects.length) effects.push(effect); },
  };
  const target = {
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: (event) => listeners.delete(event),
  };
  const document = { ...target, visibilityState: 'visible' };
  const module = { exports: {} };
  const require = (name) => {
    if (name === 'react') return react;
    if (name.endsWith('supabase/client')) return { createClient: () => supabase };
    if (name.endsWith('socialPresence')) return { typingTopic, typingSignal };
    throw new Error(name);
  };
  let nextTimer = 0;
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'window', 'document', 'Date', compiled)(
    require, module, module.exports,
    (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    (id) => timers.delete(id), target, document, { now: () => now },
  );
  const render = () => { index = 0; return module.exports.useTypingIndicator(me, peer); };
  render();
  const cleanup = effects[0]();
  await Promise.resolve();
  status('SUBSCRIBED');
  return {
    render, sent, cleanup, listeners, document,
    receive: (payload) => received({ payload }),
    status: (value) => status(value),
    channelOptions: () => channelOptions,
    removed: () => removed,
    advance(ms) {
      const until = now + ms;
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].callback();
      }
      now = until;
    },
  };
}

test('typing broadcasts contain no draft, throttle while writing, and stop after a pause', async () => {
  const harness = await typingHarness();
  assert.equal(harness.channelOptions().config.private, true);
  harness.render().updateTyping(true);
  harness.advance(1_000);
  harness.render().updateTyping(true);
  assert.equal(harness.sent.length, 1);
  harness.advance(1_000);
  harness.render().updateTyping(true);
  assert.equal(harness.sent.length, 2);
  harness.advance(2_999);
  assert.equal(harness.sent.at(-1).payload.typing, true);
  harness.advance(1);
  assert.deepEqual(harness.sent.at(-1).payload, { userId: me, typing: false });
  assert.deepEqual(Object.keys(harness.sent[0].payload), ['userId', 'typing']);
  harness.cleanup();
});

test('sending a message stops typing immediately without waiting for the pause timer', async () => {
  const harness = await typingHarness();
  harness.render().updateTyping(true);
  harness.render().stopTyping();
  assert.equal(harness.sent.at(-1).payload.typing, false);
  const count = harness.sent.length;
  harness.advance(3_000);
  assert.equal(harness.sent.length, count);
  harness.receive({ userId: peer, typing: true });
  harness.receive({ userId: peer, typing: false });
  assert.equal(harness.render().isTyping, false);
  harness.cleanup();
});

test('peer typing expires after disconnect and stale events are ignored after leaving the dialog', async () => {
  const harness = await typingHarness();
  harness.receive({ userId: peer, typing: true });
  assert.equal(harness.render().isTyping, true);
  harness.advance(3_999);
  assert.equal(harness.render().isTyping, true);
  harness.advance(1);
  assert.equal(harness.render().isTyping, false);
  harness.receive({ userId: me, typing: true });
  assert.equal(harness.render().isTyping, false);
  harness.receive({ userId: peer, typing: true });
  assert.equal(harness.render().isTyping, true);
  harness.cleanup();
  harness.receive({ userId: peer, typing: true });
  assert.equal(harness.render().isTyping, false);
  assert.equal(harness.removed(), true);
});

test('hiding the window sends stop; lost subscription clears the peer indicator', async () => {
  const harness = await typingHarness();
  harness.render().updateTyping(true);
  harness.document.visibilityState = 'hidden';
  harness.listeners.get('visibilitychange')();
  assert.equal(harness.sent.at(-1).payload.typing, false);
  harness.receive({ userId: peer, typing: true });
  harness.status('CHANNEL_ERROR');
  assert.equal(harness.render().isTyping, false);
  harness.cleanup();
});
