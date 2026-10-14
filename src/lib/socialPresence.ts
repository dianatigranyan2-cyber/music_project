export type OnlineStatus = 'online' | 'offline' | 'unknown';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function typingTopic(firstId: string | null, secondId: string | null): string | null {
  if (!firstId || !secondId || !uuid.test(firstId) || !uuid.test(secondId)) return null;
  const ids = [firstId.toLowerCase(), secondId.toLowerCase()].sort();
  return ids[0] === ids[1] ? null : `melo:typing:${ids.join(':')}`;
}

export function onlineStatusLabel(status: OnlineStatus, lastSeenAt: string | null = null, now = new Date()): string {
  if (status === 'online') return 'В сети';
  if (!lastSeenAt) return 'Время посещения пока неизвестно';
  const seen = new Date(lastSeenAt);
  if (!Number.isFinite(seen.getTime())) return 'Время посещения пока неизвестно';
  const time = seen.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = seen.toDateString() === now.toDateString() ? 'сегодня'
    : seen.toDateString() === yesterday.toDateString() ? 'вчера'
    : seen.toLocaleDateString('ru-RU');
  return `Был(а) в сети ${day} в ${time}`;
}

export function hasOnlineSession(state: Record<string, unknown>): boolean {
  return Object.values(state).some((sessions) => Array.isArray(sessions) && sessions.length > 0);
}

export function typingSignal(payload: unknown, peerId: string): boolean | null {
  if (!payload || typeof payload !== 'object') return null;
  const signal = payload as Record<string, unknown>;
  return signal.userId === peerId && typeof signal.typing === 'boolean' ? signal.typing : null;
}
