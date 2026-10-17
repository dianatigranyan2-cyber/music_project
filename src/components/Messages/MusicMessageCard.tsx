'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useMusicLibrary} from '../../hooks/useMusicLibrary';
import {usePlayer} from '../../context/PlayerContext';
import {parseMusicMessage,type MusicMessage} from '../../lib/musicMessages';
import type {PersonalPlaylist} from '../../lib/personalMusic';
import type {Track} from '../../types';
import styles from './MusicMessageCard.module.css';
export function MusicMessageCard({content}:{content:string}){
  const item=parseMusicMessage(content);if(!item)return null;
  return item.kind==='track'?<TrackMessage id={item.id}/>:<PlaylistMessage key={item.id} item={item}/>;
}
function TrackMessage({id}:{id:string}){
  const {library,error,retry}=useMusicLibrary();const {playTrack,listeningControl}=usePlayer();const track=library?.tracks.find(track=>track.id===id);
  if(!track)return <div className={styles.card}>{error?<button className={styles.button} onClick={retry}>Загрузить трек</button>:library?'Трек больше недоступен.':'Загружаем трек…'}</div>;
  return <div className={styles.card}><Cover src={track.coverUrl}/><div className={styles.detail}><strong>{track.title}</strong><small>{track.artist}</small></div><button className={styles.play} aria-label={'Слушать: '+track.title} disabled={!!listeningControl} title={listeningControl?'Сначала отключитесь от совместного прослушивания':'Слушать'} onClick={()=>playTrack(track,[track])}>▶</button></div>;
}
function Cover({src}:{src:string}){
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.cover} src={src} alt="" onError={({currentTarget})=>{if(!currentTarget.src.endsWith('/music-placeholder.svg'))currentTarget.src='/music-placeholder.svg';}}/>;
}
function PlaylistMessage({item}:{item:MusicMessage}){
  const {library,error:catalogError,retry:retryLibrary}=useMusicLibrary();const {playTrack,listeningControl}=usePlayer();
  const [playlist,setPlaylist]=useState<PersonalPlaylist|null>(null);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
  useEffect(()=>{const controller=new AbortController();async function load(){try{const response=await fetch('/api/music/shared/'+encodeURIComponent(item.id),{signal:controller.signal,cache:'no-store'});const value=await response.json();if(!response.ok)throw new Error(value.error);setPlaylist(value);setError('');}catch(error){if(!controller.signal.aborted){setPlaylist(null);setError(error instanceof Error?error.message:'Подборка недоступна.');}}}void load();const interval=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);window.addEventListener('focus',load);return()=>{controller.abort();clearInterval(interval);window.removeEventListener('focus',load);};},[item.id,attempt]);
  const tracks=playlist?.trackIds.map(id=>library?.tracks.find(track=>track.id===id)).filter((track):track is Track=>!!track)??[];
  async function play(){
    // Recheck sharing on every play: an owner may have revoked the token since rendering.
    try{const response=await fetch('/api/music/shared/'+encodeURIComponent(item.id),{cache:'no-store'});const value=await response.json();if(!response.ok)throw new Error(value.error);const current=(value.trackIds as string[]).map(id=>library?.tracks.find(track=>track.id===id)).filter((track):track is Track=>!!track);if(current.length)playTrack(current[0],current);setPlaylist(value);}catch(error){setPlaylist(null);setError(error instanceof Error?error.message:'Подборка недоступна.');}
  }
  return <div className={styles.card}>{playlist?<><Cover src={playlist.coverUrl||tracks[0]?.coverUrl||'/music-placeholder.svg'}/><div className={styles.detail}><Link href={'/music/playlists/'+item.id}><strong>{playlist.title}</strong></Link><small>Плейлист · {tracks.length} треков</small>{catalogError&&<button onClick={retryLibrary}>Загрузить песни</button>}</div><button className={styles.play} disabled={!tracks.length||!!listeningControl} aria-label={'Слушать плейлист: '+playlist.title} onClick={()=>void play()}>▶</button></>:<div className={styles.detail}><span>{error||'Загружаем подборку…'}</span>{error&&<button className={styles.button} onClick={()=>setAttempt(n=>n+1)}>Повторить</button>}</div>}</div>;
}
