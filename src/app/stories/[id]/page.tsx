'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { createClient } from '../../../lib/supabase/client';

interface StoryData {
  id: string;
  user_id: string;
  media_url: string;
  media_path?: string | null;
  media_type: 'image' | 'video';
  created_at: string;
  expires_at: string;
}

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

    // Check if storyId is already present in cached userGroups state
    let foundGroupIdx = -1;
    let foundStoryIdx = -1;
    let foundStory: StoryData | null = null;

    userGroups.forEach((g, gIdx) => {
      const sIdx = g.stories.findIndex((s) => s.id === storyId);
      if (sIdx !== -1) {
        foundGroupIdx = gIdx;
        foundStoryIdx = sIdx;
        foundStory = g.stories[sIdx];
      }
    });

    if (foundGroupIdx !== -1 && foundStoryIdx !== -1 && foundStory) {
      setCurrentGroupIndex(foundGroupIdx);
      setCurrentStoryIndex(foundStoryIdx);
      setStory(foundStory);
      setProfile(userGroups[foundGroupIdx].profile || null);
      setProgress(0);
      setIsMenuOpen(false);
      setLoading(false);
      setNotFound(false);
      return;
    }

    // Otherwise, fetch all active stories from Supabase
    const loadAllActiveStories = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const nowIso = new Date().toISOString();
        const { data: allActiveStories, error: storiesError } = await supabase
          .from('stories')
          .select('id, user_id, media_url, media_path, media_type, created_at, expires_at')
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

        // Group stories by user_id preserving user order (earliest active story)
        const groupsMap = new Map<string, StoryData[]>();
        allActiveStories.forEach((s) => {
          const list = groupsMap.get(s.user_id) || [];
          list.push({
            ...s,
            media_type: s.media_type === 'video' ? 'video' : 'image',
          });
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
          setIsMenuOpen(false);
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
  }, [storyId, supabase, userGroups]);

  // Mark current story as viewed in public.story_views if it belongs to another user
  useEffect(() => {
    if (!story || !supabase) return;

    const markStoryAsViewed = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && story.user_id !== user.id) {
          const { error } = await supabase.from('story_views').upsert(
            {
              story_id: story.id,
              user_id: user.id,
            },
            {
              onConflict: 'story_id,user_id',
            }
          );

          if (error) {
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

  // Navigation handlers
  const goToNextStory = () => {
    const currentGroup = userGroups[currentGroupIndex];
    if (!currentGroup) return;

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
  };

  const goToPrevStory = () => {
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
  };

  // Timer for IMAGE stories (5 seconds)
  useEffect(() => {
    if (loading || notFound || !story || story.media_type !== 'image' || isPaused || isMenuOpen) {
      return;
    }

    const intervalMs = 50;
    const totalDurationMs = 5000;
    const increment = (intervalMs / totalDurationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + increment >= 100) {
          clearInterval(timer);
          goToNextStory();
          return 100;
        }
        return prev + increment;
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [loading, notFound, story, isPaused, isMenuOpen, currentGroupIndex, currentStoryIndex, userGroups]);

  // Video event handlers
  const handleVideoTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const pct = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(pct);
    }
  };

  const handleVideoEnded = () => {
    goToNextStory();
  };

  // Press-and-hold pause and tap navigation logic
  const handlePointerDown = () => {
    if (isMenuOpen) return;
    pressStartTimeRef.current = Date.now();
    setIsPaused(true);
    if (story?.media_type === 'video' && videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handlePointerUp = (direction: 'left' | 'right') => {
    if (isMenuOpen) return;
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
                    setIsMenuOpen((prev) => !prev);
                    setIsPaused(true);
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

              {story.media_type === 'video' ? (
                <video
                  ref={videoRef}
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
              )}
            </>
          )}
        </div>

        {/* Story Footer Controls */}
        {!loading && !notFound && story && (
          <div className={styles.storyFooter}>
            {sentNotice ? (
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
      </div>
    </div>
  );
}



