'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { StoryEditor } from '../../../components/Stories/StoryEditor';
import { StoryMusic } from '../../../components/Stories/StoryMusic';
import { StoryCanvas } from '../../../components/Stories/StoryCanvas';
import { initialStoryPresentation } from '../../../lib/storyPresentation';
import { useMusicLibrary } from '../../../hooks/useMusicLibrary';
import type { EditableStory } from '../../../lib/storyEditing';
import { createClient } from '../../../lib/supabase/client';

type StoryData = EditableStory;

interface UserProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface UserStoryGroup {
  userId: string;
  stories: StoryData[];
  profile?: UserProfile;
}

interface StoryViewerItem {
  id: string;
  user_id: string;
  viewed_at: string;
  profile?: UserProfile;
  hasLiked?: boolean;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatTimeAgo(createdAt: string): string {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const diffInSeconds = Math.floor((now - created) / 1000);

  if (isNaN(diffInSeconds) || diffInSeconds < 60) {
    return 'только что';
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} мин. назад`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ч. назад`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} дн. назад`;
}

export default function StoryViewerPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const storyId = resolvedParams.id;
  const router = useRouter();
  const { library, error: musicLibraryError } = useMusicLibrary();
  const [editing, setEditing] = useState(false);
  const [storyRevision, setStoryRevision] = useState(0);
  const [musicWaiting, setMusicWaiting] = useState(false);
  const [mediaTime, setMediaTime] = useState(0);
  const [pageHidden, setPageHidden] = useState(false);
  const transitioning = useRef(false);
  useEffect(() => {
    const visibility = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => { transitioning.current = false; }, [storyId]);

  const [supabase] = useState(() => createClient());
  const [userGroups, setUserGroups] = useState<UserStoryGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState<number>(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0);
  const [story, setStory] = useState<StoryData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const pressStartTimeRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [replyText, setReplyText] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  const [viewers, setViewers] = useState<StoryViewerItem[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [isViewersModalOpen, setIsViewersModalOpen] = useState(false);

  // Load authenticated user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, [supabase]);

  // 1. Fetch active stories, group by user, and update indices
  useEffect(() => {
    let isMounted = true;

    // Otherwise, fetch all active stories from Supabase
    const loadAllActiveStories = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const nowIso = new Date().toISOString();
        const { data: { user }, error: authError } =
          await supabase.auth.getUser();

        if (authError || !user) {
          if (isMounted) setNotFound(true);
          return;
        }

        const { data: friendships, error: friendsError } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        if (friendsError) {
          console.error('Error checking friendships:', friendsError);
          if (isMounted) setNotFound(true);
          return;
        }

        const allowedUserIds = [
          user.id,
          ...(friendships || []).map((friend) =>
            friend.sender_id === user.id
              ? friend.receiver_id
              : friend.sender_id
          ),
        ];
        const { data: allActiveStories, error: storiesError } = await supabase
          .from('stories')
          .select('id, user_id, media_url, media_path, media_type, created_at, expires_at, caption, presentation, music_track_id, music_start_seconds, music_duration_seconds')
          .in('user_id', allowedUserIds)
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: true });

        if (storiesError || !allActiveStories || allActiveStories.length === 0) {
          if (isMounted) setNotFound(true);
          return;
        }

        const targetStory = allActiveStories.find((s) => s.id === storyId);
        if (!targetStory) {
          if (isMounted) setNotFound(true);
          return;
        }

        // Create temporary signed URLs for story media
        const storiesWithSignedUrls = await Promise.all(
          allActiveStories.map(async (s) => {
            if (!s.media_path) {
              return null;
            }

            const { data, error } = await supabase.storage
              .from('stories')
              .createSignedUrl(s.media_path, 300);

            if (error || !data?.signedUrl) {
              console.error('Error creating story signed URL:', error);
              return null;
            }

            return {
              ...s,
              media_url: data.signedUrl,
              media_type: s.media_type === 'video' ? 'video' as const : 'image' as const,
            };
          })
        );

        const groupsMap = new Map<string, StoryData[]>();

        storiesWithSignedUrls.forEach((s) => {
          if (!s) return;

          const list = groupsMap.get(s.user_id) || [];
          list.push(s);
          groupsMap.set(s.user_id, list);
        });
        const userIds = Array.from(groupsMap.keys());

        // Fetch user profiles for all story owners
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const profilesMap = new Map<string, UserProfile>();
        profilesData?.forEach((p) => {
          profilesMap.set(p.id, {
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
          });
        });

        const groups: UserStoryGroup[] = userIds.map((uid) => ({
          userId: uid,
          stories: groupsMap.get(uid)!,
          profile: profilesMap.get(uid),
        }));

        const targetGroupIdx = groups.findIndex((g) => g.userId === targetStory.user_id);
        const targetStoryIdx = targetGroupIdx >= 0
          ? groups[targetGroupIdx].stories.findIndex((s) => s.id === storyId)
          : -1;

        if (targetGroupIdx === -1 || targetStoryIdx === -1) {
          if (isMounted) setNotFound(true);
          return;
        }

        if (isMounted) {
          setUserGroups(groups);
          setCurrentGroupIndex(targetGroupIdx);
          setCurrentStoryIndex(targetStoryIdx);
          setStory(groups[targetGroupIdx].stories[targetStoryIdx]);
          setProfile(groups[targetGroupIdx].profile || null);
          setProgress(0);
          setMediaTime(0); setMusicWaiting(false); setIsPaused(false); setIsMenuOpen(false); setEditing(false);
          setIsMenuOpen(false);
          setIsViewersModalOpen(false);
        }
      } catch (err) {
        console.error('Error loading active stories:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (storyId) {
      loadAllActiveStories();
    }

    return () => {
      isMounted = false;
    };
  }, [storyId, supabase]);

  // Load viewers list and likes if current story belongs to current user
  useEffect(() => {
    if (!story || !currentUserId || story.user_id !== currentUserId) {
      return;
    }

    let isMounted = true;

    const fetchStoryViewers = async () => {
      try {
        setLoadingViewers(true);
        const { data: viewsData, error: viewsError } = await supabase
          .from('story_views')
          .select('id, story_id, user_id, viewed_at')
          .eq('story_id', story.id)
          .order('viewed_at', { ascending: false });

        if (viewsError) {
          console.error('Error fetching story viewers:', viewsError);
          if (isMounted) setViewers([]);
          return;
        }

        if (!viewsData || viewsData.length === 0) {
          if (isMounted) setViewers([]);
          return;
        }

        // Deduplication: each viewer must appear exactly once, preserving recent view order
        const uniqueViewsMap = new Map<string, (typeof viewsData)[0]>();
        viewsData.forEach((v) => {
          if (!uniqueViewsMap.has(v.user_id)) {
            uniqueViewsMap.set(v.user_id, v);
          }
        });
        const uniqueViews = Array.from(uniqueViewsMap.values());
        const viewerUserIds = uniqueViews.map((v) => v.user_id);

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', viewerUserIds);

        if (profilesError) {
          console.error('Error fetching viewer profiles:', profilesError);
        }

        // Fetch existing likes (story_reactions) for this story
        const { data: reactionsData, error: reactionsError } = await supabase
          .from('story_reactions')
          .select('id, user_id, reaction')
          .eq('story_id', story.id);

        if (reactionsError) {
          console.error('Error fetching story reactions:', reactionsError);
        }

        const likedUserIds = new Set(
          (reactionsData || [])
            .filter((r) => r.reaction === '❤️')
            .map((r) => r.user_id)
        );

        const profilesMap = new Map<string, UserProfile>();
        profilesData?.forEach((p) => {
          profilesMap.set(p.id, {
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
          });
        });

        const viewerItems: StoryViewerItem[] = uniqueViews.map((v) => ({
          id: v.id,
          user_id: v.user_id,
          viewed_at: v.viewed_at,
          profile: profilesMap.get(v.user_id),
          hasLiked: likedUserIds.has(v.user_id),
        }));

        if (isMounted) {
          setViewers(viewerItems);
        }
      } catch (err) {
        console.error('Unexpected error fetching story viewers:', err);
        if (isMounted) setViewers([]);
      } finally {
        if (isMounted) setLoadingViewers(false);
      }
    };

    fetchStoryViewers();

    return () => {
      isMounted = false;
    };
  }, [story, currentUserId, supabase]);

  // Realtime subscription for story reactions (likes/unlikes) to update open viewers list without reload
  useEffect(() => {
    if (!story || !currentUserId || story.user_id !== currentUserId) {
      return;
    }

    const currentStoryId = story.id;

    // Helper to reliably re-fetch active likes for this story
    const reloadStoryLikes = async () => {
      try {
        const { data, error } = await supabase
          .from('story_reactions')
          .select('user_id, reaction')
          .eq('story_id', currentStoryId);

        if (error) {
          console.error('Error reloading story reactions:', error);
          return;
        }

        const likedSet = new Set(
          (data || [])
            .filter((r) => r.reaction === '❤️')
            .map((r) => r.user_id)
        );

        setViewers((prev) =>
          prev.map((v) => ({
            ...v,
            hasLiked: likedSet.has(v.user_id),
          }))
        );
      } catch (err) {
        console.error('Unexpected error reloading story likes:', err);
      }
    };

    const channel = supabase
      .channel(`story-reactions-${currentStoryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_reactions',
          filter: `story_id=eq.${currentStoryId}`,
        },
        (payload) => {
          const newRow = payload.new as { user_id?: string; reaction?: string };
          if (newRow?.user_id && newRow.reaction === '❤️') {
            setViewers((prev) =>
              prev.map((v) =>
                v.user_id === newRow.user_id ? { ...v, hasLiked: true } : v
              )
            );
          } else {
            reloadStoryLikes();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'story_reactions',
          filter: `story_id=eq.${currentStoryId}`,
        },
        (payload) => {
          const updatedRow = payload.new as { user_id?: string; reaction?: string };
          if (updatedRow?.user_id) {
            const isLiked = updatedRow.reaction === '❤️';
            setViewers((prev) =>
              prev.map((v) =>
                v.user_id === updatedRow.user_id ? { ...v, hasLiked: isLiked } : v
              )
            );
          } else {
            reloadStoryLikes();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'story_reactions',
        },
        (payload) => {
          const oldRow = payload.old as { id?: string; story_id?: string; user_id?: string };
          // If story_id is present (REPLICA IDENTITY FULL), ignore events from other stories
          if (oldRow?.story_id && oldRow.story_id !== currentStoryId) {
            return;
          }

          // If user_id is present, optimistically remove heart immediately
          if (oldRow?.user_id) {
            setViewers((prev) =>
              prev.map((v) =>
                v.user_id === oldRow.user_id ? { ...v, hasLiked: false } : v
              )
            );
          }

          // Always re-fetch active likes for current story to ensure 100% sync
          reloadStoryLikes();
        }
      )
      .subscribe();

    return () => {
      // Clean up previous channel subscription on story switch or unmount
      supabase.removeChannel(channel);
    };
  }, [story, currentUserId, supabase]);

  // Re-verify likes whenever viewers modal is opened
  useEffect(() => {
    if (!isViewersModalOpen || !story || !currentUserId || story.user_id !== currentUserId) {
      return;
    }

    const verifyLikesOnOpen = async () => {
      const { data, error } = await supabase
        .from('story_reactions')
        .select('user_id, reaction')
        .eq('story_id', story.id);

      if (!error && data) {
        const likedSet = new Set(
          data.filter((r) => r.reaction === '❤️').map((r) => r.user_id)
        );
        setViewers((prev) =>
          prev.map((v) => ({ ...v, hasLiked: likedSet.has(v.user_id) }))
        );
      }
    };

    verifyLikesOnOpen();
  }, [isViewersModalOpen, story, currentUserId, supabase]);

  // Mark current story as viewed in public.story_views if it belongs to another user
  useEffect(() => {
    if (!story || !supabase) return;

    const markStoryAsViewed = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && story.user_id !== user.id) {
          const { error } = await supabase
            .from('story_views')
            .insert({
              story_id: story.id,
              user_id: user.id,
            });

          if (error && error.code !== '23505') {
            console.error('Error marking story as viewed in story_views:', error);
          }
        }
      } catch (err) {
        console.error('Unexpected error marking story as viewed:', err);
      }
    };

    markStoryAsViewed();
  }, [story, supabase]);

  // Load current user's reaction for the current story
  useEffect(() => {
    if (!story || !currentUserId) return;

    const loadReaction = async () => {
      const { data, error } = await supabase
        .from('story_reactions')
        .select('reaction')
        .eq('story_id', story.id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (error) {
        console.error('Error loading story reaction:', error);
        return;
      }

      setSelectedReaction(data?.reaction ?? null);
    };

    loadReaction();
  }, [story, currentUserId, supabase]);

  const handleReaction = async (reaction: string) => {
    if (!story || !currentUserId) return;

    // Нельзя реагировать на свою Story
    if (story.user_id === currentUserId) return;

    // Пока обрабатываем только случай, когда реакции ещё нет
    if (selectedReaction === null) {
      const { error } = await supabase
        .from('story_reactions')
        .insert({
          story_id: story.id,
          user_id: currentUserId,
          reaction: reaction,
        });

      if (error) {
        console.error('Error adding story reaction:', error);
        return;
      }

      setSelectedReaction(reaction);
    }

    if (selectedReaction !== null && selectedReaction !== reaction) {
      const { error } = await supabase
        .from('story_reactions')
        .update({
          reaction: reaction,
        })
        .eq('story_id', story.id)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Error updating story reaction:', error);
        return;
      }

      setSelectedReaction(reaction);
    }

    if (selectedReaction === reaction) {
      const { error } = await supabase
        .from('story_reactions')
        .delete()
        .eq('story_id', story.id)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Error deleting story reaction:', error);
        return;
      }

      setSelectedReaction(null);
    }
  };

  const musicTrack = library?.tracks.find(track => track.id === story?.music_track_id);
  const presentation = initialStoryPresentation(story?.presentation, story?.caption ?? '', !!musicTrack);
  const pausedForControls = isPaused || isMenuOpen || isViewersModalOpen || editing || pageHidden;
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (pausedForControls || musicWaiting) element.pause();
    else void element.play().catch(() => {});
  }, [pausedForControls, musicWaiting, story?.id]);

  // Navigation handlers
  const goToNextStory = useCallback(() => {
    if (transitioning.current) return;
    const currentGroup = userGroups[currentGroupIndex];
    if (!currentGroup) return;
    transitioning.current = true;

    if (currentStoryIndex < currentGroup.stories.length - 1) {
      // Next story of the SAME user
      const nextStory = currentGroup.stories[currentStoryIndex + 1];
      router.push(`/stories/${nextStory.id}`);
    } else if (currentGroupIndex < userGroups.length - 1) {
      // FIRST story of the NEXT user
      const nextGroup = userGroups[currentGroupIndex + 1];
      const firstStoryOfNextUser = nextGroup.stories[0];
      router.push(`/stories/${firstStoryOfNextUser.id}`);
    } else {
      // End of all user stories -> return to home
      router.push('/');
    }
  }, [currentGroupIndex, currentStoryIndex, router, userGroups]);

  const goToPrevStory = useCallback(() => {
    const currentGroup = userGroups[currentGroupIndex];
    if (!currentGroup) return;

    if (currentStoryIndex > 0) {
      // Previous story of the SAME user
      const prevStory = currentGroup.stories[currentStoryIndex - 1];
      router.push(`/stories/${prevStory.id}`);
    } else if (currentGroupIndex > 0) {
      // LAST story of the PREVIOUS user
      const prevGroup = userGroups[currentGroupIndex - 1];
      const lastStoryOfPrevUser = prevGroup.stories[prevGroup.stories.length - 1];
      router.push(`/stories/${lastStoryOfPrevUser.id}`);
    }
  }, [currentGroupIndex, currentStoryIndex, router, userGroups]);

  // Timer for IMAGE stories (5 seconds)
  useEffect(() => {
    if (loading || notFound || !story || story.media_type !== 'image' || pausedForControls || musicWaiting || (story.music_track_id && !library && !musicLibraryError)) {
      return;
    }

    const intervalMs = 50;
    const totalDurationMs = musicTrack ? (story.music_duration_seconds ?? 15) * 1000 : 5000;
    const increment = (intervalMs / totalDurationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + increment >= 100) {
          clearInterval(timer);
          setTimeout(() => goToNextStory(), 0);
          return 100;
        }
        return prev + increment;
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [loading, notFound, story, pausedForControls, musicWaiting, musicTrack, library, musicLibraryError, goToNextStory]);

  // Video event handlers
  const handleVideoTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const elapsed = videoRef.current.currentTime;
      setMediaTime(elapsed);
      const length = musicTrack ? Math.min(videoRef.current.duration, story?.music_duration_seconds ?? 15) : videoRef.current.duration;
      if (elapsed >= length) { goToNextStory(); return; }
      const pct = (elapsed / length) * 100;
      setProgress(pct);
    }
  };

  const handleVideoEnded = () => {
    goToNextStory();
  };

  // Press-and-hold pause and tap navigation logic
  const handlePointerDown = () => {
    if (isMenuOpen || isViewersModalOpen || editing) return;
    pressStartTimeRef.current = Date.now();
    setIsPaused(true);
    if (story?.media_type === 'video' && videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handlePointerUp = (direction: 'left' | 'right') => {
    if (isMenuOpen || isViewersModalOpen || editing) return;
    const pressDuration = Date.now() - pressStartTimeRef.current;
    setIsPaused(false);
    if (story?.media_type === 'video' && videoRef.current) {
      videoRef.current.play().catch(() => { });
    }

    // Only trigger tap navigation if press was brief (< 250ms)
    if (pressDuration < 250) {
      if (direction === 'left') {
        goToPrevStory();
      } else {
        goToNextStory();
      }
    }
  };

  const handleDeleteStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);

    if (!story || !currentUserId || story.user_id !== currentUserId) {
      return;
    }

    const confirmed = window.confirm('Удалить эту историю?');
    if (!confirmed) {
      setIsPaused(false);
      return;
    }

    try {
      // 1. Delete Storage file FIRST if media_path exists
      if (story.media_path) {
        const { error: storageError } = await supabase.storage
          .from('stories')
          .remove([story.media_path]);

        if (storageError) {
          console.error('Error deleting story file from Storage:', storageError);
          setIsPaused(false);
          return;
        }
      }

      // 2. Delete database row
      const { error: dbError } = await supabase
        .from('stories')
        .delete()
        .eq('id', story.id)
        .eq('user_id', currentUserId);

      if (dbError) {
        console.error('Error deleting story from database:', dbError);
        setIsPaused(false);
        return;
      }

      // 3. Deletion succeeded -> navigate to "/"
      router.push('/');
    } catch (err) {
      console.error('Unexpected error deleting story:', err);
      setIsPaused(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!replyText.trim() || !story || !currentUserId) return;

    // Нельзя отправлять сообщение самому себе
    if (story.user_id === currentUserId) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUserId,
        receiver_id: story.user_id,
        content: replyText.trim(),
        story_id: story.id,
        is_story_reply: true,
      });

    if (error) {
      console.error('Error sending message:', error);
      alert('Не удалось отправить сообщение');
      return;
    }

    setReplyText('');
    setSentNotice(true);

    setTimeout(() => setSentNotice(false), 2500);
  };

  const currentGroupStories = userGroups[currentGroupIndex]?.stories || [];
  const userName = profile?.display_name || profile?.username || 'Пользователь';
  const avatarUrl = profile?.avatar_url || '/default-avatar.png';
  const timeAgo = story?.created_at ? formatTimeAgo(story.created_at) : '';
  const isOwnStory = Boolean(currentUserId && story?.user_id === currentUserId);

  return (
    <div className={styles.overlay}>
      <div className={styles.storyCard}>
        {/* Segmented Progress Bars for Current User's Stories ONLY */}
        <div className={styles.progressBarWrapper}>
          {currentGroupStories.length > 0
            ? currentGroupStories.map((s, idx) => {
              let fillWidth = '0%';
              if (idx < currentStoryIndex) {
                fillWidth = '100%';
              } else if (idx === currentStoryIndex) {
                fillWidth = `${progress}%`;
              }
              return (
                <div key={s.id} className={styles.progressSegment}>
                  <div
                    className={styles.progressSegmentFill}
                    style={{ width: fillWidth }}
                  />
                </div>
              );
            })
            : <div className={styles.progressSegment} />}
        </div>

        {/* Story Top Header */}
        <div className={styles.storyHeader}>
          <div className={styles.userMeta}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={userName} className={styles.avatar} />
            <div className={styles.userInfo}>
              <span className={styles.username}>{userName}</span>
              {timeAgo && <span className={styles.timeAgo}>{timeAgo}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isOwnStory && (
              <div className={styles.menuContainer}>
                <button
                  className={styles.menuBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isMenuOpen;
                    setIsMenuOpen(next);
                    setIsPaused(next);
                    if (story?.media_type === 'video' && videoRef.current) {
                      videoRef.current.pause();
                    }
                  }}
                  title="Управление историей"
                >
                  ⋯
                </button>
                {isMenuOpen && (
                  <div className={styles.dropdownMenu}>
                    <button className={styles.editOption} onClick={() => { setIsMenuOpen(false); setEditing(true); setIsPaused(true); }}>✏️ Редактировать историю</button>
                    <button
                      className={styles.deleteOption}
                      onClick={handleDeleteStory}
                    >
                      🗑️ Удалить историю
                    </button>
                  </div>
                )}
              </div>
            )}

            <Link href="/" className={styles.closeBtn} title="Закрыть">
              ✕
            </Link>
          </div>
        </div>

        {/* Story Content Area */}
        <div className={styles.storyMedia}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Загрузка истории...
            </div>
          ) : notFound || !story ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              История недоступна
            </div>
          ) : (
            <>
              {/* Left and Right Tap/Hold Navigation Zones */}
              <div
                className={styles.navZoneLeft}
                onMouseDown={handlePointerDown}
                onMouseUp={() => handlePointerUp('left')}
                onTouchStart={handlePointerDown}
                onTouchEnd={() => handlePointerUp('left')}
              />
              <div
                className={styles.navZoneRight}
                onMouseDown={handlePointerDown}
                onMouseUp={() => handlePointerUp('right')}
                onTouchStart={handlePointerDown}
                onTouchEnd={() => handlePointerUp('right')}
              />

              <StoryCanvas presentation={presentation} music={musicTrack}>{story.media_type === 'video' ? (
                <video
                  ref={videoRef}
                  muted={!!musicTrack}
                  src={story.media_url}
                  className={styles.mediaImg}
                  autoPlay
                  playsInline
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={story.media_url} alt="Story" className={styles.mediaImg} />
              )}</StoryCanvas>
            </>
          )}
        </div>

        {!loading && story && !notFound && <div className={styles.storyDetails}>
          {musicTrack && <StoryMusic compact key={story.id + ':' + story.music_track_id + ':' + storyRevision} track={musicTrack} start={story.music_start_seconds ?? 0} duration={story.music_duration_seconds ?? 15} paused={pausedForControls} videoTime={story.media_type === 'video' ? mediaTime : null} onWaiting={setMusicWaiting} onEnded={goToNextStory}/>}
          {story.music_track_id && library && !musicTrack && <p>Музыка сейчас недоступна.</p>}
        </div>}
        {editing && story && isOwnStory && <StoryEditor story={story} onClose={() => { setEditing(false); setIsPaused(false); }} onSaved={saved => {
          setStory(saved); setUserGroups(groups => groups.map(group => ({ ...group, stories: group.stories.map(item => item.id === saved.id ? saved : item) })));
          setStoryRevision(value => value + 1);
          setProgress(0); setMediaTime(0); setMusicWaiting(false); setEditing(false); setIsPaused(false);
          if (videoRef.current) videoRef.current.currentTime = 0;
        }}/>}

        {/* Story Footer Controls */}
        {!loading && !notFound && story && (
          <div className={styles.storyFooter}>
            {isOwnStory ? (
              <div className={styles.ownerFooterControls}>
                <button
                  type="button"
                  className={styles.viewersToggleBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsViewersModalOpen(true);
                    setIsPaused(true);
                    if (story?.media_type === 'video' && videoRef.current) {
                      videoRef.current.pause();
                    }
                  }}
                  title="Просмотры истории"
                >
                  <span className={styles.eyeIcon}>👁️</span>
                  <span className={styles.viewersCountLabel}>
                    {viewers.length} {viewers.length === 1 ? '' : (viewers.length >= 2 && viewers.length <= 4) ? '' : ''}
                  </span>
                </button>
              </div>
            ) : sentNotice ? (
              <div className={styles.sentBadge}>✓ Сообщение отправлено!</div>
            ) : (
              <form onSubmit={handleSendReply} className={styles.replyForm}>
                <input
                  type="text"
                  placeholder={`Ответить ${userName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className={styles.replyInput}
                />
                <button
                  type="button"
                  className={styles.sendReplyBtn}
                  onClick={() => handleReaction('❤️')}
                  disabled={isOwnStory}
                  aria-label={selectedReaction === '❤️' ? 'Убрать лайк' : 'Поставить лайк'}
                  style={{
                    color: selectedReaction === '❤️' ? '#ff3040' : '#ffffff',
                    fontSize: '28px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {selectedReaction === '❤️' ? '♥' : '♡'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Viewers Drawer Modal for Story Owner */}
        {isOwnStory && isViewersModalOpen && (
          <div
            className={styles.viewersModalOverlay}
            onClick={(e) => {
              e.stopPropagation();
              setIsViewersModalOpen(false);
              setIsPaused(false);
              if (story?.media_type === 'video' && videoRef.current) {
                videoRef.current.play().catch(() => { });
              }
            }}
          >
            <div
              className={styles.viewersModalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.viewersHeader}>
                <div className={styles.viewersTitleGroup}>
                  <span className={styles.viewersTitle}>Просмотры</span>
                  <span className={styles.viewersBadge}>{viewers.length}</span>
                </div>
                <button
                  type="button"
                  className={styles.closeViewersBtn}
                  onClick={() => {
                    setIsViewersModalOpen(false);
                    setIsPaused(false);
                    if (story?.media_type === 'video' && videoRef.current) {
                      videoRef.current.play().catch(() => { });
                    }
                  }}
                  title="Закрыть"
                >
                  ✕
                </button>
              </div>

              <div className={styles.viewersListContainer}>
                {loadingViewers ? (
                  <div className={styles.viewersStatusState}>Загрузка просмотров...</div>
                ) : viewers.length === 0 ? (
                  <div className={styles.viewersStatusState}>Пока нет просмотров</div>
                ) : (
                  <div className={styles.viewersList}>
                    {viewers.map((v) => {
                      const vName = v.profile?.display_name || v.profile?.username || 'Пользователь';
                      const vAvatar = v.profile?.avatar_url || '/default-avatar.png';
                      const vTime = v.viewed_at ? formatTimeAgo(v.viewed_at) : '';
                      return (
                        <div key={v.id} className={styles.viewerRow}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={vAvatar} alt={vName} className={styles.viewerAvatar} />
                          <div className={styles.viewerMeta}>
                            <div className={styles.viewerNameRow}>
                              <span className={styles.viewerName}>{vName}</span>
                              {v.hasLiked && (
                                <span
                                  className={styles.viewerLikedHeart}
                                  role="img"
                                  aria-label="Поставил(а) лайк"
                                  title="Поставил(а) лайк"
                                >
                                  ❤️
                                </span>
                              )}
                            </div>
                            {v.profile?.username && (
                              <span className={styles.viewerSubname}>@{v.profile.username}</span>
                            )}
                          </div>
                          {vTime && <span className={styles.viewerTime}>{vTime}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



