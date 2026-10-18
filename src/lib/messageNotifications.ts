export interface IncomingMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at?: string | null;
  story_id?: string | null;
  is_story_reply?: boolean;
}

export interface MessageToast {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername?: string | null;
  avatarUrl: string | null;
  preview: string;
  arrivalOrder: number;
}

export function incomingMessageFor(value: unknown, userId: string): IncomingMessage | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' || !row.id ||
    typeof row.sender_id !== 'string' || !row.sender_id ||
    row.receiver_id !== userId || row.sender_id === userId ||
    typeof row.content !== 'string' || row.read_at != null
  ) return null;
  return row as unknown as IncomingMessage;
}

export function messageToastPreview(message: IncomingMessage): string {
  const text = message.content.replace(/\s+/g, ' ').trim();
  const isStoryReply = message.is_story_reply || Boolean(message.story_id);
  const preview = isStoryReply
    ? text ? `Ответ на историю: ${text}` : 'Ответ на вашу историю'
    : text || 'Новое сообщение';
  const characters = Array.from(preview);
  return characters.length > 120 ? `${characters.slice(0, 120).join('')}…` : preview;
}

export function isOpenConversation(
  senderId: string, selectedChatId: string | null, pathname: string,
): boolean {
  return pathname === '/messages' && selectedChatId === senderId;
}

export function appendMessageToast(current: MessageToast[], next: MessageToast): MessageToast[] {
  if (current.some((toast) => toast.id === next.id)) return current;
  // Profile lookups can finish in a different order from message arrival.
  return [...current, next].sort((a, b) => a.arrivalOrder - b.arrivalOrder).slice(-3);
}
