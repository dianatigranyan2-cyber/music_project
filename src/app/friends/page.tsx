'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { MOCK_FRIENDS, CURRENT_USER } from '../../data/mockData';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';
import { createClient } from '../../lib/supabase/client';

interface UserSearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function FriendsPage() {
  const { playTrack, searchQuery: headerSearchQuery } = usePlayer();
  const { user: currentUser } = useAuth();
  const [supabase] = useState(() => createClient());

  const [activeTab, setActiveTab] = useState<'my' | 'requests' | 'search'>('my');
  const [requests, setRequests] = useState([
    { id: 'r1', name: 'Екатерина Романова', username: 'katya_music', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', mutual: 6 },
    { id: 'r2', name: 'Денис Мельников', username: 'denis_beats', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', mutual: 14 },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Sync header search query with friends search
  useEffect(() => {
    if (headerSearchQuery.trim()) {
      setSearchTerm(headerSearchQuery);
      setActiveTab('search');
    }
  }, [headerSearchQuery]);

  // Debounced search logic for querying public.profiles
  useEffect(() => {
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        let query = supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio')
          .or(`username.ilike.%${cleanTerm}%,display_name.ilike.%${cleanTerm}%`);

        if (currentUser?.id) {
          query = query.neq('id', currentUser.id);
        }

        const { data, error } = await query.limit(20);

        if (!error && data) {
          setSearchResults(data as UserSearchResult[]);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
        setHasSearched(true);
      }
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser?.id, supabase]);

  const handleAcceptRequest = (id: string) => {
    setRequests(requests.filter((r) => r.id !== id));
  };

  const handleDeclineRequest = (id: string) => {
    setRequests(requests.filter((r) => r.id !== id));
  };

  const filteredFriends = MOCK_FRIENDS.filter(
    (f) =>
      f.name.toLowerCase().includes(headerSearchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(headerSearchQuery.toLowerCase())
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
              <p>Друзья по запросу «{headerSearchQuery}» не найдены.</p>
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
        <div className={styles.searchResultsList}>
          <div className={styles.searchBarRow}>
            <span style={{ fontSize: '16px' }}>🔍</span>
            <input
              type="text"
              placeholder="Введите никнейм или имя для поиска..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
            {searchTerm && (
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>

          {isSearching && (
            <div className={styles.emptyState}>
              <p>🔍 Поиск пользователей в Melo...</p>
            </div>
          )}

          {!isSearching && hasSearched && searchResults.length === 0 && (
            <div className={styles.emptyState}>
              <p>Пользователи по запросу «{searchTerm}» не найдены.</p>
            </div>
          )}

          {!isSearching && !hasSearched && !searchTerm && (
            <div className={styles.emptyState}>
              <p>Введите никнейм или имя в поле поиска выше для нахождения аккаунтов Melo.</p>
            </div>
          )}

          {!isSearching &&
            searchResults.map((userResult) => {
              const displayName = userResult.display_name || userResult.username;
              const avatar = userResult.avatar_url || CURRENT_USER.avatarUrl;

              return (
                <div key={userResult.id} className={styles.friendRow}>
                  <div className={styles.avatarWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatar} alt={displayName} className={styles.avatar} />
                  </div>

                  <div className={styles.friendInfo}>
                    <div className={styles.nameLine}>
                      <span className={styles.name}>{displayName}</span>
                      <span className={styles.username}>@{userResult.username}</span>
                    </div>
                    <span className={styles.statusMsg}>
                      {userResult.bio ? userResult.bio.slice(0, 70) + (userResult.bio.length > 70 ? '...' : '') : 'Пользователь Melo'}
                    </span>
                  </div>

                  <div className={styles.actions}>
                    <Link href={`/profile/${userResult.username}`} className={styles.profileLinkBtn}>
                      👤 Профиль
                    </Link>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
