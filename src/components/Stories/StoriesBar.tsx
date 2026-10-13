'use client';

import React, { useRef, useState } from 'react';
import styles from './StoriesBar.module.css';
import { Story } from '../../types';
import { createClient } from '../../lib/supabase/client';

interface StoriesBarProps {
  stories: Story[];
  onSelectStory?: (story: Story) => void;
  onStoryUploaded?: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ stories, onSelectStory, onStoryUploaded }) => {
  const [supabase] = useState(() => createClient());
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('Authentication error or no authenticated user:', userError);
        return;
      }

      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}-${file.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('stories')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading story to Supabase Storage:', uploadError);
        return;
      }

      const uploadedPath = uploadData?.path || filePath;
      console.log('Successfully uploaded story to storage path:', uploadedPath);

      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      const { data: storyData, error: dbError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: '',
          media_path: uploadedPath,
          media_type: mediaType,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error inserting story into database:', dbError);
        // Delete uploaded file from storage to avoid orphaned file
        await supabase.storage.from('stories').remove([uploadedPath]);
        return;
      }

      console.log('Successfully created story in database:', storyData);
      onStoryUploaded?.();
    } catch (err) {
      console.error('Unexpected error during story upload:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section className={styles.container}>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
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
