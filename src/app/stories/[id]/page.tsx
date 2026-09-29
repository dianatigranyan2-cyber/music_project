'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { MOCK_STORIES, DEMO_TRACKS } from '../../../data/mockData';
import { usePlayer } from '../../../context/PlayerContext';

export default function StoryViewerPage() {
  const { playTrack } = usePlayer();
  const story = MOCK_STORIES[0];
  const avatarUrl = story.userAvatar || story.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
  const mediaUrl = story.mediaUrl || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80';

  const [replyText, setReplyText] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSentNotice(true);
    setReplyText('');
    setTimeout(() => setSentNotice(false), 2500);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.storyCard}>
        {/* Progress Bar Header */}
        <div className={styles.progressBarWrapper}>
          <div className={styles.progressBarFill} />
        </div>

        {/* Story Top Header */}
        <div className={styles.storyHeader}>
          <div className={styles.userMeta}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={story.userName} className={styles.avatar} />
            <div className={styles.userInfo}>
              <span className={styles.username}>{story.userName}</span>
              <span className={styles.timeAgo}>2 часа назад</span>
            </div>
          </div>
          <Link href="/" className={styles.closeBtn} title="Закрыть">
            ✕
          </Link>
        </div>

        {/* Story Content Image */}
        <div className={styles.storyMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl} alt="Story" className={styles.mediaImg} />

          {/* Tagged Track Overlay */}
          <div className={styles.trackOverlay} onClick={() => playTrack(DEMO_TRACKS[0])}>
            <span className={styles.noteIcon}>🎵</span>
            <div className={styles.trackMeta}>
              <span className={styles.trackTitle}>{DEMO_TRACKS[0].title}</span>
              <span className={styles.trackArtist}>{DEMO_TRACKS[0].artist}</span>
            </div>
            <button className={styles.playBadge}>Слушать</button>
          </div>
        </div>

        {/* Story Footer Controls */}
        <div className={styles.storyFooter}>
          {sentNotice ? (
            <div className={styles.sentBadge}>✓ Сообщение отправлено!</div>
          ) : (
            <form onSubmit={handleSendReply} className={styles.replyForm}>
              <input
                type="text"
                placeholder={`Ответить ${story.userName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className={styles.replyInput}
              />
              <button type="submit" className={styles.sendReplyBtn}>
                🔥
              </button>
            </form>
          )}

          <div className={styles.reactionsRow}>
            <span>❤️</span>
            <span>🔥</span>
            <span>🎵</span>
            <span>👏</span>
          </div>
        </div>
      </div>
    </div>
  );
}
