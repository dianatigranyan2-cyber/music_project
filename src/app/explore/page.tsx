'use client';

import React, { useState, useRef } from 'react';
import styles from './page.module.css';
import { usePlayer } from '../../context/PlayerContext';
import { DEMO_TRACKS } from '../../data/mockData';

export default function ExplorePage() {
  const { playTrack, currentTrack, searchQuery } = usePlayer();
  const [selectedGenre, setSelectedGenre] = useState('all');
  const artistStripRef = useRef<HTMLDivElement>(null);
  const tracksStripRef = useRef<HTMLDivElement>(null);

  const genres = [
    { id: 'all', label: 'Все жанры' },
    { id: 'pop', label: 'Поп' },
    { id: 'synthwave', label: 'Синтвейв' },
    { id: 'indie', label: 'Инди' },
    { id: 'electronic', label: 'Электроника' },
    { id: 'hiphop', label: 'Хип-хоп' },
  ];

  const featuredArtists = [
    { name: 'The Weeknd', listeners: '1.2M слушателей', avatar: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80' },
    { name: 'M83', listeners: '840K слушателей', avatar: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80' },
    { name: 'HOME', listeners: '620K слушателей', avatar: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80' },
    { name: 'Daft Punk', listeners: '2.5M слушателей', avatar: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80' },
    { name: 'Kavinsky', listeners: '430K слушателей', avatar: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80' },
    { name: 'Perturbator', listeners: '210K слушателей', avatar: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?w=300&auto=format&fit=crop&q=80' },
  ];

  const scrollStrip = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: direction === 'right' ? 220 : -220, behavior: 'smooth' });
  };

  const filteredTracks = DEMO_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.album.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Обзор музыки</h1>
        <p className={styles.subtitle}>Открывайте новые треки, тренды и исполнителей вместе с сообществом Melo.</p>
      </header>

      {/* Genre Filter Pills */}
      <div className={styles.genreRow}>
        {genres.map((g) => (
          <button
            key={g.id}
            className={`${styles.genrePill} ${selectedGenre === g.id ? styles.activePill : ''}`}
            onClick={() => setSelectedGenre(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Popular Artists — Horizontal Strip */}
      <section className={styles.section}>
        <div className={styles.stripHeader}>
          <h2 className={styles.sectionTitle}>Популярные исполнители</h2>
          <div className={styles.navBtns}>
            <button className={styles.navBtn} onClick={() => scrollStrip(artistStripRef, 'left')}>←</button>
            <button className={styles.navBtn} onClick={() => scrollStrip(artistStripRef, 'right')}>→</button>
          </div>
        </div>
        <div className={styles.hStrip} ref={artistStripRef}>
          {featuredArtists.map((artist, idx) => (
            <div key={idx} className={`${styles.artistCard} ${styles.snapCard}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artist.avatar} alt={artist.name} className={styles.artistAvatar} />
              <span className={styles.artistName}>{artist.name}</span>
              <span className={styles.artistListeners}>{artist.listeners}</span>
              <button className={styles.subscribeBtn}>Подписаться</button>
            </div>
          ))}
        </div>
      </section>

      {/* Trending Tracks — Horizontal Strip */}
      <section className={styles.section}>
        <div className={styles.stripHeader}>
          <h2 className={styles.sectionTitle}>Тренды недели</h2>
          <div className={styles.navBtns}>
            <button className={styles.navBtn} onClick={() => scrollStrip(tracksStripRef, 'left')}>←</button>
            <button className={styles.navBtn} onClick={() => scrollStrip(tracksStripRef, 'right')}>→</button>
          </div>
        </div>
        <div className={styles.hStrip} ref={tracksStripRef}>
          {filteredTracks.map((track) => (
            <div
              key={track.id}
              className={`${styles.trackCard} ${styles.snapCard} ${
                track.id === currentTrack.id ? styles.activeTrackCard : ''
              }`}
              onClick={() => playTrack(track)}
            >
              <div className={styles.coverWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={track.coverUrl} alt={track.title} className={styles.trackCover} />
                <button className={styles.playOverlay}>
                  {track.id === currentTrack.id ? '▶' : '🎵'}
                </button>
              </div>
              <div className={styles.trackMeta}>
                <span className={styles.trackTitle}>{track.title}</span>
                <span className={styles.trackArtist}>{track.artist}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
