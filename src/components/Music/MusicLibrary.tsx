'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePlayer } from '../../context/PlayerContext';
import { useMusicLibrary } from '../../hooks/useMusicLibrary';
import { filterMusic } from '../../lib/musicLibrary';
import { MusicTracks } from './MusicLists';
import styles from './MusicLibrary.module.css';

export function MusicLibrary({ artistId, albumId, compact = false }: { artistId?: string; albumId?: string; compact?: boolean }) {
  const { library, error, retry } = useMusicLibrary();
  const { searchQuery, setSearchQuery, playTrack } = usePlayer();
  const [genre, setGenre] = useState('');
  if (error) return <section className={styles.container}><h2>Музыка Melo</h2><p role="status">{error}</p><button className={styles.button} onClick={retry}>Повторить</button></section>;
  if (!library) return <p className={styles.container} role="status">Загружаем библиотеку…</p>;
  const artist = library.artists.find(item => item.id === artistId);
  const album = library.albums.find(item => item.id === albumId);
  if ((artistId && !artist) || (albumId && !album)) return <section className={styles.container}><h1>Музыка не найдена</h1><Link href="/explore">Открыть библиотеку</Link></section>;
  const collection = library.tracks.filter(track => (!artistId || track.artistId === artistId) && (!albumId || track.albumId === albumId));
  if (albumId) collection.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
  else collection.sort((a, b) => a.title.localeCompare(b.title));
  const tracks = filterMusic(collection, searchQuery, genre);
  const title = album?.title ?? artist?.name ?? (compact ? 'Музыка на Melo' : 'Обзор музыки');
  const queryWords = searchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matchesName = (name: string) => queryWords.every(word => name.toLocaleLowerCase().includes(word));
  const visibleArtists = library.artists.filter(a => tracks.some(t => t.artistId === a.id) && matchesName(a.name));
  const visibleAlbums = library.albums.filter(a => tracks.some(t => t.albumId === a.id) && matchesName(a.title));
  return <section className={styles.container}>
    <header className={styles.heading}><div>{compact ? <h2>{title}</h2> : <h1>{title}</h1>}
      <p>{album ? `${library.artists.find(a => a.id === album.artistId)?.name} · ${album.year}` : artist ? 'Все песни исполнителя в библиотеке Melo' : 'Независимая музыка — слушайте прямо здесь'}</p></div>
      {compact ? <Link className={styles.button} href="/explore">Вся музыка →</Link> : <Link href="/explore">Библиотека</Link>}
    </header>
    {!compact && !albumId && <div className={styles.genres} aria-label="Жанры">
      {['', ...new Set(collection.map(t => t.genre).filter(Boolean))].map(g => <button key={g} aria-pressed={genre === g} className={genre === g ? styles.selected : ''} onClick={() => setGenre(g ?? '')}>{g || 'Все жанры'}</button>)}
    </div>}
    {!compact && !artistId && !albumId && visibleArtists.length > 0 && <section><h2>Исполнители</h2><div className={styles.cards}>
      {visibleArtists.map(a => <Link className={styles.card} key={a.id} href={'/music/artists/' + a.id} onClick={() => setSearchQuery('')}><span className={styles.artistIcon}>♪</span><strong>{a.name}</strong><span>{library.tracks.filter(t => t.artistId === a.id).length} треков</span></Link>)}
    </div></section>}
    {!compact && !albumId && visibleAlbums.length > 0 && <section><h2>Альбомы</h2><div className={styles.cards}>
      {visibleAlbums.map(a => <Link className={styles.card} key={a.id} href={'/music/albums/' + a.id} onClick={() => setSearchQuery('')}><strong>{a.title}</strong><span>{library.artists.find(ar => ar.id === a.artistId)?.name} · {a.year}</span></Link>)}
    </div></section>}
    <div className={styles.heading}><h2>{searchQuery.trim() ? `Результаты: ${searchQuery}` : 'Треки'} <span className={styles.count}>{tracks.length}</span></h2>
      {tracks.length > 0 && <button className={styles.button} onClick={() => playTrack(tracks[0], tracks)}>▶ Слушать всё</button>}
    </div>
    {tracks.length ? <MusicTracks tracks={compact ? tracks.slice(0, 6) : tracks} /> : <p role="status">{library.tracks.length ? 'Ничего не найдено. Попробуйте другое название или исполнителя.' : 'В библиотеке пока нет опубликованных треков.'}</p>}
    <p className={styles.footer}>Музыка доступна по свободным лицензиям. Авторы, источники и условия указаны у каждого трека.</p>
  </section>;
}
