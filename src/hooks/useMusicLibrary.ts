'use client';
import { createContext,createElement,useContext,useEffect,useState } from 'react';
import type { MusicLibrary } from '../lib/musicLibrary';

function useLibraryLoader() {
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
const LibraryContext=createContext<ReturnType<typeof useLibraryLoader>|null>(null);
export function MusicLibraryProvider({children}:{children:React.ReactNode}){
  const value=useLibraryLoader();return createElement(LibraryContext.Provider,{value},children);
}
export function useMusicLibrary(){const library=useContext(LibraryContext);if(!library)throw new Error('MusicLibraryProvider missing');return library;}
