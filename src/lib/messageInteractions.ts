export const MESSAGE_EMOJIS = ['❤️','👍','😂','🔥','😮','😢','👏','🎵'] as const;
export interface MessageReaction {message_id: string; user_id: string; emoji: string | null}
export function groupMessageReactions(rows: MessageReaction[], messageId: string, userId: string) {
  return MESSAGE_EMOJIS.map(emoji => {
    const users = new Set(rows.filter(row => row.message_id === messageId && row.emoji === emoji).map(row => row.user_id));
    return {emoji, count: users.size, mine: users.has(userId)};
  }).filter(group => group.count > 0);
}
