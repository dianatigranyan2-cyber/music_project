'use client';
import { usePlayer } from '../../context/PlayerContext';
import { MusicImage } from './MusicLists';
import styles from './MusicLibrary.module.css';
export function MusicQueue({ onClose }: { onClose: () => void }) {
  const { listeningControl, queue, currentTrack, isPlaying, playQueuedTrack, togglePlayback, removeQueuedTrack } = usePlayer();
  return <aside className={styles.queuePanel} aria-label="Очередь воспроизведения" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <div className={styles.heading}><h2>Очередь воспроизведения</h2><button className={styles.queueButton} aria-label="Закрыть очередь" onClick={onClose}>✕</button></div>
    {queue.length ? queue.map(track => <div className={styles.row} key={track.id}>
      <button className={styles.trackButton} aria-label={`В очереди: ${track.title}`} aria-pressed={currentTrack.id === track.id && isPlaying} disabled={!!listeningControl&&currentTrack.id!==track.id}
        onClick={() => currentTrack.id === track.id ? togglePlayback() : playQueuedTrack(track.id)}><MusicImage src={track.coverUrl} /><span className={styles.title}>{track.title}<br /><small>{track.artist}</small></span></button>
      {track.id !== currentTrack.id && <button className={styles.queueButton} aria-label={`Убрать из очереди: ${track.title}`} disabled={!!listeningControl} onClick={() => removeQueuedTrack(track.id)}>✕</button>}
    </div>) : <p>Выберите песню.</p>}
  </aside>;
}
