'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { usePublicProfile } from '../../../hooks/usePublicProfile';
import { ProfileContent } from '../../../components/Profile/ProfileContent';
import ProfilePage from '../page';
import styles from '../page.module.css';

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user } = useAuth();
  const { data, loading, error, notFound, retry } = usePublicProfile(username);
  if (loading) return <p role="status">Загружаем профиль…</p>;
  if (notFound) return <section className={styles.container}><h1 className={styles.name}>Профиль не найден</h1><Link href="/friends" className={styles.editBtn}>Поиск людей</Link></section>;
  if (!data) return <p role="status">{error}<button className={styles.editBtn} onClick={retry}>Повторить</button></p>;
  if (data.profile.id === user?.id) return <ProfilePage/>;
  return <ProfileContent key={data.profile.id} profile={data.profile} music={data} friendCount={data.friendCount} detailsVisible={data.canViewDetails !== false} loading={false} error={error} retry={retry} isOwner={false}/>;
}
