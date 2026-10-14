'use client';
import { useEffect, useState } from 'react';
import type { MusicLibrary } from '../lib/musicLibrary';

export function useMusicLibrary() {
  const [library, setLibrary] = useState<MusicLibrary | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/music/library', { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить музыку.');
      if (!controller.signal.aborted) { setLibrary(data); setError(''); }
    }).catch(caught => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить музыку.');
    });
    return () => controller.abort();
  }, [attempt]);
  return { library, error, retry: () => { setError(''); setAttempt(value => value + 1); } };
}
