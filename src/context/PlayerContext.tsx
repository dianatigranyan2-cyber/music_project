'use client';

import React, { createContext, useContext, useState } from 'react';
import { Track } from '../types';
import { INITIAL_TRACK, DEMO_TRACKS } from '../data/mockData';

interface PlayerContextType {
  currentTrack: Track;
  playTrack: (track: Track) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleNextTrack: () => void;
  handlePrevTrack: () => void;
  /** True when a full-screen mobile chat is open — hides player + bottom nav */
  mobileChatOpen: boolean;
  setMobileChatOpen: (open: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track>(INITIAL_TRACK);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
  };

  const handleNextTrack = () => {
    const currentIndex = DEMO_TRACKS.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % DEMO_TRACKS.length;
    setCurrentTrack(DEMO_TRACKS[nextIndex]);
  };

  const handlePrevTrack = () => {
    const currentIndex = DEMO_TRACKS.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + DEMO_TRACKS.length) % DEMO_TRACKS.length;
    setCurrentTrack(DEMO_TRACKS[prevIndex]);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        playTrack,
        searchQuery,
        setSearchQuery,
        handleNextTrack,
        handlePrevTrack,
        mobileChatOpen,
        setMobileChatOpen,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
