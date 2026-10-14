'use client';

import { useEffect } from 'react';
import type { MessageToast } from '../../lib/messageNotifications';
import styles from './MessageToastStack.module.css';

interface StackProps {
  toasts: MessageToast[];
  chatOpen: boolean;
  onDismiss: (id: string) => void;
  onOpen: (toast: MessageToast) => void;
}

function MessageToastCard({ toast, onDismiss, onOpen }: {
  toast: MessageToast;
  onDismiss: StackProps['onDismiss'];
  onOpen: StackProps['onOpen'];
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5_000);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.id]);

  return (
    <div
      className={styles.card}
      role="status"
      aria-atomic="true"
    >
      <button
        type="button"
        className={styles.message}
        onClick={() => onOpen(toast)}
        aria-label={`Открыть диалог с ${toast.senderName}: ${toast.preview}`}
      >
        <span className={styles.avatar}>
          {toast.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={toast.avatarUrl} alt="" />
          ) : Array.from(toast.senderName.trim())[0]?.toLocaleUpperCase('ru-RU') || '?'}
          <span className={styles.messageIcon} aria-hidden="true">💬</span>
        </span>
        <span className={styles.copy}>
          <span className={styles.label}>Новое сообщение</span>
          <strong className={styles.name}>{toast.senderName}</strong>
          <span className={styles.preview}>{toast.preview}</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.close}
        onClick={() => onDismiss(toast.id)}
        aria-label={`Закрыть уведомление от ${toast.senderName}`}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export function MessageToastStack({
  toasts, chatOpen, onDismiss, onOpen,
}: StackProps) {
  return (
    <aside
      className={`${styles.stack} ${chatOpen ? styles.chatOpen : ''}`}
      aria-label="Уведомления о сообщениях"
    >
      {toasts.map((toast) => (
        <MessageToastCard
          key={toast.id} toast={toast}
          onDismiss={onDismiss} onOpen={onOpen}
        />
      ))}
    </aside>
  );
}
