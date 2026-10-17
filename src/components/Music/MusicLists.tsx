'use client';
import Link from 'next/link';
import type { Track } from '../../types';
import { usePlayer } from '../../context/PlayerContext';
import styles from './MusicLibrary.module.css';
import {FavoriteButton,PlaylistButton} from './TrackActions';

export function MusicImage({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.cover} src={src} alt="" onError={({ currentTarget }) => { if (!currentTarget.src.endsWith('/music-placeholder.svg')) currentTarget.src = '/music-placeholder.svg'; }} />;
}
export function MusicTracks({ tracks, playbackCollection=tracks }: { tracks: Track[]; playbackCollection?:Track[] }) {
  const { listeningControl, playTrack, currentTrack, isPlaying, togglePlayback, setSearchQuery } = usePlayer();
  return <div className={styles.list}>
    {tracks.map(track => <article className={`${styles.row} ${currentTrack.id === track.id ? styles.active : ''}`} key={track.id}>
      <button className={styles.trackButton} aria-label={`Слушать: ${track.title}`} aria-pressed={currentTrack.id === track.id && isPlaying} disabled={!!listeningControl&&currentTrack.id!==track.id}
        onClick={() => currentTrack.id === track.id ? togglePlayback() : playTrack(track, playbackCollection)}>
        <MusicImage src={track.coverUrl} /><span className={styles.title}>{track.title}</span><span aria-hidden="true">{currentTrack.id === track.id && isPlaying ? '⏸' : '▶'}</span>
      </button>
      <div className={styles.trackDetails}>
        <Link href={'/music/artists/' + track.artistId} onClick={() => setSearchQuery('')}>{track.artist}</Link>
        {track.albumId && <Link href={'/music/albums/' + track.albumId} onClick={() => setSearchQuery('')}>{track.album}</Link>}
      </div>
      <span className={styles.duration}>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}</span>
      <div className={styles.trackActions}><PlaylistButton track={track}/><FavoriteButton track={track}/></div>
    </article>)}
  </div>;
}
