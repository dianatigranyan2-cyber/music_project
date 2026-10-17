'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useMusicLibrary} from '../../hooks/useMusicLibrary';
import {usePlayer} from '../../context/PlayerContext';
import type {PersonalPlaylist} from '../../lib/personalMusic';
import type {Track} from '../../types';
import {MusicTracks} from './MusicLists';
import {PlaylistCover} from './PlaylistCover';
import styles from './MusicLibrary.module.css';
export function SharedPlaylist({token}:{token:string}){
  const {library,error:catalogError,retry}=useMusicLibrary();const {playTrack}=usePlayer();
  const [playlist,setPlaylist]=useState<PersonalPlaylist|null>(null);const [error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();void fetch('/api/music/shared/'+encodeURIComponent(token),{signal:controller.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);if(!controller.signal.aborted)setPlaylist(data);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Не удалось открыть подборку.');});return ()=>controller.abort();},[token]);
  const byId=new Map(library?.tracks.map(t=>[t.id,t]));const tracks=(playlist?.trackIds??[]).map(id=>byId.get(id)).filter((t):t is Track=>!!t);
  return <section className={styles.container}>
    {error?<><h1>Подборка недоступна</h1><p role="status">{error}</p></>:playlist?<><header className={styles.heading}><div className={styles.sharedCover}><PlaylistCover title={playlist.title} tracks={tracks} src={playlist.coverUrl}/></div><div><h1>{playlist.title}</h1><p>{playlist.description}</p><p>Подборка по ссылке · Треков: {tracks.length}</p><button className={styles.button} disabled={!tracks.length} onClick={()=>playTrack(tracks[0],tracks)}>▶ Слушать</button></div></header>{catalogError?<p role="alert">{catalogError} <button onClick={retry}>Повторить</button></p>:!library?<p>Загрузка песен…</p>:<MusicTracks tracks={tracks}/>}</>:<p>Загружаем подборку…</p>}
    <p><Link href="/#music">Открыть каталог Melo</Link></p>
  </section>;
}
