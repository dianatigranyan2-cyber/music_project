'use client';
import Link from 'next/link';
import type { Track } from '../../types';
import { usePlayer } from '../../context/PlayerContext';
import styles from './MusicLibrary.module.css';

export function MusicImage({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.cover} src={src} alt="" onError={({ currentTarget }) => { if (!currentTarget.src.endsWith('/music-placeholder.svg')) currentTarget.src = '/music-placeholder.svg'; }} />;
}
export function MusicTracks({ tracks }: { tracks: Track[] }) {
  const { playTrack, currentTrack, isPlaying, togglePlayback, addToQueue, setSearchQuery } = usePlayer();
  return <div className={styles.list}>
    {tracks.map(track => <article className={`${styles.row} ${currentTrack.id === track.id ? styles.active : ''}`} key={track.id}>
      <button className={styles.trackButton} aria-label={`Слушать: ${track.title}`} aria-pressed={currentTrack.id === track.id && isPlaying}
        onClick={() => currentTrack.id === track.id ? togglePlayback() : playTrack(track, tracks)}>
        <MusicImage src={track.coverUrl} /><span className={styles.title}>{track.title}</span><span aria-hidden="true">{currentTrack.id === track.id && isPlaying ? '⏸' : '▶'}</span>
      </button>
      <div className={styles.trackDetails}>
        <Link href={'/music/artists/' + track.artistId} onClick={() => setSearchQuery('')}>{track.artist}</Link>
        {track.albumId && <Link href={'/music/albums/' + track.albumId} onClick={() => setSearchQuery('')}>{track.album}</Link>}
      </div>
      <span className={styles.duration}>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}</span>
      <button className={styles.queueButton} aria-label={`В очередь: ${track.title}`} title="Добавить в очередь" onClick={() => addToQueue(track)}>＋</button>
      <details className={styles.credits}><summary>Автор и лицензия</summary><p>{track.attribution}</p>
        <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">Источник</a>{' · '}<a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">{track.licenseCode?.replaceAll('-', ' ') ?? 'Лицензия'}</a>
      </details>
    </article>)}
  </div>;
}
