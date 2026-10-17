'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

export function useProfileFriendCount(userId: string | undefined) {
  const [supabase] = useState(() => createClient());
  const [result, setResult] = useState<{ userId: string; count?: number; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let version = 0;
    const load = async () => {
      const request = ++version;
      try {
        const { data, error } = await supabase.from('friend_requests')
          .select('sender_id,receiver_id').eq('status', 'accepted')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        if (error) throw error;
        const ids = new Set((data ?? []).map(row => row.sender_id === userId ? row.receiver_id : row.sender_id));
        ids.delete(userId);
        if (active && request === version) setResult({ userId, count: ids.size });
      } catch {
        if (active && request === version) setResult({ userId, error: 'Не удалось загрузить число друзей.' });
      }
    };
    void load();
    const channel = supabase.channel('profile-friends:' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => void load())
      .subscribe(status => { if (status === 'SUBSCRIBED') void load(); });
    const focus = () => void load();
    window.addEventListener('focus', focus);
    return () => { active = false; window.removeEventListener('focus', focus); void supabase.removeChannel(channel); };
  }, [userId, supabase, attempt]);
  return { result: result?.userId === userId ? result : null, retry: () => setAttempt(value => value + 1) };
}
