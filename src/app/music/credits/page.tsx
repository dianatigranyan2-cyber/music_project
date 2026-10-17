'use client';

import Link from 'next/link';
import { useMusicLibrary } from '../../../hooks/useMusicLibrary';
import styles from '../../../components/Music/MusicLibrary.module.css';

export default function MusicCreditsPage() {
  const { library, error, retry } = useMusicLibrary();
  return <section className={styles.container}>
    <header className={styles.heading}><h1>Авторы и лицензии</h1><Link href="/#music">К музыке</Link></header>
    <p>Авторы, источники и условия использования музыки из каталога Melo.</p>
    {error ? <div role="status"><p>{error}</p><button className={styles.button} onClick={retry}>Повторить</button></div>
      : !library ? <p role="status">Загружаем сведения…</p>
      : <div className={styles.creditsList}>{library.tracks.map(track => <article key={track.id} id={'track-' + track.id} className={styles.creditsEntry}>
        <h2>{track.title}</h2>
        <Link href={'/music/artists/' + track.artistId}>{track.artist}</Link>
        <p>{track.attribution}</p>
        <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">Источник</a>{' · '}
        <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">{track.licenseCode?.replaceAll('-', ' ') ?? 'Лицензия'}</a>
      </article>)}</div>}
  </section>;
}
