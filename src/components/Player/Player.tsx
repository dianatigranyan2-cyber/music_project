'use client';

import React, { useState } from 'react';
import { AppIcon } from '../Icons/AppIcon';
import Link from 'next/link';
import { MusicQueue } from '../Music/MusicQueue';
import { FavoriteButton, PlaylistButton } from '../Music/TrackActions';
import styles from './Player.module.css';
import { Track } from '../../types';
import { usePlayer } from '../../context/PlayerContext';
import {useFriendListening} from '../../context/FriendListeningContext';

interface PlayerProps {
  currentTrack: Track;
  onNextTrack: () => void;
  onPrevTrack: () => void;
}

export const Player: React.FC<PlayerProps> = ({ currentTrack, onNextTrack, onPrevTrack }) => {
  const {
    listeningControl, mobileChatOpen, isPlaying, currentTime, duration, loading, error,
    togglePlayback, seek, volume, setVolume, isMuted, toggleMuted,
    isRepeat, repeatMode, toggleRepeat, canSkip, isShuffle, toggleShuffle, canShuffle, setSearchQuery,
  } = usePlayer();
  const {sound:friendSound}=useFriendListening();
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const playable = Boolean(currentTrack.source);
  const status = error ?? (listeningControl?'Слушаете вместе с '+listeningControl.name:loading ? 'Загрузка…' : '');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  return (
    <>
      {queueOpen && <MusicQueue onClose={() => setQueueOpen(false)} />}
      {/* Full Expanded Player Overlay for Mobile */}
      {isExpandedMobile && (
        <div className={styles.mobileExpandedOverlay}>
          <div className={styles.expandedHeader}>
            <button className={styles.closeBtn} aria-label="Свернуть плеер" onClick={() => setIsExpandedMobile(false)}>
              ▼
            </button>
            <span className={styles.expandedHeaderTitle}>Сейчас играет</span>
            <div className={styles.expandedHeaderActions}>
              <button className={styles.smallBtn} aria-label="Открыть очередь" aria-expanded={queueOpen} onClick={() => setQueueOpen(!queueOpen)}>☷</button>
              <PlaylistButton key={currentTrack.id} track={currentTrack} icon="+" placement="below" onNavigate={() => setIsExpandedMobile(false)}/>
              <FavoriteButton track={currentTrack}/>
            </div>
          </div>

          <div className={styles.expandedBody}>
            <div className={styles.expandedCoverWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                onError={({ currentTarget }) => {
                  if (!currentTarget.src.endsWith('/music-placeholder.svg')) currentTarget.src = '/music-placeholder.svg';
                }}
                className={styles.expandedCover}
              />
            </div>

            <div className={styles.expandedMeta}>
              <h3 className={styles.expandedTitle}>{currentTrack.title}</h3>
              {currentTrack.artistId ? <Link className={styles.expandedArtist} href={'/music/artists/' + currentTrack.artistId} onClick={() => { setSearchQuery(''); setIsExpandedMobile(false); }}>{currentTrack.artist}</Link>
                : <p className={styles.expandedArtist}>{currentTrack.artist}</p>}
              <div className={styles.expandedActions}>
                {currentTrack.sourceUrl && <Link className={styles.sourceLink} href={'/music/credits#track-' + currentTrack.id} onClick={() => setIsExpandedMobile(false)}>Информация о треке</Link>}
              </div>
              {status && <p className={styles.expandedStatus} role="status">{status}</p>}
            </div>

            {/* Timeline Seek Bar */}
            <div className={styles.expandedTimeSection}>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={Math.min(currentTime, duration || 0)}
                onChange={handleSeekChange}
                disabled={!playable || !duration || !!listeningControl}
                aria-label="Позиция воспроизведения"
                className={styles.seekBar}
                style={{
                  backgroundSize: `${(duration ? currentTime / duration : 0) * 100}% 100%`,
                }}
              />
              <div className={styles.timeLabelsRow}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className={styles.expandedControls}>
              <button
                className={`${styles.smallBtn} ${isShuffle ? styles.activeMode : ''}`}
                onClick={toggleShuffle} disabled={!canShuffle} aria-label="Случайный порядок" aria-pressed={isShuffle}
              >
                <AppIcon name="shuffle"/>
              </button>
              <button className={styles.stepBtn} onClick={onPrevTrack} disabled={!playable || !!listeningControl} aria-label="Предыдущий трек">
                ⏮
              </button>
              <button
                className={styles.expandedPlayPauseBtn}
                onClick={togglePlayback}
                disabled={!playable}
                aria-label={listeningControl?(friendSound?'Выключить звук у себя':'Включить звук'):isPlaying ? 'Пауза' : 'Воспроизвести'}
              >
                <AppIcon name={isPlaying ? 'pause' : 'play'} size={54}/>
              </button>
              <button className={styles.stepBtn} onClick={onNextTrack} disabled={!canSkip || !!listeningControl} aria-label="Следующий трек">
                ⏭
              </button>
              <button
                className={`${styles.smallBtn} ${isRepeat ? styles.activeMode : ''}`}
                onClick={toggleRepeat}
                disabled={!playable || !!listeningControl}
                aria-label={`Повтор: ${repeatMode==='off'?'выключен':repeatMode==='all'?'вся очередь':'один трек'}`}
                title="Повтор: выключен → вся очередь → один трек"
                aria-pressed={isRepeat}
              >
                <span className={styles.repeatIcon}><AppIcon name="repeat"/>{repeatMode==='one'&&<span className={styles.repeatOne}>1</span>}</span>
              </button>
            </div>

            {/* Volume Control */}
            <div className={styles.expandedVolume}>
              <button className={styles.volumeBtn} onClick={toggleMuted} aria-label={isMuted || volume === 0 ? 'Включить звук' : 'Выключить звук'} aria-pressed={isMuted || volume === 0}>
                <AppIcon name="volume" muted={isMuted || volume === 0}/>
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Громкость"
                className={styles.volumeBar}
                style={{
                  backgroundSize: `${isMuted ? 0 : volume}% 100%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Persistent Compact Bar */}
      <div className={`${styles.playerContainer} ${mobileChatOpen ? styles.hideOnMobileChat : ''}`}>
        {/* Left: Track Info */}
        <div className={styles.trackInfo} onClick={() => setIsExpandedMobile(true)}>
          <div className={styles.coverWrapper}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              onError={({ currentTarget }) => {
                if (!currentTarget.src.endsWith('/music-placeholder.svg')) currentTarget.src = '/music-placeholder.svg';
              }}
              className={styles.cover}
            />
          </div>
          <div className={styles.meta}>
            <span className={styles.title}>{currentTrack.title}</span>
            {currentTrack.artistId ? <Link className={styles.artist} href={'/music/artists/' + currentTrack.artistId} onClick={(event) => { event.stopPropagation(); setSearchQuery(''); }}>{currentTrack.artist}</Link>
              : <span className={styles.artist}>{currentTrack.artist}</span>}
            {listeningControl&&<Link className={styles.artist} href="/friends" onClick={event=>event.stopPropagation()}>🎧 Вместе с {listeningControl.name}</Link>}
            {status && <span className={styles.playbackStatus} role="status" title={status}>{status}</span>}
          </div>
          <span className={styles.desktopOnly} onClick={event=>event.stopPropagation()}><FavoriteButton track={currentTrack}/></span>
        </div>

        {/* Center: Controls & Timeline (Desktop) */}
        <div className={styles.controlsSection}>
          <div className={styles.buttonsRow}>
            <button
              className={`${styles.smallBtn} ${isShuffle ? styles.activeMode : ''}`}
              onClick={toggleShuffle} disabled={!canShuffle} aria-label="Случайный порядок" aria-pressed={isShuffle}
            >
              <AppIcon name="shuffle" size={18}/>
            </button>
            <button className={styles.stepBtn} onClick={onPrevTrack} disabled={!playable || !!listeningControl} aria-label="Предыдущий трек">
              ⏮
            </button>
            <button
              className={styles.playPauseBtn}
              onClick={togglePlayback}
                disabled={!playable}
                aria-label={listeningControl?(friendSound?'Выключить звук у себя':'Включить звук'):isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              <AppIcon name={isPlaying ? 'pause' : 'play'} size={34}/>
            </button>
            <button className={styles.stepBtn} onClick={onNextTrack} disabled={!canSkip || !!listeningControl} aria-label="Следующий трек">
              ⏭
            </button>
            <button
              className={`${styles.smallBtn} ${isRepeat ? styles.activeMode : ''}`}
              onClick={toggleRepeat}
                disabled={!playable || !!listeningControl}
                aria-label={`Повтор: ${repeatMode==='off'?'выключен':repeatMode==='all'?'вся очередь':'один трек'}`}
                title="Повтор: выключен → вся очередь → один трек"
                aria-pressed={isRepeat}
            >
                <span className={styles.repeatIcon}><AppIcon name="repeat" size={18}/>{repeatMode==='one'&&<span className={styles.repeatOne}>1</span>}</span>
            </button>
          </div>

          <div className={styles.timeSection}>
            <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSeekChange}
                disabled={!playable || !duration || !!listeningControl}
                aria-label="Позиция воспроизведения"
              className={styles.seekBar}
              style={{
                backgroundSize: `${(duration ? currentTime / duration : 0) * 100}% 100%`,
              }}
            />
            <span className={styles.timeLabel}>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Mobile Quick Play Controls */}
        <div className={styles.mobileQuickControls}>
          <button className={styles.expandBtn} aria-label="Открыть очередь" aria-expanded={queueOpen} onClick={() => setQueueOpen(!queueOpen)}>☷</button>
          <button
            className={styles.mobilePlayBtn}
            disabled={!playable}
            aria-label={listeningControl?(friendSound?'Выключить звук у себя':'Включить звук'):isPlaying ? 'Пауза' : 'Воспроизвести'}
            onClick={(e) => {
              e.stopPropagation();
              togglePlayback();
            }}
          >
            <AppIcon name={isPlaying ? 'pause' : 'play'} size={32}/>
          </button>
          <button
            className={styles.expandBtn}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpandedMobile(true);
            }}
            title="Открыть плеер"
            aria-label="Открыть плеер"
          >
            ▲
          </button>
        </div>

        {/* Right: Volume (Desktop) */}
        <div className={styles.volumeSection}>
          <button className={styles.smallBtn} aria-label="Открыть очередь" aria-expanded={queueOpen} onClick={() => setQueueOpen(!queueOpen)}>☷</button>
          <button className={styles.volumeBtn} onClick={toggleMuted} aria-label={isMuted || volume === 0 ? 'Включить звук' : 'Выключить звук'} aria-pressed={isMuted || volume === 0}>
            <AppIcon name="volume" size={18} muted={isMuted || volume === 0}/>
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
                aria-label="Громкость"
            className={styles.volumeBar}
            style={{
              backgroundSize: `${isMuted ? 0 : volume}% 100%`,
            }}
          />
          {currentTrack.sourceUrl && (
            <Link className={styles.sourceLink} href={'/music/credits#track-' + currentTrack.id}>О треке</Link>
          )}
        </div>
      </div>
    </>
  );
};
