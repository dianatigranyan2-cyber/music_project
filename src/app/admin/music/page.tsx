'use client';
import {useEffect,useState,useRef} from 'react';
import Link from 'next/link';
import {useAuth} from '../../../context/AuthContext';
import {useMusicLibrary} from '../../../hooks/useMusicLibrary';
import {CATALOG_LICENSES} from '../../../lib/catalogAdmin';
import {AudiusAdminPanel} from '../../../components/Music/AudiusAdminPanel';
import styles from './page.module.css';
type CatalogTrack={id:string;provider:'storage'|'audius';external_id:string|null;title:string;genre:string;is_published:boolean;source_url:string;attribution:string;license_code:string;music_artists:{name:string};music_albums:{title:string}|null};
const empty={id:null as string|null,provider:'storage' as 'storage'|'audius',title:'',artist:'',album:'',genre:'Поп',source_url:'',attribution:'',license_code:'CC-BY-4.0',is_published:true};
export default function MusicAdminPage(){
  const {user,loading}=useAuth();const {retry:refreshLibrary}=useMusicLibrary();
  const [tracks,setTracks]=useState<CatalogTrack[]|null>(null);const [denied,setDenied]=useState(false);const [error,setError]=useState('');
  const [adminFor,setAdminFor]=useState<string|null>(null);const [showAudius,setShowAudius]=useState(false);
  const [attempt,setAttempt]=useState(0);const [busy,setBusy]=useState(false);const [editing,setEditing]=useState(false);const [notice,setNotice]=useState('');
  const [form,setForm]=useState(empty);const formRef=useRef<HTMLFormElement>(null);const audioRef=useRef<HTMLInputElement>(null);const coverRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!user)return;const controller=new AbortController();void fetch('/api/music/admin',{signal:controller.signal,cache:'no-store'}).then(async response=>{const data=await response.json();if(response.status===403){setDenied(true);return;}if(!response.ok)throw new Error(data.error);if(controller.signal.aborted)return;setTracks(data.tracks);setAdminFor(user.id);setDenied(false);setError('');}).catch(error=>{if(!controller.signal.aborted)setError(error.message);});return()=>controller.abort();},[user,attempt]);
  useEffect(()=>{if(editing)formRef.current?.scrollIntoView({block:'start',behavior:'smooth'});},[editing,form.id]);
  async function save(event:React.FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
    try{
      if(form.provider==='audius'){
        const response=await fetch('/api/music/admin/audius',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:form.id,title:form.title,artist:form.artist,album:form.album,genre:form.genre,isPublished:form.is_published}),signal:AbortSignal.timeout(30000)});
        const value=await response.json();if(!response.ok)throw new Error(value.error);
        setEditing(false);setForm(empty);setAttempt(n=>n+1);refreshLibrary();setNotice(form.is_published?'Трек сохранён и опубликован.':'Трек сохранён и скрыт.');return;
      }
      const body=new FormData();body.set('metadata',JSON.stringify(form));
      const audio=audioRef.current?.files?.[0];const cover=coverRef.current?.files?.[0];
      if(!form.id){
        if(!audio||audio.size>52428800)throw new Error('Выберите MP3 или M4A до 50 МБ.');
        const duration=await new Promise<number>((resolve,reject)=>{const el=new Audio();const url=URL.createObjectURL(audio);const timer=setTimeout(()=>finish(new Error('Не удалось прочитать длительность аудио.')),15000);function finish(error?:Error){clearTimeout(timer);const duration=el.duration;el.removeAttribute('src');el.load();URL.revokeObjectURL(url);if(error)reject(error);else resolve(Math.ceil(duration));}el.onloadedmetadata=()=>finish();el.onerror=()=>finish(new Error('Этот аудиофайл не воспроизводится.'));el.src=url;});
        body.set('audio',audio);body.set('duration',String(duration));
      }
      if(cover)body.set('cover',cover);
      const response=await fetch('/api/music/admin',{method:'POST',body,signal:AbortSignal.timeout(120000)});const value=await response.json();if(!response.ok)throw new Error(value.error);
      setEditing(false);setForm(empty);setAttempt(n=>n+1);refreshLibrary();setNotice(form.is_published?'Трек сохранён и опубликован.':'Трек снят с публикации.');
    }catch(error){setError(error instanceof Error?error.message:'Не удалось сохранить.');}finally{setBusy(false);}
  }
  if(loading)return <p role="status">Проверяем доступ…</p>;
  if(!user)return <p>Войдите в аккаунт администратора. <Link href="/login">Войти</Link></p>;
  if(denied)return <p>Доступ к управлению музыкой для этого аккаунта закрыт.</p>;
  return <section className={styles.page}><header className={styles.header}><div><h1>Управление музыкой</h1><p className={styles.hint}>Треки, исполнители, альбомы и обложки Melo</p></div><button className={styles.button} disabled={busy||!tracks} onClick={()=>{setForm(empty);setEditing(true);setError('');}}>＋ Загрузить файл</button></header>
    {adminFor===user.id&&<><button type="button" className={styles.button} aria-expanded={showAudius} onClick={()=>setShowAudius(value=>!value)}>{showAudius?'Закрыть поиск Audius':'Добавить из Audius'}</button>{showAudius&&<AudiusAdminPanel key={user.id} onImported={()=>{setAttempt(n=>n+1);refreshLibrary();}}/>}</>}
    {error&&<p role="alert" className={styles.error}>{error} {!tracks&&<button onClick={()=>setAttempt(n=>n+1)}>Повторить</button>}</p>}{notice&&<p role="status">{notice}</p>}
    {editing&&<form ref={formRef} className={styles.form} onSubmit={save}>
      <h2 className={styles.wide}>{form.id?'Редактировать трек':'Новый трек'}</h2>
      {(['title','artist','album','genre','source_url'] as const).filter(key=>form.provider!=='audius'||key!=='source_url').map(key=><label key={key} className={styles.field}>{{title:'Название песни',artist:'Исполнитель',album:'Альбом (необязательно)',genre:'Жанр',source_url:'Ссылка на источник и разрешение'}[key]}<input type={key==='source_url'?'url':'text'} required={key!=='album'} maxLength={key==='source_url'?2000:key==='genre'?100:200} value={form[key]} disabled={busy} onChange={event=>setForm({...form,[key]:event.target.value})}/></label>)}
      {form.provider==='storage'&&<>
      <label className={styles.field}>Лицензия<select value={form.license_code} disabled={busy} onChange={event=>setForm({...form,license_code:event.target.value})}>{Object.keys(CATALOG_LICENSES).map(code=><option key={code}>{code}</option>)}</select></label>
      <label className={`${styles.field} ${styles.wide}`}>Указание автора и условий лицензии<textarea minLength={21} maxLength={3000} required rows={3} value={form.attribution} disabled={busy} onChange={event=>setForm({...form,attribution:event.target.value})}/></label>
      {!form.id&&<label className={styles.field}>Аудиофайл MP3 / M4A, до 50 МБ<input ref={audioRef} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a" required disabled={busy}/></label>}
      <label className={styles.field}>Обложка JPG / PNG / WebP, до 5 МБ<input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}/></label>
      <p className={`${styles.hint} ${styles.wide}`}>Добавляйте музыку с разрешением на размещение. Условия и авторы будут доступны в информации о треке. Файлы каталога хранятся в открытом хранилище.</p>
      </>}
      {form.provider==='audius'&&<p className={`${styles.hint} ${styles.wide}`}>Источник: Audius. Аудиофайл загружать не нужно. Авторы и условия указаны в информации о треке; при публикации доступность проверяется заново.</p>}
      <label className={`${styles.check} ${styles.wide}`}><input type="checkbox" checked={form.is_published} disabled={busy} onChange={event=>setForm({...form,is_published:event.target.checked})}/>Показывать трек в каталоге</label>
      <div className={`${styles.actions} ${styles.wide}`}><button className={styles.button} disabled={busy}>{busy?'Сохраняем…':'Сохранить'}</button><button type="button" className={styles.button} disabled={busy} onClick={()=>setEditing(false)}>Отмена</button></div>
    </form>}
    {!tracks&&!error?<p role="status">Загружаем каталог…</p>:tracks?.map(track=><article key={track.id} className={styles.row}><div><strong>{track.title}</strong><p>{track.music_artists.name} · {track.music_albums?.title||'Сингл'} · {track.is_published?'Опубликован':'Скрыт'} · {track.provider==='audius'?'Audius':'Файл Melo'}</p></div><button className={styles.button} disabled={busy} onClick={()=>{setForm({id:track.id,provider:track.provider||'storage',title:track.title,artist:track.music_artists.name,album:track.music_albums?.title||'',genre:track.genre,source_url:track.source_url,attribution:track.attribution,license_code:track.license_code,is_published:track.is_published});setEditing(true);setError('');}}>Изменить</button></article>)}
  </section>;
}
