'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navigation.module.css';
import { usePlayer } from '../../context/PlayerContext';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { mobileChatOpen } = usePlayer();

  const navItems = [
    { id: 'home', href: '/', label: 'Главная', icon: '🏠' },
    { id: 'explore', href: '/explore', label: 'Обзор', icon: '🧭' },
    { id: 'friends', href: '/friends', label: 'Друзья', icon: '👥', badge: '3' },
    { id: 'playlists', href: '/playlists', label: 'Плейлисты', icon: '🎵' },
    { id: 'messages', href: '/messages', label: 'Сообщения', icon: '💬', badge: '2' },
    { id: 'profile', href: '/profile', label: 'Профиль', icon: '👤' },
    { id: 'settings', href: '/settings', label: 'Настройки', icon: '⚙️' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.logoContainer}>
          <div className={styles.logoIcon}>
            <span>♪</span>
          </div>
          <span className={styles.logoText}>Melo</span>
        </Link>

        <nav className={styles.navMenu}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {item.badge && <span className={styles.badge}>{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={styles.roomWidget}>
          <div className={styles.roomBadge}>LIVE</div>
          <p className={styles.roomTitle}>Музыкальная комната</p>
          <p className={styles.roomSub}>3 друга уже слушают</p>
          <Link href="/room/1" className={styles.joinBtn}>
            Присоединиться
          </Link>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className={`${styles.mobileNav} ${mobileChatOpen ? styles.mobileNavHidden : ''}`}>
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.mobileNavItem} ${isActive ? styles.mobileActive : ''}`}
            >
              <span className={styles.mobileIcon}>{item.icon}</span>
              <span className={styles.mobileLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
