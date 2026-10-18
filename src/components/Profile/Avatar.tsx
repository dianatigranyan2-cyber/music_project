'use client';

import {useState} from 'react';
import Link from 'next/link';
import styles from './Avatar.module.css';

const placeholder = '/icons/profile.png';

export function Avatar({src, alt, className, username, ownProfile, onProfileOpen}: {
  src?: string | null;
  alt: string;
  className?: string;
  username?: string | null;
  ownProfile?: boolean;
  onProfileOpen?: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const photo = src?.trim();
  const fallback = !photo || photo === '/default-avatar.png' || photo === placeholder || failedSrc === photo;

  const href = ownProfile ? '/profile' : username?.trim() ? `/profile/${encodeURIComponent(username.trim())}` : null;
  // eslint-disable-next-line @next/next/no-img-element
  const image = <img src={fallback ? placeholder : photo} alt={alt}
    className={`${styles.image} ${href ? styles.fill : className || styles.fill} ${fallback ? styles.fallback : ''}`}
    onError={() => { if (!fallback) setFailedSrc(photo ?? null); }}/>;
  if (!href) return image;
  return <Link href={href} className={`${styles.profileLink} ${className || styles.fill}`}
    aria-label={alt ? `Открыть профиль: ${alt}` : 'Открыть профиль'}
    onClick={event => { event.stopPropagation(); onProfileOpen?.(); }}>
    {image}
  </Link>;
}
