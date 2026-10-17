'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePersonalMusic} from '../../context/PersonalMusicContext';
import type {Track} from '../../types';
import styles from './MusicLibrary.module.css';

export function FavoriteButton({track}:{track:Track}) {
  const {data,loading,busy,signedIn,mutate,error}=usePersonalMusic();
  const [notice,setNotice]=useState(false);
  const liked=!!data?.favoriteIds.includes(track.id);
  return <span className={styles.favoriteControl}>
    <button className={styles.actionButton} aria-label={`${liked?'Убрать из любимых':'В любимые'}: ${track.title}`} aria-pressed={liked}
      disabled={!track.source||loading||busy} title={liked?'Убрать из любимых':'В любимые'}
      onClick={async()=>{if(!signedIn){setNotice(!notice);return;}setNotice(!await mutate({action:'favorite',trackId:track.id,liked:!liked}));}}>{liked?'❤️':'♡'}</button>
    {notice&&<span role="status" className={styles.actionNotice}>{signedIn?error||'Не удалось сохранить. Попробуйте ещё раз.':<Link href="/login">Войдите, чтобы сохранять музыку</Link>}</span>}
  </span>;
}

export function PlaylistButton({track,label,icon,placement='above',onNavigate}:{track:Track;label?:string;icon?:string;placement?:'above'|'inline'|'below';onNavigate?:()=>void}) {
  const {data,loading,busy,signedIn,mutate,error}=usePersonalMusic();
  const [open,setOpen]=useState(false);
  return <span className={`${styles.playlistControl} ${placement==='inline'?styles.playlistControlInline:''}`}>
    <button className={label?styles.playlistLabelButton:styles.actionButton} disabled={!track.source||loading||busy} aria-expanded={open} aria-label={label?`${label}: ${track.title}`:`В плейлист: ${track.title}`} title="Добавить в плейлист" onClick={()=>setOpen(!open)}>{label||icon||'♫＋'}</button>
    {open&&<span className={`${styles.playlistMenu} ${placement==='inline'?styles.playlistMenuInline:placement==='below'?styles.playlistMenuBelow:''}`}>
      <button className={styles.actionButton} onClick={()=>setOpen(false)} aria-label="Закрыть выбор плейлиста">✕</button>
      {!signedIn?<Link href="/login" onClick={onNavigate}>Войдите, чтобы создать плейлист</Link>:<>
        <strong>Добавить в плейлист</strong>
        {data?.playlists.map(p=><button key={p.id} className={styles.button} disabled={busy||p.trackIds.includes(track.id)} onClick={async()=>{if(await mutate({action:'add',playlistId:p.id,trackId:track.id}))setOpen(false);}}>{p.title}{p.trackIds.includes(track.id)?' ✓':''}</button>)}
        <Link href="/playlists" onClick={onNavigate}>Создать плейлист</Link>
        {error&&<span role="alert">{error}</span>}
      </>}
    </span>}
  </span>;
}
