'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import styles from '../../app/page.module.css';
import { Navigation } from '../Navigation/Navigation';
import { Header } from '../Header/Header';
import { Player } from '../Player/Player';
import { PlayerProvider, usePlayer } from '../../context/PlayerContext';
import {BlockingProvider} from '../../context/BlockingContext';
import { AuthProvider } from '../../context/AuthContext';
import {MusicLibraryProvider} from '../../hooks/useMusicLibrary';
import { PersonalMusicProvider } from '../../context/PersonalMusicContext';
import { MessageNotificationsProvider } from '../../context/MessageNotificationsContext';
import { SocialPresenceProvider } from '../../context/SocialPresenceContext';
import {FriendListeningProvider} from '../../context/FriendListeningContext';
import {FriendListeningStatus} from '../Music/FriendListeningStatus';

const InnerShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isStory = usePathname().startsWith('/stories/');
  const { currentTrack, searchQuery, setSearchQuery, handleNextTrack, handlePrevTrack } = usePlayer();

  return (
    <div className={styles.container}>
      {/* Persistent Navigation */}
      <Navigation />

      {/* Main Viewport */}
      <div className={`${styles.mainContent} ${isStory ? styles.storyLayout : ''}`}>
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <FriendListeningStatus/>
        <main className={`${styles.contentArea} ${isStory ? styles.storyContentArea : ''}`}>
          {children}
        </main>
      </div>

      {/* Persistent Bottom Music Player */}
      <Player
        currentTrack={currentTrack}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
      />
    </div>
  );
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MusicLibraryProvider><AuthProvider>
      <BlockingProvider><PersonalMusicProvider>
      <PlayerProvider>
        <FriendListeningProvider>
        <SocialPresenceProvider>
          <MessageNotificationsProvider>
            <InnerShell>{children}</InnerShell>
          </MessageNotificationsProvider>
        </SocialPresenceProvider>
        </FriendListeningProvider>
      </PlayerProvider>
      </PersonalMusicProvider></BlockingProvider>
    </AuthProvider></MusicLibraryProvider>
  );
};
