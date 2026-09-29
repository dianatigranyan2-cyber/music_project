'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { DEMO_TRACKS } from '../../data/mockData';
import { usePlayer } from '../../context/PlayerContext';

export default function PlaylistsPage() {
  const { playTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState<'my' | 'shared' | 'favorites'>('my');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [myPlaylists, setMyPlaylists] = useState([
    {
      id: 'p1',
      title: 'Вайб для работы 💻',
      desc: 'Синтвейв и лоу-фай для концентрации',
      trackCount: 14,
      coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop&q=80',
    },
    {
      id: 'p2',
      title: 'Вечерний чилл 🌆',
      desc: 'Медленные треки для отдыха после работы',
      trackCount: 8,
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    },
  ]);

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    const newPl = {
      id: `p_${Date.now()}`,
      title: newTitle,
      desc: newDesc || 'Мой новый плейлист',
      trackCount: 0,
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80',
    };
    setMyPlaylists([newPl, ...myPlaylists]);
    setNewTitle('');
    setNewDesc('');
    setIsModalOpen(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTitleRow}>
          <div>
            <h1 className={styles.title}>Мои плейлисты</h1>
            <p className={styles.subtitle}>Коллекция любимых треков, совместных подборок и альбомов.</p>
          </div>
          <button className={styles.createBtn} onClick={() => setIsModalOpen(true)}>
            + Создать плейлист
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'my' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('my')}
        >
          Мои ({myPlaylists.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'shared' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          Совместные (1)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'favorites' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          Любимые треки (4)
        </button>
      </div>

      {/* My Playlists */}
      {activeTab === 'my' && (
        <div className={styles.grid}>
          {myPlaylists.map((pl) => (
            <div key={pl.id} className={styles.card}>
              <div className={styles.coverWrapper}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pl.coverUrl} alt={pl.title} className={styles.cover} />
                <button
                  className={styles.playBtn}
                  onClick={() => playTrack(DEMO_TRACKS[0])}
                  title="Воспроизвести"
                >
                  ▶
                </button>
              </div>
              <h3 className={styles.cardTitle}>{pl.title}</h3>
              <p className={styles.cardDesc}>{pl.desc}</p>
              <span className={styles.trackCount}>{pl.trackCount} треков</span>
            </div>
          ))}
        </div>
      )}

      {/* Shared Playlists */}
      {activeTab === 'shared' && (
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.coverWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80"
                alt="Совместный"
                className={styles.cover}
              />
              <button className={styles.playBtn} onClick={() => playTrack(DEMO_TRACKS[1])}>
                ▶
              </button>
            </div>
            <h3 className={styles.cardTitle}>Ночной движ 🎧 (с Алиной)</h3>
            <p className={styles.cardDesc}>Совместный плейлист, обновляемый вместе</p>
            <span className={styles.trackCount}>22 трека</span>
          </div>
        </div>
      )}

      {/* Favorites */}
      {activeTab === 'favorites' && (
        <div className={styles.favList}>
          {DEMO_TRACKS.map((t, i) => (
            <div key={t.id} className={styles.favRow} onClick={() => playTrack(t)}>
              <span className={styles.favIdx}>{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.coverUrl} alt={t.title} className={styles.favCover} />
              <div className={styles.favMeta}>
                <span className={styles.favTitle}>{t.title}</span>
                <span className={styles.favArtist}>{t.artist}</span>
              </div>
              <button className={styles.favPlayIcon}>▶</button>
            </div>
          ))}
        </div>
      )}

      {/* Create Playlist Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Создать новый плейлист</h2>
              <button className={styles.closeModalBtn} onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePlaylist} className={styles.form}>
              <label className={styles.label}>Название плейлиста</label>
              <input
                type="text"
                placeholder="Например: Мой синтвейв..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className={styles.input}
                required
              />
              <label className={styles.label}>Описание (необязательно)</label>
              <textarea
                placeholder="Короткое описание плейлиста..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className={styles.textarea}
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Отмена
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
