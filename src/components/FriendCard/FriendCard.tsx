'use client';

import React from 'react';
import {Avatar} from '../Profile/Avatar';
import {useFriendListening} from '../../context/FriendListeningContext';
import styles from './FriendCard.module.css';
import { Friend } from '../../types';

interface FriendCardProps {
  friend: Friend;
}

export const FriendCard: React.FC<FriendCardProps> = ({ friend }) => {
  const {friends:activities,listeners,following,busy,follow,leave}=useFriendListening();const isPlayingThisTrack=following?.id===friend.id;
  const listeningWithMe=listeners.some(listener=>listener.id===friend.id);
  return (
    <div className={`${styles.card} ${friend.currentTrack ? styles.hasMusic : ''}`}>
      {/* Top Bar: Avatar & Status */}
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          <Avatar username={friend.username} src={friend.avatarUrl} alt={friend.name} className={styles.avatar} />
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
      {friend.currentTrack&&!listeningWithMe ? (
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
            disabled={busy||!activities.find(a=>a.id===friend.id)?.canJoin&&!isPlayingThisTrack} onClick={()=>void(isPlayingThisTrack?leave():follow(friend.id))}
          >
            {isPlayingThisTrack ? 'Отключиться' : activities.find(a=>a.id===friend.id)?.canJoin?'🎧 Слушать вместе':'Совместное прослушивание отключено'}
          </button>
        </div>
      ) : (
        <div className={styles.noMusicBox}>
          <span className={listeningWithMe?styles.withMe:styles.offlineText}>{listeningWithMe?'Слушает с вами':'Сейчас ничего не слушает'}</span>
          {isPlayingThisTrack&&<button className={styles.shareMusicBtn} disabled={busy} onClick={()=>void leave()}>Отключиться</button>}
        </div>
      )}
    </div>
  );
};
