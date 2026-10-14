'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase/client';
import { typingSignal, typingTopic } from '../lib/socialPresence';

export function useTypingIndicator(userId: string | null, peerId: string | null) {
  const [supabase] = useState(() => createClient());
  const topic = typingTopic(userId, peerId);
  const [incoming, setIncoming] = useState({ topic: null as string | null, userId: null as string | null, typing: false });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const readyRef = useRef(false);
  const publishedRef = useRef(false);
  const lastSentRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stopTyping = useCallback(() => {
    clearTimeout(stopTimerRef.current);
    if (publishedRef.current && readyRef.current && channelRef.current) {
      void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId, typing: false } });
    }
    publishedRef.current = false;
  }, [userId]);

  const updateTyping = useCallback((typing: boolean) => {
    if (!typing) { stopTyping(); return; }
    if (!readyRef.current || !channelRef.current) return;
    clearTimeout(stopTimerRef.current);
    if (!publishedRef.current || Date.now() - lastSentRef.current >= 2_000) {
      void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId, typing: true } });
      lastSentRef.current = Date.now();
      publishedRef.current = true;
    }
    stopTimerRef.current = setTimeout(stopTyping, 3_000);
  }, [stopTyping, userId]);

  useEffect(() => {
    if (!topic || !userId || !peerId) return;
    let active = true;
    let channel: RealtimeChannel | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const clearIncoming = () => {
      clearTimeout(expiry);
      if (active) setIncoming({ topic, userId, typing: false });
    };
    void (async () => {
      await supabase.realtime.setAuth();
      if (!active) return;
      channel = supabase.channel(topic, { config: { private: true, broadcast: { self: false } } });
      channelRef.current = channel;
      channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!active) return;
        const typing = typingSignal(payload, peerId);
        if (typing === null) return;
        clearTimeout(expiry);
        setIncoming({ topic, userId, typing });
        if (typing) expiry = setTimeout(clearIncoming, 4_000);
      }).subscribe((status) => {
        if (!active) return;
        readyRef.current = status === 'SUBSCRIBED';
        if (!readyRef.current) {
          publishedRef.current = false;
          clearIncoming();
        }
      });
    })().catch((error) => {
      if (active) console.error('Не удалось подключить индикатор набора:', error);
    });
    const hide = () => { if (document.visibilityState !== 'visible') stopTyping(); };
    window.addEventListener('blur', stopTyping);
    document.addEventListener('visibilitychange', hide);
    return () => {
      stopTyping();
      clearIncoming();
      active = false;
      readyRef.current = false;
      publishedRef.current = false;
      channelRef.current = null;
      clearTimeout(expiry);
      window.removeEventListener('blur', stopTyping);
      document.removeEventListener('visibilitychange', hide);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [peerId, stopTyping, supabase, topic, userId]);

  return { isTyping: incoming.topic === topic && incoming.userId === userId && incoming.typing, updateTyping, stopTyping };
}
