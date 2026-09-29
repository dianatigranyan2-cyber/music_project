'use client';

import React, { useState } from 'react';
import styles from './Header.module.css';
import { UserProfile } from '../../types';

interface HeaderProps {
  user: UserProfile;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ user, searchQuery, setSearchQuery }) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const toggleMobileSearch = () => {
    setIsMobileSearchOpen(!isMobileSearchOpen);
  };

  const handleCloseSearch = () => {
    setIsMobileSearchOpen(false);
    if (searchQuery) {
      setSearchQuery('');
    }
  };

  return (
    <header className={styles.header}>
      {/* Main Header Row */}
      <div className={styles.topRow}>
        {/* Mobile Logo Branding */}
        <div className={styles.mobileBrand}>
          <span className={styles.mobileLogoIcon}>♪</span>
          <span className={styles.mobileLogoText}>Melo</span>
        </div>

        {/* Desktop Search Bar (Always visible on desktop) */}
        <div className={styles.desktopSearchRow}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Поиск треков, исполнителей и друзей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button className={styles.clearBtn} onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* User & Mobile Toggle Actions */}
        <div className={styles.userSection}>
          {/* Mobile Search Toggle Icon Button */}
          <button
            className={`${styles.iconBtn} ${styles.mobileSearchToggle}`}
            onClick={toggleMobileSearch}
            title="Поиск"
          >
            <span>{isMobileSearchOpen ? '✕' : '🔍'}</span>
          </button>

          {/* Notifications Button */}
          <button 
            className={styles.iconBtn}
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            title="Уведомления"
          >
            <span>🔔</span>
            <span className={styles.unreadDot} />
          </button>

          {/* User Profile */}
          <div className={styles.profileCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatarUrl} alt={user.name} className={styles.avatar} />
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userHandle}>{user.handle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Expandable Search Bar Row */}
      {(isMobileSearchOpen || searchQuery) && (
        <div className={styles.mobileSearchRow}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Поиск треков, исполнителей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
            <button className={styles.clearBtn} onClick={handleCloseSearch} title="Закрыть поиск">
              ✕
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
