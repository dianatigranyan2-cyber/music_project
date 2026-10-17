'use client';

import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { usePersonalMusic } from '../../context/PersonalMusicContext';
import { useProfileFriendCount } from '../../hooks/useProfileFriendCount';
import { ProfileContent } from '../../components/Profile/ProfileContent';
import styles from './page.module.css';

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { data, loading, error, refresh, busy, mutate } = usePersonalMusic();
  const { result: friendCount, retry: retryFriends } = useProfileFriendCount(user?.id);
  if (authLoading) return <p role="status">Загружаем профиль…</p>;
  if (!user) return <section className={styles.container}><h1 className={styles.name}>Ваш профиль</h1><p>Войдите, чтобы увидеть свой профиль и музыку.</p><Link href="/login" className={styles.editBtn}>Войти</Link></section>;
  const ownProfile = profile?.id === user.id ? profile : { id: user.id, username: user.user_metadata?.username || '', display_name: 'Пользователь' };
  const music = data?.userId === user.id ? data : null;
  return <ProfileContent key={user.id} profile={ownProfile} music={music} friendCount={friendCount?.count ?? null} loading={loading || !friendCount}
    error={[error, friendCount?.error].filter(Boolean).join(' ')} retry={() => { refresh(); retryFriends(); }} isOwner visibilityBusy={busy} onVisibilityChange={(playlistId, enabled) => mutate({action:'profile-visibility',playlistId,enabled})}/>;
}
