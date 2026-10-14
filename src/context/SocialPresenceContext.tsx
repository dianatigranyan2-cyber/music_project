'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { createClient } from '../lib/supabase/client';
import { hasOnlineSession, onlineStatusLabel } from '../lib/socialPresence';
import type { OnlineStatus } from '../lib/socialPresence';

type FriendPresence = { status: OnlineStatus; lastSeenAt: string | null };
type Statuses = Record<string, FriendPresence>;
const EMPTY_STATUSES: Statuses = {};
const SocialPresenceContext = createContext<Statuses>(EMPTY_STATUSES);

function PresenceConnections({ userId, onChange }: { userId: string; onChange: (statuses: Statuses) => void }) {
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    let active = true;
    let statuses: Statuses = {};
    let loadRequest = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let ownChannel: RealtimeChannel | undefined;
    let friendshipChannel: RealtimeChannel | undefined;
    let activityPending = false;
    const watchers = new Map<string, RealtimeChannel>();

    const setStatus = (friendId: string, status: OnlineStatus) => {
      if (!active || statuses[friendId]?.status === status) return;
      statuses = { ...statuses, [friendId]: { status, lastSeenAt: statuses[friendId]?.lastSeenAt ?? null } };
      onChange(statuses);
    };

    const loadLastSeen = async (friendIds: string[]) => {
      if (!friendIds.length) return;
      try {
        const { data, error } = await supabase.from('user_activity')
          .select('user_id, last_seen_at').in('user_id', friendIds);
        if (error) throw error;
        if (!active) return;
        let changed = false;
        const next = { ...statuses };
        for (const row of data ?? []) {
          const current = next[row.user_id];
          if (!current || (current.lastSeenAt && current.lastSeenAt >= row.last_seen_at)) continue;
          next[row.user_id] = { ...current, lastSeenAt: row.last_seen_at };
          changed = true;
        }
        if (changed) { statuses = next; onChange(statuses); }
      } catch (error) {
        if (active) console.error('Не удалось загрузить время посещения:', error);
      }
    };

    const touchActivity = async () => {
      if (!active || activityPending) return;
      activityPending = true;
      try {
        const { error } = await supabase.rpc('touch_user_activity');
        if (error) throw error;
      } catch (error) {
        if (active) console.error('Не удалось сохранить время посещения:', error);
      } finally {
        activityPending = false;
      }
    };

    const watchFriend = (friendId: string) => {
      const channel = supabase.channel(`melo:presence:${friendId}`, {
        config: { private: true, presence: { enabled: true } },
      });
      watchers.set(friendId, channel);
      channel.on('presence', { event: 'sync' }, () => {
        if (watchers.get(friendId) !== channel) return;
        const online = hasOnlineSession(channel.presenceState());
        const wasOnline = statuses[friendId]?.status === 'online';
        setStatus(friendId, online ? 'online' : 'offline');
        if (!online && wasOnline) void loadLastSeen([friendId]);
      }).subscribe((status) => {
        if (watchers.get(friendId) !== channel) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setStatus(friendId, 'unknown');
        }
      });
    };

    const loadFriends = async () => {
      const request = ++loadRequest;
      try {
        const { data, error } = await supabase.from('friend_requests')
          .select('sender_id, receiver_id').eq('status', 'accepted')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        if (error) throw error;
        if (!active || request !== loadRequest) return;
        const friendIds = new Set((data ?? []).map((friend) =>
          friend.sender_id === userId ? friend.receiver_id as string : friend.sender_id as string));
        for (const [id, channel] of watchers) {
          if (friendIds.has(id)) continue;
          watchers.delete(id);
          void supabase.removeChannel(channel);
        }
        statuses = Object.fromEntries([...friendIds].map((id) => [id,
          statuses[id] ?? { status: 'unknown', lastSeenAt: null }]));
        onChange(statuses);
        for (const id of friendIds) if (!watchers.has(id)) watchFriend(id);
        void loadLastSeen([...friendIds]);
      } catch (error) {
        if (active) console.error('Не удалось загрузить статусы друзей:', error);
      }
    };

    const scheduleRefresh = () => {
      if (!active) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void loadFriends(); }, 150);
    };
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };

    void (async () => {
      await supabase.realtime.setAuth();
      if (!active) return;
      ownChannel = supabase.channel(`melo:presence:${userId}`, {
        config: { private: true, presence: { key: userId, enabled: true } },
      });
      const channel = ownChannel;
      channel.subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !active) return;
        void touchActivity();
        try {
          await channel.track({ connected_at: new Date().toISOString() });
        } catch (error) {
          if (active) console.error('Не удалось опубликовать онлайн-статус:', error);
        }
      });
      friendshipChannel = supabase.channel(`presence-friendships-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, scheduleRefresh)
        .subscribe((status) => { if (status === 'SUBSCRIBED') scheduleRefresh(); });
      scheduleRefresh();
    })().catch((error) => {
      if (active) console.error('Не удалось подключить онлайн-статусы:', error);
    });

    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('focus', touchActivity);
    window.addEventListener('pagehide', touchActivity);
    document.addEventListener('visibilitychange', touchActivity);
    void touchActivity();
    const activityTimer = setInterval(() => { void touchActivity(); }, 30_000);
    const reconcile = setInterval(refreshVisible, 60_000);

    return () => {
      active = false;
      clearTimeout(refreshTimer);
      clearInterval(reconcile);
      clearInterval(activityTimer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('focus', touchActivity);
      window.removeEventListener('pagehide', touchActivity);
      document.removeEventListener('visibilitychange', touchActivity);
      for (const channel of watchers.values()) void supabase.removeChannel(channel);
      watchers.clear();
      if (ownChannel) void supabase.removeChannel(ownChannel);
      if (friendshipChannel) void supabase.removeChannel(friendshipChannel);
    };
  }, [onChange, supabase, userId]);

  return null;
}

export function SocialPresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [snapshot, setSnapshot] = useState<{ userId: string | null; statuses: Statuses }>({
    userId: null, statuses: EMPTY_STATUSES,
  });
  const update = useCallback((statuses: Statuses) => setSnapshot({ userId, statuses }), [userId]);
  const statuses = snapshot.userId === userId ? snapshot.statuses : EMPTY_STATUSES;
  return (
    <SocialPresenceContext.Provider value={statuses}>
      {children}
      {userId && <PresenceConnections key={userId} userId={userId} onChange={update} />}
    </SocialPresenceContext.Provider>
  );
}

export function useSocialPresence() {
  const statuses = useContext(SocialPresenceContext);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => ({
    getOnlineStatus: (id: string): OnlineStatus => statuses[id]?.status ?? 'unknown',
    getStatusLabel: (id: string) => onlineStatusLabel(statuses[id]?.status ?? 'unknown', statuses[id]?.lastSeenAt ?? null, now),
  }), [statuses, now]);
}
