'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './Header.module.css';
import { UserProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  fallbackUser: UserProfile;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ fallbackUser, searchQuery, setSearchQuery }) => {
  const { user, profile, signOut, loading } = useAuth();
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

  const displayName = profile?.display_name || profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || fallbackUser.name;
  const displayHandle = profile?.username ? `@${profile.username}` : user?.email ? user.email : fallbackUser.handle;
  const avatarUrl = profile?.avatar_url || fallbackUser.avatarUrl;

  return (
    <header className={styles.header}>
      {/* Main Header Row */}
      <div className={styles.topRow}>
        {/* Mobile Logo Branding */}
        <div className={styles.mobileBrand}>
          <span className={styles.mobileLogoIcon}>♪</span>
          <span className={styles.mobileLogoText}>Melo</span>
        </div>

        {/* Desktop Search Bar */}
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

          {/* User Auth Section */}
          {!loading && user ? (
            <div className={styles.authProfileWrapper}>
              <Link href="/profile" className={styles.profileCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUrl} alt={displayName} className={styles.avatar} />
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{displayName}</span>
                  <span className={styles.userHandle}>{displayHandle}</span>
                </div>
              </Link>
              <button className={styles.logoutBtn} onClick={() => signOut()} title="Выйти из аккаунта">
                Выйти
              </button>
            </div>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/login" className={styles.loginBtn}>
                Войти
              </Link>
              <Link href="/register" className={styles.registerBtn}>
                Регистрация
              </Link>
            </div>
          )}
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
