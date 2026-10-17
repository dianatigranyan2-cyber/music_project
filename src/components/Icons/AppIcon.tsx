import type { CSSProperties } from 'react';
import styles from './AppIcon.module.css';

const icons = {
  home: 'home',
  friends: 'friends',
  profile: 'profile',
  music: 'music',
  messages: 'messages',
  notifications: 'notifications',
  search: 'search',
  shuffle: 'shuffle',
  repeat: 'repeat',
  volume: 'volume',
  heart: 'heart',
  'heart-filled': 'heart-filled',
} as const;

export type AppIconName = keyof typeof icons;

export function AppIcon({ name, size = 20, muted = false }: {
  name: AppIconName;
  size?: number | `${number}em`;
  muted?: boolean;
}) {
  const style = {
    '--icon-image': `url("/icons/${icons[name]}.png")`,
    width: size,
    height: size,
  } as CSSProperties;

  return <i aria-hidden="true" data-icon={name}
    className={`${styles.icon} ${name === 'heart-filled' ? styles.liked : ''} ${muted ? styles.muted : ''}`}
    style={style}><i className={styles.shape}/></i>;
}
