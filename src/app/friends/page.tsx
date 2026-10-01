'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { CURRENT_USER } from '../../data/mockData';
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

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function FriendsPage() {
  const { searchQuery: headerSearchQuery } = usePlayer();
  const { user: currentUser } = useAuth();
  const [supabase] = useState(() => createClient());
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<Record<string, string>>({});

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'my' | 'requests' | 'search'>('my');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Close ⋯ dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load already sent friend requests
  useEffect(() => {
    const loadSentRequests = async () => {
      if (!currentUser?.id) {
        setSentRequests([]);
        return;
      }

      const { data, error } = await supabase
        .from('friend_requests')
        .select('receiver_id')
        .eq('sender_id', currentUser.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error loading sent friend requests:', error);
        return;
      }

      setSentRequests(
        (data || []).map((request) => request.receiver_id)
      );
    };

    loadSentRequests();
  }, [currentUser?.id, supabase]);

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

  // Load real incoming friend requests
  useEffect(() => {
    const loadFriendRequests = async () => {
      if (!currentUser?.id) {
        setRequests([]);
        setRequestsLoading(false);
        return;
      }

      setRequestsLoading(true);

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
        id,
        sender_id,
        receiver_id,
        status,
        created_at,
        sender:profiles!friend_requests_sender_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading friend requests:', error);
        setRequests([]);
      } else {
        const incomingRequests = (data || []) as unknown as FriendRequest[];

        setRequests(incomingRequests);

        const receivedMap: Record<string, string> = {};

        incomingRequests.forEach((request) => {
          receivedMap[request.sender_id] = request.id;
        });

        setReceivedRequests(receivedMap);
      }

      setRequestsLoading(false);
    };

    loadFriendRequests();
  }, [currentUser?.id, supabase]);

  const loadFriends = useCallback(async () => {
    if (!currentUser?.id) {
      setFriends([]);
      setFriendsLoading(false);
      return;
    }

    setFriendsLoading(true);

    // Получаем все принятые заявки, где участвует текущий пользователь
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

    if (friendshipsError) {
      console.error('Error loading friends:', friendshipsError);
      setFriends([]);
      setFriendsLoading(false);
      return;
    }

    // Получаем ID второго пользователя в каждой дружбе
    const friendIds = (friendships || []).map((friendship) =>
      friendship.sender_id === currentUser.id
        ? friendship.receiver_id
        : friendship.sender_id
    );

    if (friendIds.length === 0) {
      setFriends([]);
      setFriendsLoading(false);
      return;
    }

    // Загружаем профили друзей
    const { data: friendProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .in('id', friendIds);

    if (profilesError) {
      console.error('Error loading friend profiles:', profilesError);
      setFriends([]);
    } else {
      setFriends((friendProfiles || []) as Friend[]);
    }

    setFriendsLoading(false);
  }, [currentUser?.id, supabase]);

  // Load real friends
  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleRemoveFriend = async (friendId: string) => {
    if (!currentUser?.id) {
      return;
    }

    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('status', 'accepted')
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`
      );

    if (error) {
      console.error('Error removing friend:', error);
      return;
    }

    // Сразу убираем пользователя из списка друзей
    setFriends((prev) =>
      prev.filter((friend) => friend.id !== friendId)
    );

    setSentRequests((prev) =>
      prev.filter((id) => id !== friendId)
    );
  };

  const handleSendFriendRequest = async (receiverId: string) => {
    if (!currentUser?.id) {
      return;
    }

    const { error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: currentUser.id,
        receiver_id: receiverId,
        status: 'pending',
      });

    if (error) {
      console.error('Error sending friend request:', error);
      return;
    }

    setSentRequests((prev) => [...prev, receiverId]);
  };

  const handleAcceptRequest = async (id: string) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', id);

    if (error) {
      console.error('Error accepting friend request:', error);
      return;
    }

    setRequests((prev) =>
      prev.filter((request) => request.id !== id)
    );

    setReceivedRequests((prev) => {
      const updated = { ...prev };

      for (const userId in updated) {
        if (updated[userId] === id) {
          delete updated[userId];
        }
      }

      return updated;
    });

    await loadFriends();
  };

  const handleDeclineRequest = async (id: string) => {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error declining friend request:', error);
      return;
    }

    setRequests((prev) =>
      prev.filter((request) => request.id !== id)
    );

    setReceivedRequests((prev) => {
      const updated = { ...prev };

      for (const userId in updated) {
        if (updated[userId] === id) {
          delete updated[userId];
        }
      }

      return updated;
    });
  };
  const filteredFriends = friends.filter((friend) => {
    const name = friend.display_name || friend.username;
    const query = headerSearchQuery.toLowerCase();

    return (
      name.toLowerCase().includes(query) ||
      friend.username.toLowerCase().includes(query)
    );
  });
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
          Мои друзья ({friends.length})
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
          {friendsLoading ? (
            <div className={styles.emptyState}>
              <p>Загрузка друзей...</p>
            </div>
          ) : filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => {
              const friendName =
                friend.display_name || friend.username;

              const friendAvatar =
                friend.avatar_url || CURRENT_USER.avatarUrl;

              return (
                <div key={friend.id} className={styles.friendRow}>
                  <div className={styles.avatarWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={friendAvatar}
                      alt={friendName}
                      className={styles.avatar}
                    />
                  </div>

                  <div className={styles.friendInfo}>
                    <div className={styles.nameLine}>
                      <span className={styles.name}>
                        {friendName}
                      </span>

                      <span className={styles.username}>
                        @{friend.username}
                      </span>
                    </div>

                    {/* <span className={styles.statusMsg}>
                      {friend.bio || 'x'}
                    </span> */}
                  </div>

                  <div className={styles.actions}>
                    <Link
                      href={`/profile/${friend.username}`}
                      className={styles.profileLinkBtn}
                    >
                      👤 Профиль
                    </Link>

                    <button
                      className={styles.iconActionBtn}
                      title="Написать"
                    >
                      💬
                    </button>

                    {/* ⋯ More menu */}
                    <div className={styles.menuWrapper} ref={openMenuId === friend.id ? menuRef : null}>
                      <button
                        className={styles.iconActionBtn}
                        title="Действия"
                        onClick={() => setOpenMenuId(openMenuId === friend.id ? null : friend.id)}
                      >
                        ⋯
                      </button>
                      {openMenuId === friend.id && (
                        <div className={styles.dropdownMenu}>
                          <button
                            className={styles.dropdownDanger}
                            onClick={() => {
                              handleRemoveFriend(friend.id);
                              setOpenMenuId(null);
                            }}
                          >
                            Удалить из друзей
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              <p>У вас пока нет друзей.</p>
            </div>
          )}
        </div>
      )}
      {/* Tab: Friend Requests */}
      {activeTab === 'requests' && (
        <div className={styles.requestsList}>
          {requestsLoading ? (
            <div className={styles.emptyState}>
              <p>Загрузка запросов...</p>
            </div>
          ) : requests.length > 0 ? (
            requests.map((req) => {
              const senderName =
                req.sender.display_name || req.sender.username;

              const senderAvatar =
                req.sender.avatar_url || CURRENT_USER.avatarUrl;

              return (
                <div key={req.id} className={styles.requestCard}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={senderAvatar}
                    alt={senderName}
                    className={styles.avatar}
                  />

                  <div className={styles.reqInfo}>
                    <span className={styles.name}>
                      {senderName}
                    </span>

                    <span className={styles.username}>
                      @{req.sender.username}
                    </span>
                  </div>

                  <div className={styles.reqBtns}>
                    <button
                      className={styles.acceptBtn}
                      onClick={() => handleAcceptRequest(req.id)}
                    >
                      Принять
                    </button>

                    <button
                      className={styles.declineBtn}
                      onClick={() => handleDeclineRequest(req.id)}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              );
            })
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

              const isFriend = friends.some(
                (friend) => friend.id === userResult.id
              );

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
                    <button
                      className={styles.acceptBtn}
                      onClick={() => {
                        const incomingRequestId = receivedRequests[userResult.id];

                        if (incomingRequestId) {
                          handleAcceptRequest(incomingRequestId);
                        } else if (!isFriend) {
                          handleSendFriendRequest(userResult.id);
                        }
                      }}
                      disabled={
                        isFriend ||
                        sentRequests.includes(userResult.id)
                      }
                    >
                      {isFriend
                        ? '✓ В друзьях'
                        : receivedRequests[userResult.id]
                          ? 'Принять заявку'
                          : sentRequests.includes(userResult.id)
                            ? '✓ Заявка отправлена'
                            : '+ Добавить'}
                    </button>
                  </div>

                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
