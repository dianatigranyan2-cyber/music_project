'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';
import { useAuth } from '../../context/AuthContext';
import { NotificationsBell } from '../Notifications/NotificationsBell';
import {MusicSearch} from '../Music/MusicSearch';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ searchQuery, setSearchQuery }) => {
  const pathname = usePathname();
  const showSearch = !['/playlists', '/music/playlists', '/messages', '/profile'].some(path => pathname === path || pathname.startsWith(path + '/'));
  const { user, profile, loading } = useAuth();
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

  const ownProfile = profile?.id === user?.id ? profile : null;
  const displayName = ownProfile?.display_name || ownProfile?.username || user?.user_metadata?.username || 'Пользователь';
  const displayHandle = ownProfile?.username ? `@${ownProfile.username}` : '';
  const avatarUrl = ownProfile?.avatar_url || '/default-avatar.png';

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
        {showSearch && <div className={styles.desktopSearchRow}>
          <MusicSearch/>
        </div>}

        {/* User & Mobile Toggle Actions */}
        <div className={styles.userSection}>
          {/* Mobile Search Toggle Icon Button */}
          {showSearch && <button
            className={`${styles.iconBtn} ${styles.mobileSearchToggle}`}
            onClick={toggleMobileSearch}
            title="Поиск"
            aria-label="Поиск"
          >
            <span>{isMobileSearchOpen ? '✕' : '🔍'}</span>
          </button>}

          <NotificationsBell />

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
      {showSearch && (isMobileSearchOpen || searchQuery) && (
        <div className={styles.mobileSearchRow}>
          <MusicSearch mobile onClose={handleCloseSearch}/>
        </div>
      )}
    </header>
  );
};
