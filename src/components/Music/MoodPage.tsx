'use client';
import { AppIcon } from '../Icons/AppIcon';
import Link from 'next/link';
import {useMusicLibrary} from '../../hooks/useMusicLibrary';
import {usePlayer} from '../../context/PlayerContext';
import {MUSIC_MOODS,moodTracks} from '../../lib/musicFeatures';
import {MusicTracks} from './MusicLists';
import styles from './MusicLibrary.module.css';
export function MoodPage({id}:{id:string}){
  const {library,error,retry}=useMusicLibrary();const {playTrack}=usePlayer();const mood=MUSIC_MOODS.find(m=>m.id===id);
  if(!mood)return <section><h1>Подборка не найдена</h1><Link href="/#music">Обзор музыки</Link></section>;
  const tracks=moodTracks(id,library?.tracks??[]);
  return <section className={styles.container}><header className={styles.heading}><div><h1>{mood.title}</h1><p>{mood.description}</p></div><Link href="/#music">Все подборки</Link></header>
    {error?<p role="alert">{error} <button onClick={retry}>Повторить</button></p>:!library?<p>Загрузка…</p>:<><p>Треков: {tracks.length}</p><button className={styles.button} disabled={!tracks.length} onClick={()=>playTrack(tracks[0],tracks)}><AppIcon name="play" size={18}/> Слушать подборку</button><MusicTracks tracks={tracks}/></>}
  </section>;
}
