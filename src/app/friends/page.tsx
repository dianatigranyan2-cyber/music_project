'use client';

import React, { useState } from 'react';
import styles from './page.module.css';
import { MOCK_FRIENDS } from '../../data/mockData';
import { usePlayer } from '../../context/PlayerContext';
import { Friend } from '../../types';

export default function FriendsPage() {
  const { playTrack, searchQuery } = usePlayer();
  const [activeTab, setActiveTab] = useState<'my' | 'requests' | 'search'>('my');
  const [requests, setRequests] = useState([
    { id: 'r1', name: 'Екатерина Романова', username: 'katya_music', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', mutual: 6 },
    { id: 'r2', name: 'Денис Мельников', username: 'denis_beats', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', mutual: 14 },
  ]);

  const handleAcceptRequest = (id: string) => {
    setRequests(requests.filter((r) => r.id !== id));
  };

  const handleDeclineRequest = (id: string) => {
    setRequests(requests.filter((r) => r.id !== id));
  };

  const filteredFriends = MOCK_FRIENDS.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Друзья и сообщество</h1>
        <p className={styles.subtitle}>Слушайте треки вместе, делитесь альбомами и общайтесь.</p>
      </header>

      {/* Tabs */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'my' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('my')}
        >
          Мои друзья ({MOCK_FRIENDS.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Запросы ({requests.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'search' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Поиск людей
        </button>
      </div>

      {/* Tab: My Friends */}
      {activeTab === 'my' && (
        <div className={styles.friendsList}>
          {filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => (
              <div key={friend.id} className={styles.friendRow}>
                <div className={styles.avatarWrapper}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={friend.avatarUrl} alt={friend.name} className={styles.avatar} />
                  <span className={`${styles.onlineDot} ${friend.isOnline ? styles.online : styles.offline}`} />
                </div>

                <div className={styles.friendInfo}>
                  <div className={styles.nameLine}>
                    <span className={styles.name}>{friend.name}</span>
                    <span className={styles.username}>@{friend.username}</span>
                  </div>
                  {friend.currentTrack ? (
                    <span className={styles.listeningStatus}>
                      🎧 Слушает: <strong>{friend.currentTrack.title}</strong> — {friend.currentTrack.artist}
                    </span>
                  ) : (
                    <span className={styles.statusMsg}>{friend.statusMessage || 'Не в сети'}</span>
                  )}
                </div>

                <div className={styles.actions}>
                  {friend.currentTrack && (
                    <button
                      className={styles.listenTogetherBtn}
                      onClick={() => friend.currentTrack && playTrack(friend.currentTrack)}
                    >
                      Слушать вместе
                    </button>
                  )}
                  <button className={styles.iconActionBtn} title="Написать">
                    💬
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>Друзья по запросу «{searchQuery}» не найдены.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Friend Requests */}
      {activeTab === 'requests' && (
        <div className={styles.requestsList}>
          {requests.length > 0 ? (
            requests.map((req) => (
              <div key={req.id} className={styles.requestCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={req.avatarUrl} alt={req.name} className={styles.avatar} />
                <div className={styles.reqInfo}>
                  <span className={styles.name}>{req.name}</span>
                  <span className={styles.username}>@{req.username} • {req.mutual} общих друзей</span>
                </div>
                <div className={styles.reqBtns}>
                  <button className={styles.acceptBtn} onClick={() => handleAcceptRequest(req.id)}>
                    Принять
                  </button>
                  <button className={styles.declineBtn} onClick={() => handleDeclineRequest(req.id)}>
                    Отклонить
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>У вас пока нет новых запросов в друзья.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Search Users */}
      {activeTab === 'search' && (
        <div className={styles.emptyState}>
          <p>Вставьте никнейм или имя в верхнее поле поиска для нахождения новых пользователей.</p>
        </div>
      )}
    </div>
  );
}
