'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Track } from '../types';
import { adjacentTrack, EMPTY_TRACK, enqueueTrack, isPlayableTrack, playbackQueue, shuffledQueue } from '../lib/musicPlayback';
import { AudioPlayback, IDLE_PLAYBACK } from '../lib/audioPlayback';
import type { PlaybackState } from '../lib/audioPlayback';

interface PlayerContextType extends PlaybackState {
  currentTrack: Track;
  playTrack: (track: Track, collection?: Track[]) => void;
  togglePlayback: () => void;
  seek: (seconds: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  toggleMuted: () => void;
  isRepeat: boolean;
  toggleRepeat: () => void;
  isShuffle: boolean;
  toggleShuffle: () => void;
  canShuffle: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleNextTrack: () => void;
  handlePrevTrack: () => void;
  canSkip: boolean;
  queue: Track[];
  addToQueue: (track: Track, next?: boolean) => void;
  playQueuedTrack: (id: string) => void;
  removeQueuedTrack: (id: string) => void;
  mobileChatOpen: boolean;
  setMobileChatOpen: (open: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track>(EMPTY_TRACK);
  const [playback, setPlayback] = useState(IDLE_PLAYBACK);
  const [volume, setVolumeState] = useState(80);
  const [isMuted, setMuted] = useState(false);
  const [isRepeat, setRepeat] = useState(false);
  const [isShuffle, setShuffle] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<AudioPlayback | null>(null);
  const currentRef = useRef<Track>(EMPTY_TRACK);
  const queueRef = useRef<Track[]>([]);
  const originalQueueRef = useRef<Track[]>([]);
  const shuffleRef = useRef(false);

  const selectTrack = useCallback((track: Track) => {
    if (!engineRef.current?.select(track)) return false;
    currentRef.current = track;
    setCurrentTrack(track);
    return true;
  }, []);
  const handleNextTrack = useCallback(() => {
    const next = adjacentTrack(queueRef.current, currentRef.current.id, 1);
    if (next) selectTrack(next);
  }, [selectTrack]);
  const handlePrevTrack = useCallback(() => {
    if ((audioRef.current?.currentTime ?? 0) > 3) { engineRef.current?.seek(0); return; }
    const previous = adjacentTrack(queueRef.current, currentRef.current.id, -1);
    if (previous) selectTrack(previous); else engineRef.current?.seek(0);
  }, [selectTrack]);

  useEffect(() => {
    if (!audioRef.current) return;
    const engine = new AudioPlayback(audioRef.current, setPlayback, handleNextTrack);
    engine.setVolume(80);
    engineRef.current = engine;
    return () => { engine.dispose(); engineRef.current = null; };
  }, [handleNextTrack]);

  const playTrack = useCallback((track: Track, collection: Track[] = [track]) => {
    if (!selectTrack(track)) return;
    const original = playbackQueue(track, collection);
    const ordered = shuffleRef.current ? shuffledQueue(original, track.id) : original;
    originalQueueRef.current = original;
    queueRef.current = ordered;
    setQueue(ordered);
  }, [selectTrack]);
  const togglePlayback = useCallback(() => engineRef.current?.toggle(), []);
  const addToQueue = useCallback((track: Track, next = false) => {
    if (!isPlayableTrack(track)) return;
    if (!currentRef.current.source) { playTrack(track); return; }
    const ordered = enqueueTrack(queueRef.current, currentRef.current.id, track, next);
    originalQueueRef.current = enqueueTrack(originalQueueRef.current, currentRef.current.id, track, next);
    queueRef.current = ordered;
    setQueue(ordered);
  }, [playTrack]);
  const playQueuedTrack = useCallback((id: string) => {
    const track = queueRef.current.find((item) => item.id === id);
    if (track) selectTrack(track);
  }, [selectTrack]);
  const removeQueuedTrack = useCallback((id: string) => {
    if (id === currentRef.current.id) return;
    queueRef.current = queueRef.current.filter((item) => item.id !== id);
    originalQueueRef.current = originalQueueRef.current.filter((item) => item.id !== id);
    setQueue(queueRef.current);
  }, []);
  const seek = useCallback((seconds: number) => engineRef.current?.seek(seconds), []);
  const setVolume = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.max(0, Math.min(value, 100));
    setVolumeState(next);
    setMuted(next === 0);
    engineRef.current?.setVolume(next);
    engineRef.current?.setMuted(next === 0);
  }, []);
  const toggleMuted = useCallback(() => {
    engineRef.current?.setMuted(!isMuted);
    setMuted(!isMuted);
  }, [isMuted]);
  const toggleRepeat = useCallback(() => {
    engineRef.current?.setRepeat(!isRepeat);
    setRepeat(!isRepeat);
  }, [isRepeat]);
  const toggleShuffle = useCallback(() => {
    const next = !shuffleRef.current;
    shuffleRef.current = next;
    const ordered = next ? shuffledQueue(originalQueueRef.current, currentRef.current.id) : originalQueueRef.current;
    queueRef.current = ordered;
    setQueue(ordered);
    setShuffle(next);
  }, []);
  const canSkip = adjacentTrack(queue, currentTrack.id, 1) !== null;

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => engineRef.current?.play()],
      ['pause', () => engineRef.current?.pause()],
      ['seekto', (details) => { if (details.seekTime != null) engineRef.current?.seek(details.seekTime); }],
      ['seekbackward', (details) => engineRef.current?.seek((audioRef.current?.currentTime ?? 0) - (details.seekOffset ?? 10))],
      ['seekforward', (details) => engineRef.current?.seek((audioRef.current?.currentTime ?? 0) + (details.seekOffset ?? 10))],
      ['stop', () => { engineRef.current?.pause(); engineRef.current?.seek(0); }],
    ];
    for (const [action, handler] of actions) {
      try { session.setActionHandler(action, handler); } catch { /* Unsupported action. */ }
    }
    return () => {
      for (const [action] of actions) {
        try { session.setActionHandler(action, null); } catch { /* Unsupported action. */ }
      }
      session.metadata = null;
      session.playbackState = 'none';
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    try { session.setActionHandler('nexttrack', canSkip ? handleNextTrack : null); } catch { /* Unsupported action. */ }
    try { session.setActionHandler('previoustrack', currentTrack.source ? handlePrevTrack : null); } catch { /* Unsupported action. */ }
    return () => {
      try { session.setActionHandler('nexttrack', null); } catch { /* Unsupported action. */ }
      try { session.setActionHandler('previoustrack', null); } catch { /* Unsupported action. */ }
    };
  }, [canSkip, currentTrack.source, handleNextTrack, handlePrevTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack.source || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title, artist: currentTrack.artist, album: currentTrack.album,
      artwork: [{ src: new URL(currentTrack.coverUrl, window.location.origin).href }],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = currentTrack.source ? playback.isPlaying ? 'playing' : 'paused' : 'none';
    if (playback.duration > 0 && navigator.mediaSession.setPositionState) {
      try {
        navigator.mediaSession.setPositionState({
          duration: playback.duration, playbackRate: 1,
          position: Math.min(playback.currentTime, playback.duration),
        });
      } catch { /* The browser may not expose a seekable position yet. */ }
    }
  }, [currentTrack.source, playback.isPlaying, playback.currentTime, playback.duration]);

  return (
    <PlayerContext.Provider value={{
      currentTrack, playTrack, ...playback, togglePlayback, seek, volume, setVolume,
      isMuted, toggleMuted, isRepeat, toggleRepeat, searchQuery, setSearchQuery,
      isShuffle, toggleShuffle, canShuffle: queue.length > 1,
      handleNextTrack, handlePrevTrack, canSkip, mobileChatOpen, setMobileChatOpen,
      queue, addToQueue, playQueuedTrack, removeQueuedTrack,
    }}>
      <audio ref={audioRef} preload="none" />
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};
