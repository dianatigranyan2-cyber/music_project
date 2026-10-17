'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import { StoriesBar } from '../components/Stories/StoriesBar';
import { FriendCard } from '../components/FriendCard/FriendCard';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { createClient } from '../lib/supabase/client';
import {useFriendListening} from '../context/FriendListeningContext';
import {useMusicLibrary} from '../hooks/useMusicLibrary';
import {useSocialPresence} from '../context/SocialPresenceContext';
import {listeningTrack} from '../lib/friendListening';
import { MusicLibrary } from '../components/Music/MusicLibrary';
import { Story } from '../types';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const {searchQuery}=usePlayer();
  const {friends:activities,listeners}=useFriendListening();const {library}=useMusicLibrary();const {getOnlineStatus}=useSocialPresence();
  const realFriends=activities.map(activity=>({...activity,listeningWithMe:listeners.some(listener=>listener.id===activity.id),avatarUrl:activity.avatarUrl||'/default-avatar.png',isOnline:getOnlineStatus(activity.id)==='online',currentTrack:listeningTrack(activity,library?.tracks??[])}));
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [supabase] = useState(() => createClient());
  const [stories, setStories] = useState<Story[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'listening' | 'online'>('all');

  const loadStories = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      if (!currentUser?.id) {
        setStories([]);
        return;
      }

      // Получаем только подтверждённые дружеские связи
      const { data: friendships, error: friendsError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(
          `sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`
        );

      if (friendsError) {
        console.error('Error loading friendships:', friendsError);
        setStories([]);
        return;
      }

      // Собираем ID пользователей, чьи истории разрешено видеть
      const allowedUserIds = [
        currentUser.id,
        ...(friendships || []).map((friend) =>
          friend.sender_id === currentUser.id
            ? friend.receiver_id
            : friend.sender_id
        ),
      ];

      // 1. Fetch non-expired stories from public.stories (ordered created_at ASC so oldest story is first)
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('id, user_id, media_url, media_type, created_at, expires_at')
        .in('user_id', allowedUserIds)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: true });

      if (storiesError) {
        console.error('Error fetching stories:', storiesError);
        return;
      }

      const rawStories = storiesData || [];

      // 2. Load current user's viewed story IDs from public.story_views
      let viewedStoryIds = new Set<string>();
      if (currentUser?.id) {
        const { data: viewsData, error: viewsError } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('user_id', currentUser.id);

        if (!viewsError && viewsData) {
          viewedStoryIds = new Set(viewsData.map((v) => v.story_id));
        }
      }

      // 3. Fetch profile info for story owners
      const userIds = Array.from(new Set(rawStories.map((s) => s.user_id)));
      const profilesMap = new Map<
        string,
        { username: string; display_name: string | null; avatar_url: string | null }
      >();

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profilesData.forEach((p) => {
            profilesMap.set(p.id, p);
          });
        }
      }

      // Group active stories by user_id
      const userActiveStoriesMap = new Map<string, typeof rawStories>();
      rawStories.forEach((s) => {
        const list = userActiveStoriesMap.get(s.user_id) || [];
        list.push(s);
        userActiveStoriesMap.set(s.user_id, list);
      });

      // 4. Convert to Story[] format (1 story card per user)
      const userStoryMap = new Map<string, Story>();

      userActiveStoriesMap.forEach((userStoriesList, userId) => {
        const oldestStory = userStoriesList[0];
        const profile = profilesMap.get(userId);
        const isMe = currentUser?.id === userId;

        const userName = isMe
          ? (currentProfile?.display_name || currentProfile?.username || profile?.display_name || profile?.username || 'Ваша история')
          : (profile?.display_name || profile?.username || 'Пользователь');

        const userAvatar = isMe
          ? (currentProfile?.avatar_url || profile?.avatar_url || '/default-avatar.png')
          : (profile?.avatar_url || '/default-avatar.png');

        // hasUnseen is true if at least ONE active story for this user is NOT in viewedStoryIds
        const hasUnseen = isMe
          ? false
          : userStoriesList.some((s) => !viewedStoryIds.has(s.id));

        userStoryMap.set(userId, {
          id: oldestStory.id,
          userId,
          userName,
          userAvatar,
          avatarUrl: userAvatar,
          mediaUrl: '',
          hasUnseen,
          isCurrentUser: isMe,
        });
      });

      // 5. Build final stories list ensuring current user's story / + button is at index 0
      const finalStories: Story[] = [];

      if (currentUser?.id) {
        const myExistingStory = userStoryMap.get(currentUser.id);
        if (myExistingStory) {
          finalStories.push(myExistingStory);
          userStoryMap.delete(currentUser.id);
        } else {
          finalStories.push({
            id: 'current-user-add',
            userId: currentUser.id,
            userName: currentProfile?.display_name || currentProfile?.username || 'Ваша история',
            userAvatar: currentProfile?.avatar_url || '/default-avatar.png',
            avatarUrl: currentProfile?.avatar_url || '/default-avatar.png',
            hasUnseen: false,
            isCurrentUser: true,
          });
        }
      }

      // Append remaining active stories from other users
      userStoryMap.forEach((story) => {
        finalStories.push(story);
      });

      setStories(finalStories);
    } catch (err) {
      console.error('Unexpected error loading real stories:', err);
    }
  }, [currentUser, currentProfile, supabase]);

  useEffect(() => {
    queueMicrotask(()=>void loadStories());

    const handleFocus = () => {
      loadStories();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadStories]);

  const filteredFriends = realFriends.filter((friend) => {
    const matchesSearch =
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.currentTrack?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.currentTrack?.artist.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'listening') return Boolean(friend.currentTrack)||friend.listeningWithMe;
    if (filterMode === 'online') return friend.isOnline;
    return true;
  });

  return (
    <div>
      {/* Friends Stories */}
      <StoriesBar
        stories={stories}
        onSelectStory={(story) => router.push(`/stories/${story.id}`)}
        onStoryUploaded={loadStories}
      />

      {/* Social Banner */}

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
            Все ({realFriends.length})
          </button>
          <button
            className={`${styles.filterBtn} ${filterMode === 'listening' ? styles.activeFilter : ''}`}
            onClick={() => setFilterMode('listening')}
          >
            Слушают сейчас ({realFriends.filter((f) => f.currentTrack||f.listeningWithMe).length})
          </button>
          <button
            className={`${styles.filterBtn} ${filterMode === 'online' ? styles.activeFilter : ''}`}
            onClick={() => setFilterMode('online')}
          >
            В сети ({realFriends.filter((f) => f.isOnline).length})
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
            />
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>{searchQuery?'Друзья по вашему запросу «'+searchQuery+'» не найдены.':filterMode==='listening'?'Друзья сейчас ничего не слушают.':'Здесь появится активность ваших друзей.'}</p>
          </div>
        )}
      </div>

      <div id="music" className={styles.musicOverview}><MusicLibrary /></div>
    </div>
  );
}
