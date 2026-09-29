'use client';

import React from 'react';
import styles from './page.module.css';
import { CURRENT_USER, DEMO_TRACKS } from '../../data/mockData';
import { usePlayer } from '../../context/PlayerContext';

export default function ProfilePage() {
  const { playTrack } = usePlayer();

  const genres = ['Синтвейв 🌌', 'Киберпанк ⚡', 'Ретровейв 🌆', 'Инди-поп 🎸', 'Лоу-фай ☕'];

  return (
    <div className={styles.container}>
      {/* Profile Header Banner */}
      <div className={styles.profileHero}>
        <div className={styles.avatarWrapper}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CURRENT_USER.avatarUrl} alt={CURRENT_USER.name} className={styles.avatar} />
        </div>
        <div className={styles.profileMeta}>
          <h1 className={styles.name}>{CURRENT_USER.name}</h1>
          <span className={styles.handle}>{CURRENT_USER.handle}</span>
          <p className={styles.bio}>
            Музыкальный энтузиаст, создатель ночных синтвейв-комнат. Делюсь атмосферными треками для концентрации.
          </p>
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statVal}>42</span>
              <span className={styles.statLbl}>Друзей</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statVal}>5</span>
              <span className={styles.statLbl}>Плейлистов</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statVal}>128 ч</span>
              <span className={styles.statLbl}>Время прослушивания</span>
            </div>
          </div>
        </div>
      </div>

      {/* Favorite Genres Tags */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Любимые жанры</h2>
        <div className={styles.tagsRow}>
          {genres.map((g, idx) => (
            <span key={idx} className={styles.genreTag}>
              {g}
            </span>
          ))}
        </div>
      </section>

      {/* Recent Listening History */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Недавно прослушано</h2>
        <div className={styles.historyList}>
          {DEMO_TRACKS.map((track, i) => (
            <div key={track.id} className={styles.trackRow} onClick={() => playTrack(track)}>
              <span className={styles.idx}>{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={track.coverUrl} alt={track.title} className={styles.cover} />
              <div className={styles.meta}>
                <span className={styles.title}>{track.title}</span>
                <span className={styles.artist}>{track.artist}</span>
              </div>
              <span className={styles.timeAgo}>2 часа назад</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
