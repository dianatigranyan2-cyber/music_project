'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';
import { createClient } from '../../../lib/supabase/client';
import { useAuth } from '../../../context/AuthContext';
import { CURRENT_USER } from '../../../data/mockData';

interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at?: string;
}

interface PageProps {
  params: Promise<{ username: string }>;
}

export default function PublicProfilePage({ params }: PageProps) {
  const { username: rawUsername } = use(params);
  const targetUsername = decodeURIComponent(rawUsername);

  const { user: currentUser } = useAuth();
  const [supabase] = useState(() => createClient());
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [friendRequestStatus, setFriendRequestStatus] = useState<
    'none' | 'pending_sent' | 'pending_received' | 'accepted'
  >('none');

  useEffect(() => {
    const fetchPublicProfile = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, bio, avatar_url, created_at')
          .ilike('username', targetUsername)
          .maybeSingle();

        if (error || !data) {
          setNotFound(true);
          setProfile(null);
        } else {
          setProfile(data as ProfileData);
        }
      } catch {
        setNotFound(true);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicProfile();
  }, [supabase, targetUsername]);

  useEffect(() => {
    const checkFriendRequest = async () => {
      if (!currentUser || !profile || currentUser.id === profile.id) {
        setFriendRequestStatus('none');
        return;
      }

      const { data, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${currentUser.id})`
        )
        .maybeSingle();

      if (error) {
        console.error('Friend request check error:', error);
        return;
      }

      if (!data) {
        setFriendRequestStatus('none');
        return;
      }

      if (data.status === 'accepted') {
        setFriendRequestStatus('accepted');
      } else if (
        data.status === 'pending' &&
        data.sender_id === currentUser.id
      ) {
        setFriendRequestStatus('pending_sent');
      } else if (
        data.status === 'pending' &&
        data.receiver_id === currentUser.id
      ) {
        setFriendRequestStatus('pending_received');
      } else {
        setFriendRequestStatus('none');
      }
    };

    checkFriendRequest();
  }, [currentUser, profile, supabase]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.profileHero} style={{ justifyContent: 'center', padding: '40px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Загрузка профиля @{targetUsername}...</span>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className={styles.container}>
        <div className={styles.profileHero} style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 24px' }}>
          <span style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</span>
          <h1 className={styles.name}>Пользователь @{targetUsername} не найден</h1>
          <p className={styles.bio} style={{ marginTop: '8px' }}>
            Пользователь с таким никнеймом не существует или у вас указана неверная ссылка.
          </p>
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
            <Link href="/friends" className={styles.editBtn}>
              👥 Вернуться к поиску
            </Link>
            <Link href="/" className={styles.editBtn} style={{ background: 'transparent' }}>
              🏠 На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const displayName = profile.display_name || profile.username;
  const displayHandle = `@${profile.username}`;
  const avatarUrl = profile.avatar_url || CURRENT_USER.avatarUrl;
  const bioText = profile.bio || 'Пользователь пока не оставил описание профиля.';

  return (
    <div className={styles.container}>
      {/* Profile Header Hero */}
      <div className={styles.profileHero}>
        <div className={styles.avatarWrapper}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt={displayName} className={styles.avatar} />
        </div>
        <div className={styles.profileMeta}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.name}>{displayName}</h1>
              <span className={styles.handle}>{displayHandle}</span>
            </div>
            {isOwnProfile ? (
              <Link href="/settings" className={styles.editBtn}>
                ✏️ Редактировать свой профиль
              </Link>
            ) : null}
          </div>
          <p className={styles.bio}>{bioText}</p>
        </div>
      </div>
    </div>
  );
}
