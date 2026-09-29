'use client';

import React from 'react';
import styles from './StoriesBar.module.css';
import { Story } from '../../types';

interface StoriesBarProps {
  stories: Story[];
  onSelectStory?: (story: Story) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ stories, onSelectStory }) => {
  return (
    <section className={styles.container}>
      <h3 className={styles.sectionTitle}>Истории друзей</h3>
      <div className={styles.storiesScroll}>
        {stories.map((story) => (
          <button
            key={story.id}
            className={styles.storyCard}
            onClick={() => onSelectStory?.(story)}
          >
            <div
              className={`${styles.avatarRing} ${
                story.hasUnseen ? styles.unseenRing : ''
              } ${story.isCurrentUser ? styles.userRing : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.userAvatar}
                alt={story.userName}
                className={styles.avatar}
              />
              {story.isCurrentUser && (
                <div className={styles.addBadge}>
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
