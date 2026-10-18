'use client';
import {useEffect, useRef, useState} from 'react';
import {createClient} from '../lib/supabase/client';
import {MESSAGE_EMOJIS, type MessageReaction} from '../lib/messageInteractions';

export function useMessageReactions(userId: string, peerId: string | null, messageIds: string[]) {
  const [client] = useState(() => createClient());
  const [state, setState] = useState<{peer: string | null; rows: MessageReaction[]; error: string}>({peer: null, rows: [], error: ''});
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const revision = useRef(0);
  const selectedPeer = useRef(peerId);
  useEffect(() => {selectedPeer.current = peerId; return () => {selectedPeer.current = null;};}, [peerId]);
  const key = messageIds.join(',');
  useEffect(() => {
    if (!peerId) return;
    let active = true;
    async function load() {
      const request = ++revision.current;
      const ids = key ? key.split(',') : [];
      const rows: MessageReaction[] = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const {data, error} = await client.from('message_reactions').select('message_id,user_id,emoji').in('message_id', ids.slice(offset, offset + 100));
        if (!active || request !== revision.current) return;
        if (error) {setState({peer: peerId, rows: [], error: 'Не удалось загрузить реакции. Обновите страницу.'});return;}
        rows.push(...data);
      }
      if (active && request === revision.current) setState({peer: peerId, rows, error: ''});
    }
    const channel = client.channel('message-reactions-' + userId + '-' + peerId)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'message_reactions'}, () => void load())
      .subscribe(status => {if (status === 'SUBSCRIBED') void load();});
    void load();
    return () => {active = false; void client.removeChannel(channel);};
  }, [client, userId, peerId, key]);
  async function react(messageId: string, emoji: string | null) {
    if (!peerId || !messageIds.includes(messageId) || pending.current || emoji !== null && !MESSAGE_EMOJIS.some(item => item === emoji)) return;
    pending.current = true; setBusy(true);
    try {
      const {data, error} = await client.rpc('set_message_reaction', {p_message_id: messageId, p_emoji: emoji});
      if (error || !data) throw new Error();
      if (selectedPeer.current !== peerId) return;
      revision.current++;
      setState(previous => ({peer: peerId, error: '', rows: [...(previous.peer === peerId ? previous.rows : []).filter(row => !(row.message_id === messageId && row.user_id === userId)), data as MessageReaction]}));
    } catch {setState(previous => previous.peer === peerId ? {...previous, error: 'Реакция не сохранена. Проверьте подключение и блокировки.'} : previous);}
    finally {pending.current = false; setBusy(false);}
  }
  return {rows: state.peer === peerId ? state.rows : [], error: state.peer === peerId ? state.error : '', busy, react};
}
