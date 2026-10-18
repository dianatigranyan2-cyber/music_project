'use client';
import {Avatar} from '../Profile/Avatar';

import React, { useRef, useState } from 'react';
import styles from './StoriesBar.module.css';
import { Story } from '../../types';
import { StoryEditor } from './StoryEditor';

interface StoriesBarProps {
  stories: Story[];
  onSelectStory?: (story: Story) => void;
  onStoryUploaded?: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ stories, onSelectStory, onStoryUploaded }) => {
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStoryClick = (story: Story) => {
    if (story.isCurrentUser && story.id === 'current-user-add') {
      fileInputRef.current?.click();
    } else {
      onSelectStory?.(story);
    }
  };

  const handleAddBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) setDraftFile(file);
  };

  return (
    <section className={styles.container}>
      {draftFile && <StoryEditor initialFile={draftFile} onClose={() => setDraftFile(null)} onSaved={() => { setDraftFile(null); onStoryUploaded?.(); }}/>}
      <h3 className={styles.sectionTitle}>Истории друзей</h3>

      {/* Hidden file input for story upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className={styles.storiesScroll}>
        {stories.map((story) => (
          <div
            key={story.id}
            className={styles.storyCard}
          >
            <div
              className={`${styles.avatarRing} ${story.isCurrentUser
                ? story.id === 'current-user-add'
                  ? styles.userRing
                  : styles.unseenRing
                : story.hasUnseen
                  ? styles.unseenRing
                  : ''
                }`}
            >
              <button type="button" className={styles.storyAvatarButton}
                onClick={() => handleStoryClick(story)}
                aria-label={story.id === 'current-user-add' ? 'Добавить вашу историю' : `Открыть истории: ${story.userName}`}>
                <Avatar
                  src={story.userAvatar}
                  alt={story.userName}
                  className={styles.avatar}
                />
              </button>
              {story.isCurrentUser && (
                <button type="button" className={styles.addBadge} onClick={handleAddBadgeClick} aria-label="Добавить историю" title="Добавить историю">
                  <span>+</span>
                </button>
              )}
            </div>
            <button type="button" className={styles.userName}
              onClick={() => handleStoryClick(story)}
              aria-label={story.id === 'current-user-add' ? 'Добавить вашу историю' : `Открыть истории: ${story.userName}`}>
              {story.userName}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
