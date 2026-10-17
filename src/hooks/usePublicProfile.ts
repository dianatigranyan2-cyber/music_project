'use client';

import { useEffect, useState } from 'react';
import type { PublicProfileData } from '../lib/profileMusic';
import { useAuth } from '../context/AuthContext';

export function usePublicProfile(username: string) {
  const { user, loading: authLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ username: string; viewerId: string | null; data?: PublicProfileData; error?: string; notFound?: boolean } | null>(null);
  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    let version = 0;
    const load = async () => {
      const request = ++version;
      try {
        const response = await fetch('/api/profiles/' + encodeURIComponent(username), { signal: controller.signal, cache: 'no-store' });
        const value = await response.json();
        if (controller.signal.aborted || request !== version) return;
        if (!response.ok) setResult({ username, viewerId, error: value.error || 'Не удалось загрузить профиль.', notFound: response.status === 404 });
        else setResult({ username, viewerId, data: value });
      } catch {
        if (!controller.signal.aborted && request === version) setResult({ username, viewerId, error: 'Не удалось загрузить профиль. Проверьте подключение.' });
      }
    };
    void load();
    const focus = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    const timer = setInterval(focus, 30000);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [username, attempt, viewerId, authLoading]);
  const current = !authLoading && result?.username === username && result.viewerId === viewerId ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? '', notFound: current?.notFound ?? false, loading: !current, retry: () => setAttempt(value => value + 1) };
}
