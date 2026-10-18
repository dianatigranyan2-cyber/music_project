'use client';

import {
  createContext, useCallback, useContext, useEffect, useEffectEvent,
  useMemo, useState,
} from 'react';
import {parseMusicMessage} from '../lib/musicMessages';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { usePlayer } from './PlayerContext';
import { createClient } from '../lib/supabase/client';
import {
  appendMessageToast, incomingMessageFor, isOpenConversation, messageToastPreview,
} from '../lib/messageNotifications';
import type { IncomingMessage, MessageToast } from '../lib/messageNotifications';
import { MessageToastStack } from '../components/Notifications/MessageToastStack';

interface ChatSelection {
  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;
  unreadCount: number;
}

const MessageNotificationsContext = createContext<ChatSelection | undefined>(undefined);

interface SenderProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

function IncomingMessageToasts({ userId, onUnreadCountChange }: {
  userId: string;
  onUnreadCountChange: (count: number) => void;
}) {
  const [supabase] = useState(() => createClient());
  const [toasts, setToasts] = useState<MessageToast[]>([]);
  const { selectedChatId, setSelectedChatId } = useMessageNotifications();
  const { mobileChatOpen } = usePlayer();
  const pathname = usePathname();
  const router = useRouter();

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const openChat = useCallback((toast: MessageToast) => {
    setToasts((current) => current.filter((item) => item.senderId !== toast.senderId));
    setSelectedChatId(toast.senderId);
    router.push('/messages');
  }, [router, setSelectedChatId]);

  const conversationOpen = useEffectEvent((senderId: string) =>
    isOpenConversation(senderId, selectedChatId, pathname));

  const deliver = useEffectEvent((message: IncomingMessage, sender: SenderProfile | null, arrivalOrder: number) => {
    if (isOpenConversation(message.sender_id, selectedChatId, pathname)) return;
    const toast: MessageToast = {
      id: message.id,
      senderId: message.sender_id,
      senderName: sender?.display_name?.trim() || sender?.username || 'Пользователь',
      senderUsername: sender?.username ?? null,
      avatarUrl: sender?.avatar_url ?? null,
      preview: parseMusicMessage(message.content) ? (parseMusicMessage(message.content)?.kind==='track'?'♫ Вам отправили трек':'♫ Вам отправили плейлист') : messageToastPreview(message),
      arrivalOrder,
    };
    setToasts((current) => appendMessageToast(current, toast));
  });

  useEffect(() => {
    let active = true;
    let arrivalOrder = 0;
    let countRequest = 0;
    let countTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshUnreadCount = async () => {
      const request = ++countRequest;
      try {
        const { count, error } = await supabase.from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', userId)
          .neq('sender_id', userId)
          .is('read_at', null);
        if (error) throw error;
        if (active && request === countRequest) onUnreadCountChange(count ?? 0);
      } catch (error) {
        if (active) console.error('Не удалось обновить счётчик сообщений:', error);
      }
    };
    const scheduleCountRefresh = () => {
      if (!active) return;
      clearTimeout(countTimer);
      countTimer = setTimeout(() => { void refreshUnreadCount(); }, 100);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleCountRefresh();
    };
    scheduleCountRefresh();
    window.addEventListener('focus', scheduleCountRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    // Reconcile missed changes after network interruptions or reads in another window.
    const reconcileTimer = setInterval(handleVisibility, 30_000);
    const seen = new Set<string>();
    const senders = new Map<string, {
      expires: number;
      result: Promise<{ isFriend: boolean; profile: SenderProfile | null }>;
    }>();

    const loadSender = (senderId: string) => {
      const cached = senders.get(senderId);
      if (cached && cached.expires > Date.now()) return cached.result;
      const result = (async () => {
        const [friendship, profile] = await Promise.all([
          supabase.from('friend_requests').select('id').eq('status', 'accepted')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${senderId}),and(sender_id.eq.${senderId},receiver_id.eq.${userId})`)
            .limit(1).maybeSingle(),
          supabase.from('profiles').select('username, display_name, avatar_url')
            .eq('id', senderId).maybeSingle(),
        ]);
        if (friendship.error) throw friendship.error;
        return {
          isFriend: Boolean(friendship.data),
          profile: profile.data as SenderProfile | null,
        };
      })();
      senders.set(senderId, { expires: Date.now() + 60_000, result });
      if (senders.size > 100) senders.delete(senders.keys().next().value!);
      return result;
    };

    const channel = supabase.channel(`message-toasts-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, async (payload) => {
        scheduleCountRefresh();
        const message = incomingMessageFor(payload.new, userId);
        if (!active || !message || seen.has(message.id)) return;
        seen.add(message.id);
        if (seen.size > 200) seen.delete(seen.values().next().value!);
        if (conversationOpen(message.sender_id)) return;
        const order = ++arrivalOrder;
        try {
          const sender = await loadSender(message.sender_id);
          if (active && sender.isFriend) deliver(message, sender.profile, order);
        } catch (error) {
          senders.delete(message.sender_id);
          console.error('Не удалось загрузить отправителя нового сообщения:', error);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, scheduleCountRefresh)
      // DELETE events may only contain a primary key, so refresh the own-inbox count.
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
      }, scheduleCountRefresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && active) scheduleCountRefresh();
      });

    return () => {
      active = false;
      clearTimeout(countTimer);
      clearInterval(reconcileTimer);
      window.removeEventListener('focus', scheduleCountRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, onUnreadCountChange]);

  useEffect(() => {
    if (pathname !== '/messages' || !selectedChatId) return;
    const timer = setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.senderId !== selectedChatId));
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname, selectedChatId]);

  return (
    <MessageToastStack
      toasts={toasts.filter((toast) => !isOpenConversation(toast.senderId, selectedChatId, pathname))}
      chatOpen={pathname === '/messages' && mobileChatOpen}
      onDismiss={dismiss} onOpen={openChat}
    />
  );
}

export function MessageNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unreadState, setUnreadState] = useState({ userId: null as string | null, count: 0 });
  const updateUnreadCount = useCallback((count: number) => {
    setUnreadState((current) => current.userId === userId && current.count === count
      ? current : { userId, count });
  }, [userId]);
  const unreadCount = unreadState.userId === userId ? unreadState.count : 0;
  const [selection, setSelection] = useState<{ userId: string | null; chatId: string | null }>({
    userId: null, chatId: null,
  });
  const setSelectedChatId = useCallback((chatId: string | null) => {
    setSelection({ userId, chatId });
  }, [userId]);
  const selectedChatId = selection.userId === userId ? selection.chatId : null;
  const value = useMemo(() => ({ selectedChatId, setSelectedChatId, unreadCount }),
    [selectedChatId, setSelectedChatId, unreadCount]);

  return (
    <MessageNotificationsContext.Provider value={value}>
      {children}
      {userId && <IncomingMessageToasts key={userId} userId={userId} onUnreadCountChange={updateUnreadCount} />}
    </MessageNotificationsContext.Provider>
  );
}

export function useMessageNotifications() {
  const context = useContext(MessageNotificationsContext);
  if (!context) throw new Error('useMessageNotifications must be used within MessageNotificationsProvider');
  return context;
}
