'use client';
import { AppIcon } from '../Icons/AppIcon';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Track } from '../../types';
import { usePlayer } from '../../context/PlayerContext';

export function StoryMusic({ track, start, duration, paused, videoTime, onWaiting, onEnded, compact = false }: {
  track: Track; start: number; duration: number; paused: boolean; videoTime: number | null;
  onWaiting: (waiting: boolean) => void; onEnded: () => void;
  compact?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const finished = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const { acquireStoryAudioFocus } = usePlayer();
  useEffect(() => { if (!failed) return acquireStoryAudioFocus(); }, [failed, acquireStoryAudioFocus]);
  useEffect(() => {
    const element = audio.current;
    if (!element || failed || finished.current) return;
    let active = true;
    if (paused) element.pause();
    else void element.play().catch(() => { if (active) { setBlocked(true); onWaiting(true); } });
    return () => { active = false; element.pause(); };
  }, [paused, failed, onWaiting]);
  useEffect(() => {
    const element = audio.current;
    if (videoTime !== null && element && element.readyState && !finished.current && Math.abs(element.currentTime - start - videoTime) > .5) element.currentTime = start + Math.min(videoTime, duration);
  }, [videoTime, start, duration]);
  return <div>
    <audio ref={audio} src={track.streamUrl} preload="auto" muted={muted} onLoadedMetadata={() => { if (audio.current) audio.current.currentTime = start + (videoTime ?? 0); }}
      onPlaying={() => { setBlocked(false); onWaiting(false); }} onWaiting={() => onWaiting(true)}
      onError={() => { setFailed(true); onWaiting(false); }} onTimeUpdate={() => {
        if (audio.current && !finished.current && audio.current.currentTime >= start + duration - .05) { finished.current = true; audio.current.pause(); onEnded(); }
      }} onEnded={() => { if (!finished.current) { finished.current = true; onEnded(); } }}/>
    <button type="button" aria-label={blocked ? 'Включить музыку истории' : muted ? 'Включить звук истории' : 'Выключить звук истории'} onClick={async () => {
      if (blocked) { try { await audio.current?.play(); setBlocked(false); } catch { setBlocked(true); } }
      else setMuted(value => !value);
    }}>{blocked ? '▶ Включить музыку' : <AppIcon name="volume" size={18} muted={muted}/>} {!compact && `${track.title} — ${track.artist}`}</button>
    {failed && <span role="status"> Музыка сейчас недоступна.</span>}
    <Link href={'/music/credits#track-' + track.id} style={{ display: 'block', fontSize: 10, color: '#d8b4fe' }}>Автор и лицензия</Link>
  </div>;
}
