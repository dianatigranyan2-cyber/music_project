'use client';

import {useState} from 'react';
import styles from './Avatar.module.css';

const placeholder = '/icons/profile.png';

export function Avatar({src, alt, className}: {src?: string | null; alt: string; className?: string}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const photo = src?.trim();
  const fallback = !photo || photo === '/default-avatar.png' || photo === placeholder || failedSrc === photo;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fallback ? placeholder : photo} alt={alt}
    className={`${styles.image} ${className || styles.fill} ${fallback ? styles.fallback : ''}`}
    onError={() => { if (!fallback) setFailedSrc(photo ?? null); }}/>;
}
