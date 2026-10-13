'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import type { AppNotification } from '../lib/notifications';

const PAGE_SIZE = 20;

export function useNotifications(userId: string | null) {
  const [supabase] = useState(() => createClient());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(userId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const limitRef = useRef(PAGE_SIZE);
  const cancelPendingRequests = useCallback(() => {
    requestRef.current++;
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const request = ++requestRef.current;
    try {
      const [inbox, unread] = await Promise.all([
        supabase.from('notifications')
          .select(`id, recipient_id, actor_id, type, payload, created_at, read_at,
            actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)`,
          { count: 'exact' })
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limitRef.current),
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', userId)
          .is('read_at', null),
      ]);
      if (!mountedRef.current) return;
      if (inbox.error || unread.error) {
        if (request === requestRef.current) {
          setError('Не удалось загрузить уведомления. Попробуйте ещё раз.');
        }
        return;
      }
      const items = (inbox.data ?? []) as unknown as AppNotification[];
      const snapshot = {
        latestCreatedAt: items[0]?.created_at,
        unreadCount: unread.count ?? 0,
      };
      if (request === requestRef.current) {
        setNotifications(items);
        setUnreadCount(snapshot.unreadCount);
        setTotalCount(inbox.count ?? 0);
        setError(null);
      }
      // An opening inbox still needs its cutoff if a Realtime refresh overtakes
      // this request. Only the newest request may update the rendered list.
      return snapshot;
    } catch {
      if (mountedRef.current && request === requestRef.current) {
        setError('Не удалось загрузить уведомления. Проверьте соединение.');
      }
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [supabase, userId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!userId) return () => { mountedRef.current = false; };

    let realtimeConnected = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    // Coalesce bursts (including "read all") into one inbox refresh.
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void refresh(); }, 150);
    };

    scheduleRefresh();
    const channel = supabase.channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, scheduleRefresh)
      .subscribe((status) => {
        realtimeConnected = status === 'SUBSCRIBED';
        // Reconcile anything received between the first query and subscribing,
        // or while the connection was interrupted.
        if (realtimeConnected) scheduleRefresh();
      });

    const handleFocus = () => { void refresh(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    const fallbackTimer = setInterval(() => {
      if (!realtimeConnected && document.visibilityState === 'visible') void refresh();
    }, 30_000);

    return () => {
      mountedRef.current = false;
      cancelPendingRequests();
      clearTimeout(refreshTimer);
      clearInterval(fallbackTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [refresh, supabase, userId, cancelPendingRequests]);

  const markAsRead = useCallback(async (id?: string, through?: string) => {
    if (!userId) return;
    setMarkingRead(true);
    try {
      let query = supabase.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', userId)
        .is('read_at', null);
      if (id) query = query.eq('id', id);
      // Do not mark notifications arriving after the user's click as read.
      if (through) query = query.lte('created_at', through);
      const { error: updateError } = await query;
      if (!mountedRef.current) return;
      if (updateError) {
        setError('Не удалось отметить уведомления прочитанными. Попробуйте ещё раз.');
      } else {
        await refresh();
      }
    } catch {
      if (mountedRef.current) setError('Не удалось сохранить статус прочтения.');
    } finally {
      if (mountedRef.current) setMarkingRead(false);
    }
  }, [supabase, userId, refresh]);

  const markAllAsRead = useCallback(async () => {
    const snapshot = await refresh();
    if (snapshot?.latestCreatedAt && snapshot.unreadCount > 0 && mountedRef.current) {
      await markAsRead(undefined, snapshot.latestCreatedAt);
    }
  }, [refresh, markAsRead]);

  const loadMore = () => {
    if (loadingMore) return;
    limitRef.current += PAGE_SIZE;
    setLoadingMore(true);
    void refresh();
  };

  return {
    notifications, unreadCount, loading, loadingMore, markingRead, error,
    hasMore: notifications.length < totalCount,
    refresh, markAsRead, markAllAsRead, loadMore,
  };
}
