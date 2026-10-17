'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useMusicLibrary} from '../../hooks/useMusicLibrary';
import {usePersonalMusic} from '../../context/PersonalMusicContext';
import {filterMusic} from '../../lib/musicLibrary';
import {musicMessageContent} from '../../lib/musicMessages';
import styles from './MusicMessageCard.module.css';
export function MusicMessagePicker({busy,onSend,onClose}:{busy:boolean;onSend:(content:string)=>Promise<boolean>;onClose:()=>void}){
  const {library,error,retry}=useMusicLibrary();const {data,loading,error:personalError}=usePersonalMusic();const [query,setQuery]=useState('');const [tab,setTab]=useState<'track'|'playlist'>('track');
  const tracks=filterMusic(library?.tracks??[],query);
  return <section className={styles.picker} aria-label="Отправить музыку"><div className={styles.heading}><strong>Музыка в сообщении</strong><button type="button" className={styles.button} disabled={busy} onClick={onClose} aria-label="Закрыть выбор музыки">✕</button></div>
    <div className={styles.tabs}><button type="button" className={styles.button} aria-pressed={tab==='track'} onClick={()=>setTab('track')}>Трек</button><button type="button" className={styles.button} aria-pressed={tab==='playlist'} onClick={()=>setTab('playlist')}>Плейлист</button></div>
    {tab==='track'?<>{error?<p>{error} <button type="button" onClick={retry}>Повторить</button></p>:!library?<p>Загружаем песни…</p>:<><input className={styles.search} aria-label="Найти музыку для сообщения" placeholder="Название или исполнитель" value={query} onChange={event=>setQuery(event.target.value)}/>{!tracks.length&&<p>Ничего не найдено.</p>}{tracks.map(track=><div className={styles.item} key={track.id}><span>{track.title}<small>{track.artist}</small></span><button type="button" className={styles.button} disabled={busy} aria-label={'Отправить трек: '+track.title} onClick={async()=>{if(await onSend(musicMessageContent({kind:'track',id:track.id})))onClose();}}>Отправить</button></div>)}</>}</>:<>
      <p className={styles.hint}>Можно отправить плейлисты с включённым доступом по ссылке. <Link href="/playlists">Настроить доступ</Link></p>
      {personalError&&<p>{personalError}</p>}{loading?<p>Загружаем плейлисты…</p>:!data?.playlists.some(p=>p.shared)?<p>Плейлистов с доступом по ссылке пока нет.</p>:data.playlists.filter(p=>p.shared&&p.shareToken).map(playlist=><div className={styles.item} key={playlist.id}><span>{playlist.title}<small>Плейлист</small></span><button type="button" className={styles.button} disabled={busy} aria-label={'Отправить плейлист: '+playlist.title} onClick={async()=>{if(await onSend(musicMessageContent({kind:'playlist',id:playlist.shareToken!})))onClose();}}>Отправить</button></div>)}
    </>}
  </section>;
}
