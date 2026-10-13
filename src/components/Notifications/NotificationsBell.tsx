'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { usePlayer } from '../../context/PlayerContext';
import { useNotifications } from '../../hooks/useNotifications';
import {
  formatNotificationTime, notificationActorName, presentNotification,
} from '../../lib/notifications';
import styles from './NotificationsBell.module.css';

function NotificationsInbox({ userId }: { userId: string | null }) {
  const { setSearchQuery } = usePlayer();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const {
    notifications, unreadCount, loading, loadingMore, error,
    hasMore, markAsRead, markAllAsRead, loadMore,
  } = useNotifications(userId);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', handleFocusOut);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('focusin', handleFocusOut);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        className={`${styles.bell} ${open ? styles.bellOpen : ''}`}
        onClick={() => {
          if (!open) void markAllAsRead();
          setOpen(!open);
        }}
        title="Уведомления"
        aria-label={unreadCount ? `Уведомления: ${unreadCount} непрочитанных` : 'Уведомления'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section id={panelId} className={styles.panel} aria-label="Уведомления">
          <div className={styles.heading}>
            <h2>Уведомления</h2>
          </div>

          {!userId ? (
            <div className={styles.empty}>
              <p>Войдите, чтобы получать уведомления.</p>
              <Link href="/login" onClick={() => setOpen(false)}>Войти</Link>
            </div>
          ) : (
            <>
              {error && (
                <div className={styles.error} role="alert">
                  <p>{error}</p>
                  <button className={styles.textButton} onClick={() => void markAllAsRead()}>
                    Повторить
                  </button>
                </div>
              )}
              {loading ? (
                <p className={styles.empty} role="status">Загрузка уведомлений…</p>
              ) : !error && notifications.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon} aria-hidden="true">🔔</span>
                  <p>Пока нет уведомлений</p>
                  <small>Здесь появятся лайки историй и новости о друзьях.</small>
                </div>
              ) : (
                <ul className={styles.list}>
                  {notifications.map((notification) => {
                    const { icon, text, href } = presentNotification(notification);
                    const unread = !notification.read_at;
                    const content = (
                      <>
                        <span className={styles.avatar}>
                          {notification.actor?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={notification.actor.avatar_url} alt="" />
                          ) : <span aria-hidden="true">{icon}</span>}
                        </span>
                        <span className={styles.copy}>
                          <span><strong>{notificationActorName(notification)}</strong> {text}</span>
                          <time dateTime={notification.created_at}>
                            {icon} · {formatNotificationTime(notification.created_at)}
                          </time>
                        </span>
                        {unread && <span className={styles.unreadDot} aria-label="Не прочитано" />}
                      </>
                    );
                    const itemClass = `${styles.item} ${unread ? styles.unread : ''}`;
                    return (
                      <li key={notification.id}>
                        {href ? (
                          <Link href={href} className={itemClass} onClick={() => {
                            if (unread) void markAsRead(notification.id);
                            // A previous global search must not hide the request/friend we open.
                            if (href.startsWith('/friends')) setSearchQuery('');
                            setOpen(false);
                          }}>
                            {content}
                          </Link>
                        ) : (
                          <button className={itemClass} onClick={() => {
                            if (unread) void markAsRead(notification.id);
                          }}>
                            {content}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasMore && (
                <button className={styles.moreButton} disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? 'Загрузка…' : 'Показать ещё'}
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

export function NotificationsBell() {
  const { user } = useAuth();
  // A new account gets a new inbox immediately, including during sign-out.
  return <NotificationsInbox key={user?.id ?? 'guest'} userId={user?.id ?? null} />;
}
