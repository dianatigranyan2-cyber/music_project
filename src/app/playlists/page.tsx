'use client';
import { AppIcon } from '../../components/Icons/AppIcon';
import {useState} from 'react';
import Link from 'next/link';
import {usePersonalMusic} from '../../context/PersonalMusicContext';
import {useMusicLibrary} from '../../hooks/useMusicLibrary';
import {usePlayer} from '../../context/PlayerContext';
import {MusicTracks} from '../../components/Music/MusicLists';
import {PlaylistDialog} from '../../components/Music/PlaylistDialog';
import {PlaylistCover} from '../../components/Music/PlaylistCover';
import {SaveMusicButton} from '../../components/Music/SaveMusicButton';
import {filterMusic} from '../../lib/musicLibrary';
import {SortablePlaylistTracks} from '../../components/Music/SortablePlaylistTracks';
import {PlaylistOptions} from '../../components/Music/PlaylistOptions';
import type {Track} from '../../types';
import styles from './page.module.css';

export default function PlaylistsPage(){
  const {data,signedIn,loading,busy,error,mutate,refresh}=usePersonalMusic();
  const {library,error:catalogError,retry}=useMusicLibrary();
  const {playTrack}=usePlayer();
  const [tab,setTab]=useState<'my'|'favorites'|'recent'|'artists'|'albums'>('my');
  const [copyStatus,setCopyStatus]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [form,setForm]=useState<{id:string;title:string;description:string;edit:boolean}|null>(null);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [query,setQuery]=useState('');
  const playlist=data?.playlists.find(p=>p.id===selected);
  const tracksById=new Map(library?.tracks.map(t=>[t.id,t]));
  const resolve=(ids:string[])=>ids.map(id=>tracksById.get(id)).filter((t):t is Track=>!!t);
  const favorites=resolve(data?.favoriteIds??[]);
  const tracks=resolve(playlist?.trackIds??[]);
  return <div className={styles.container}>
    {!playlist&&<header className={styles.headerTitleRow}><div><h1 className={styles.title}>Моя музыка</h1><p className={styles.subtitle}>Любимые песни и личные подборки.</p></div>
      {signedIn&&<button className={styles.createBtn} disabled={loading||busy} onClick={()=>setForm({id:crypto.randomUUID(),title:'',description:'',edit:false})}>+ Создать плейлист</button>}
    </header>}
    {!signedIn&&!loading?<p>Войдите, чтобы сохранять любимые песни и создавать плейлисты. <Link href="/login">Войти</Link></p>:<>
      {loading&&<p role="status">Загрузка вашей музыки…</p>}
      {error&&<p role="alert">{error} <button className={styles.cancelBtn} disabled={busy} onClick={refresh}>Повторить</button></p>}
      {catalogError&&<p role="alert">{catalogError} <button className={styles.cancelBtn} onClick={retry}>Загрузить каталог</button></p>}
      {!library&&!catalogError&&<p role="status">Загружаем каталог песен…</p>}
      {!playlist&&<div className={styles.tabsRow}>
        <button className={`${styles.tabBtn} ${tab==='my'?styles.activeTab:''}`} onClick={()=>{setTab('my');setSelected(null);}}>Мои плейлисты ({data?.playlists.length??0})</button>
        <button className={`${styles.tabBtn} ${tab==='favorites'?styles.activeTab:''}`} onClick={()=>{setTab('favorites');setSelected(null);}}>Любимые треки ({data?.favoriteIds.length??0})</button>
        <button className={`${styles.tabBtn} ${tab==='recent'?styles.activeTab:''}`} onClick={()=>{setTab('recent');setSelected(null);}}>Недавно прослушано</button>
        <button className={`${styles.tabBtn} ${tab==='artists'?styles.activeTab:''}`} onClick={()=>{setTab('artists');setSelected(null);}}>Исполнители ({data?.savedArtistIds?.length??0})</button>
        <button className={`${styles.tabBtn} ${tab==='albums'?styles.activeTab:''}`} onClick={()=>{setTab('albums');setSelected(null);}}>Альбомы ({data?.savedAlbumIds?.length??0})</button>
      </div>}
      {tab==='favorites'&&<>{library&&!data?.favoriteIds.length&&<p>Нажмите ♡ у песни, чтобы добавить её сюда.</p>}<MusicTracks tracks={favorites}/>
        {library&&data?.favoriteIds.filter(id=>!tracksById.has(id)).map(id=><p key={id}>Трек больше недоступен. <button className={styles.cancelBtn} disabled={busy} onClick={()=>mutate({action:'favorite',trackId:id,liked:false})}>Убрать из любимых</button></p>)}
      </>}
      {tab==='recent'&&<><h2>Недавно прослушано</h2><p className={styles.subtitle}>Недавно включённые песни.</p>
        {!data?.history?.length&&<p>Включи песню — она появится здесь после начала воспроизведения.</p>}<MusicTracks tracks={resolve(data?.history?.map(h=>h.trackId)??[])}/></>}
      {(tab==='artists'||tab==='albums')&&<div className={styles.grid}>
        {(tab==='artists'?data?.savedArtistIds:data?.savedAlbumIds)?.map(id=>{
          const item=tab==='artists'?library?.artists.find(a=>a.id===id):library?.albums.find(a=>a.id===id);
          const title=item?('name'in item?item.name:item.title):'Больше недоступно';
          return <article key={id} className={styles.card}>{item&&<Link href={`/music/${tab}/${id}`} className={styles.cardTitle}>{title}</Link>}
            <SaveMusicButton id={id} kind={tab==='artists'?'artist':'album'}/></article>;
        })}
        {(tab==='artists'?!data?.savedArtistIds?.length:!data?.savedAlbumIds?.length)&&<p>Открой страницу {tab==='artists'?'исполнителя':'альбома'} и нажми «Сохранить».</p>}
      </div>}
      {tab==='my'&&!playlist&&<div className={styles.grid}>
        {!loading&&data?.playlists.length===0&&<p>Создайте первую подборку и добавьте в неё музыку.</p>}
        {data?.playlists.map(p=><button key={p.id} className={styles.card} onClick={()=>{setSelected(p.id);setQuery('');setConfirmDelete(false);}}>
          <PlaylistCover tracks={resolve(p.trackIds)} src={p.coverUrl} title={p.title}/><span className={styles.cardTitle}>{p.title}</span><span className={styles.cardDesc}>{p.description}</span><span className={styles.trackCount}>Треков: {p.trackIds.length}</span>
        </button>)}
      </div>}
      {tab==='my'&&playlist&&<>
        <div className={styles.playlistHeading}>
          <button className={styles.backBtn} aria-label="Все плейлисты" title="Все плейлисты" onClick={()=>setSelected(null)}>←</button>
          <h1 className={styles.title}>{playlist.title}</h1>
          <PlaylistOptions>
            <button className={styles.cancelBtn} disabled={!tracks.length} onClick={()=>playTrack(tracks[0],tracks)}><AppIcon name="play" size={18}/> Слушать плейлист</button>
            <button className={styles.cancelBtn} disabled={busy} onClick={()=>setForm({id:playlist.id,title:playlist.title,description:playlist.description,edit:true})}>Изменить плейлист</button>
            <button className={styles.cancelBtn} disabled={busy} onClick={()=>setConfirmDelete(true)}>Удалить плейлист</button>
            <div className={styles.shareBox}><strong>{playlist.shared?'Доступ по ссылке включён':'Личный плейлист'}</strong><p className={styles.subtitle}>{playlist.shared?'Любой, у кого есть ссылка, сможет открыть и слушать подборку.':'Подборка доступна только тебе.'}</p>
              <div className={styles.toolbar}><button className={styles.cancelBtn} disabled={busy} onClick={async()=>{setCopyStatus('');await mutate({action:'sharing',playlistId:playlist.id,enabled:!playlist.shared});}}>{playlist.shared?'Закрыть доступ':'Включить доступ по ссылке'}</button>
              {playlist.shared&&playlist.shareToken&&<><Link className={styles.cancelBtn} href={'/music/playlists/'+playlist.shareToken} target="_blank">Открыть ссылку</Link><button className={styles.cancelBtn} onClick={async()=>{const url=new URL('/music/playlists/'+playlist.shareToken,location.origin).href;try{await navigator.clipboard.writeText(url);setCopyStatus('Ссылка скопирована');}catch{setCopyStatus(url);}}}>Скопировать ссылку</button></>}
              </div>{copyStatus&&<p className={styles.copyStatus} role="status">{copyStatus}</p>}
            </div>
          </PlaylistOptions>
        </div>
        {confirmDelete&&<div className={styles.confirmBox} role="alert"><p>Удалить «{playlist.title}»? Сами песни останутся в каталоге.</p><div className={styles.toolbar}><button className={styles.cancelBtn} disabled={busy} onClick={()=>setConfirmDelete(false)}>Отмена</button><button className={styles.submitBtn} disabled={busy} onClick={async()=>{if(await mutate({action:'delete',playlistId:playlist.id})){setSelected(null);setConfirmDelete(false);}}}>Подтвердить удаление</button></div></div>}
        {!playlist.trackIds.length&&<p>В подборке пока нет песен. Добавьте их ниже.</p>}
        {library&&<SortablePlaylistTracks key={playlist.id} trackIds={playlist.trackIds} tracks={tracks} busy={busy} onReorder={trackIds=>mutate({action:'reorder',playlistId:playlist.id,trackIds})}/>}
        <h2>Добавить песни</h2><label htmlFor="playlist-search">Поиск по каталогу</label><input id="playlist-search" className={styles.input} placeholder="Название песни или исполнитель" value={query} onChange={e=>setQuery(e.target.value)}/>
        <div className={styles.addList}>{filterMusic(library?.tracks??[],query).map(t=><div className={styles.addRow} key={t.id}><span>{t.title}<small>{t.artist}</small></span><button className={styles.cancelBtn} disabled={busy||playlist.trackIds.includes(t.id)} onClick={()=>mutate({action:'add',playlistId:playlist.id,trackId:t.id})}>{playlist.trackIds.includes(t.id)?'Добавлено ✓':'Добавить'}</button></div>)}</div>
      </>}
    </>}
    {form&&<PlaylistDialog busy={busy} onClose={()=>setForm(null)}><div className={styles.modal}>
      <h2 id="playlist-form-title">{form.edit?'Изменить плейлист':'Создать плейлист'}</h2>
      <form className={styles.form} onSubmit={async e=>{e.preventDefault();if(await mutate({action:form.edit?'rename':'create',playlistId:form.id,title:form.title.trim(),description:form.description.trim()})){setSelected(form.id);setTab('my');setForm(null);}}}>
        <label className={styles.label} htmlFor="playlist-title">Название</label><input autoFocus id="playlist-title" className={styles.input} required maxLength={100} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
        <label className={styles.label} htmlFor="playlist-description">Описание</label><textarea id="playlist-description" className={styles.textarea} maxLength={500} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        {error&&<p role="alert">{error}</p>}<div className={styles.modalActions}><button type="button" className={styles.cancelBtn} disabled={busy} onClick={()=>setForm(null)}>Отмена</button><button className={styles.submitBtn} disabled={busy||!form.title.trim()}>{busy?'Сохранение…':'Сохранить'}</button></div>
      </form>
    </div></PlaylistDialog>}
  </div>;
}
