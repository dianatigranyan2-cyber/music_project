'use client';

import React from 'react';
import styles from './FriendCard.module.css';
import { Friend, Track } from '../../types';

interface FriendCardProps {
  friend: Friend;
  onPlayTrack: (track: Track) => void;
  isPlayingThisTrack?: boolean;
}

export const FriendCard: React.FC<FriendCardProps> = ({ friend, onPlayTrack, isPlayingThisTrack }) => {
  return (
    <div className={`${styles.card} ${friend.currentTrack ? styles.hasMusic : ''}`}>
      {/* Top Bar: Avatar & Status */}
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={friend.avatarUrl} alt={friend.name} className={styles.avatar} />
          <span className={`${styles.onlineDot} ${friend.isOnline ? styles.online : styles.offline}`} />
        </div>

        <div className={styles.nameBlock}>
          <h4 className={styles.friendName}>{friend.name}</h4>
          <span className={styles.username}>@{friend.username}</span>
        </div>

        {friend.currentTrack && (
          <div className={styles.equalizer}>
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
          </div>
        )}
      </div>

      {/* Status Quote */}
      {friend.statusMessage && (
        <p className={styles.statusQuote}>«{friend.statusMessage}»</p>
      )}

      {/* Listening Status Area */}
      {friend.currentTrack ? (
        <div className={styles.listeningBox}>
          <div className={styles.trackInfo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={friend.currentTrack.coverUrl}
              alt={friend.currentTrack.title}
              className={styles.trackCover}
            />
            <div className={styles.trackDetails}>
              <span className={styles.listeningLabel}>Слушает сейчас</span>
              <span className={styles.trackTitle}>{friend.currentTrack.title}</span>
              <span className={styles.trackArtist}>{friend.currentTrack.artist}</span>
            </div>
          </div>

          {/* Progress Indicator */}
          {friend.listeningProgress && (
            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${friend.listeningProgress}%` }}
              />
            </div>
          )}

          <button
            className={`${styles.listenTogetherBtn} ${isPlayingThisTrack ? styles.activePlaying : ''}`}
            onClick={() => friend.currentTrack && onPlayTrack(friend.currentTrack)}
          >
            {isPlayingThisTrack ? '▶ Воспроизводится' : '🎧 Слушать вместе'}
          </button>
        </div>
      ) : (
        <div className={styles.noMusicBox}>
          <span className={styles.offlineText}>Сейчас ничего не слушает</span>
          <button className={styles.shareMusicBtn}>Поделиться треком</button>
        </div>
      )}
    </div>
  );
};
