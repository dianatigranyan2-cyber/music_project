'use client';
import Link from 'next/link';
import {AppIcon} from '../Icons/AppIcon';
import {useEffect,useId,useRef,useState} from 'react';
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
      onClick={async()=>{if(!signedIn){setNotice(!notice);return;}setNotice(!await mutate({action:'favorite',trackId:track.id,liked:!liked}));}}><AppIcon name={liked?'heart-filled':'heart'}/></button>
    {notice&&<span role="status" className={styles.actionNotice}>{signedIn?error||'Не удалось сохранить. Попробуйте ещё раз.':<Link href="/login">Войдите, чтобы сохранять музыку</Link>}</span>}
  </span>;
}

export function PlaylistButton({track,label,icon,placement='above',onNavigate}:{track:Track;label?:string;icon?:string;placement?:'above'|'inline'|'below';onNavigate?:()=>void}) {
  const {data,loading,busy,signedIn,mutate,error}=usePersonalMusic();
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLSpanElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const menuId=useId();
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent|FocusEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('focusin',outside);
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',key);};
  },[open]);
  return <span ref={root} className={`${styles.playlistControl} ${placement==='inline'?styles.playlistControlInline:''}`}>
    <button ref={trigger} className={label?styles.playlistLabelButton:styles.actionButton} disabled={!track.source||loading||busy} aria-expanded={open} aria-controls={open?menuId:undefined} aria-label={label?`${label}: ${track.title}`:`В плейлист: ${track.title}`} title="Добавить в плейлист" onClick={()=>setOpen(!open)}>{label||icon||'＋'}</button>
    {open&&<span id={menuId} role="group" aria-label="Выбор плейлистов" className={`${styles.playlistMenu} ${placement==='inline'?styles.playlistMenuInline:placement==='below'?styles.playlistMenuBelow:''}`}>
      {!signedIn?<Link href="/login" onClick={onNavigate}>Войдите, чтобы создать плейлист</Link>:<>
        <strong>Добавить в плейлист</strong>
        {data?.playlists.map(p=>{const included=p.trackIds.includes(track.id);return <button key={p.id} className={styles.button} aria-pressed={included} disabled={busy||loading} title={included?'Убрать из плейлиста':'Добавить в плейлист'} onClick={()=>void mutate({action:included?'remove':'add',playlistId:p.id,trackId:track.id})}>{p.title}{included?' ✓':''}</button>;})}
        <Link href="/playlists" onClick={onNavigate}>Создать плейлист</Link>
        {error&&<span role="alert">{error}</span>}
      </>}
    </span>}
  </span>;
}
