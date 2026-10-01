'use client';

import React, { useState, useEffect } from 'react';
import styles from './Player.module.css';
import { Track } from '../../types';
import { usePlayer } from '../../context/PlayerContext';

interface PlayerProps {
  currentTrack: Track;
  onNextTrack: () => void;
  onPrevTrack: () => void;
}

export const Player: React.FC<PlayerProps> = ({ currentTrack, onNextTrack, onPrevTrack }) => {
  const { mobileChatOpen } = usePlayer();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(45);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTime((prev) => (prev >= currentTrack.duration ? 0 : prev + 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentTrack.duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (val === 0) setIsMuted(true);
    else setIsMuted(false);
  };

  return (
    <>
      {/* Full Expanded Player Overlay for Mobile */}
      {isExpandedMobile && (
        <div className={styles.mobileExpandedOverlay}>
          <div className={styles.expandedHeader}>
            <button className={styles.closeBtn} onClick={() => setIsExpandedMobile(false)}>
              ▼
            </button>
            <span className={styles.expandedHeaderTitle}>Сейчас играет</span>
            <button
              className={`${styles.likeBtn} ${isLiked ? styles.liked : ''}`}
              onClick={() => setIsLiked(!isLiked)}
            >
              {isLiked ? '❤️' : '🤍'}
            </button>
          </div>

          <div className={styles.expandedBody}>
            <div className={styles.expandedCoverWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={styles.expandedCover}
              />
            </div>

            <div className={styles.expandedMeta}>
              <h3 className={styles.expandedTitle}>{currentTrack.title}</h3>
              <p className={styles.expandedArtist}>{currentTrack.artist}</p>
              <span className={styles.expandedAlbum}>{currentTrack.album}</span>
            </div>

            {/* Timeline Seek Bar */}
            <div className={styles.expandedTimeSection}>
              <input
                type="range"
                min={0}
                max={currentTrack.duration}
                value={currentTime}
                onChange={handleSeekChange}
                className={styles.seekBar}
                style={{
                  backgroundSize: `${(currentTime / currentTrack.duration) * 100}% 100%`,
                }}
              />
              <div className={styles.timeLabelsRow}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className={styles.expandedControls}>
              <button
                className={`${styles.smallBtn} ${isShuffle ? styles.activeMode : ''}`}
                onClick={() => setIsShuffle(!isShuffle)}
              >
                🔀
              </button>
              <button className={styles.stepBtn} onClick={onPrevTrack}>
                ⏮
              </button>
              <button
                className={styles.expandedPlayPauseBtn}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button className={styles.stepBtn} onClick={onNextTrack}>
                ⏭
              </button>
              <button
                className={`${styles.smallBtn} ${isRepeat ? styles.activeMode : ''}`}
                onClick={() => setIsRepeat(!isRepeat)}
              >
                🔁
              </button>
            </div>

            {/* Volume Control */}
            <div className={styles.expandedVolume}>
              <button className={styles.volumeBtn} onClick={() => setIsMuted(!isMuted)}>
                {isMuted || volume === 0 ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
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
              className={styles.cover}
            />
          </div>
          <div className={styles.meta}>
            <span className={styles.title}>{currentTrack.title}</span>
            <span className={styles.artist}>{currentTrack.artist}</span>
          </div>
          <button
            className={`${styles.likeBtn} ${styles.desktopOnly} ${isLiked ? styles.liked : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsLiked(!isLiked);
            }}
          >
            {isLiked ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Center: Controls & Timeline (Desktop) */}
        <div className={styles.controlsSection}>
          <div className={styles.buttonsRow}>
            <button
              className={`${styles.smallBtn} ${isShuffle ? styles.activeMode : ''}`}
              onClick={() => setIsShuffle(!isShuffle)}
            >
              🔀
            </button>
            <button className={styles.stepBtn} onClick={onPrevTrack}>
              ⏮
            </button>
            <button
              className={styles.playPauseBtn}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className={styles.stepBtn} onClick={onNextTrack}>
              ⏭
            </button>
            <button
              className={`${styles.smallBtn} ${isRepeat ? styles.activeMode : ''}`}
              onClick={() => setIsRepeat(!isRepeat)}
            >
              🔁
            </button>
          </div>

          <div className={styles.timeSection}>
            <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={currentTrack.duration}
              value={currentTime}
              onChange={handleSeekChange}
              className={styles.seekBar}
              style={{
                backgroundSize: `${(currentTime / currentTrack.duration) * 100}% 100%`,
              }}
            />
            <span className={styles.timeLabel}>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Mobile Quick Play Controls */}
        <div className={styles.mobileQuickControls}>
          <button
            className={styles.mobilePlayBtn}
            onClick={(e) => {
              e.stopPropagation();
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className={styles.expandBtn}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpandedMobile(true);
            }}
            title="Открыть плеер"
          >
            ▲
          </button>
        </div>

        {/* Right: Volume (Desktop) */}
        <div className={styles.volumeSection}>
          <button className={styles.volumeBtn} onClick={() => setIsMuted(!isMuted)}>
            {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className={styles.volumeBar}
            style={{
              backgroundSize: `${isMuted ? 0 : volume}% 100%`,
            }}
          />
          <div className={styles.listenTogetherBadge}>
            <span className={styles.liveIndicator} />
            <span className={styles.liveText}>Синхронизировано</span>
          </div>
        </div>
      </div>
    </>
  );
};
