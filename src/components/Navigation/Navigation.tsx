'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navigation.module.css';
import {useFriendListening} from '../../context/FriendListeningContext';
import { usePlayer } from '../../context/PlayerContext';
import { useMessageNotifications } from '../../context/MessageNotificationsContext';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const {following,friends=[]}=useFriendListening();
  const { mobileChatOpen } = usePlayer();
  const { unreadCount, setSelectedChatId } = useMessageNotifications();
  const messageBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined;

  const navItems = [
    { id: 'home', href: '/', label: 'Главная', icon: '🏠' },
    { id: 'friends', href: '/friends', label: 'Друзья', icon: '👥', badge: friends.length?String(friends.length):undefined },
    { id: 'playlists', href: '/playlists', label: 'Плейлисты', icon: '🎵' },
    { id: 'messages', href: '/messages', label: 'Сообщения', icon: '💬', badge: messageBadge },
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
                onClick={item.id === 'messages' ? () => setSelectedChatId(null) : undefined}
                aria-label={item.id === 'messages' && unreadCount > 0 ? `Сообщения: ${unreadCount} непрочитанных` : undefined}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
                {item.badge && (
                  <span className={`${styles.badge} ${item.id === 'messages' ? styles.messageBadge : ''}`} aria-hidden="true">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={styles.roomWidget}>
          <div className={styles.roomBadge}>ВМЕСТЕ</div>
          <p className={styles.roomTitle}>Музыка друзей</p>
          <p className={styles.roomSub}>{following?'Слушаете вместе с '+following.name:'Узнайте, что слушают ваши друзья'}</p>
          <Link href="/friends" className={styles.joinBtn}>
            Открыть друзей
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
              onClick={item.id === 'messages' ? () => setSelectedChatId(null) : undefined}
              aria-label={item.id === 'messages' && unreadCount > 0 ? `Сообщения: ${unreadCount} непрочитанных` : undefined}
              className={`${styles.mobileNavItem} ${isActive ? styles.mobileActive : ''}`}
            >
              <span className={styles.mobileIcon}>
                {item.icon}
                {item.id === 'messages' && messageBadge && (
                  <span className={styles.mobileMessageBadge} aria-hidden="true">{messageBadge}</span>
                )}
              </span>
              <span className={styles.mobileLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
