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
          <button
            key={story.id}
            className={styles.storyCard}
            onClick={() => handleStoryClick(story)}
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
              <Avatar
                src={story.userAvatar}
                alt={story.userName}
                className={styles.avatar}
              />
              {story.isCurrentUser && (
                <div className={styles.addBadge} onClick={handleAddBadgeClick} title="Добавить историю">
                  <span>+</span>
                </div>
              )}
            </div>
            <span className={styles.userName}>{story.userName}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
