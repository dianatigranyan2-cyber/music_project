'use client';

import {BlockUser} from './BlockUser';
import { useState } from 'react';
import Link from 'next/link';
import type { Profile } from '../../context/AuthContext';
import type { ProfileMusicData } from '../../lib/profileMusic';
import type { Track } from '../../types';
import { useMusicLibrary } from '../../hooks/useMusicLibrary';
import { usePlayer } from '../../context/PlayerContext';
import { MusicTracks } from '../Music/MusicLists';
import { PlaylistCover } from '../Music/PlaylistCover';
import styles from '../../app/profile/page.module.css';

export function ProfileContent({ profile, music, friendCount, loading, error, retry, isOwner, visibilityBusy, onVisibilityChange, detailsVisible = true }: {
  profile: Profile; music: ProfileMusicData | null; friendCount: number | null;
  loading: boolean; error: string; retry: () => void; isOwner: boolean;
  visibilityBusy?: boolean; onVisibilityChange?: (playlistId: string, enabled: boolean) => Promise<boolean>;
  detailsVisible?: boolean;
}) {
  const { library, error: libraryError, retry: retryLibrary } = useMusicLibrary();
  const { playTrack, listeningControl } = usePlayer();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byId = new Map(library?.tracks.map(track => [track.id, track]));
  const resolve = (ids: string[]) => ids.map(id => byId.get(id)).filter((track): track is Track => !!track);
  const favorites = resolve(music?.favoriteIds ?? []);
  const genres = [...new Set(favorites.map(track => track.genre).filter((genre): genre is string => !!genre))];
  const playlist = music?.playlists.find(item => item.id === selectedId);
  const playlistTracks = resolve(playlist?.trackIds ?? []);
  const displayName = profile.display_name || profile.username || 'Пользователь';
  const count = (value: number | undefined) => music ? String(value ?? 0) : loading ? '…' : '—';
  const musicLoading = loading || (!library && !libraryError);

  return <div className={styles.container}>
    <div className={styles.profileHero}>
      <div className={styles.avatarWrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={profile.avatar_url || '/default-avatar.png'} alt={displayName} className={styles.avatar} onError={({ currentTarget }) => { if (!currentTarget.src.endsWith('/default-avatar.png')) currentTarget.src = '/default-avatar.png'; }}/>
      </div>
      <div className={styles.profileMeta}>
        <div className={styles.headerTop}><div><h1 className={styles.name}>{displayName}</h1><span className={styles.handle}>{profile.username ? '@' + profile.username : ''}</span></div>{isOwner && <div className={styles.profileActions}><Link href="/settings#profile-details" className={styles.editBtn}>✏️ Редактировать профиль</Link><Link href="/settings" className={styles.editBtn}>⚙️ Настройки</Link></div>}</div>
        {!isOwner && <BlockUser id={profile.id} name={displayName}/>}
        {profile.is_private && <span className={styles.privateBadge}>🔒 Закрытый аккаунт</span>}
        {detailsVisible && <><p className={styles.bio}>{profile.bio || 'Описание профиля пока не добавлено.'}</p>
        <div className={styles.statsRow}>
          <div className={styles.statItem}><span className={styles.statVal}>{friendCount ?? (loading ? '…' : '—')}</span><span className={styles.statLbl}>Друзей</span></div>
          <a href="#profile-playlists" className={styles.statItem}><span className={styles.statVal}>{count(music?.playlists.length)}</span><span className={styles.statLbl}>Плейлистов</span></a>
          <a href="#profile-favorites" className={styles.statItem}><span className={styles.statVal}>{count(music?.favoriteIds.length)}</span><span className={styles.statLbl}>Любимых треков</span></a>
        </div></>}
      </div>
    </div>
    {!detailsVisible ? <section className={styles.lockedProfile}><span aria-hidden="true">🔒</span><h2>Это закрытый аккаунт</h2><p>Описание, статистика и музыка доступны только принятым друзьям.</p></section> : <>
    {error && <p role="status">{error} <button className={styles.editBtn} onClick={retry}>Повторить</button></p>}
    {libraryError && <p role="status">{libraryError} <button className={styles.editBtn} onClick={retryLibrary}>Повторить</button></p>}
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Жанры любимых треков</h2>
      {musicLoading ? <p role="status">Загружаем жанры…</p> : !music || !library ? <p>Жанры сейчас недоступны.</p> : genres.length ? <div className={styles.tagsRow}>{genres.map(genre => <span key={genre} className={styles.genreTag}>{genre}</span>)}</div> : <p className={styles.bio}>Жанры появятся после добавления любимых песен.</p>}
    </section>
    <section className={styles.section} id="profile-playlists">
      <h2 className={styles.sectionTitle}>Плейлисты</h2>
      {musicLoading ? <p role="status">Загружаем плейлисты…</p> : !music || !library ? <p>Плейлисты сейчас недоступны.</p> : !music.playlists.length ? <p className={styles.bio}>{isOwner ? 'Вы пока не создали плейлисты.' : 'Нет открытых плейлистов.'}</p> : <>
        <div className={styles.playlistCards}>{music.playlists.map(item => <article key={item.id} className={styles.playlistCard}>
          <button className={styles.playlistOpen} aria-label={'Открыть плейлист: ' + item.title} aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
          <PlaylistCover tracks={resolve(item.trackIds)} src={item.coverUrl} title={item.title}/>
          <strong>{item.title}</strong>{item.description && <span>{item.description}</span>}<span>Треков: {item.trackIds.length}</span>
          </button>
          {isOwner && <label className={styles.visibilityControl}><input type="checkbox" checked={!!item.showOnProfile} disabled={visibilityBusy} aria-label={'Показывать в профиле: ' + item.title} onChange={event => { void onVisibilityChange?.(item.id, event.currentTarget.checked); }}/>Показывать в профиле</label>}
        </article>)}</div>
        {playlist && <div className={styles.playlistDetail}><div className={styles.playlistHeading}><h3>{playlist.title}</h3><button className={styles.editBtn} aria-label="Закрыть список песен плейлиста" onClick={() => setSelectedId(null)}>✕</button>
          <button className={styles.editBtn} disabled={!playlistTracks.length || !!listeningControl} onClick={() => playTrack(playlistTracks[0], playlistTracks)}>▶ Слушать плейлист</button></div>
          {playlistTracks.length ? <MusicTracks tracks={playlistTracks}/> : <p>В плейлисте пока нет доступных песен.</p>}
        </div>}
      </>}
      {isOwner && <Link href="/playlists" className={styles.editBtn}>Управлять плейлистами</Link>}
    </section>
    <section className={styles.section} id="profile-favorites">
      <h2 className={styles.sectionTitle}>Любимые песни</h2>
      {musicLoading ? <p role="status">Загружаем любимые песни…</p> : !music || !library ? <p>Любимые песни сейчас недоступны.</p> : favorites.length ? <MusicTracks tracks={favorites}/> : <p className={styles.bio}>{music.favoriteIds.length ? 'Любимые песни сейчас недоступны в каталоге.' : 'Любимых песен пока нет.'}</p>}
    </section>
    </>}
  </div>;
}
