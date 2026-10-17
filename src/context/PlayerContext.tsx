'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Track } from '../types';
import { adjacentTrack, EMPTY_TRACK, enqueueTrack, isPlayableTrack, playbackQueue, shuffledQueue } from '../lib/musicPlayback';
import { AudioPlayback, IDLE_PLAYBACK } from '../lib/audioPlayback';
import type { PlaybackState } from '../lib/audioPlayback';
import {useAuth} from './AuthContext';
import {parsePlayerSession,resolvePlayerSession} from '../lib/playerSession';
import type {PlayerSession} from '../lib/playerSession';
import type {MusicLibrary} from '../lib/musicLibrary';
import {nextQueueTrack,nextRepeatMode} from '../lib/musicFeatures';
import type {RepeatMode} from '../lib/musicFeatures';
import {usePersonalMusic} from './PersonalMusicContext';
import type {ListeningController} from '../lib/friendListening';

interface PlayerContextType extends PlaybackState {
  acquireStoryAudioFocus: () => () => void;
  listeningControl:{id:string;name:string}|null;
  setListeningController:(controller:ListeningController|null)=>void;
  syncListeningAudio:(track:Track|null,tracks:Track[],position:number,playing:boolean)=>void;
  startListeningAudio:()=>void;
  currentTrack: Track;
  playTrack: (track: Track, collection?: Track[]) => void;
  togglePlayback: () => void;
  seek: (seconds: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  toggleMuted: () => void;
  isRepeat: boolean;
  repeatMode: RepeatMode;
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
  const {user,loading}=useAuth();
  const scope=loading?'pending':user?.id??'guest';
  return <PlayerSessionProvider key={scope} storageKey={loading?null:'melo.player.v1:'+scope}>{children}</PlayerSessionProvider>;
};

const PlayerSessionProvider: React.FC<{children:React.ReactNode;storageKey:string|null}>=({children,storageKey})=>{
  const [currentTrack, setCurrentTrack] = useState<Track>(EMPTY_TRACK);
  const [playback, setPlayback] = useState(IDLE_PLAYBACK);
  const [volume, setVolumeState] = useState(80);
  const [isMuted, setMuted] = useState(false);
  const [repeatMode,setRepeatMode]=useState<RepeatMode>('off');
  const isRepeat=repeatMode!=='off';
  const repeatRef=useRef<RepeatMode>('off');
  const {recordListen}=usePersonalMusic();
  const listenRef=useRef('');
  const [isShuffle, setShuffle] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<AudioPlayback | null>(null);
  const storyFocus = useRef(0);
  const userMuted = useRef(false);
  const acquireStoryAudioFocus = useCallback(() => {
    ++storyFocus.current;
    engineRef.current?.setMuted(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      storyFocus.current = Math.max(0, storyFocus.current - 1);
      engineRef.current?.setMuted(userMuted.current || storyFocus.current > 0);
    };
  }, []);
  const currentRef = useRef<Track>(EMPTY_TRACK);
  const queueRef = useRef<Track[]>([]);
  const originalQueueRef = useRef<Track[]>([]);
  const shuffleRef = useRef(false);
  const restored=useRef(false);
  const interactions=useRef(0);
  const savedAt=useRef(0);
  const snapshot=useRef<PlayerSession|null>(null);
  const followingRef=useRef<ListeningController|null>(null);
  const [listeningControl,setListeningControl]=useState<{id:string;name:string}|null>(null);
  const personalBeforeFollowing=useRef<{track:Track;queue:Track[];original:Track[];position:number;repeat:RepeatMode;shuffle:boolean}|null>(null);
  const blockFollowingControl=useCallback(()=>{
    if(!followingRef.current)return false;
    setPlayback(previous=>({...previous,error:'Вы слушаете вместе с другом. Отключитесь, чтобы выбирать музыку самостоятельно.'}));
    return true;
  },[]);
  const save=useCallback(()=>{
    if(!storageKey||!restored.current||!snapshot.current||followingRef.current)return;
    try {localStorage.setItem(storageKey,JSON.stringify(snapshot.current));} catch { /* Storage may be unavailable or full. */ }
  },[storageKey]);

  const selectTrack = useCallback((track: Track) => {
    ++interactions.current;
    restored.current=true;
    listenRef.current='';
    if (!engineRef.current?.select(track)) return false;
    currentRef.current = track;
    setCurrentTrack(track);
    return true;
  }, []);
  const handleNextTrack = useCallback(() => {
    if(blockFollowingControl())return;
    const next = nextQueueTrack(queueRef.current, currentRef.current.id, repeatRef.current);
    if (next) selectTrack(next);
  }, [selectTrack,blockFollowingControl]);
  const handlePrevTrack = useCallback(() => {
    if(blockFollowingControl())return;
    if ((audioRef.current?.currentTime ?? 0) > 3) { engineRef.current?.seek(0); return; }
    const previous = adjacentTrack(queueRef.current, currentRef.current.id, -1);
    if (previous) selectTrack(previous); else engineRef.current?.seek(0);
  }, [selectTrack,blockFollowingControl]);

  const setListeningController=useCallback((controller:ListeningController|null)=>{
    if(controller&&!followingRef.current){
      save();++interactions.current;restored.current=true;
      personalBeforeFollowing.current={track:currentRef.current,queue:queueRef.current,original:originalQueueRef.current,position:audioRef.current?.currentTime??0,repeat:repeatRef.current,shuffle:shuffleRef.current};
      engineRef.current?.pause();engineRef.current?.setRepeat(false);setShuffle(false);setRepeatMode('off');
    }
    const wasActive=!!followingRef.current;followingRef.current=controller;
    setListeningControl(controller?{id:controller.id,name:controller.name}:null);
    if(!controller&&wasActive){
      engineRef.current?.pause();const previous=personalBeforeFollowing.current;personalBeforeFollowing.current=null;
      if(previous){
        currentRef.current=previous.track;setCurrentTrack(previous.track);queueRef.current=previous.queue;setQueue(previous.queue);originalQueueRef.current=previous.original;
        repeatRef.current=previous.repeat;setRepeatMode(previous.repeat);shuffleRef.current=previous.shuffle;setShuffle(previous.shuffle);engineRef.current?.setRepeat(previous.repeat==='one');
        if(previous.track.source)engineRef.current?.select(previous.track,false,previous.position);
      }
    }
  },[save]);
  const syncListeningAudio=useCallback((track:Track|null,tracks:Track[],position:number,playing:boolean)=>{
    if(!followingRef.current)return;
    if(queueRef.current.map(t=>t.id).join()!==tracks.map(t=>t.id).join()){queueRef.current=tracks;setQueue(tracks);}
    if(!track){engineRef.current?.pause();currentRef.current=EMPTY_TRACK;setCurrentTrack(EMPTY_TRACK);return;}
    if(currentRef.current.id!==track.id){listenRef.current='';currentRef.current=track;setCurrentTrack(track);engineRef.current?.select(track,playing,position);return;}
    const audio=audioRef.current;if(!audio)return;
    if(Math.abs(audio.currentTime-position)>(playing?0.75:0.1))engineRef.current?.seek(position);
    if(!playing&&!audio.paused)engineRef.current?.pause();
    if(playing&&audio.paused&&!audio.error)engineRef.current?.play();
  },[]);
  const startListeningAudio=useCallback(()=>engineRef.current?.play(),[]);

  useEffect(() => {
    if (!audioRef.current) return;
    const engine = new AudioPlayback(audioRef.current, setPlayback, () => {
      // A follower waits for the friend's actual player instead of advancing locally.
      if(!followingRef.current)handleNextTrack();
    });
    engine.setVolume(80);
    engineRef.current = engine;
    engine.setMuted(userMuted.current || storyFocus.current > 0);
    return () => { engine.dispose(); engineRef.current = null; };
  }, [handleNextTrack]);

  useEffect(()=>{
    if(!storageKey)return;
    const controller=new AbortController();
    const version=interactions.current;
    let session:PlayerSession|null=null;
    try {session=parsePlayerSession(localStorage.getItem(storageKey));}catch { /* Optional browser storage. */ }
    const restore=async()=>{
      if(!session){restored.current=true;return;}
      try {
        let tracks:Track[]=[];
        if(session.trackId||session.queueIds.length){
          const response=await fetch('/api/music/library',{signal:controller.signal});
          if(!response.ok)throw new Error('catalog unavailable');
          tracks=((await response.json()) as MusicLibrary).tracks;
        }
        if(controller.signal.aborted)return;
        if(version!==interactions.current){restored.current=true;return;}
        const resolved=resolvePlayerSession(session,tracks);
        queueRef.current=resolved.queue;originalQueueRef.current=resolved.original;shuffleRef.current=session.shuffle;
        const mode=session.repeatMode??(session.repeat?'one':'off');repeatRef.current=mode;
        setQueue(resolved.queue);setVolumeState(session.volume);setMuted(session.muted);setRepeatMode(mode);setShuffle(session.shuffle);
        userMuted.current=session.muted;engineRef.current?.setVolume(session.volume);engineRef.current?.setMuted(session.muted||storyFocus.current>0);engineRef.current?.setRepeat(mode==='one');
        if(resolved.track){currentRef.current=resolved.track;setCurrentTrack(resolved.track);engineRef.current?.select(resolved.track,false,resolved.currentTime);}
        restored.current=true;
      } catch {
        // Preserve the old snapshot after a failed restore until the user starts a new song.
        if(!controller.signal.aborted&&version!==interactions.current)restored.current=true;
        else if(!controller.signal.aborted)setPlayback(previous=>({...previous,error:'Не удалось восстановить плеер. Обновите страницу или выберите песню.'}));
      }
    };
    void restore();
    return ()=>controller.abort();
  },[storageKey]);

  useEffect(()=>{
    if(followingRef.current)return;
    snapshot.current={version:1,trackId:currentTrack.source?currentTrack.id:null,queueIds:queue.map(t=>t.id),originalQueueIds:originalQueueRef.current.map(t=>t.id),currentTime:playback.currentTime,volume,muted:isMuted,repeat:repeatMode==='one',repeatMode,shuffle:isShuffle};
    if(Date.now()-savedAt.current>5000||!playback.isPlaying){save();savedAt.current=Date.now();}
  },[currentTrack,queue,playback.currentTime,playback.isPlaying,volume,isMuted,repeatMode,isShuffle,save]);
  useEffect(()=>{save();},[queue,currentTrack,volume,isMuted,repeatMode,isShuffle,save]);
  useEffect(()=>{
    if(playback.isPlaying&&currentTrack.source&&listenRef.current!==currentTrack.id){listenRef.current=currentTrack.id;void recordListen(currentTrack.id);}
  },[playback.isPlaying,currentTrack,recordListen]);
  useEffect(()=>{
    const flush=()=>{
      if(followingRef.current)return;
      if(snapshot.current&&audioRef.current?.readyState) snapshot.current={...snapshot.current,currentTime:audioRef.current.currentTime};
      save();
    };
    const hidden=()=>{if(document.visibilityState==='hidden')flush();};
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);
    return ()=>{flush();window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);};
  },[save]);

  const playTrack = useCallback((track: Track, collection: Track[] = [track]) => {
    if(blockFollowingControl())return;
    if (!selectTrack(track)) return;
    const original = playbackQueue(track, collection);
    const ordered = shuffleRef.current ? shuffledQueue(original, track.id) : original;
    originalQueueRef.current = original;
    queueRef.current = ordered;
    setQueue(ordered);
  }, [selectTrack,blockFollowingControl]);
  const togglePlayback = useCallback(() => {
    if(followingRef.current){followingRef.current.toggleSound();return;}
    engineRef.current?.toggle();
  }, []);
  const addToQueue = useCallback((track: Track, next = false) => {
    if(blockFollowingControl())return;
    if (!isPlayableTrack(track)) return;
    if (!currentRef.current.source) { playTrack(track); return; }
    const ordered = enqueueTrack(queueRef.current, currentRef.current.id, track, next);
    originalQueueRef.current = enqueueTrack(originalQueueRef.current, currentRef.current.id, track, next);
    queueRef.current = ordered;
    setQueue(ordered);
  }, [playTrack,blockFollowingControl]);
  const playQueuedTrack = useCallback((id: string) => {
    if(blockFollowingControl())return;
    const track = queueRef.current.find((item) => item.id === id);
    if (track) selectTrack(track);
  }, [selectTrack,blockFollowingControl]);
  const removeQueuedTrack = useCallback((id: string) => {
    if(blockFollowingControl())return;
    if (id === currentRef.current.id) return;
    queueRef.current = queueRef.current.filter((item) => item.id !== id);
    originalQueueRef.current = originalQueueRef.current.filter((item) => item.id !== id);
    setQueue(queueRef.current);
  }, [blockFollowingControl]);
  const seek = useCallback((seconds: number) => {
    if(blockFollowingControl())return;
    engineRef.current?.seek(seconds);
  }, [blockFollowingControl]);
  const setVolume = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.max(0, Math.min(value, 100));
    setVolumeState(next);
    setMuted(next === 0);
    engineRef.current?.setVolume(next);
    userMuted.current = next === 0;
    engineRef.current?.setMuted(userMuted.current || storyFocus.current > 0);
  }, []);
  const toggleMuted = useCallback(() => {
    userMuted.current = !isMuted;
    engineRef.current?.setMuted(userMuted.current || storyFocus.current > 0);
    setMuted(!isMuted);
  }, [isMuted]);
  const toggleRepeat = useCallback(() => {
    if(followingRef.current)return;
    const mode=nextRepeatMode(repeatRef.current);repeatRef.current=mode;
    engineRef.current?.setRepeat(mode==='one');setRepeatMode(mode);
  }, []);
  const toggleShuffle = useCallback(() => {
    if(followingRef.current)return;
    const next = !shuffleRef.current;
    shuffleRef.current = next;
    const ordered = next ? shuffledQueue(originalQueueRef.current, currentRef.current.id) : originalQueueRef.current;
    queueRef.current = ordered;
    setQueue(ordered);
    setShuffle(next);
  }, []);
  const canSkip = nextQueueTrack(queue, currentTrack.id, repeatMode) !== null;

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => {const following=followingRef.current;if(following){if(!following.soundEnabled())following.toggleSound();}else engineRef.current?.play();}],
      ['pause', () => {const following=followingRef.current;if(following){if(following.soundEnabled())following.toggleSound();}else engineRef.current?.pause();}],
      ['seekto', details=>{if(details.seekTime!=null)seek(details.seekTime);}],
      ['seekbackward',details=>seek((audioRef.current?.currentTime??0)-(details.seekOffset??10))],
      ['seekforward',details=>seek((audioRef.current?.currentTime??0)+(details.seekOffset??10))],
      ['stop',()=>{if(followingRef.current){if(followingRef.current.soundEnabled())followingRef.current.toggleSound();return;}engineRef.current?.pause();engineRef.current?.seek(0);}],
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
  }, [seek]);

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
      acquireStoryAudioFocus,listeningControl,setListeningController,syncListeningAudio,startListeningAudio,
      currentTrack, playTrack, ...playback, togglePlayback, seek, volume, setVolume,
      isMuted, toggleMuted, isRepeat, repeatMode, toggleRepeat, searchQuery, setSearchQuery,
      isShuffle, toggleShuffle, canShuffle: !listeningControl && queue.length > 1,
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
