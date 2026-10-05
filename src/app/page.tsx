'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { StoriesBar } from '../components/Stories/StoriesBar';
import { FriendCard } from '../components/FriendCard/FriendCard';
import { usePlayer } from '../context/PlayerContext';
import {
  DEMO_TRACKS,
  MOCK_FRIENDS,
  MOCK_STORIES,
} from '../data/mockData';
import { Track } from '../types';

export default function Home() {
  const { currentTrack, playTrack, searchQuery } = usePlayer();
  const [filterMode, setFilterMode] = useState<'all' | 'listening' | 'online'>('all');

  const filteredFriends = MOCK_FRIENDS.filter((friend) => {
    const matchesSearch =
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.currentTrack?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.currentTrack?.artist.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'listening') return Boolean(friend.currentTrack);
    if (filterMode === 'online') return friend.isOnline;
    return true;
  });

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      {/* Friends Stories */}
      <StoriesBar stories={MOCK_STORIES} />

      {/* Social Banner */}
      <section className={styles.heroBanner}>
        <div className={styles.heroText}>
          <h2>Слушайте вместе в реальном времени</h2>
          <p>Присоединяйтесь к сессиям друзей, общайтесь и делитесь плейлистами без задержек.</p>
        </div>
        <Link href="/room/1" className={styles.listenRoomBtn}>
          Создать комнату 🎧
        </Link>
      </section>

      {/* Friends Section Header */}
      <section className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>
          Активность друзей <span className={styles.liveBadge}>LIVE</span>
        </h3>

        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterBtn} ${filterMode === 'all' ? styles.activeFilter : ''}`}
            onClick={() => setFilterMode('all')}
          >
            Все ({MOCK_FRIENDS.length})
          </button>
          <button
            className={`${styles.filterBtn} ${filterMode === 'listening' ? styles.activeFilter : ''}`}
            onClick={() => setFilterMode('listening')}
          >
            Слушают сейчас ({MOCK_FRIENDS.filter((f) => f.currentTrack).length})
          </button>
          <button
            className={`${styles.filterBtn} ${filterMode === 'online' ? styles.activeFilter : ''}`}
            onClick={() => setFilterMode('online')}
          >
            В сети ({MOCK_FRIENDS.filter((f) => f.isOnline).length})
          </button>
        </div>
      </section>

      {/* Friends Grid / Horizontal Strip on Mobile */}
      <div className={styles.friendsGrid}>
        {filteredFriends.length > 0 ? (
          filteredFriends.map((friend) => (
            <FriendCard
              key={friend.id}
              friend={friend}
              onPlayTrack={(track: Track) => playTrack(track)}
              isPlayingThisTrack={friend.currentTrack?.id === currentTrack.id}
            />
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>Друзья по вашему запросу «{searchQuery}» не найдены.</p>
          </div>
        )}
      </div>

      {/* Recommended Demo Tracks */}
      <section className={styles.recommendSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Демо-треки на Melo</h3>
        </div>
        <div className={styles.tracksList}>
          {DEMO_TRACKS.map((track, idx) => (
            <div
              key={track.id}
              className={`${styles.trackRow} ${track.id === currentTrack.id ? styles.trackRowActive : ''
                }`}
              onClick={() => playTrack(track)}
            >
              <div className={styles.trackRowLeft}>
                <span className={styles.trackIndex}>{idx + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className={styles.trackRowCover}
                />
                <div className={styles.trackRowMeta}>
                  <span className={styles.trackRowTitle}>{track.title}</span>
                  <span className={styles.trackRowArtist}>{track.artist}</span>
                </div>
              </div>

              <div className={styles.trackRowRight}>
                <span className={styles.trackRowDuration}>
                  {formatDuration(track.duration)}
                </span>
                <div className={styles.playTrackIcon}>
                  {track.id === currentTrack.id ? '▶' : '🎵'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
