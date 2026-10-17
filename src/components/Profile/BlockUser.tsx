'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useBlocking} from '../../context/BlockingContext';
import styles from './BlockUser.module.css';
export function BlockUser({id,name,placement='inline'}:{id:string;name:string;placement?:'inline'|'menu'}){
  const {user}=useAuth();const {data,ready,busy,error,setBlocked}=useBlocking();const [confirm,setConfirm]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
  useEffect(()=>{if(!confirm)return;const current=dialog.current;current?.showModal();return()=>current?.close();},[confirm]);
  if(!user||user.id===id)return null;
  const blocked=!!data?.outgoing.some(peer=>peer.id===id);
  return <div className={`${styles.control} ${placement==='menu'?styles.menuControl:''}`}><button type="button" className={placement==='menu'?styles.menuButton:styles.button} disabled={!ready||busy} onClick={()=>blocked?void setBlocked(id,false):setConfirm(true)}>{blocked?'Разблокировать':'Заблокировать'}</button>
    {confirm&&<dialog ref={dialog} className={styles.confirm} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!busy)setConfirm(false);}}><h2 id={titleId}>Заблокировать {name}?</h2><p>Пользователь будет удалён из друзей и не сможет писать вам или слушать вместе. История сообщений сохранится.</p><div className={styles.confirmActions}><button type="button" className={styles.button} disabled={busy} onClick={async()=>{if(await setBlocked(id,true))setConfirm(false);}}>Да, заблокировать</button><button type="button" className={styles.button} disabled={busy} onClick={()=>setConfirm(false)}>Отмена</button></div>{error&&<p role="alert">{error}</p>}</dialog>}
    {error&&<span role="alert">{error}</span>}
  </div>;
}
export function BlockedUsers(){const {data,ready,busy,error,setBlocked,refresh}=useBlocking();return <section className={styles.list}><h2>Заблокированные пользователи</h2>{error&&<p role="alert">{error} <button type="button" onClick={refresh}>Повторить</button></p>}{!ready?<p>Загружаем…</p>:!data?.outgoing.length?<p>Вы никого не заблокировали.</p>:data.outgoing.map(peer=><div key={peer.id} className={styles.peer}><span>{peer.displayName||peer.username} <small>@{peer.username}</small></span><button type="button" className={styles.button} disabled={busy} onClick={()=>void setBlocked(peer.id,false)}>Разблокировать</button></div>)}</section>;}
