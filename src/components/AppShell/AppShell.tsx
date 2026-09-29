'use client';

import React from 'react';
import styles from '../../app/page.module.css';
import { Navigation } from '../Navigation/Navigation';
import { Header } from '../Header/Header';
import { Player } from '../Player/Player';
import { PlayerProvider, usePlayer } from '../../context/PlayerContext';
import { CURRENT_USER } from '../../data/mockData';

const InnerShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTrack, searchQuery, setSearchQuery, handleNextTrack, handlePrevTrack } = usePlayer();

  return (
    <div className={styles.container}>
      {/* Persistent Navigation */}
      <Navigation />

      {/* Main Viewport */}
      <div className={styles.mainContent}>
        <Header
          user={CURRENT_USER}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <main className={styles.contentArea}>{children}</main>
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
    <PlayerProvider>
      <InnerShell>{children}</InnerShell>
    </PlayerProvider>
  );
};
